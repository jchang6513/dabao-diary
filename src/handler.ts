import * as line from '@line/bot-sdk';
import { readSheet, appendSheet } from './sheets';
import { parseMessageWithGemini, ParsedMessage } from './gemini';

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const client = new line.Client(config);

// In-memory store for pending confirmations.
// In a real-world scenario, you might want to use a more persistent store like Redis.
const pendingConfirmations = new Map<string, ParsedMessage>();

// event handler
export async function handleEvent(event: line.WebhookEvent): Promise<any> {
  if (event.type !== 'message' || event.message.type !== 'text' || !event.source.userId) {
    // ignore non-text-message event or event without a userId
    return Promise.resolve(null);
  }

  const userId = event.source.userId;
  const userMessage = event.message.text.toLowerCase();

  // Step 1: Check if the user is confirming a pending action.
  if (userMessage === 'yes') {
    const pendingData = pendingConfirmations.get(userId);
    if (pendingData) {
      pendingConfirmations.delete(userId); // Clear the pending state
      let replyText = '';

      try {
        switch (pendingData.intent) {
          case 'add_diary':
            await appendSheet('Diary!A:D', [
              [pendingData.petName, pendingData.action, pendingData.description, new Date().toISOString()],
            ]);
            replyText = 'OK, I have saved the diary entry.';
            break;
          case 'add_pet':
            await appendSheet('Pets!A:A', [[pendingData.petName]]);
            replyText = `OK, I have added "${pendingData.petName}" to the list of pets.`;
            break;

          // In the future, we can add 'add_action' here.
          
          default:
            replyText = 'Sorry, I forgot what I was asking. Please try again.';
            break;
        }
        return client.replyMessage(event.replyToken, { type: 'text', text: replyText });
      } catch (error) {
        console.error('Error writing to Google Sheet:', error);
        return client.replyMessage(event.replyToken, { type: 'text', text: 'Sorry, I failed to save the data.' });
      }
    }
  }

  // If the user says "no" or anything else that's not a "yes" to a pending action,
  // clear the pending state for that user.
  if (pendingConfirmations.has(userId)) {
    pendingConfirmations.delete(userId);
  }

  // Step 2: If it's not a confirmation, process the new message.
  try {
    // Fetch pets and actions from Google Sheets
    const petsData = await readSheet('Pets!A:A');
    const pets = petsData ? petsData.flat().filter(Boolean) : [];

    const actionsData = await readSheet('Actions!A:A');
    const actions = actionsData ? actionsData.flat().filter(Boolean) : [];

    // Parse message with Gemini
    const parsedData = await parseMessageWithGemini(userMessage, pets, actions);
    
    // Step 3: Ask for confirmation instead of writing directly.
    let confirmationText = '';
    if (parsedData.intent === 'add_diary' && parsedData.petName && parsedData.description) {
      confirmationText = `I understood: Log a diary entry for "${parsedData.petName}" - "${parsedData.description}". Is this correct? (Reply 'yes' to save)`;
      pendingConfirmations.set(userId, parsedData);
    } else if (parsedData.intent === 'add_pet' && parsedData.petName) {
      confirmationText = `Should I add a new pet named "${parsedData.petName}"? (Reply 'yes' to add)`;
      pendingConfirmations.set(userId, parsedData);
    } else {
      // If Gemini couldn't understand, just echo back or ask for clarification.
      confirmationText = "Sorry, I didn't quite understand that. Can you please rephrase?";
    }

    return client.replyMessage(event.replyToken, { type: 'text', text: confirmationText });

  } catch (error) {
    console.error('Error handling event:', error);
    const errorMessage: line.TextMessage = {
      type: 'text',
      text: 'An error occurred while processing your request. Please try again later.',
    };
    return client.replyMessage(event.replyToken, errorMessage);
  }
}

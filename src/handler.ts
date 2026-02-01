import * as line from '@line/bot-sdk';
import { readSheet, appendSheet } from './sheets';
import { parseMessageWithGemini } from './gemini'; // Will implement this next

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const client = new line.Client(config);

// event handler
export async function handleEvent(event: line.WebhookEvent): Promise<any> {
  if (event.type !== 'message' || event.message.type !== 'text') {
    // ignore non-text-message event
    return Promise.resolve(null);
  }

  const userMessage = event.message.text;

  try {
    // Fetch pets and actions from Google Sheets
    const petsData = await readSheet('Pets!A:A');
    const pets = petsData ? petsData.flat().filter(Boolean) : [];

    const actionsData = await readSheet('Actions!A:A');
    const actions = actionsData ? actionsData.flat().filter(Boolean) : [];

    // Parse message with Gemini (placeholder for now)
    // This function will eventually return { petName, action, description, time }
    const parsedData = await parseMessageWithGemini(userMessage, pets, actions);

    // Prepare data for Google Sheet
    const now = new Date().toISOString();
    const diaryEntry = [
      parsedData.petName || 'N/A',
      parsedData.action || 'N/A',
      parsedData.description || userMessage, // Fallback to original message if description is not parsed
      now,
    ];

    await appendSheet('Diary!A:D', [diaryEntry]);

    const replyMessage: line.TextMessage = {
      type: 'text',
      text: `Received: "${userMessage}"\nParsed and recorded: Pet: ${parsedData.petName}, Action: ${parsedData.action}, Desc: ${parsedData.description}`,
    };

    return client.replyMessage(event.replyToken, replyMessage);

  } catch (error) {
    console.error('Error handling event:', error);
    const errorMessage: line.TextMessage = {
      type: 'text',
      text: 'An error occurred while processing your request. Please try again later.',
    };
    return client.replyMessage(event.replyToken, errorMessage);
  }
}

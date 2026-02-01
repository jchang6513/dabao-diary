import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ParsedMessage {
  intent: 'add_diary' | 'add_pet' | 'unknown';
  petName: string | null;
  action: string | null;
  description: string | null;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set in environment variables.');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

export async function parseMessageWithGemini(
  message: string,
  pets: string[],
  actions: string[]
): Promise<ParsedMessage> {
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY is missing. Returning placeholder data.');
    return {
      intent: 'unknown',
      petName: null,
      action: null,
      description: message,
    };
  }

  const petList = pets.length > 0 ? pets.join(', ') : 'no pets defined yet';
  const actionList = actions.length > 0 ? actions.join(', ') : 'no actions defined yet';

  const prompt = `
  You are an AI assistant for a pet diary. Your task is to parse a user's message and determine their intent.

  Here's the user's message: "${message}"

  Here are the known pet names: [${petList}]
  Here are the known action categories: [${actionList}]

  First, determine the user's intent. The intent can be one of three things:
  1.  'add_diary': The user is describing an event or action for a known pet. (e.g., "大寶剛剛拉屎", "開罐罐給肉包吃"). This should be the most common intent.
  2.  'add_pet': The user is introducing a new pet. (e.g., "I have a new cat call daobao", "Add 大寶").
  3.  'unknown': The intent is not clear.

  Based on the intent, extract the following information and return it as a JSON object.
  - "intent": The intent you determined ('add_diary', 'add_pet', 'unknown').
  - "petName": For 'add_diary', the name of the pet from the known pet list. For 'add_pet', the name of the new pet.
  - "action": For 'add_diary', categorize the action. If it doesn't fit, return null. For other intents, this should be null.
  - "description": For 'add_diary', a concise summary of the event. For other intents, this should be null.

  Examples:
  - Message: "大寶剛剛拉屎" -> {"intent": "add_diary", "petName": "大寶", "action": "poop", "description": "剛剛拉屎"}
  - Message: "Add a new cat, 小雞" -> {"intent": "add_pet", "petName": "小雞", "action": null, "description": null}
  - Message: "hi" -> {"intent": "unknown", "petName": null, "action": null, "description": null}
  
  The output should ONLY be a valid JSON object.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    console.log('Gemini raw response:', text);

    // Clean the text to make sure it's valid JSON
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedText);

    // Validate and return
    return {
      intent: parsed.intent || 'unknown',
      petName: parsed.petName || null,
      action: parsed.action || null,
      description: parsed.description || (parsed.intent === 'unknown' ? message : null),
    };
  } catch (error) {
    console.error('Error calling Gemini API or parsing response:', error);
    // Fallback to basic parsing if Gemini fails
    return {
      intent: 'unknown',
      petName: null,
      action: null,
      description: message,
    };
  }
}

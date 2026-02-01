import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ParsedMessage {
  intent: 'add_diary' | 'add_pet' | 'query_diary' | 'unknown';
  petName: string | null;
  action: string | null;
  description: string | null;
  queryPetName: string | null;
  queryAction: string | null;
  queryDate: string | null;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set in environment variables.');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

export async function parseMessageWithGemini(
  message: string,
  pets: string[],
  actions: string[]
): Promise<ParsedMessage> {
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY is missing. Returning placeholder data.');
    return {
      intent: 'unknown',
      petName: null, action: null, description: message,
      queryPetName: null, queryAction: null, queryDate: null,
    };
  }

  const petList = pets.length > 0 ? pets.join(', ') : 'no pets defined yet';
  const actionList = actions.length > 0 ? actions.join(', ') : 'no actions defined yet';
  const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

  const prompt = `
  You are an AI assistant for a pet diary. Your task is to parse a user's message and determine their intent.

  Here's the user's message: "${message}"

  Here are the known pet names: [${petList}]
  Here are the known action categories: [${actionList}]
  Today's date is ${today}.

  First, determine the user's intent. The intent can be one of four things:
  1. 'add_diary': The user is describing an event for a pet. (e.g., "大寶剛剛拉屎", "開罐罐給肉包吃"). This is the most common intent.
  2. 'add_pet': The user is introducing a new pet. (e.g., "Add a new cat, 小雞").
  3. 'query_diary': The user is asking to see diary entries. (e.g., "大寶的日記", "今天做了什麼", "肉包什麼時候去看醫生").
  4. 'unknown': The intent is not clear or is a simple greeting.

  Based on the intent, extract the following information and return it as a valid JSON object.
  
  - "intent": The intent you determined.
  
  - For 'add_diary':
    - "petName": The name of the pet from the known pet list.
    - "action": Categorize the action.
    - "description": A concise summary of the event.
  
  - For 'add_pet':
    - "petName": The name of the new pet.
  
  - For 'query_diary':
    - "queryPetName": The pet name to filter by, if mentioned.
    - "queryAction": The action to filter by, if mentioned.
    - "queryDate": The date to filter by, in YYYY-MM-DD format. If relative dates like '今天' (today) or '昨天' (yesterday) are used, convert them.
  
  Set any unused fields for a given intent to null.

  Examples:
  - Message: "大寶剛剛拉屎" -> {"intent": "add_diary", "petName": "大寶", "action": "poop", "description": "剛剛拉屎", "queryPetName": null, "queryAction": null, "queryDate": null}
  - Message: "Add a new cat, 小雞" -> {"intent": "add_pet", "petName": "小雞", "action": null, "description": null, "queryPetName": null, "queryAction": null, "queryDate": null}
  - Message: "大寶的日記" -> {"intent": "query_diary", "petName": null, "action": null, "description": null, "queryPetName": "大寶", "queryAction": null, "queryDate": null}
  - Message: "今天做了什麼" -> {"intent": "query_diary", "petName": null, "action": null, "description": null, "queryPetName": null, "queryAction": null, "queryDate": "${today}"}
  - Message: "hi" -> {"intent": "unknown", "petName": null, "action": null, "description": null, "queryPetName": null, "queryAction": null, "queryDate": null}
  
  The output should ONLY be a valid JSON object.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    console.log('Gemini raw response:', text);

    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedText);

    return {
      intent: parsed.intent || 'unknown',
      petName: parsed.petName || null,
      action: parsed.action || null,
      description: parsed.description || (parsed.intent === 'unknown' ? message : null),
      queryPetName: parsed.queryPetName || null,
      queryAction: parsed.queryAction || null,
      queryDate: parsed.queryDate || null,
    };
  } catch (error) {
    console.error('Error calling Gemini API or parsing response:', error);
    return {
      intent: 'unknown',
      petName: null, action: null, description: message,
      queryPetName: null, queryAction: null, queryDate: null,
    };
  }
}

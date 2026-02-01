import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ParsedMessage {
  petName: string | null;
  action: string | null;
  description: string | null;
  time: string | null;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set in environment variables.');
  // In a real application, you might want to handle this more gracefully,
  // perhaps by throwing an error that gets caught higher up.
  // For now, we'll exit or ensure a default behavior.
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
      petName: null,
      action: null,
      description: message,
      time: new Date().toISOString(),
    };
  }

  const petList = pets.length > 0 ? pets.join(', ') : 'no pets defined yet';
  const actionList = actions.length > 0 ? actions.join(', ') : 'no actions defined yet';

  const prompt = `
  You are an AI assistant that helps manage a pet diary. Your task is to parse a user's message about their pets and extract structured information.

  Here's the user's message: "${message}"

  Here are the known pet names: [${petList}]
  Here are the known action categories (e.g., eat, play, sleep, vet, poop): [${actionList}]

  Please extract the following information from the message and return it as a JSON object.
  - "petName": The name of the pet mentioned in the message. If multiple pets are mentioned, pick the most relevant one. If no pet name is clearly identified from the known list, return null. If the message indicates adding a *new* pet, identify it, but prioritize known pets for actions.
  - "action": The action performed by the pet. Try to categorize it into one of the known action categories. If no specific action is mentioned or it doesn't fit a known category, return null.
  - "description": A more detailed description of the event, including any additional context (e.g., "拉屎" or "開罐罐"). This should be a concise summary of the event.
  - "time": The time of the event in ISO 8601 format. If no specific time is mentioned, use the current time.

  If the message seems to be adding a new pet name, please try to identify the new pet's name for petName.

  The output should ONLY be a JSON object, like this:
  {
    "petName": "大寶",
    "action": "看醫生",
    "description": "今天去看醫生",
    "time": "2026-02-01T12:30:00.000Z"
  }

  Ensure the JSON is perfectly valid and can be directly parsed.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    console.log('Gemini raw response:', text);

    // Attempt to parse the text as JSON
    const parsed = JSON.parse(text);

    // Validate and return
    return {
      petName: parsed.petName || null,
      action: parsed.action || null,
      description: parsed.description || message,
      time: parsed.time || new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error calling Gemini API or parsing response:', error);
    // Fallback to basic parsing if Gemini fails
    return {
      petName: null,
      action: null,
      description: message,
      time: new Date().toISOString(),
    };
  }
}

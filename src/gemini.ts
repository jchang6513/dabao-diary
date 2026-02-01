import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ParsedMessage {
  intent: 'add_diary' | 'add_pet' | 'query' | 'edit' | 'unknown';
  petName: string | null;
  petType: string | null;
  action: string | null;
  description: string | null;
  time: string | null;
  // For 'edit' intent
  editTarget: 'pet' | 'diary' | null;
  newPetName?: string | null;
  newPetType?: string | null;
  newAction?: string | null;
  newDescription?: string | null;
  newTime?: string | null;
  // For 'query' intent
  queryTarget: 'pet' | 'action' | 'diary' | null;
  queryFilters: {
    petName?: string | null;
    actionName?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  } | null;
  clarificationPrompt: string | null;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-pro';

if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set in environment variables.');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

export async function parseMessageWithGemini(
  message: string,
  pets: string[],
  actions: string[]
): Promise<ParsedMessage> {
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY is missing. Returning placeholder data.');
    return {
      intent: 'unknown',
      petName: null, petType: null, action: null, description: message, time: null,
      editTarget: null,
      queryTarget: null, queryFilters: null, clarificationPrompt: null,
    };
  }

  const petList = pets.length > 0 ? pets.join(',') : '無';
  const actionList = actions.length > 0 ? actions.join(',') : '無';
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().substring(0, 5);

  const prompt = `
你視為寵物日記助手，負責分析訊息並回傳 JSON。
現況：日期 ${today}，時間 ${currentTime}，寵物 [${petList}]，動作 [${actionList}]。

意圖與 JSON 欄位：
- 'add_diary': {intent, petName, action, description, time}
- 'add_pet': {intent, petName, petType}
- 'query': {intent, queryTarget, queryFilters: {petName, actionName, startDate, endDate}}
- 'edit': {intent, editTarget('pet'|'diary'), petName, time, newPetName, newPetType, newAction, newDescription, newTime}
- 'unknown': {intent, clarificationPrompt}

規則：
1. 僅回傳 JSON。
2. 語系：正體中文。
3. 'edit' 若未指名時間，視為修改「最近一筆」。
4. 時間格式：YYYY-MM-DD HH:mm。
5. 若為 'unknown'，"clarificationPrompt" 必須包含像這樣的引導範例：
   「我暫時還沒理解您的意思，您可以試著這樣說說看：
   🐾 記錄內容：『大寶 12:00 吃飯』
   🔍 查詢紀錄：『大寶今天做了什麼？』
   ...」

範例：
- 「大寶12:00在睡覺」-> {"intent":"add_diary","petName":"大寶","action":"睡覺","time":"${today} 12:00"}
- 「修改大寶剛才的時間為13:00」-> {"intent":"edit","editTarget":"diary","petName":"大寶","newTime":"${today} 13:00"}
- 「大寶今天做了什麼」-> {"intent":"query","queryTarget":"diary","queryFilters":{"petName":"大寶","startDate":"${today}"}}

訊息：「${message}」
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
      petType: parsed.petType || null,
      action: parsed.action || null,
      description: parsed.description || null,
      time: parsed.time || null,
      editTarget: parsed.editTarget || null,
      newPetName: parsed.newPetName || null,
      newPetType: parsed.newPetType || null,
      newAction: parsed.newAction || null,
      newDescription: parsed.newDescription || null,
      newTime: parsed.newTime || null,
      queryTarget: parsed.queryTarget || null,
      queryFilters: parsed.queryFilters || null,
      clarificationPrompt: parsed.clarificationPrompt || null,
    };
  } catch (error) {
    console.error('Error calling Gemini API or parsing response:', error);
    return {
      intent: 'unknown',
      petName: null, petType: null, action: null, description: message, time: null,
      editTarget: null,
      queryTarget: null, queryFilters: null, clarificationPrompt: "抱歉，我這裡有點問題，請稍後再試一次。",
    };
  }
}
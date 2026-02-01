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

  const petList = pets.length > 0 ? pets.join(', ') : '尚未定義寵物';
  const actionList = actions.length > 0 ? actions.join(', ') : '尚未定義動作';
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

  const prompt = `
  你是一個寵物日記助手。請分析使用者的訊息並判斷其意圖。
  所有的回應都必須使用正體中文。

  使用者的訊息：「${message}」
  已知的寵物：[${petList}]
  已知的動作：[${actionList}]
  今天是 ${today}，現在時間是 ${currentTime}。

  意圖分類：
  1. 'add_diary': 記錄寵物事件。
  2. 'add_pet': 新增寵物。
  3. 'query': 查詢資訊。
  4. 'edit': 編輯現有資訊 (如：「將小雞的種類改為蛇」、「把大寶剛才的描述改為好乖」)。
  5. 'unknown': 不明或問候。

  請根據意圖提取資訊並回傳 JSON 格式：

  - "intent": 意圖。
  - "petName": 寵物名稱。
  - "petType": 寵物種類。
  - "action": 動作類型。
  - "description": 詳細描述。
  - "time": 時間。
  - "editTarget": 編輯對象 ('pet', 'diary')。
  - "newPetName", "newPetType", "newAction", "newDescription", "newTime": 編輯後的新值。
  - "queryTarget": 查詢對象。
  - "queryFilters": 查詢過濾條件。
  - "clarificationPrompt": 引導詢問。

  範例：
  - 「修改小雞的種類為蛇」 -> {"intent": "edit", "editTarget": "pet", "petName": "小雞", "newPetType": "蛇"}
  - 「將大寶下午三點的動作改為吃飯」 -> {"intent": "edit", "editTarget": "diary", "petName": "大寶", "time": "${today} 15:00", "newAction": "吃飯"}

  注意：
  - 如果是編輯日記但沒指定時間，通常指「最近的一筆」。
  - 請只回傳 JSON 物件。
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
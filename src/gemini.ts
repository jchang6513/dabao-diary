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
  1. 'add_diary': 記錄寵物事件 (例如：「大寶三點在睡覺」)。
  2. 'add_pet': 新增寵物。
  3. 'query': 查詢資訊 (例如：「大寶今天做了什麼」)。
  4. 'edit': 修改「已存在」的資訊。這包含：
     - 修改寵物資訊 (例如：「把小雞的種類改成貓」)。
     - 修改日記內容 (例如：「把大寶剛才的時間改成 12:00」、「大寶剛才的動作應該是吃飯不是睡覺」、「把剛才那筆的描述改為好乖」)。
  5. 'unknown': 不明或問候。

  對於 'edit' 意圖：
  - 如果使用者提到「剛才」、「最後一筆」，請將 "petName" 設為該寵物的名字（如果訊息中有提到），且不需指定 "time"。
  - 如果訊息中包含新的時間、動作或描述，請分別填入 "newTime", "newAction", "newDescription"。
  - 如果要修改寵物名字，請填入 "newPetName"。

  請根據意圖提取資訊並回傳 JSON 格式：

  - "intent": 意圖。
  - "petName": 寵物名稱 (修改日記時指目標寵物)。
  - "petType": 寵物種類 (新增寵物時使用)。
  - "action": 原本的動作 (若有提到)。
  - "description": 原本的描述 (若有提到)。
  - "time": 原本的時間 (若有提到，用來定位日記)。
  - "editTarget": 編輯對象 ('pet' 或 'diary')。
  - "newPetName": 新的寵物名稱。
  - "newPetType": 新的寵物種類。
  - "newAction": 新的動作。
  - "newDescription": 新的描述。
  - "newTime": 新的時間 (格式 YYYY-MM-DD HH:mm，若只有時間則補上今日日期)。
  - "queryTarget": 查詢對象。
  - "queryFilters": 查詢過濾條件。
  - "clarificationPrompt": 如果資訊不足以判斷意圖，請在此提供親切的引導詢問。

  範例：
  - 「把大寶剛才的時間改為 12:00」 -> {"intent": "edit", "editTarget": "diary", "petName": "大寶", "newTime": "${today} 12:00"}
  - 「大寶剛才不是睡覺是在吃飯」 -> {"intent": "edit", "editTarget": "diary", "petName": "大寶", "newAction": "吃飯"}
  - 「修改剛剛那筆描述為超級可愛」 -> {"intent": "edit", "editTarget": "diary", "newDescription": "超級可愛"}

  請只回傳 JSON 物件。
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
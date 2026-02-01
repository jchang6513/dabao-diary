import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ParsedMessage {
  intent: 'add_diary' | 'add_pet' | 'query' | 'unknown';
  petName: string | null;
  petType: string | null; // For 'add_pet'
  action: string | null;
  description: string | null;
  time: string | null;
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
  1. 'add_diary': 記錄寵物事件 (如：「大寶剛剛拉屎」、「三點給肉包吃罐罐」)。
  2. 'add_pet': 新增寵物 (如：「新養了一隻貓叫小雞」、「新增狗狗大福」)。
  3. 'query': 查詢資訊 (如：「大寶的日記」、「最近有什麼動作」、「列出所有寵物」、「昨天肉包吃了什麼」)。
  4. 'unknown': 不明或問候。

  請根據意圖提取資訊並回傳 JSON 格式：

  - "intent": 意圖。
  - "petName": 寵物名稱。
  - "petType": 寵物種類 (僅用於 add_pet，如：貓、狗、蛇)。
  - "action": 動作類型 (如：進食、排泄、睡覺)。
  - "description": 詳細描述。
  - "time": 事件發生的時間或日期時間 (ISO 8601 格式或 YYYY-MM-DD HH:mm)。
  - "queryTarget": 查詢對象 ('pet', 'action', 'diary')。
  - "queryFilters": 查詢過濾條件 (包含 petName, actionName, startDate, endDate)。
  - "clarificationPrompt": 當意圖為 unknown 時，產生的親切引導詢問。

  範例：
  - 「大寶三點拉屎」 -> {"intent": "add_diary", "petName": "大寶", "action": "排泄", "description": "拉屎", "time": "${today} 15:00", "queryTarget": null, "queryFilters": null, "clarificationPrompt": null}
  - 「新養了一隻貓叫小雞」 -> {"intent": "add_pet", "petName": "小雞", "petType": "貓", "action": null, "description": null, "time": null, "queryTarget": null, "queryFilters": null, "clarificationPrompt": null}
  - 「大寶昨天的日記」 -> {"intent": "query", "petName": null, "petType": null, "action": null, "description": null, "time": null, "queryTarget": "diary", "queryFilters": {"petName": "大寶", "startDate": "昨天日期", "endDate": "昨天日期"}, "clarificationPrompt": null}
  - 「有什麼寵物」 -> {"intent": "query", "petName": null, "petType": null, "action": null, "description": null, "time": null, "queryTarget": "pet", "queryFilters": null, "clarificationPrompt": null}

  注意：
  - 如果使用者沒提到時間，add_diary 的 time 預設為現在：「${today} ${currentTime}」。
  - 查詢昨天的日期請根據 ${today} 計算。
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
      queryTarget: parsed.queryTarget || null,
      queryFilters: parsed.queryFilters || null,
      clarificationPrompt: parsed.clarificationPrompt || null,
    };
  } catch (error) {
    console.error('Error calling Gemini API or parsing response:', error);
    return {
      intent: 'unknown',
      petName: null, petType: null, action: null, description: message, time: null,
      queryTarget: null, queryFilters: null, clarificationPrompt: "抱歉，我這裡有點問題，請稍後再試一次。",
    };
  }
}

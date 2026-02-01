import * as line from '@line/bot-sdk';
import { readSheet, appendSheet } from './sheets';
import { parseMessageWithGemini, ParsedMessage } from './gemini';

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const client = new line.Client(config);

// Main event handler
export async function handleEvent(event: line.WebhookEvent): Promise<any> {
  switch (event.type) {
    case 'message':
      if (event.message.type === 'text') {
        return handleTextMessage(event as line.MessageEvent & { message: line.TextEventMessage });
      }
      break;
    case 'postback':
      return handlePostback(event);
    default:
      return Promise.resolve(null);
  }
}

// Sub-handler for query commands
async function handleCommand(command: string): Promise<string | null> {
  if (command === '列出寵物') {
    const petsData = await readSheet('Pets!A:A');
    const pets = petsData ? petsData.flat().filter(Boolean) : [];
    if (pets.length > 0) {
      return `目前已記錄的寵物有：\n- ${pets.join('\n- ')}`;
    } else {
      return '目前沒有記錄任何寵物。';
    }
  }

  if (command === '列出動作') {
    const actionsData = await readSheet('Actions!A:A');
    const actions = actionsData ? actionsData.flat().filter(Boolean) : [];
    if (actions.length > 0) {
      return `目前已設定的動作有：\n- ${actions.join('\n- ')}`;
    } else {
      return '目前沒有設定任何動作。';
    }
  }

  if (command === '最近的日記') {
    const diaryData = await readSheet('Diary!A:D');
    if (diaryData && diaryData.length > 0) {
      const recentEntries = diaryData.slice(-5); // Get the last 5 entries
      const formattedEntries = recentEntries.map(entry => 
        `- ${new Date(entry[3]).toLocaleDateString()} | ${entry[0]}: ${entry[2]}`
      ).join('\n');
      return `最近的 5 筆日記：\n${formattedEntries}`;
    } else {
      return '目前沒有任何日記。';
    }
  }

  // Add other commands here in the future
  return null;
}

// Handler for when a user sends a text message
async function handleTextMessage(event: line.MessageEvent & { message: line.TextEventMessage }): Promise<any> {
  const userMessage = event.message.text.trim();

  try {
    // First, check if the message is a command
    const commandResponse = await handleCommand(userMessage);
    if (commandResponse) {
      return client.replyMessage(event.replyToken, { type: 'text', text: commandResponse });
    }

    // If not a command, proceed with Gemini parsing
    const petsData = await readSheet('Pets!A:A');
    const pets = petsData ? petsData.flat().filter(Boolean) : [];
    const actionsData = await readSheet('Actions!A:A');
    const actions = actionsData ? actionsData.flat().filter(Boolean) : [];

    const parsedData = await parseMessageWithGemini(userMessage, pets, actions);
    
    // Handle natural language queries
    if (parsedData.intent === 'query_diary') {
      const diaryData = await readSheet('Diary!A:D');
      if (!diaryData || diaryData.length === 0) {
        return client.replyMessage(event.replyToken, { type: 'text', text: '目前沒有任何日記可供查詢。' });
      }

      const filteredEntries = diaryData.filter(entry => {
        const entryDate = entry[3] ? entry[3].substring(0, 10) : ''; // YYYY-MM-DD
        const petMatch = !parsedData.queryPetName || entry[0] === parsedData.queryPetName;
        const actionMatch = !parsedData.queryAction || entry[1] === parsedData.queryAction;
        const dateMatch = !parsedData.queryDate || entryDate === parsedData.queryDate;
        return petMatch && actionMatch && dateMatch;
      });

      if (filteredEntries.length > 0) {
        const formattedEntries = filteredEntries.map(entry => 
          `- ${new Date(entry[3]).toLocaleString()} | ${entry[0]}: ${entry[2]}`
        ).join('\n');
        return client.replyMessage(event.replyToken, { type: 'text', text: `這是您查詢的日記：\n${formattedEntries}` });
      } else {
        return client.replyMessage(event.replyToken, { type: 'text', text: '找不到符合條件的日記。' });
      }
    }

    let confirmationText = '';
    let postbackData = '';

    if (parsedData.intent === 'add_diary' && parsedData.petName && parsedData.description) {
      confirmationText = `我 समझ लिया: 要為「${parsedData.petName}」記錄一筆日記：「${parsedData.description}」。\n\n這樣對嗎？`;
      postbackData = `action=add_diary&petName=${encodeURIComponent(parsedData.petName)}&actionName=${encodeURIComponent(parsedData.action || '')}&description=${encodeURIComponent(parsedData.description)}`;
    } else if (parsedData.intent === 'add_pet' && parsedData.petName) {
      confirmationText = `要新增一隻新的寵物「${parsedData.petName}」嗎？`;
      postbackData = `action=add_pet&petName=${encodeURIComponent(parsedData.petName)}`;
    } else {
      const reply = parsedData.clarificationPrompt || "抱歉，我不太懂您的意思，可以換句話說嗎？";
      return client.replyMessage(event.replyToken, { type: 'text', text: reply });
    }

    const confirmTemplate: line.TemplateMessage = {
      type: 'template',
      altText: confirmationText,
      template: {
        type: 'confirm',
        text: confirmationText,
        actions: [
          { type: 'postback', label: '是', data: postbackData },
          { type: 'postback', label: '否', data: 'action=cancel' },
        ],
      },
    };

    return client.replyMessage(event.replyToken, confirmTemplate);

  } catch (error) {
    console.error('Error handling text message:', error);
    return client.replyMessage(event.replyToken, { type: 'text', text: '處理您的訊息時發生錯誤，請稍後再試。' });
  }
}

// Handler for when a user clicks a button from a template
async function handlePostback(event: line.PostbackEvent): Promise<any> {
  const data = new URLSearchParams(event.postback.data);
  const action = data.get('action');

  if (action === 'cancel') {
    return client.replyMessage(event.replyToken, { type: 'text', text: '好的，操作已取消。' });
  }

  let replyText = '';
  try {
    if (action === 'add_diary') {
      const petName = data.get('petName');
      const actionName = data.get('actionName');
      const description = data.get('description');
      await appendSheet('Diary!A:D', [[petName, actionName, description, new Date().toISOString()]]);
      replyText = '好的，日記已儲存！';
    } else if (action === 'add_pet') {
      const petName = data.get('petName');
      await appendSheet('Pets!A:A', [[petName]]);
      replyText = `好的，我已經將「${petName}」加入寵物列表了！`;
    } else {
      replyText = '抱歉，這是一個無效的操作。';
    }
    return client.replyMessage(event.replyToken, { type: 'text', text: replyText });
  } catch (error) {
    console.error('Error writing to Google Sheet:', error);
    return client.replyMessage(event.replyToken, { type: 'text', text: '抱歉，儲存資料時失敗了。' });
  }
}

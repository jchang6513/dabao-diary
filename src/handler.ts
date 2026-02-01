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
        return handleTextMessage(event);
      }
      break;
    case 'postback':
      return handlePostback(event);
    default:
      return Promise.resolve(null);
  }
}

// Handler for when a user sends a text message
async function handleTextMessage(event: line.MessageEvent & { message: line.TextEventMessage }): Promise<any> {
  const userMessage = event.message.text;

  try {
    const petsData = await readSheet('Pets!A:A');
    const pets = petsData ? petsData.flat().filter(Boolean) : [];
    const actionsData = await readSheet('Actions!A:A');
    const actions = actionsData ? actionsData.flat().filter(Boolean) : [];

    const parsedData = await parseMessageWithGemini(userMessage, pets, actions);
    
    let confirmationText = '';
    let postbackData = '';

    if (parsedData.intent === 'add_diary' && parsedData.petName && parsedData.description) {
      confirmationText = `我 समझ लिया: 要為「${parsedData.petName}」記錄一筆日記：「${parsedData.description}」。\n\n這樣對嗎？`;
      postbackData = `action=add_diary&petName=${encodeURIComponent(parsedData.petName)}&actionName=${encodeURIComponent(parsedData.action || '')}&description=${encodeURIComponent(parsedData.description)}`;
    } else if (parsedData.intent === 'add_pet' && parsedData.petName) {
      confirmationText = `要新增一隻新的寵物「${parsedData.petName}」嗎？`;
      postbackData = `action=add_pet&petName=${encodeURIComponent(parsedData.petName)}`;
    } else {
      return client.replyMessage(event.replyToken, { type: 'text', text: "抱歉，我不太懂您的意思，可以換句話說嗎？" });
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

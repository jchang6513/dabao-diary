import * as line from '@line/bot-sdk';
import { readSheet, appendSheet, updateSheet } from './sheets';
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
async function handleQuery(parsedData: ParsedMessage): Promise<string> {
  if (parsedData.queryTarget === 'pet') {
    const petsData = await readSheet('Pets!A:B');
    const pets = petsData ? petsData.map(p => `${p[0]} (${p[1] || '未知'})`).filter(Boolean) : [];
    return pets.length > 0 ? `目前已記錄的寵物有：\n- ${pets.join('\n- ')}` : '目前沒有記錄任何寵物。';
  }

  if (parsedData.queryTarget === 'action') {
    const actionsData = await readSheet('Actions!A:A');
    const actions = actionsData ? actionsData.flat().filter(Boolean) : [];
    return actions.length > 0 ? `目前已設定的動作有：\n- ${actions.join('\n- ')}` : '目前沒有設定任何動作。';
  }

  if (parsedData.queryTarget === 'diary') {
    const diaryData = await readSheet('Diary!A:D');
    if (!diaryData || diaryData.length === 0) return '目前沒有任何日記。';

    const filters = parsedData.queryFilters || {};
    const filteredEntries = diaryData.filter(entry => {
      const entryDate = entry[3] ? entry[3].substring(0, 10) : '';
      const petMatch = !filters.petName || entry[0] === filters.petName;
      const actionMatch = !filters.actionName || entry[1] === filters.actionName;
      
      let dateMatch = true;
      if (filters.startDate && entryDate < filters.startDate) dateMatch = false;
      if (filters.endDate && entryDate > filters.endDate) dateMatch = false;
      
      return petMatch && actionMatch && dateMatch;
    });

    if (filteredEntries.length > 0) {
      const formattedEntries = filteredEntries.slice(-10).map(entry => 
        `- [${entry[3]}] ${entry[0]} ${entry[1]}: ${entry[2]}`
      ).join('\n');
      return `查詢結果 (最多顯示 10 筆)：\n${formattedEntries}`;
    }
    return '找不到符合條件的日記。';
  }

  return '抱歉，我不確定您想查詢什麼。';
}

async function handleEdit(parsedData: ParsedMessage): Promise<string> {
  if (parsedData.editTarget === 'pet' && parsedData.petName) {
    const petsData = await readSheet('Pets!A:B');
    if (!petsData) return '讀取資料失敗。';
    
    const rowIndex = petsData.findIndex(row => row[0] === parsedData.petName);
    if (rowIndex === -1) return `找不到寵物「${parsedData.petName}」。`;

    const currentRow = petsData[rowIndex];
    const newPetName = parsedData.newPetName || currentRow[0];
    const newPetType = parsedData.newPetType || currentRow[1];
    
    // Check for duplicate name if renaming
    if (parsedData.newPetName && parsedData.newPetName !== parsedData.petName) {
      if (petsData.some(row => row[0] === parsedData.newPetName)) {
        return `更新失敗：名稱「${parsedData.newPetName}」已存在。`;
      }
    }
    
    await updateSheet(`Pets!A${rowIndex + 1}:B${rowIndex + 1}`, [[newPetName, newPetType]]);
    return `已更新寵物「${parsedData.petName}」的資訊。`;
  }

  if (parsedData.editTarget === 'diary' && parsedData.petName) {
    const diaryData = await readSheet('Diary!A:D');
    if (!diaryData) return '讀取資料失敗。';

    // Find entries for this pet, matching time if provided, otherwise the latest one
    let targetIndex = -1;
    if (parsedData.time) {
      targetIndex = diaryData.findLastIndex(row => row[0] === parsedData.petName && row[3].includes(parsedData.time!));
    } else {
      targetIndex = diaryData.findLastIndex(row => row[0] === parsedData.petName);
    }

    if (targetIndex === -1) return '找不到符合條件的日記。';

    const currentRow = diaryData[targetIndex];
    const newPetName = parsedData.newPetName || currentRow[0];
    const newAction = parsedData.newAction || currentRow[1];
    const newDescription = parsedData.newDescription || currentRow[2];
    const newTime = parsedData.newTime || currentRow[3];

    // Ensure target pet exists if renaming pet in diary
    if (parsedData.newPetName && parsedData.newPetName !== currentRow[0]) {
        const petsData = await readSheet('Pets!A:A');
        const pets = petsData ? petsData.flat().filter(Boolean) : [];
        if (!pets.includes(newPetName)) {
            await appendSheet('Pets!A:B', [[newPetName, '未知']]);
        }
    }

    await updateSheet(`Diary!A${targetIndex + 1}:D${targetIndex + 1}`, [[newPetName, newAction, newDescription, newTime]]);
    return `已更新「${parsedData.petName}」的日記內容。`;
  }

  return '抱歉，我不確定您想修改什麼。';
}

// Handler for when a user sends a text message
async function handleTextMessage(event: line.MessageEvent & { message: line.TextEventMessage }): Promise<any> {
  const userMessage = event.message.text.trim();

  try {
    const petsData = await readSheet('Pets!A:A');
    const pets = petsData ? petsData.flat().filter(Boolean) : [];
    const actionsData = await readSheet('Actions!A:A');
    const actions = actionsData ? actionsData.flat().filter(Boolean) : [];

    const parsedData = await parseMessageWithGemini(userMessage, pets, actions);
    
    if (parsedData.intent === 'query') {
      const response = await handleQuery(parsedData);
      return client.replyMessage(event.replyToken, { type: 'text', text: response });
    }

    if (parsedData.intent === 'edit') {
      const response = await handleEdit(parsedData);
      return client.replyMessage(event.replyToken, { type: 'text', text: response });
    }

    if (parsedData.intent === 'add_pet' && parsedData.petName) {
      if (pets.includes(parsedData.petName)) {
          return client.replyMessage(event.replyToken, { type: 'text', text: `寵物「${parsedData.petName}」已經存在囉！` });
      }
      const confirmationText = `確定要新增寵物嗎？\n名稱：${parsedData.petName}\n種類：${parsedData.petType || '未知'}`;
      return client.replyMessage(event.replyToken, {
        type: 'template',
        altText: confirmationText,
        template: {
          type: 'confirm',
          text: confirmationText,
          actions: [
            { type: 'postback', label: '是', data: `action=confirm_add_pet&petName=${encodeURIComponent(parsedData.petName!)}&petType=${encodeURIComponent(parsedData.petType || '')}` },
            { type: 'postback', label: '否', data: 'action=cancel' },
          ],
        },
      });
    }

    if (parsedData.intent === 'add_diary' && parsedData.petName && parsedData.action) {
      const confirmationText = `請確認日記內容：\n事件：${parsedData.action}\n描述：${parsedData.description || '無'}\n時間：${parsedData.time}\n寵物：${parsedData.petName}`;
      const postbackData = `action=confirm_add_diary&petName=${encodeURIComponent(parsedData.petName)}&actionName=${encodeURIComponent(parsedData.action)}&description=${encodeURIComponent(parsedData.description || '')}&time=${encodeURIComponent(parsedData.time || '')}`;
      
      return client.replyMessage(event.replyToken, {
        type: 'template',
        altText: '確認日記內容',
        template: {
          type: 'buttons',
          text: confirmationText,
          actions: [
            { type: 'postback', label: '是，儲存', data: postbackData },
            { type: 'postback', label: '否，需修改', data: 'action=modify' },
            { type: 'postback', label: '取消', data: 'action=cancel' },
          ],
        },
      });
    }

    const reply = parsedData.clarificationPrompt || "抱歉，我不太懂您的意思，可以再說清楚一點嗎？例如：「大寶三點吃飯」或「查詢大寶今天的日記」。";
    return client.replyMessage(event.replyToken, { type: 'text', text: reply });

  } catch (error) {
    console.error('Error handling text message:', error);
    return client.replyMessage(event.replyToken, { type: 'text', text: '處理時發生錯誤，請稍後再試。' });
  }
}

// Handler for when a user clicks a button from a template
async function handlePostback(event: line.PostbackEvent): Promise<any> {
  const data = new URLSearchParams(event.postback.data);
  const action = data.get('action');

  if (action === 'cancel') {
    return client.replyMessage(event.replyToken, { type: 'text', text: '已取消操作。' });
  }

  if (action === 'modify') {
    return client.replyMessage(event.replyToken, { type: 'text', text: '好的，請直接輸入正確的內容，我會重新為您解析。' });
  }

  try {
    if (action === 'confirm_add_pet') {
      const petName = data.get('petName')!;
      const petType = data.get('petType') || '未知';
      
      const petsData = await readSheet('Pets!A:A');
      const pets = petsData ? petsData.flat().filter(Boolean) : [];
      if (pets.includes(petName)) {
          return client.replyMessage(event.replyToken, { type: 'text', text: `寵物「${petName}」已經存在囉！` });
      }

      await appendSheet('Pets!A:B', [[petName, petType]]);
      return client.replyMessage(event.replyToken, { type: 'text', text: `已成功新增寵物：${petName} (${petType})` });
    }

    if (action === 'confirm_add_diary') {
      const petName = data.get('petName')!;
      const actionName = data.get('actionName')!;
      const description = data.get('description') || '';
      const time = data.get('time') || new Date().toISOString();

      // Check if pet exists
      const petsData = await readSheet('Pets!A:A');
      const pets = petsData ? petsData.flat().filter(Boolean) : [];
      if (!pets.includes(petName)) {
        await appendSheet('Pets!A:B', [[petName, '未知']]);
      }

      // Check if action exists
      const actionsData = await readSheet('Actions!A:A');
      const actions = actionsData ? actionsData.flat().filter(Boolean) : [];
      if (!actions.includes(actionName)) {
        await appendSheet('Actions!A:A', [[actionName]]);
      }

      await appendSheet('Diary!A:D', [[petName, actionName, description, time]]);
      return client.replyMessage(event.replyToken, { type: 'text', text: '日記已成功儲存！' });
    }
  } catch (error) {
    console.error('Error in handlePostback:', error);
    return client.replyMessage(event.replyToken, { type: 'text', text: '儲存資料時發生錯誤。' });
  }
}

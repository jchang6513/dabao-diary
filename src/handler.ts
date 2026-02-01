import * as line from '@line/bot-sdk';
import { readSheet, appendSheet, updateSheet } from './sheets';
import { parseMessageWithGemini, ParsedMessage } from './gemini';

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const client = new line.Client(config);

// Simple in-memory state management (User ID -> Target Diary Row Index)
const userState = new Map<string, number>();

// Main event handler
export async function handleEvent(event: line.WebhookEvent): Promise<any> {
  const userId = event.source.userId;
  if (!userId) return Promise.resolve(null);

  switch (event.type) {
    case 'message':
      if (event.message.type === 'text') {
        return handleTextMessage(event as line.MessageEvent & { message: line.TextEventMessage });
      }
      if (event.message.type === 'image') {
        return handleImageMessage(event as line.MessageEvent & { message: line.ImageEventMessage }, userId);
      }
      break;
    case 'postback':
      return handlePostback(event, userId);
    default:
      return Promise.resolve(null);
  }
}

async function handleImageMessage(event: line.MessageEvent & { message: line.ImageEventMessage }, userId: string): Promise<any> {
  try {
    const targetRowIndex = userState.get(userId);
    
    if (targetRowIndex === undefined) {
      return client.replyMessage(event.replyToken, { type: 'text', text: '我不確定這張照片要對應哪一筆日記。您可以說「幫剛才那筆日記加照片」後再上傳。' });
    }

    const imageId = event.message.id;
    const diaryData = await readSheet('Diary!A:E');
    
    if (!diaryData || !diaryData[targetRowIndex]) {
      userState.delete(userId);
      return client.replyMessage(event.replyToken, { type: 'text', text: '找不到對應的日記資料。' });
    }

    const updatedRow = [...diaryData[targetRowIndex]];
    // Ensure row has 5 columns
    while (updatedRow.length < 5) updatedRow.push('');
    updatedRow[4] = imageId;

    await updateSheet(`Diary!A${targetRowIndex + 1}:E${targetRowIndex + 1}`, [updatedRow]);
    
    userState.delete(userId); // Clear state after success
    return client.replyMessage(event.replyToken, { type: 'text', text: `照片已成功關聯至「${updatedRow[0]}」的日記！` });

  } catch (error) {
    console.error('Error handling image message:', error);
    return client.replyMessage(event.replyToken, { type: 'text', text: '處理照片時發生錯誤。' });
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
    const diaryData = await readSheet('Diary!A:E');
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
      const formattedEntries = filteredEntries.slice(-10).map(entry => {
        const hasImage = entry[4] ? ' [有照片]' : '';
        return `- [${entry[3]}] ${entry[0]} ${entry[1]}: ${entry[2]}${hasImage}`;
      }).join('\n');
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
    const diaryData = await readSheet('Diary!A:E');
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

    const updatedRow = [newPetName, newAction, newDescription, newTime, currentRow[4] || ''];
    await updateSheet(`Diary!A${targetIndex + 1}:E${targetIndex + 1}`, [updatedRow]);
    return `已更新「${parsedData.petName}」的日記內容。`;
  }

  return '抱歉，我不確定您想修改什麼。';
}

async function handleAttachPhoto(parsedData: ParsedMessage, userId: string): Promise<string> {
  const diaryData = await readSheet('Diary!A:E');
  if (!diaryData) return '讀取資料失敗。';

  let targetIndex = -1;
  if (parsedData.petName || parsedData.time) {
    targetIndex = diaryData.findLastIndex(row => {
      const petMatch = !parsedData.petName || row[0] === parsedData.petName;
      const timeMatch = !parsedData.time || row[3].includes(parsedData.time);
      return petMatch && timeMatch;
    });
  } else {
    targetIndex = diaryData.length - 1; // Default to last entry
  }

  if (targetIndex === -1) return '找不到符合條件的日記。';

  userState.set(userId, targetIndex);
  return `好的，請現在傳送「${diaryData[targetIndex][0]}」在「${diaryData[targetIndex][3]}」這筆記錄的照片。`;
}

// Handler for when a user sends a text message
async function handleTextMessage(event: line.MessageEvent & { message: line.TextEventMessage }): Promise<any> {
  const userMessage = event.message.text.trim();
  const userId = event.source.userId!;

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

    if (parsedData.intent === 'attach_photo') {
      const response = await handleAttachPhoto(parsedData, userId);
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

async function handlePostback(event: line.PostbackEvent, userId: string): Promise<any> {
  const data = new URLSearchParams(event.postback.data);
  const action = data.get('action');

  if (action === 'cancel') {
    return client.replyMessage(event.replyToken, { type: 'text', text: '已取消操作。' });
  }

  if (action === 'modify') {
    return client.replyMessage(event.replyToken, { type: 'text', text: '好的，請直接輸入正確的內容，我會重新為您解析。' });
  }

  if (action === 'prepare_photo') {
    const rowIndex = parseInt(data.get('rowIndex') || '-1');
    if (rowIndex !== -1) {
      userState.set(userId, rowIndex);
      return client.replyMessage(event.replyToken, { type: 'text', text: '好的，請傳送照片，我會幫您關聯到剛才的日記。' });
    }
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
      
      // Get the index of the newly added row
      const updatedDiaryData = await readSheet('Diary!A:A');
      const newRowIndex = (updatedDiaryData?.length || 1) - 1;

      return client.replyMessage(event.replyToken, {
        type: 'template',
        altText: '日記已儲存，要上傳照片嗎？',
        template: {
          type: 'buttons',
          text: '日記已成功儲存！需要現在上傳照片嗎？',
          actions: [
            { type: 'postback', label: '上傳照片', data: `action=prepare_photo&rowIndex=${newRowIndex}` },
            { type: 'postback', label: '不用了', data: 'action=cancel' },
          ],
        },
      });
    }
  } catch (error) {
    console.error('Error in handlePostback:', error);
    return client.replyMessage(event.replyToken, { type: 'text', text: '儲存資料時發生錯誤。' });
  }
}

import * as line from '@line/bot-sdk';
import { readSheet, appendSheet, updateSheet } from './sheets';
import { parseMessageWithGemini, ParsedMessage } from './gemini';
import { LineBotContext } from './context';
import { DIARY_COLUMNS, PET_COLUMNS, UI_LIMITS, DATE_FORMAT_LENGTHS } from './constants';

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const client = new line.Client(config);

// Main event handler
export async function handleEvent(event: line.WebhookEvent): Promise<any> {
  if (event.type !== 'message' && event.type !== 'postback') return Promise.resolve(null);
  if (!('replyToken' in event)) return Promise.resolve(null);

  const ctx = new LineBotContext(client, event.replyToken);
  const userId = event.source.userId;
  if (!userId) return Promise.resolve(null);

  try {
    switch (event.type) {
      case 'message':
        if (event.message.type === 'text') {
          return handleTextMessage(ctx, event as line.MessageEvent & { message: line.TextEventMessage });
        }
        break;
      case 'postback':
        return handlePostback(ctx, event);
      default:
        return Promise.resolve(null);
    }
  } catch (error) {
    console.error('Handler Error:', error);
    return ctx.sendText('抱歉，處理您的請求時發生錯誤。');
  }
}

// Sub-handler for query commands
async function handleQuery(parsedData: ParsedMessage): Promise<string> {
  if (parsedData.queryTarget === 'pet') {
    const petsData = await readSheet('Pets!A:B');
    const pets = petsData ? petsData.map(p => `${p[PET_COLUMNS.NAME]} (${p[PET_COLUMNS.TYPE] || '未知'})`).filter(Boolean) : [];
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
      const entryDate = entry[DIARY_COLUMNS.TIME] ? entry[DIARY_COLUMNS.TIME].substring(0, DATE_FORMAT_LENGTHS.ISO_DATE) : '';
      const petMatch = !filters.petName || entry[DIARY_COLUMNS.PET_NAME] === filters.petName;
      const actionMatch = !filters.actionName || entry[DIARY_COLUMNS.ACTION] === filters.actionName;
      
      let dateMatch = true;
      if (filters.startDate && entryDate < filters.startDate) dateMatch = false;
      if (filters.endDate && entryDate > filters.endDate) dateMatch = false;
      
      return petMatch && actionMatch && dateMatch;
    });

    if (filteredEntries.length > 0) {
      const formattedEntries = filteredEntries.slice(-UI_LIMITS.MAX_DIARY_QUERY).map(entry => {
        return `- [${entry[DIARY_COLUMNS.TIME]}] ${entry[DIARY_COLUMNS.PET_NAME]} ${entry[DIARY_COLUMNS.ACTION]}: ${entry[DIARY_COLUMNS.DESCRIPTION]}`;
      }).join('\n');
      return `查詢結果 (最多顯示 ${UI_LIMITS.MAX_DIARY_QUERY} 筆)：\n${formattedEntries}`;
    }
    return '找不到符合條件的日記。';
  }

  return '抱歉，我不確定您想查詢什麼。';
}

async function handleEdit(parsedData: ParsedMessage): Promise<string> {
  if (parsedData.editTarget === 'pet' && parsedData.petName) {
    const petsData = await readSheet('Pets!A:B');
    if (!petsData) return '讀取資料失敗。';
    
    const rowIndex = petsData.findIndex(row => row[PET_COLUMNS.NAME] === parsedData.petName);
    if (rowIndex === -1) return `找不到寵物「${parsedData.petName}」。`;

    const currentRow = petsData[rowIndex];
    const newPetName = parsedData.newPetName || currentRow[PET_COLUMNS.NAME];
    const newPetType = parsedData.newPetType || currentRow[PET_COLUMNS.TYPE];
    
    if (parsedData.newPetName && parsedData.newPetName !== parsedData.petName) {
      if (petsData.some(row => row[PET_COLUMNS.NAME] === parsedData.newPetName)) {
        return `更新失敗：名稱「${parsedData.newPetName}」已存在。`;
      }
    }
    
    await updateSheet(`Pets!A${rowIndex + 1}:B${rowIndex + 1}`, [[newPetName, newPetType]]);
    return `已更新寵物「${parsedData.petName}」的資訊為：${newPetName} (${newPetType})`;
  }

  if (parsedData.editTarget === 'diary') {
    const diaryData = await readSheet('Diary!A:D');
    if (!diaryData || diaryData.length === 0) return '目前沒有任何日記可以修改。';

    let targetIndex = -1;
    if (parsedData.petName || parsedData.time) {
      targetIndex = diaryData.findLastIndex(row => {
        const petMatch = !parsedData.petName || row[DIARY_COLUMNS.PET_NAME] === parsedData.petName;
        const timeMatch = !parsedData.time || row[DIARY_COLUMNS.TIME].includes(parsedData.time);
        return petMatch && timeMatch;
      });
    } else {
      targetIndex = diaryData.length - 1; 
    }

    if (targetIndex === -1) return '找不到符合條件的日記。';

    const currentRow = diaryData[targetIndex];
    const updatedRow = [...currentRow];
    
    const changes: string[] = [];
    if (parsedData.newTime) {
      updatedRow[DIARY_COLUMNS.TIME] = parsedData.newTime;
      changes.push(`時間：${parsedData.newTime}`);
    }
    if (parsedData.newPetName) {
      updatedRow[DIARY_COLUMNS.PET_NAME] = parsedData.newPetName;
      changes.push(`寵物：${parsedData.newPetName}`);
    }
    if (parsedData.newAction) {
      updatedRow[DIARY_COLUMNS.ACTION] = parsedData.newAction;
      changes.push(`動作：${parsedData.newAction}`);
    }
    if (parsedData.newDescription !== undefined && parsedData.newDescription !== null) {
      updatedRow[DIARY_COLUMNS.DESCRIPTION] = parsedData.newDescription;
      changes.push(`描述：${parsedData.newDescription}`);
    }

    if (changes.length === 0) return '未偵測到需要修改的內容。';

    await updateSheet(`Diary!A${targetIndex + 1}:D${targetIndex + 1}`, [updatedRow]);
    return `已更新日記內容：\n${changes.join('\n')}`;
  }

  return '抱歉，我不確定您想修改什麼。可以說「把大寶剛才的時間改為 12:00」或「修改剛剛那筆的描述」。';
}

// Handler for when a user sends a text message
async function handleTextMessage(ctx: LineBotContext, event: line.MessageEvent & { message: line.TextEventMessage }): Promise<any> {
  const userMessage = event.message.text.trim();

  const petsData = await readSheet('Pets!A:A');
  const pets = petsData ? petsData.flat().filter(Boolean) : [];
  const actionsData = await readSheet('Actions!A:A');
  const actions = actionsData ? actionsData.flat().filter(Boolean) : [];

  const parsedData = await parseMessageWithGemini(userMessage, pets, actions);
  
  if (parsedData.intent === 'query') {
    const response = await handleQuery(parsedData);
    return ctx.sendText(response);
  }

  if (parsedData.intent === 'edit') {
    const response = await handleEdit(parsedData);
    return ctx.sendText(response);
  }

  if (parsedData.intent === 'add_pet' && parsedData.petName) {
    if (pets.includes(parsedData.petName)) {
        return ctx.sendText(`寵物「${parsedData.petName}」已經存在囉！`);
    }
    const confirmationText = `確定要新增寵物嗎？\n名稱：${parsedData.petName}\n種類：${parsedData.petType || '未知'}`;
    return ctx.sendConfirm(confirmationText, [
      { type: 'postback', label: '是', data: `action=confirm_add_pet&petName=${encodeURIComponent(parsedData.petName!)}&petType=${encodeURIComponent(parsedData.petType || '')}` },
      { type: 'postback', label: '否', data: 'action=cancel' },
    ]);
  }

  if (parsedData.intent === 'add_diary' && parsedData.petName && parsedData.action) {
    const confirmationText = `請確認日記內容：\n事件：${parsedData.action}\n描述：${parsedData.description || '無'}\n時間：${parsedData.time}\n寵物：${parsedData.petName}`;
    const postbackData = `action=confirm_add_diary&petName=${encodeURIComponent(parsedData.petName)}&actionName=${encodeURIComponent(parsedData.action)}&description=${encodeURIComponent(parsedData.description || '')}&time=${encodeURIComponent(parsedData.time || '')}`;
    
    return ctx.sendButtons(confirmationText, '確認日記內容', [
      { type: 'postback', label: '是，儲存', data: postbackData },
      { type: 'postback', label: '否，需修改', data: 'action=modify' },
      { type: 'postback', label: '取消', data: 'action=cancel' },
    ]);
  }

  const reply = parsedData.clarificationPrompt || "抱歉，我不太懂您的意思，可以再說清楚一點嗎？例如：「大寶三點吃飯」或「查詢大寶今天的日記」。";
  return ctx.sendText(reply);
}

async function handlePostback(ctx: LineBotContext, event: line.PostbackEvent): Promise<any> {
  const data = new URLSearchParams(event.postback.data);
  const action = data.get('action');

  if (action === 'cancel') {
    return ctx.sendText('已取消操作。');
  }

  if (action === 'modify') {
    return ctx.sendText('好的，請直接輸入正確的內容，我會重新為您解析。');
  }

  if (action === 'confirm_add_pet') {
    const petName = data.get('petName')!;
    const petType = data.get('petType') || '未知';
    
    const petsData = await readSheet('Pets!A:A');
    const pets = petsData ? petsData.flat().filter(Boolean) : [];
    if (pets.includes(petName)) {
        return ctx.sendText(`寵物「${petName}」已經存在囉！`);
    }

    await appendSheet('Pets!A:B', [[petName, petType]]);
    return ctx.sendText(`已成功新增寵物：${petName} (${petType})`);
  }

  if (action === 'confirm_add_diary') {
    const petName = data.get('petName')!;
    const actionName = data.get('actionName')!;
    const description = data.get('description') || '';
    const time = data.get('time') || new Date().toISOString();

    const petsData = await readSheet('Pets!A:A');
    const pets = petsData ? petsData.flat().filter(Boolean) : [];
    if (!pets.includes(petName)) {
      await appendSheet('Pets!A:B', [[petName, '未知']]);
    }

    const actionsData = await readSheet('Actions!A:A');
    const actions = actionsData ? actionsData.flat().filter(Boolean) : [];
    if (!actions.includes(actionName)) {
      await appendSheet('Actions!A:A', [[actionName]]);
    }

    const newRow = [];
    newRow[DIARY_COLUMNS.TIME] = time;
    newRow[DIARY_COLUMNS.PET_NAME] = petName;
    newRow[DIARY_COLUMNS.ACTION] = actionName;
    newRow[DIARY_COLUMNS.DESCRIPTION] = description;

    await appendSheet('Diary!A:D', [newRow]);
    return ctx.sendText('日記已成功儲存！');
  }
}

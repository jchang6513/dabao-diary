import * as line from '@line/bot-sdk';
import { parseMessageWithGemini, ParsedMessage } from './gemini';
import { LineBotContext } from './context';
import { DIARY_COLUMNS, PET_COLUMNS, UI_LIMITS, DATE_FORMAT_LENGTHS } from './constants';
import { PetService } from './services/pet.service';
import { DiaryService } from './services/diary.service';
import { ActionService } from './services/action.service';

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const client = new line.Client(config);

export async function handleEvent(event: line.WebhookEvent): Promise<any> {
  if (event.type !== 'message' && event.type !== 'postback') return Promise.resolve(null);
  if (!('replyToken' in event)) return Promise.resolve(null);

  const ctx = new LineBotContext(client, event.replyToken);
  try {
    if (event.type === 'message' && event.message.type === 'text') {
      return handleTextMessage(ctx, event as line.MessageEvent & { message: line.TextEventMessage });
    }
    if (event.type === 'postback') {
      return handlePostback(ctx, event);
    }
  } catch (error) {
    console.error('Handler Error:', error);
    return ctx.sendText('抱歉，處理您的請求時發生錯誤。');
  }
}

async function handleQuery(parsedData: ParsedMessage): Promise<string> {
  if (parsedData.queryTarget === 'pet') {
    const pets = await PetService.getPetsWithInfo();
    const list = pets.map(p => `${p[PET_COLUMNS.NAME]} (${p[PET_COLUMNS.TYPE] || '未知'})`).filter(Boolean);
    return list.length > 0 ? `目前已記錄的寵物有：\n- ${list.join('\n- ')}` : '目前沒有記錄任何寵物。';
  }

  if (parsedData.queryTarget === 'action') {
    const actions = await ActionService.getAllActions();
    return actions.length > 0 ? `目前已設定的動作有：\n- ${actions.join('\n- ')}` : '目前沒有設定任何動作。';
  }

  if (parsedData.queryTarget === 'diary') {
    const diaryData = await DiaryService.getDiaryEntries();
    if (diaryData.length === 0) return '目前沒有任何日記。';

    const filters = parsedData.queryFilters || {};
    const filteredEntries = diaryData.filter(entry => {
      const entryDate = entry[DIARY_COLUMNS.TIME]?.substring(0, DATE_FORMAT_LENGTHS.ISO_DATE) || '';
      const petMatch = !filters.petName || entry[DIARY_COLUMNS.PET_NAME] === filters.petName;
      const actionMatch = !filters.actionName || entry[DIARY_COLUMNS.ACTION] === filters.actionName;
      let dateMatch = true;
      if (filters.startDate && entryDate < filters.startDate) dateMatch = false;
      if (filters.endDate && entryDate > filters.endDate) dateMatch = false;
      return petMatch && actionMatch && dateMatch;
    });

    if (filteredEntries.length > 0) {
      const formatted = filteredEntries.slice(-UI_LIMITS.MAX_DIARY_QUERY).map(entry => 
        `- [${entry[DIARY_COLUMNS.TIME]}] ${entry[DIARY_COLUMNS.PET_NAME]} ${entry[DIARY_COLUMNS.ACTION]}: ${entry[DIARY_COLUMNS.DESCRIPTION]}`
      ).join('\n');
      return `查詢結果 (最多顯示 ${UI_LIMITS.MAX_DIARY_QUERY} 筆)：\n${formatted}`;
    }
    return '找不到符合條件的日記。';
  }
  return '抱歉，我不確定您想查詢什麼。';
}

async function handleEdit(parsedData: ParsedMessage): Promise<string> {
  if (parsedData.editTarget === 'pet' && parsedData.petName) {
    const pets = await PetService.getPetsWithInfo();
    const rowIndex = pets.findIndex(row => row[PET_COLUMNS.NAME] === parsedData.petName);
    if (rowIndex === -1) return `找不到寵物「${parsedData.petName}」。`;

    const newName = parsedData.newPetName || pets[rowIndex][PET_COLUMNS.NAME];
    const newType = parsedData.newPetType || pets[rowIndex][PET_COLUMNS.TYPE];

    if (parsedData.newPetName && parsedData.newPetName !== parsedData.petName && await PetService.exists(parsedData.newPetName)) {
      return `更新失敗：名稱「${parsedData.newPetName}」已存在。`;
    }

    await PetService.updatePet(parsedData.petName, newName, newType);
    return `已更新寵物「${parsedData.petName}」的資訊為：${newName} (${newType})`;
  }

  if (parsedData.editTarget === 'diary') {
    const entry = await DiaryService.findEntry(parsedData.petName, parsedData.time);
    if (!entry) return '找不到符合條件的日記。';

    const updatedRow = [...entry.data];
    const changes: string[] = [];
    if (parsedData.newTime) { updatedRow[DIARY_COLUMNS.TIME] = parsedData.newTime; changes.push(`時間：${parsedData.newTime}`); }
    if (parsedData.newPetName) { updatedRow[DIARY_COLUMNS.PET_NAME] = parsedData.newPetName; changes.push(`寵物：${parsedData.newPetName}`); }
    if (parsedData.newAction) { updatedRow[DIARY_COLUMNS.ACTION] = parsedData.newAction; changes.push(`動作：${parsedData.newAction}`); }
    if (parsedData.newDescription) { updatedRow[DIARY_COLUMNS.DESCRIPTION] = parsedData.newDescription; changes.push(`描述：${parsedData.newDescription}`); }

    if (changes.length === 0) return '未偵測到需要修改的內容。';
    await DiaryService.updateEntry(entry.index, updatedRow);
    return `已更新日記內容：\n${changes.join('\n')}`;
  }
  return '抱歉，我不確定您想修改什麼。';
}

async function handleTextMessage(ctx: LineBotContext, event: line.MessageEvent & { message: line.TextEventMessage }): Promise<any> {
  const userMessage = event.message.text.trim();
  const [pets, actions] = await Promise.all([PetService.getAllPetNames(), ActionService.getAllActions()]);
  const parsed = await parseMessageWithGemini(userMessage, pets, actions);
  
  if (parsed.intent === 'query') return ctx.sendText(await handleQuery(parsed));
  if (parsed.intent === 'edit') return ctx.sendText(await handleEdit(parsed));

  if (parsed.intent === 'add_pet' && parsed.petName) {
    if (await PetService.exists(parsed.petName)) return ctx.sendText(`寵物「${parsed.petName}」已經存在囉！`);
    return ctx.sendConfirm(`確定要新增寵物嗎？\n名稱：${parsed.petName}\n種類：${parsed.petType || '未知'}`, [
      { type: 'postback', label: '是', data: `action=confirm_add_pet&petName=${encodeURIComponent(parsed.petName)}&petType=${encodeURIComponent(parsed.petType || '')}` },
      { type: 'postback', label: '否', data: 'action=cancel' },
    ]);
  }

  if (parsed.intent === 'add_diary' && parsed.petName && parsed.action) {
    const confirmationText = `請確認日記內容：\n事件：${parsed.action}\n描述：${parsed.description || '無'}\n時間：${parsed.time}\n寵物：${parsed.petName}`;
    const data = `action=confirm_add_diary&petName=${encodeURIComponent(parsed.petName)}&actionName=${encodeURIComponent(parsed.action)}&description=${encodeURIComponent(parsed.description || '')}&time=${encodeURIComponent(parsed.time || '')}`;
    return ctx.sendButtons(confirmationText, '確認日記內容', [
      { type: 'postback', label: '是，儲存', data },
      { type: 'postback', label: '否，需修改', data: 'action=modify' },
      { type: 'postback', label: '取消', data: 'action=cancel' },
    ]);
  }

  return ctx.sendText(parsed.clarificationPrompt || "抱歉，我不太懂您的意思，可以再說清楚一點嗎？");
}

async function handlePostback(ctx: LineBotContext, event: line.PostbackEvent): Promise<any> {
  const data = new URLSearchParams(event.postback.data);
  const action = data.get('action');
  if (action === 'cancel') return ctx.sendText('已取消操作。');
  if (action === 'modify') return ctx.sendText('好的，請直接輸入正確的內容，我會重新為您解析。');

  if (action === 'confirm_add_pet') {
    const name = data.get('petName')!;
    if (await PetService.exists(name)) return ctx.sendText(`寵物「${name}」已經存在囉！`);
    await PetService.addPet(name, data.get('petType') || '未知');
    return ctx.sendText(`已成功新增寵物：${name}`);
  }

  if (action === 'confirm_add_diary') {
    const petName = data.get('petName')!;
    const actionName = data.get('actionName')!;
    const time = data.get('time') || new Date().toISOString();
    
    await Promise.all([
      (async () => {
        if (!(await PetService.exists(petName))) {
          await PetService.addPet(petName);
        }
      })(),
      ActionService.ensureActionExists(actionName),
      DiaryService.addEntry(time, petName, actionName, data.get('description') || '')
    ]);
    return ctx.sendText('日記已成功儲存！');
  }
}
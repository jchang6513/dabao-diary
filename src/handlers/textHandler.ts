import * as line from '@line/bot-sdk';
import { parseMessageWithGemini } from '../gemini';
import { LineBotContext } from '../context';
import { metadataService } from '../services/metadataService';
import { handleQueryMsg } from './queryHandler';
import { handleEditMsg } from './editHandler';
import { handleAddMsg } from './addHandler';
import { MessageUI } from './messages';

export async function handleTextMsg(ctx: LineBotContext, event: line.MessageEvent & { message: line.TextEventMessage }): Promise<any> {
  const userMessage = event.message.text.trim();
  const { pets, actions } = await metadataService.getMetadata();
  const parsedResults = await parseMessageWithGemini(userMessage, pets, actions);
  
  const textResponses: string[] = [];
  const addPetQueue: any[] = [];
  const addDiaryQueue: any[] = [];
  let unknownPrompt: string | null = null;

  // 1. 分類意圖
  for (const parsed of parsedResults) {
    switch (parsed.intent) {
      case 'query':
        textResponses.push(await handleQueryMsg(parsed));
        break;
      case 'edit':
        // 編輯現在也需要 ctx 來發送確認按鈕
        return handleEditMsg(ctx, parsed);
      case 'add_pet':
        if (parsed.petName) addPetQueue.push(parsed);
        break;
      case 'add_diary':
        if (parsed.petName && parsed.action) addDiaryQueue.push(parsed);
        break;
      default:
        unknownPrompt = parsed.clarificationPrompt;
    }
  }

  // 2. 處理立即執行的文字回覆
  const combinedText = textResponses.join('\n\n');

  // 3. 處理需要確認的動作 (優先處理 add_pet, 其次 add_diary)
  // 注意：LINE 一次只能回覆一個 Template，所以混合多種新增時，我們會優先處理一類
  if (addPetQueue.length > 0) {
    if (addPetQueue.length === 1) {
      const p = addPetQueue[0];
      const prefix = combinedText ? `${combinedText}\n\n` : '';
      return ctx.sendConfirm(`${prefix}${MessageUI.confirmAddPet(p.petName, p.petType || '未知')}`, [
        { type: 'postback', label: '是', data: `action=confirm_add_pet&petName=${encodeURIComponent(p.petName)}&petType=${encodeURIComponent(p.petType || '')}` },
        { type: 'postback', label: '否', data: 'action=cancel' },
      ]);
    } else {
      // 多重新增寵物
      const petsInfo = addPetQueue.map(p => ({ name: p.petName, type: p.petType || '未知' }));
      const prefix = combinedText ? `${combinedText}\n\n` : '';
      const data = `action=confirm_multi_add_pet&payload=${encodeURIComponent(JSON.stringify(petsInfo))}`;
      return ctx.sendConfirm(`${prefix}${MessageUI.confirmMultiAddPet(petsInfo)}`, [
        { type: 'postback', label: '全部新增', data: data.length > 300 ? 'action=too_long' : data },
        { type: 'postback', label: '取消', data: 'action=cancel' },
      ]);
    }
  }

  if (addDiaryQueue.length > 0) {
    const prefix = combinedText ? `${combinedText}\n\n` : '';
    if (addDiaryQueue.length === 1) {
      const d = addDiaryQueue[0];
      const postbackData = `action=confirm_add_diary&petName=${encodeURIComponent(d.petName)}&actionName=${encodeURIComponent(d.action)}&description=${encodeURIComponent(d.description || '')}&time=${encodeURIComponent(d.time || '')}`;
      return ctx.sendButtons(`${prefix}${MessageUI.confirmAddDiary(d.action, d.description || '', d.time || '', d.petName)}`, '確認日記內容', [
        { type: 'postback', label: '是，儲存', data: postbackData },
        { type: 'postback', label: '否，需修改', data: 'action=modify' },
        { type: 'postback', label: '取消', data: 'action=cancel' },
      ]);
    } else {
      // 多重新增日記
      const entries = addDiaryQueue.map(d => ({ petName: d.petName, action: d.action, time: d.time, description: d.description || '' }));
      const data = `action=confirm_multi_add_diary&payload=${encodeURIComponent(JSON.stringify(entries.map(e => [e.petName, e.action, e.time, e.description])))}`;
      return ctx.sendButtons(`${prefix}${MessageUI.confirmMultiAddDiary(entries)}`, '確認多筆日記', [
        { type: 'postback', label: '全部儲存', data: data.length > 300 ? 'action=too_long' : data },
        { type: 'postback', label: '取消', data: 'action=cancel' },
      ]);
    }
  }

  // 4. 若無動作，回傳純文字或引導
  if (combinedText) {
    return ctx.sendText(combinedText);
  }

  return ctx.sendText(MessageUI.clarification(unknownPrompt));
}

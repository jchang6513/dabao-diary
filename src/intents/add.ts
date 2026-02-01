import { ParsedMessage } from '../gemini';
import { LineBotContext } from '../context';
import { PetService } from '../services/pet.service';

export async function handleAddIntent(ctx: LineBotContext, parsed: ParsedMessage): Promise<any> {
  if (parsed.intent === 'add_pet' && parsed.petName) {
    if (await PetService.exists(parsed.petName)) {
      return ctx.sendText(`寵物「${parsed.petName}」已經存在囉！`);
    }
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
}
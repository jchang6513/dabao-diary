import { LineBotContext } from '../context';
import { PetService } from '../services/pet.service';
import { ActionService } from '../services/action.service';
import { DiaryService } from '../services/diary.service';

export async function handlePostbackIntent(ctx: LineBotContext, data: URLSearchParams): Promise<any> {
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

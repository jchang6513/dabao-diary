import { LineBotContext } from '../context';
import { PetService } from '../services/petService';
import { ActionService } from '../services/actionService';
import { DiaryService } from '../services/diaryService';
import { MessageUI } from './messages';

export async function handlePostbackMsg(ctx: LineBotContext, data: URLSearchParams): Promise<any> {
  const action = data.get('action');
  
  if (action === 'cancel') return ctx.sendText(MessageUI.cancel());
  if (action === 'modify') return ctx.sendText(MessageUI.modifyRequest());
  if (action === 'too_long') return ctx.sendText('抱歉，一次處理的資料量太大，請分開輸入。');

  if (action === 'confirm_add_pet') {
    const name = data.get('petName')!;
    if (await PetService.exists(name)) return ctx.sendText(MessageUI.petAlreadyExists(name));
    await PetService.addPet(name, data.get('petType') || '未知');
    return ctx.sendText(MessageUI.petAdded(name));
  }

  if (action === 'confirm_multi_add_pet') {
    const pets: {name: string, type: string}[] = JSON.parse(data.get('payload')!);
    let addedCount = 0;
    for (const p of pets) {
      if (!(await PetService.exists(p.name))) {
        await PetService.addPet(p.name, p.type);
        addedCount++;
      }
    }
    return ctx.sendText(`成功新增 ${addedCount} 隻寵物！`);
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
    return ctx.sendText(MessageUI.diarySaved());
  }

  if (action === 'confirm_multi_add_diary') {
    const rows: string[][] = JSON.parse(data.get('payload')!); // [petName, action, time, description]
    
    await Promise.all(rows.map(async (row) => {
      const [petName, actionName, time, description] = row;
      return Promise.all([
        (async () => {
          if (!(await PetService.exists(petName))) {
            await PetService.addPet(petName);
          }
        })(),
        ActionService.ensureActionExists(actionName),
        DiaryService.addEntry(time || new Date().toISOString(), petName, actionName, description || '')
      ]);
    }));
    
    return ctx.sendText(`成功儲存 ${rows.length} 筆日記！`);
  }
}

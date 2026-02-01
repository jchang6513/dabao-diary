import { LineBotContext } from '../context';
import { PetService } from '../services/petService';
import { ActionService } from '../services/actionService';
import { DiaryService } from '../services/diaryService';
import { MessageUI } from './messages';

export async function handlePostbackMsg(ctx: LineBotContext, data: URLSearchParams): Promise<any> {
  const action = data.get('action');
  
  if (action === 'cancel') return ctx.sendText(MessageUI.cancel());
  if (action === 'modify') return ctx.sendText(MessageUI.modifyRequest());

  if (action === 'confirm_add_pet') {
    const name = data.get('petName')!;
    if (await PetService.exists(name)) return ctx.sendText(MessageUI.petAlreadyExists(name));
    await PetService.addPet(name, data.get('petType') || '未知');
    return ctx.sendText(MessageUI.petAdded(name));
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
}

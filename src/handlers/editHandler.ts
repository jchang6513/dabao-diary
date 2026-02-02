import { ParsedMessage } from '../gemini';
import { PetService } from '../services/petService';
import { DiaryService } from '../services/diaryService';
import { DIARY_COLUMNS, PET_COLUMNS } from '../constants';
import { MessageUI } from './messages';
import { LineBotContext } from '../context';

export async function handleEditMsg(ctx: LineBotContext, parsedData: ParsedMessage): Promise<any> {
  if (parsedData.editTarget === 'pet' && parsedData.petName) {
    const pets = await PetService.getPetsWithInfo();
    const rowIndex = pets.findIndex(row => row[PET_COLUMNS.NAME] === parsedData.petName);
    if (rowIndex === -1) return ctx.sendText(MessageUI.petNotFound(parsedData.petName));

    const newName = parsedData.newPetName || pets[rowIndex][PET_COLUMNS.NAME];
    const newType = parsedData.newPetType || pets[rowIndex][PET_COLUMNS.TYPE];

    if (parsedData.newPetName && parsedData.newPetName !== parsedData.petName && await PetService.exists(parsedData.newPetName)) {
      return ctx.sendText(MessageUI.petUpdateFailedDuplicate(parsedData.newPetName));
    }

    // 寵物修改較簡單，維持原樣或也可加確認，此處先維持直接更新或改為確認
    await PetService.updatePet(parsedData.petName, newName, newType);
    return ctx.sendText(MessageUI.petUpdated(parsedData.petName, newName, newType));
  }

  if (parsedData.editTarget === 'diary') {
    const entry = await DiaryService.findEntry(parsedData.petName, parsedData.time);
    if (!entry) return ctx.sendText(MessageUI.diaryNotFound());

    const updatedRow = [...entry.data];
    const changes: string[] = [];
    if (parsedData.newTime) { updatedRow[DIARY_COLUMNS.TIME] = parsedData.newTime; changes.push(`時間: ${parsedData.newTime}`); }
    if (parsedData.newPetName) { updatedRow[DIARY_COLUMNS.PET_NAME] = parsedData.newPetName; changes.push(`寵物: ${parsedData.newPetName}`); }
    if (parsedData.newAction) { updatedRow[DIARY_COLUMNS.ACTION] = parsedData.newAction; changes.push(`動作: ${parsedData.newAction}`); }
    if (parsedData.newDescription) { updatedRow[DIARY_COLUMNS.DESCRIPTION] = parsedData.newDescription; changes.push(`描述: ${parsedData.newDescription}`); }

    if (changes.length === 0) return ctx.sendText(MessageUI.diaryUpdateNoChanges());

    // 改為回傳確認按鈕
    const postbackData = `action=confirm_edit_diary&index=${entry.index}&payload=${encodeURIComponent(JSON.stringify(updatedRow))}`;
    return ctx.sendConfirm(MessageUI.confirmEditDiary(entry.data[DIARY_COLUMNS.PET_NAME], entry.data[DIARY_COLUMNS.TIME], changes), [
      { type: 'postback', label: '是，確認修改', data: postbackData },
      { type: 'postback', label: '否，取消', data: 'action=cancel' },
    ]);
  }
  return ctx.sendText(MessageUI.editUnclear());
}

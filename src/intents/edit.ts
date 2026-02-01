import { ParsedMessage } from '../gemini';
import { PetService } from '../services/pet.service';
import { DiaryService } from '../services/diary.service';
import { DIARY_COLUMNS, PET_COLUMNS } from '../constants';

export async function handleEditIntent(parsedData: ParsedMessage): Promise<string> {
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

import { ParsedMessage } from '../gemini';
import { PetService } from '../services/pet.service';
import { DiaryService } from '../services/diary.service';
import { DIARY_COLUMNS, PET_COLUMNS } from '../constants';
import { MessageUI } from './messages';

export async function handleEditIntent(parsedData: ParsedMessage): Promise<string> {
  if (parsedData.editTarget === 'pet' && parsedData.petName) {
    const pets = await PetService.getPetsWithInfo();
    const rowIndex = pets.findIndex(row => row[PET_COLUMNS.NAME] === parsedData.petName);
    if (rowIndex === -1) return MessageUI.petNotFound(parsedData.petName);

    const newName = parsedData.newPetName || pets[rowIndex][PET_COLUMNS.NAME];
    const newType = parsedData.newPetType || pets[rowIndex][PET_COLUMNS.TYPE];

    if (parsedData.newPetName && parsedData.newPetName !== parsedData.petName && await PetService.exists(parsedData.newPetName)) {
      return MessageUI.petUpdateFailedDuplicate(parsedData.newPetName);
    }

    await PetService.updatePet(parsedData.petName, newName, newType);
    return MessageUI.petUpdated(parsedData.petName, newName, newType);
  }

  if (parsedData.editTarget === 'diary') {
    const entry = await DiaryService.findEntry(parsedData.petName, parsedData.time);
    if (!entry) return MessageUI.diaryNotFound();

    const updatedRow = [...entry.data];
    const changes: string[] = [];
    if (parsedData.newTime) { updatedRow[DIARY_COLUMNS.TIME] = parsedData.newTime; changes.push(`時間：${parsedData.newTime}`); }
    if (parsedData.newPetName) { updatedRow[DIARY_COLUMNS.PET_NAME] = parsedData.newPetName; changes.push(`寵物：${parsedData.newPetName}`); }
    if (parsedData.newAction) { updatedRow[DIARY_COLUMNS.ACTION] = parsedData.newAction; changes.push(`動作：${parsedData.newAction}`); }
    if (parsedData.newDescription) { updatedRow[DIARY_COLUMNS.DESCRIPTION] = parsedData.newDescription; changes.push(`描述：${parsedData.newDescription}`); }

    if (changes.length === 0) return MessageUI.diaryUpdateNoChanges();
    await DiaryService.updateEntry(entry.index, updatedRow);
    return MessageUI.diaryUpdated(changes);
  }
  return MessageUI.editUnclear();
}
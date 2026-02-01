import { ParsedMessage } from '../gemini';
import { PetService } from '../services/pet.service';
import { ActionService } from '../services/action.service';
import { DiaryService } from '../services/diary.service';
import { DIARY_COLUMNS, PET_COLUMNS, DATE_FORMAT_LENGTHS } from '../constants';
import { MessageUI } from './messages';

export async function handleQueryIntent(parsedData: ParsedMessage): Promise<string> {
  if (parsedData.queryTarget === 'pet') {
    const pets = await PetService.getPetsWithInfo();
    const list = pets.map(p => `${p[PET_COLUMNS.NAME]} (${p[PET_COLUMNS.TYPE] || '未知'})`).filter(Boolean);
    return MessageUI.petList(list);
  }

  if (parsedData.queryTarget === 'action') {
    const actions = await ActionService.getAllActions();
    return MessageUI.actionList(actions);
  }

  if (parsedData.queryTarget === 'diary') {
    const diaryData = await DiaryService.getDiaryEntries();
    if (diaryData.length === 0) return MessageUI.noDiaryFound();

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

    const formatted = filteredEntries.map(entry => 
      `- [${entry[DIARY_COLUMNS.TIME]}] ${entry[DIARY_COLUMNS.PET_NAME]} ${entry[DIARY_COLUMNS.ACTION]}: ${entry[DIARY_COLUMNS.DESCRIPTION]}`
    );
    return MessageUI.diaryEntries(formatted);
  }
  return MessageUI.queryUnclear();
}
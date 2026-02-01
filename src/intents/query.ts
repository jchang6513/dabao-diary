import { ParsedMessage } from '../gemini';
import { PetService } from '../services/pet.service';
import { ActionService } from '../services/action.service';
import { DiaryService } from '../services/diary.service';
import { DIARY_COLUMNS, PET_COLUMNS, UI_LIMITS, DATE_FORMAT_LENGTHS } from '../constants';

export async function handleQueryIntent(parsedData: ParsedMessage): Promise<string> {
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

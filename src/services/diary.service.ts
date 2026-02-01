import { readSheet, appendSheet, updateSheet } from '../sheets';
import { DIARY_COLUMNS } from '../constants';

export class DiaryService {
  static async getDiaryEntries(): Promise<string[][]> {
    return (await readSheet('Diary!A:D')) || [];
  }

  static async addEntry(time: string, petName: string, action: string, description: string): Promise<void> {
    const newRow = [];
    newRow[DIARY_COLUMNS.TIME] = time;
    newRow[DIARY_COLUMNS.PET_NAME] = petName;
    newRow[DIARY_COLUMNS.ACTION] = action;
    newRow[DIARY_COLUMNS.DESCRIPTION] = description;
    await appendSheet('Diary!A:D', [newRow]);
  }

  static async findEntry(petName?: string | null, time?: string | null): Promise<{ index: number; data: string[] } | null> {
    const entries = await this.getDiaryEntries();
    if (entries.length === 0) return null;

    let index = -1;
    if (petName || time) {
      index = entries.findLastIndex(row => {
        const petMatch = !petName || row[DIARY_COLUMNS.PET_NAME] === petName;
        const timeMatch = !time || row[DIARY_COLUMNS.TIME].includes(time);
        return petMatch && timeMatch;
      });
    } else {
      index = entries.length - 1;
    }

    return index !== -1 ? { index, data: entries[index] } : null;
  }

  static async updateEntry(index: number, updatedRow: string[]): Promise<void> {
    await updateSheet(`Diary!A${index + 1}:D${index + 1}`, [updatedRow]);
  }
}

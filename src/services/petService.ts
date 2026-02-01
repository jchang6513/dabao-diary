import { readSheet, appendSheet, updateSheet } from '../sheets';
import { PET_COLUMNS } from '../constants';

export class PetService {
  static async getAllPetNames(): Promise<string[]> {
    const petsData = await readSheet('Pets!A:A');
    return petsData ? petsData.flat().filter(Boolean) : [];
  }

  static async getPetsWithInfo(): Promise<string[][]> {
    return (await readSheet('Pets!A:B')) || [];
  }

  static async addPet(name: string, type: string = '未知'): Promise<void> {
    await appendSheet('Pets!A:B', [[name, type]]);
  }

  static async updatePet(oldName: string, newName: string, newType: string): Promise<void> {
    const petsData = await this.getPetsWithInfo();
    const rowIndex = petsData.findIndex(row => row[PET_COLUMNS.NAME] === oldName);
    if (rowIndex !== -1) {
      await updateSheet(`Pets!A${rowIndex + 1}:B${rowIndex + 1}`, [[newName, newType]]);
    }
  }

  static async exists(name: string): Promise<boolean> {
    const names = await this.getAllPetNames();
    return names.includes(name);
  }
}

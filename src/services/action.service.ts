import { readSheet, appendSheet } from '../sheets';

export class ActionService {
  static async getAllActions(): Promise<string[]> {
    const actionsData = await readSheet('Actions!A:A');
    return actionsData ? actionsData.flat().filter(Boolean) : [];
  }

  static async ensureActionExists(actionName: string): Promise<void> {
    const actions = await this.getAllActions();
    if (!actions.includes(actionName)) {
      await appendSheet('Actions!A:A', [[actionName]]);
    }
  }
}

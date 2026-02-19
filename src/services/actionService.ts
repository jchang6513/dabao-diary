import { readSheet, appendSheet } from '../sheets';
import { metadataService } from './metadataService';

export class ActionService {
  static async getAllActions(): Promise<string[]> {
    const metadata = await metadataService.getMetadata();
    return metadata.actions;
  }

  static async ensureActionExists(actionName: string): Promise<void> {
    const actions = await this.getAllActions();
    if (!actions.includes(actionName)) {
      await appendSheet('Actions!A:A', [[actionName]]);
      metadataService.clearCache();
    }
  }
}

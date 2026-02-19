import { batchReadSheet } from '../sheets';

export interface AppMetadata {
  pets: string[];
  actions: string[];
}

class MetadataService {
  private cache: AppMetadata | null = null;
  private lastFetch: number = 0;
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getMetadata(): Promise<AppMetadata> {
    const now = Date.now();
    if (this.cache && (now - this.lastFetch < this.CACHE_TTL)) {
      return this.cache;
    }

    const [petsData, actionsData] = await batchReadSheet(['Pets!A:A', 'Actions!A:A']);
    
    this.cache = {
      pets: petsData ? petsData.flat().filter(Boolean) : [],
      actions: actionsData ? actionsData.flat().filter(Boolean) : []
    };
    this.lastFetch = now;
    
    return this.cache;
  }

  /**
   * Clear the cache to force a fresh fetch next time.
   * Call this after adding a pet or an action.
   */
  clearCache() {
    this.cache = null;
    this.lastFetch = 0;
  }
}

export const metadataService = new MetadataService();

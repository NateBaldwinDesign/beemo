export interface Preferences {
  muted: boolean;
  volume: number;
  best: number;
  bestStars: number;
  bestCrossing: number;
}

const KEY = 'beemo-pocket:v1';
export const DEFAULTS: Preferences = { muted: false, volume: 0.55, best: 0, bestStars: 0, bestCrossing: 0 };

export function loadPreferences(storage: Storage, report: (message: string) => void): Preferences {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) throw new Error('Invalid preferences');
    const data = value as Record<string, unknown>;
    if (typeof data.muted !== 'boolean' || typeof data.volume !== 'number'
      || !Number.isFinite(data.volume) || data.volume < 0 || data.volume > 1
      || typeof data.best !== 'number' || !Number.isSafeInteger(data.best) || data.best < 0) {
      throw new Error('Invalid preferences');
    }
    for (const key of ['bestStars', 'bestCrossing']) {
      if (data[key] !== undefined && (typeof data[key] !== 'number' || !Number.isSafeInteger(data[key]) || data[key] < 0)) {
        throw new Error('Invalid arcade best score');
      }
    }
    return {
      muted: data.muted, volume: data.volume, best: data.best,
      bestStars: typeof data.bestStars === 'number' ? data.bestStars : 0,
      bestCrossing: typeof data.bestCrossing === 'number' ? data.bestCrossing : 0,
    };
  } catch (error) {
    console.warn('Could not read Beemo preferences', error);
    report('Saved settings could not be read. Using the default settings.');
    return { ...DEFAULTS };
  }
}

export function savePreferences(storage: Storage, preferences: Preferences, report: (message: string) => void) {
  try {
    storage.setItem(KEY, JSON.stringify(preferences));
  } catch (error) {
    console.warn('Could not save Beemo preferences', error);
    report('This browser could not save your settings or best score.');
  }
}

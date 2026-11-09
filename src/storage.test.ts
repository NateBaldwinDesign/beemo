import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULTS, loadPreferences, savePreferences } from './storage';

describe('saved settings', () => {
  beforeEach(() => localStorage.clear());
  it('uses defaults on a first visit and round-trips valid settings', () => {
    const report = vi.fn();
    expect(loadPreferences(localStorage, report)).toEqual(DEFAULTS);
    const settings = { muted: true, volume: 0.3, best: 1200 };
    savePreferences(localStorage, settings, report);
    expect(loadPreferences(localStorage, report)).toEqual(settings);
    expect(report).not.toHaveBeenCalled();
  });
  it.each(['broken', '{}', '{"muted":true,"volume":2,"best":1}', '{"muted":false,"volume":0.5,"best":-5}'])('reports invalid data: %s', raw => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('beemo-pocket:v1', raw);
    const report = vi.fn();
    expect(loadPreferences(localStorage, report)).toEqual(DEFAULTS);
    expect(report).toHaveBeenCalledOnce();
  });
  it('reports a blocked write rather than claiming persistence', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    const report = vi.fn();
    savePreferences(localStorage, DEFAULTS, report);
    expect(report).toHaveBeenCalledOnce();
  });
});

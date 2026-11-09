import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Face, interpolate, mouthPath } from './face';

let reduced = false;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
});
afterEach(() => { reduced = false; vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('expression geometry', () => {
  it('interpolates matching path coordinates and clamps progress', () => {
    const a = { mouth: Array(14).fill(0) as number[], eye: 1, tilt: 0, tongue: 0 };
    const b = { mouth: Array(14).fill(10) as number[], eye: 0, tilt: 10, tongue: 1 };
    expect(interpolate(a, b, 0.5).mouth).toEqual(Array(14).fill(5));
    expect(interpolate(a, b, 2)).toEqual(b);
    expect(interpolate(a, b, -1)).toEqual(a);
    expect(mouthPath(a.mouth).match(/C/g)).toHaveLength(2);
  });
});

describe('face lifecycle', () => {
  it('reacts immediately, prevents shake from starving touch, and recovers', () => {
    const host = document.createElement('div');
    const speak = vi.fn();
    const face = new Face(host, speak, vi.fn());
    face.react('ouch', -1);
    expect(face.expression).toBe('ouch');
    face.react('shake', 0, 'motion');
    expect(face.expression).toBe('ouch');
    face.react('laugh');
    expect(face.expression).toBe('laugh');
    vi.advanceTimersByTime(900);
    expect(face.expression).toBe('idle');
    face.suspend();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('bounds repeated reactions and suspends every timer', () => {
    const face = new Face(document.createElement('div'), vi.fn(), vi.fn());
    for (let i = 0; i < 200; i++) face.react('ouch');
    expect(vi.getTimerCount()).toBeLessThanOrEqual(2);
    face.suspend();
    expect(vi.getTimerCount()).toBe(0);
    face.react('hello');
    expect(face.expression).toBe('idle');
    face.resume();
    expect(vi.getTimerCount()).toBe(1);
    face.suspend();
  });
  it('does not schedule idle motion when reduced motion is requested', () => {
    reduced = true;
    const face = new Face(document.createElement('div'), vi.fn(), vi.fn());
    expect(vi.getTimerCount()).toBe(0);
    face.react('ouch'); vi.advanceTimersByTime(1200);
    expect(face.expression).toBe('idle');
    expect(vi.getTimerCount()).toBe(0);
    face.suspend();
  });
});

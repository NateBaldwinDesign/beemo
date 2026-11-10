import { describe, expect, it, vi } from 'vitest';
import { MotionInput, ShakeDetector } from './motion';

describe('shake detection', () => {
  it('filters gravity and small movements, requires three peaks, and cools down', () => {
    const shake = new ShakeDetector();
    expect(shake.sample(0, 0, 9.8, 0)).toBe(false);
    expect(shake.sample(0, 1, 9.8, 10)).toBe(false);
    expect(shake.sample(30, 0, 9.8, 100)).toBe(false);
    expect(shake.sample(-30, 0, 9.8, 180)).toBe(false);
    expect(shake.sample(30, 0, 9.8, 260)).toBe(true);
    expect(shake.sample(-30, 0, 9.8, 300)).toBe(false);
    expect(shake.sample(NaN, 0, 0, 400)).toBe(false);
    shake.reset();
    expect(shake.sample(30, 0, 0, 500)).toBe(false);
  });
  it('discards peaks outside the window', () => {
    const shake = new ShakeDetector();
    shake.sample(0, 0, 0, 0);
    shake.sample(30, 0, 0, 20);
    expect(shake.sample(-30, 0, 0, 1000)).toBe(false);
  });
  it('reports continuing shaking again after cooldown without flooding callbacks', () => {
    const detector = new ShakeDetector();
    const shakes: number[] = [];
    for (let time = 0; time <= 3600; time += 80) {
      if (detector.sample((time / 80) % 2 ? 30 : -30, 0, 0, time)) shakes.push(time);
    }
    expect(shakes.length).toBeGreaterThanOrEqual(2);
    expect(shakes[1]! - shakes[0]!).toBeGreaterThanOrEqual(1400);
    expect(shakes[1]! - shakes[0]!).toBeLessThan(2000);
  });
});

describe('motion permissions', () => {
  it('reports unsupported motion and denial', async () => {
    const report = vi.fn();
    const noAPI = new MotionInput(vi.fn(), report, undefined);
    expect(await noAPI.enable()).toBe(false);
    const denied = new MotionInput(vi.fn(), report, { requestPermission: vi.fn().mockResolvedValue('denied') });
    expect(await denied.enable()).toBe(false);
    expect(report).toHaveBeenCalledTimes(2);
  });
  it('attaches once after permission, detaches on suspension, and handles rejection', async () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const report = vi.fn();
    const requestPermission = vi.fn().mockResolvedValue('granted');
    const input = new MotionInput(vi.fn(), report, { requestPermission });
    expect(await input.enable()).toBe(true);
    input.resume();
    expect(add.mock.calls.filter(call => call[0] === 'devicemotion')).toHaveLength(1);
    input.suspend(); input.resume(); input.disable(); input.resume();
    expect(remove.mock.calls.filter(call => call[0] === 'devicemotion')).toHaveLength(2);
    requestPermission.mockRejectedValue(new Error('Blocked'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await input.enable()).toBe(false);
    expect(report).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { RepeatInput, TickleGesture } from './gestures';

describe('tickling', () => {
  it('requires three significant direction changes within a short gesture', () => {
    const gesture = new TickleGesture();
    gesture.start(1, 100, 0);
    expect(gesture.move(1, 125, 50)).toBe(false);
    expect(gesture.move(1, 90, 100)).toBe(false);
    expect(gesture.move(1, 125, 150)).toBe(false);
    expect(gesture.move(1, 90, 200)).toBe(true);
    expect(gesture.move(1, 91, 220)).toBe(false);
  });
  it('ignores jitter, expired gestures, ended pointers, and unrelated fingers', () => {
    const gesture = new TickleGesture();
    gesture.start(1, 100, 0);
    expect(gesture.move(1, 105, 50)).toBe(false);
    expect(gesture.move(2, 50, 100)).toBe(false);
    expect(gesture.move(1, 150, 1000)).toBe(false);
    gesture.end(1);
    expect(gesture.move(1, 40, 1050)).toBe(false);
    gesture.start(2, 100, 0);
    gesture.clear();
    expect(gesture.move(2, 120, 10)).toBe(false);
  });
});

describe('held controls', () => {
  it('has a 180 ms initial delay and 70 ms repeats without duplicate keydown presses', () => {
    const perform = vi.fn();
    const input = new RepeatInput(perform);
    input.press('key', 'left'); input.press('key', 'left');
    input.tick(179);
    expect(perform).toHaveBeenCalledTimes(1);
    input.tick(1);
    input.tick(140);
    expect(perform).toHaveBeenCalledTimes(4);
    input.release('key'); input.tick(1000);
    expect(perform).toHaveBeenCalledTimes(4);
  });
  it('supports independent fingers and releases everything on cancellation', () => {
    const perform = vi.fn();
    const input = new RepeatInput(perform);
    input.press('finger1', 'left'); input.press('finger2', 'down');
    input.tick(65);
    expect(perform.mock.calls.map(call => call[0])).toEqual(['left', 'down', 'down']);
    input.clear(); input.tick(1000);
    expect(perform).toHaveBeenCalledTimes(3);
  });
  it('uses game-specific repeat timing for firing and upward hops', () => {
    const perform = vi.fn();
    const input = new RepeatInput(perform, control => control === 'fire'
      ? { delay: 100, interval: 100 } : { delay: 180, interval: 180 });
    input.press('shot', 'fire');
    input.press('hop', 'up');
    input.tick(99);
    expect(perform.mock.calls.map(call => call[0])).toEqual(['fire', 'up']);
    input.tick(1);
    input.tick(80);
    expect(perform.mock.calls.map(call => call[0])).toEqual(['fire', 'up', 'fire', 'up']);
    input.clear();
    input.tick(500);
    expect(perform).toHaveBeenCalledTimes(4);
  });
});

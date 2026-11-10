import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArcadeView } from './arcade-view';
import { Crossing } from './crossing';
import { Shooter } from './shooter';

const drawing = {
  scale: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(), save: vi.fn(), restore: vi.fn(),
  beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(),
};

describe('arcade display and lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(vi.fn().mockReturnValue(drawing));
    vi.stubGlobal('devicePixelRatio', 3);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it.each(['stars', 'crossing'] as const)('renders %s with capped resolution, no idle loop, and refreshes the shared canvas', id => {
    const frame = vi.spyOn(window, 'requestAnimationFrame');
    const status = vi.fn();
    const canvas = document.createElement('canvas');
    const view = new ArcadeView(id, canvas, status, vi.fn());
    expect(canvas.width).toBe(720);
    expect(canvas.height).toBe(540);
    expect(drawing.scale).toHaveBeenLastCalledWith(2, 2);
    expect(frame).not.toHaveBeenCalled();
    view.refresh();
    expect(status).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'ready' }));
    expect(drawing.fillRect).toHaveBeenCalled();
  });

  it.each(['stars', 'crossing'] as const)('runs only while playing and clears held inputs on pause for %s', id => {
    const view = new ArcadeView(id, document.createElement('canvas'), vi.fn(), vi.fn());
    view.start();
    view.input.press('finger', 'right');
    vi.advanceTimersByTime(250);
    view.pause();
    const x = view.game.playerX;
    const before = JSON.stringify(view.game);
    vi.advanceTimersByTime(2000);
    expect(JSON.stringify(view.game)).toBe(before);
    view.resume();
    vi.advanceTimersByTime(200);
    expect(view.game.playerX).toBe(x);
    view.pause();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fires continuously on held input and dispatches scoring sounds and summaries', () => {
    const sound = vi.fn(), status = vi.fn();
    const view = new ArcadeView('stars', document.createElement('canvas'), status, sound);
    const game = view.game as Shooter;
    view.start();
    view.input.press('fire', 'fire');
    vi.advanceTimersByTime(420);
    expect(game.shots.filter(shot => !shot.enemy)).toHaveLength(3);
    view.input.clear();
    game.targets = [{ x: 100, y: 70, alive: true }];
    game.shots = [{ x: 100, y: 80, enemy: false }];
    vi.advanceTimersByTime(100);
    expect(sound).toHaveBeenCalledWith('clear');
    expect(status).toHaveBeenLastCalledWith(expect.objectContaining({ score: 10 }));
    view.pause();
  });

  it('maps both action buttons to forward hops and reports a crossing loss', () => {
    const view = new ArcadeView('crossing', document.createElement('canvas'), vi.fn(), vi.fn());
    const game = view.game as Crossing;
    view.start(); view.rotate();
    expect(game.row).toBe(1);
    vi.advanceTimersByTime(180);
    Object.assign(game.lanes.find(value => value.row === 2)!, { offset: 0, speed: 0 });
    view.drop();
    expect(game.row).toBe(2);
    expect(game.phase).toBe('over');
    expect(vi.getTimerCount()).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { Crossing, laneObjects, type Lane } from './crossing';
import { seededRandom } from './rules';

function rest(game: Crossing) { game.tick(100); game.tick(100); }
function lane(game: Crossing, row: number): Lane { return game.lanes.find(candidate => candidate.row === row)!; }

describe('Pixel Crossing', () => {
  it('generates reproducible lanes, starting with safe grass and bounded traffic/logs', () => {
    const a = new Crossing(seededRandom(12)), b = new Crossing(seededRandom(12));
    a.hop('up'); a.tick(100);
    expect(a.phase).toBe('ready');
    a.start(); b.start();
    expect(a.lanes).toEqual(b.lanes);
    expect(a.lanes.map(value => value.kind)).toEqual(['grass', 'grass', 'road', 'road', 'river', 'river', 'grass', 'grass', 'road']);
    expect(laneObjects(lane(a, 0))).toEqual([]);
    for (const value of a.lanes.slice(2)) {
      expect(laneObjects(value).length).toBeLessThanOrEqual(4);
      expect(laneObjects(value).every(object => object.width === (value.kind === 'road' ? 1.35 : value.kind === 'river' ? 3.2 : 0))).toBe(true);
    }
  });

  it('hops four ways with a cooldown, scores only new rows, and prevents leaving the board', () => {
    const game = new Crossing();
    game.start(); game.hop('up'); game.hop('up');
    expect(game.row).toBe(1);
    expect(game.score).toBe(1);
    rest(game); game.hop('down');
    expect(game.row).toBe(0);
    expect(game.score).toBe(1);
    rest(game); game.hop('down');
    expect(game.row).toBe(0);
    for (let i = 0; i < 10; i++) { rest(game); game.hop('left'); }
    expect(game.playerX).toBe(0.5);
    for (let i = 0; i < 20; i++) { rest(game); game.hop('right'); }
    expect(game.playerX).toBe(8.5);
  });

  it('detects a car immediately when hopping into its lane', () => {
    const game = new Crossing();
    game.start();
    Object.assign(lane(game, 2), { offset: 0, speed: 0 });
    game.hop('up'); rest(game); game.hop('up');
    expect(game.phase).toBe('over');
    expect(game.reason).toContain('traffic');
    expect(game.takeEvents()).toContain('over');
  });

  it('detects traffic moving into the player between hops', () => {
    const game = new Crossing();
    game.start(); game.row = 2;
    Object.assign(lane(game, 2), { offset: 2, speed: 10 });
    game.tick(100);
    expect(game.phase).toBe('over');
  });

  it('carries the player with a log and preserves its support through offset wrapping', () => {
    const game = new Crossing();
    game.start(); game.row = 4;
    Object.assign(lane(game, 4), { offset: 11.99, speed: 1 });
    game.tick(100);
    expect(game.playerX).toBeCloseTo(4.6);
    expect(game.phase).toBe('playing');
    expect(lane(game, 4).offset).toBeCloseTo(0.09);
  });

  it('ends in uncovered water or when carried beyond the screen', () => {
    const game = new Crossing();
    game.start(); game.row = 4;
    Object.assign(lane(game, 4), { offset: 1, speed: 0 });
    game.tick(20);
    expect(game.phase).toBe('over');
    expect(game.summary.message).toContain('Splash');
    game.start(); game.row = 4; game.playerX = 8.79;
    Object.assign(lane(game, 4), { offset: 0.5, speed: 1 });
    game.tick(100);
    expect(game.phase).toBe('over');
    expect(game.reason).toContain('drifted');
  });

  it('checks log support immediately after a hop', () => {
    const game = new Crossing();
    game.start(); game.row = 3;
    Object.assign(lane(game, 3), { offset: 2, speed: 0 });
    Object.assign(lane(game, 4), { offset: 1, speed: 0 });
    game.hop('up');
    expect(game.phase).toBe('over');
    expect(game.reason).toContain('Splash');
  });

  it('keeps endless lanes bounded, increases difficulty, and limits backward travel', () => {
    const game = new Crossing(seededRandom(9));
    game.start();
    for (let row = 1; row <= 120; row++) {
      for (const value of game.lanes) { value.kind = 'grass'; value.speed = 0; }
      rest(game); game.hop('up');
      expect(game.phase).toBe('playing');
      expect(game.lanes.length).toBeLessThanOrEqual(11);
      expect(game.score).toBe(row);
    }
    expect(game.level).toBe(11);
    for (let i = 0; i < 5; i++) { rest(game); game.hop('down'); }
    expect(game.row).toBe(118);
    expect(game.score).toBe(120);
    expect(game.takeEvents()).toContain('clear');
  });

  it('freezes timers, movement, and lanes on pause, then restarts cleanly', () => {
    const game = new Crossing();
    game.start(); game.hop('up'); game.pause();
    const before = JSON.stringify(game);
    game.tick(1000); game.hop('right');
    expect(JSON.stringify(game)).toBe(before);
    game.resume(); rest(game); game.hop('right');
    expect(game.playerX).toBe(5.5);
    game.start();
    expect(game.row).toBe(0);
    expect(game.farthest).toBe(0);
    expect(game.score).toBe(0);
    expect(game.playerX).toBe(4.5);
    expect(game.reason).toBe('');
    expect(game.takeEvents()).toEqual([]);
  });
});

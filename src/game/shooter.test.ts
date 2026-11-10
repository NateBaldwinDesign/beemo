import { describe, expect, it } from 'vitest';
import { Shooter } from './shooter';
import { seededRandom } from './rules';

function advance(game: Shooter, milliseconds: number) {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 20) game.tick(Math.min(20, milliseconds - elapsed));
}

describe('Star Patrol', () => {
  it('starts three lives and 21 targets, and clamps movement to the playfield', () => {
    const game = new Shooter(seededRandom(5));
    game.move(-1); game.fire(); game.tick(100);
    expect(game.phase).toBe('ready');
    expect(game.shots).toEqual([]);
    game.start();
    expect(game.targets).toHaveLength(21);
    expect(game.summary).toMatchObject({ phase: 'playing', score: 0, level: 1, detailValue: 3 });
    for (let i = 0; i < 50; i++) game.move(-1);
    expect(game.playerX).toBe(8);
    for (let i = 0; i < 50; i++) game.move(1);
    expect(game.playerX).toBe(208);
  });

  it('limits firing by cooldown and simultaneous shot count', () => {
    const game = new Shooter();
    game.start();
    game.fire(); game.fire();
    expect(game.shots).toHaveLength(1);
    advance(game, 179); game.fire();
    expect(game.shots).toHaveLength(1);
    advance(game, 1); game.fire();
    advance(game, 180); game.fire();
    advance(game, 180); game.fire();
    expect(game.shots.filter(shot => !shot.enemy)).toHaveLength(3);
  });

  it('scores hits once, clears the wave, then starts a harder wave after a short break', () => {
    const game = new Shooter();
    game.start();
    game.targets = [{ x: 100, y: 70, alive: true }];
    game.shots = [{ x: 100, y: 80, enemy: false }, { x: 100, y: 80, enemy: false }];
    game.tick(50);
    expect(game.score).toBe(10);
    expect(game.takeEvents()).toEqual(['lock', 'clear']);
    expect(game.takeEvents()).toEqual([]);
    expect(game.shots).toEqual([]);
    game.fire();
    expect(game.shots).toEqual([]);
    advance(game, 880);
    expect(game.level).toBe(1);
    advance(game, 20);
    expect(game.level).toBe(2);
    expect(game.targets).toHaveLength(21);
    expect(game.targets.every(target => target.alive)).toBe(true);
    game.targets = [{ x: 100, y: 70, alive: true }];
    game.shots = [{ x: 100, y: 80, enemy: false }];
    game.tick(50);
    expect(game.score).toBe(30);
  });

  it('uses temporary damage protection and ends when all lives are lost', () => {
    const game = new Shooter(seededRandom(8));
    game.start();
    const hit = () => { game.shots = [{ x: game.playerX, y: 217, enemy: true }]; game.tick(20); };
    hit();
    expect(game.lives).toBe(2);
    hit();
    expect(game.lives).toBe(2);
    advance(game, 1500);
    hit();
    expect(game.lives).toBe(1);
    advance(game, 1500);
    hit();
    expect(game.lives).toBe(0);
    expect(game.phase).toBe('over');
    expect(game.takeEvents()).toContain('over');
    expect(game.shots).toEqual([]);
    game.start();
    expect(game.lives).toBe(3);
    expect(game.score).toBe(0);
    expect(game.invulnerable).toBe(0);
  });

  it('reverses and descends at an edge, losing when the formation reaches the ship', () => {
    const game = new Shooter();
    game.start();
    game.targets = [{ x: 207, y: 198, alive: true }];
    game.tick(20);
    expect(game.targets[0]!.y).toBe(207);
    expect(game.phase).toBe('over');
    expect(game.takeEvents()).toEqual(['over']);
  });

  it('fires enemy shots from the bottom of a column and bounds projectile storage', () => {
    const game = new Shooter(seededRandom(7));
    game.start();
    advance(game, 920);
    const enemy = game.shots.find(shot => shot.enemy)!;
    expect(enemy).toBeDefined();
    expect(enemy.y).toBeGreaterThan(68);
    for (let i = 0; i < 3000 && game.phase === 'playing'; i++) {
      game.fire(); game.tick(20);
      expect(game.shots.filter(shot => shot.enemy).length).toBeLessThanOrEqual(5);
      expect(game.shots.filter(shot => !shot.enemy).length).toBeLessThanOrEqual(3);
      expect(game.shots.every(shot => shot.y >= 0 && shot.y <= 244)).toBe(true);
    }
  });

  it('freezes controls, bullets, and clocks while paused, and resumes deliberately', () => {
    const game = new Shooter();
    game.start(); game.fire(); game.pause();
    const before = JSON.stringify(game);
    game.tick(1000); game.fire(); game.move(-1);
    expect(JSON.stringify(game)).toBe(before);
    game.resume(); game.tick(20);
    expect(game.shots[0]!.y).toBeLessThan(218);
  });

  it('caps catch-up time after a long frame', () => {
    const a = new Shooter(seededRandom(3)), b = new Shooter(seededRandom(3));
    a.start(); b.start(); a.fire(); b.fire();
    a.tick(10000); b.tick(100);
    expect(a.targets).toEqual(b.targets);
    expect(a.shots).toEqual(b.shots);
  });
});

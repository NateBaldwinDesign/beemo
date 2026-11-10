import type { Phase } from './rules';
import type { ArcadeSound, GameSummary } from './arcade';

export interface Target { x: number; y: number; alive: boolean }
export interface Shot { x: number; y: number; enemy: boolean }

export class Shooter {
  phase: Phase = 'ready';
  score = 0;
  level = 1;
  lives = 3;
  playerX = 108;
  targets: Target[] = [];
  shots: Shot[] = [];
  invulnerable = 0;
  private direction = 1;
  private fireCooldown = 0;
  private enemyCooldown = 900;
  private waveDelay = 0;
  private events: ArcadeSound[] = [];

  constructor(private random: () => number = Math.random) {}

  get summary(): GameSummary {
    return { phase: this.phase, score: this.score, level: this.level, detailLabel: 'LIVES', detailValue: this.lives };
  }

  start() {
    this.phase = 'playing';
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.playerX = 108;
    this.invulnerable = 0;
    this.events = [];
    this.spawnWave();
  }

  pause() { if (this.phase === 'playing') this.phase = 'paused'; }
  resume() { if (this.phase === 'paused') this.phase = 'playing'; }

  move(direction: -1 | 1) {
    if (this.phase === 'playing') this.playerX = Math.max(8, Math.min(208, this.playerX + direction * 7));
  }

  fire() {
    if (this.phase !== 'playing' || this.fireCooldown > 0 || this.waveDelay > 0
      || this.shots.filter(shot => !shot.enemy).length >= 3) return;
    this.shots.push({ x: this.playerX, y: 218, enemy: false });
    this.fireCooldown = 180;
  }

  tick(delta: number) {
    if (this.phase !== 'playing') return;
    const dt = Math.max(0, Math.min(100, delta));
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.waveDelay > 0) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) { this.level++; this.spawnWave(); }
      return;
    }

    const alive = this.targets.filter(target => target.alive);
    const speed = Math.min(70, 9 + this.level * 3 + (21 - alive.length) * 0.6);
    const advance = this.direction * speed * dt / 1000;
    const edge = alive.some(target => target.x + advance < 9 || target.x + advance > 207);
    if (edge) {
      this.direction *= -1;
      alive.forEach(target => { target.y += 9; });
    } else {
      alive.forEach(target => { target.x += advance; });
    }
    if (alive.some(target => target.y >= 207)) { this.end(); return; }

    this.enemyCooldown -= dt;
    if (this.enemyCooldown <= 0 && alive.length && this.shots.filter(shot => shot.enemy).length < 5) {
      const columns = alive.filter(target => !alive.some(other => Math.abs(other.x - target.x) < 1 && other.y > target.y));
      const target = columns[Math.floor(this.random() * columns.length)]!;
      this.shots.push({ x: target.x, y: target.y + 7, enemy: true });
      this.enemyCooldown = Math.max(330, 1100 - this.level * 70);
    }

    const remaining: Shot[] = [];
    for (const shot of this.shots) {
      const before = shot.y;
      shot.y += (shot.enemy ? 85 + Math.min(this.level, 12) * 4 : -240) * dt / 1000;
      if (shot.enemy) {
        if (this.invulnerable === 0 && Math.abs(shot.x - this.playerX) < 8 && before <= 232 && shot.y >= 218) {
          this.lives--;
          this.invulnerable = 1500;
          this.events.push('lock');
          if (this.lives === 0) { this.end(); return; }
          continue;
        }
      } else {
        const hit = alive.find(target => target.alive && Math.abs(shot.x - target.x) < 8
          && before >= target.y - 7 && shot.y <= target.y + 7);
        if (hit) {
          hit.alive = false;
          this.score += 10 * this.level;
          this.events.push('lock');
          continue;
        }
      }
      if (shot.y >= 0 && shot.y <= 244) remaining.push(shot);
    }
    this.shots = remaining;
    if (this.targets.every(target => !target.alive)) {
      this.waveDelay = 900;
      this.shots = [];
      this.events.push('clear');
    }
  }

  takeEvents() { return this.events.splice(0); }

  private spawnWave() {
    this.direction = 1;
    this.shots = [];
    this.fireCooldown = 0;
    this.enemyCooldown = 900;
    this.waveDelay = 0;
    this.targets = Array.from({ length: 21 }, (_, index) => ({
      x: 24 + index % 7 * 27,
      y: 24 + Math.floor(index / 7) * 22,
      alive: true,
    }));
  }

  private end() {
    this.phase = 'over';
    this.shots = [];
    this.events.push('over');
  }
}

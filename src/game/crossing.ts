import type { HeldDirection } from '../input/gestures';
import type { Phase } from './rules';
import type { ArcadeSound, GameSummary } from './arcade';

export interface Lane {
  row: number;
  kind: 'grass' | 'road' | 'river';
  offset: number;
  speed: number;
}
export interface Obstacle { x: number; width: number }
export const CROSSING_COLUMNS = 9;
const PERIOD = 12;

export function laneObjects(lane: Lane): Obstacle[] {
  if (lane.kind === 'grass') return [];
  const width = lane.kind === 'road' ? 1.35 : 3.2;
  const objects: Obstacle[] = [];
  for (let i = -1; i < 4; i++) {
    const x = ((lane.offset % 4) + 4) % 4 + i * 4;
    if (x + width >= 0 && x <= CROSSING_COLUMNS) objects.push({ x, width });
  }
  return objects;
}

export class Crossing {
  phase: Phase = 'ready';
  score = 0;
  playerX = 4.5;
  row = 0;
  farthest = 0;
  elapsed = 0;
  lanes: Lane[] = [];
  reason = '';
  private hopCooldown = 0;
  private events: ArcadeSound[] = [];

  constructor(private random: () => number = Math.random) {}
  get level() { return 1 + Math.floor(this.farthest / 12); }
  get summary(): GameSummary {
    return { phase: this.phase, score: this.score, level: this.level, detailLabel: 'HOPS', detailValue: this.farthest, message: this.reason };
  }

  start() {
    this.phase = 'playing';
    this.score = this.row = this.farthest = this.elapsed = this.hopCooldown = 0;
    this.playerX = 4.5;
    this.reason = '';
    this.events = [];
    this.lanes = [];
    this.ensureLanes();
  }

  pause() { if (this.phase === 'playing') this.phase = 'paused'; }
  resume() { if (this.phase === 'paused') this.phase = 'playing'; }

  hop(direction: HeldDirection) {
    if (this.phase !== 'playing' || this.hopCooldown > 0) return;
    const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
    const dy = direction === 'up' ? 1 : direction === 'down' ? -1 : 0;
    const x = this.playerX + dx;
    const row = this.row + dy;
    if (x < 0.3 || x > CROSSING_COLUMNS - 0.3 || row < Math.max(0, this.farthest - 2)) return;
    this.playerX = x;
    this.row = row;
    this.hopCooldown = 150;
    if (row > this.farthest) {
      this.farthest = row;
      this.score = row;
      this.events.push(row % 6 === 0 ? 'clear' : 'lock');
    }
    this.ensureLanes();
    this.checkCollision();
  }

  tick(delta: number) {
    if (this.phase !== 'playing') return;
    const dt = Math.max(0, Math.min(100, delta));
    this.elapsed += dt;
    this.hopCooldown = Math.max(0, this.hopCooldown - dt);
    const lane = this.lanes.find(candidate => candidate.row === this.row)!;
    if (lane.kind === 'river') {
      const supported = laneObjects(lane).some(log => this.playerX >= log.x + 0.2 && this.playerX <= log.x + log.width - 0.2);
      if (!supported) { this.end('Splash! Aim for a floating log.'); return; }
      this.playerX += lane.speed * dt / 1000;
    }
    for (const moving of this.lanes) moving.offset = (moving.offset + moving.speed * dt / 1000 + PERIOD) % PERIOD;
    this.checkCollision();
  }

  takeEvents() { return this.events.splice(0); }

  private ensureLanes() {
    const minimum = Math.max(0, this.farthest - 2);
    this.lanes = this.lanes.filter(lane => lane.row >= minimum);
    const last = this.lanes.at(-1)?.row ?? minimum - 1;
    for (let row = last + 1; row <= this.farthest + 8; row++) {
      const cycle = row % 6;
      const kind = cycle < 2 ? 'grass' : cycle < 4 ? 'road' : 'river';
      const direction = row % 2 === 0 ? 1 : -1;
      const speed = kind === 'grass' ? 0 : direction * (0.65 + this.random() * 0.45 + Math.min(0.7, row / 100));
      this.lanes.push({ row, kind, speed, offset: this.random() * PERIOD });
    }
  }

  private checkCollision() {
    if (this.playerX < 0.2 || this.playerX > CROSSING_COLUMNS - 0.2) {
      this.end('That log drifted out of reach.');
      return;
    }
    const lane = this.lanes.find(candidate => candidate.row === this.row)!;
    if (lane.kind === 'road' && laneObjects(lane).some(car => this.playerX + 0.25 > car.x && this.playerX - 0.25 < car.x + car.width)) {
      this.end('Watch the traffic! Try another crossing.');
    } else if (lane.kind === 'river' && !laneObjects(lane).some(log => this.playerX >= log.x + 0.2 && this.playerX <= log.x + log.width - 0.2)) {
      this.end('Splash! Aim for a floating log.');
    }
  }

  private end(reason: string) {
    this.reason = reason;
    this.phase = 'over';
    this.events.push('over');
  }
}

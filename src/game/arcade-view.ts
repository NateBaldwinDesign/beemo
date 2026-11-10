import { RepeatInput, type HeldControl } from '../input/gestures';
import type { ArcadeSound, GameId, GameSummary } from './arcade';
import { Crossing, laneObjects } from './crossing';
import { Shooter } from './shooter';

const ENEMY = ['..####..', '.######.', '##.##.##', '########', '..#..#..', '.#....#.'];
const SHIP = ['...#...', '..###..', '..###..', '.#####.', '#######', '#..#..#'];
const WALKER = ['..####..', '.######.', '.#.##.#.', '.######.', '..####..', '.######.', '..#..#..', '.##..##.'];

function sprite(context: CanvasRenderingContext2D, pattern: string[], x: number, y: number, color: string, scale = 2) {
  context.fillStyle = color;
  pattern.forEach((row, yy) => [...row].forEach((value, xx) => {
    if (value === '#') context.fillRect(Math.round(x) + xx * scale, Math.round(y) + yy * scale, scale, scale);
  }));
}

export class ArcadeView {
  readonly game: Shooter | Crossing;
  readonly input: RepeatInput;
  private context: CanvasRenderingContext2D;
  private frame = 0;
  private previous = 0;
  private accumulator = 0;
  private lastSummary = '';

  constructor(
    readonly id: Exclude<GameId, 'blocks'>,
    canvas: HTMLCanvasElement,
    private status: (summary: GameSummary) => void,
    private sound: (event: ArcadeSound) => void,
  ) {
    this.game = id === 'stars' ? new Shooter() : new Crossing();
    this.input = new RepeatInput(control => this.move(control), control => (
      id === 'crossing' ? { delay: 180, interval: 180 }
        : control === 'fire' ? { delay: 100, interval: 100 } : { delay: 100, interval: 40 }
    ));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser does not support the game display.');
    this.context = context;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = 360 * ratio;
    canvas.height = 270 * ratio;
    context.scale(ratio, ratio);
    context.imageSmoothingEnabled = false;
    this.render();
  }

  start() { this.stop(); this.game.start(); this.changed(); this.run(); }
  pause() { this.game.pause(); this.stop(); this.changed(); }
  resume() { this.game.resume(); this.changed(); this.run(); }
  rotate() { this.action(); }
  drop() { this.action(); }
  refresh() { this.lastSummary = ''; this.changed(); }

  private action() {
    if (this.game instanceof Shooter) this.game.fire();
    else this.game.hop('up');
    this.changed();
    if (this.game.phase !== 'playing') this.stop();
  }

  private move(control: HeldControl) {
    if (this.game instanceof Shooter) {
      if (control === 'fire') this.game.fire();
      else if (control === 'left' || control === 'right') this.game.move(control === 'left' ? -1 : 1);
    } else if (control !== 'fire') {
      this.game.hop(control);
    }
    this.changed();
  }

  private run() {
    if (this.frame || this.game.phase !== 'playing') return;
    this.previous = performance.now();
    this.accumulator = 0;
    const step = (now: number) => {
      this.accumulator += Math.min(100, Math.max(0, now - this.previous));
      this.previous = now;
      while (this.accumulator >= 1000 / 60 && this.game.phase === 'playing') {
        this.input.tick(1000 / 60);
        this.game.tick(1000 / 60);
        this.accumulator -= 1000 / 60;
      }
      this.changed();
      this.frame = this.game.phase === 'playing' ? requestAnimationFrame(step) : 0;
      if (!this.frame) this.input.clear();
    };
    this.frame = requestAnimationFrame(step);
  }

  private stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.input.clear();
  }

  private changed() {
    for (const event of this.game.takeEvents()) this.sound(event);
    const summary = this.game.summary;
    const key = `${summary.phase}:${summary.score}:${summary.level}:${summary.detailValue}`;
    if (key !== this.lastSummary) {
      this.lastSummary = key;
      this.status(summary);
    }
    this.render();
  }

  private render() {
    const c = this.context;
    c.fillStyle = '#173c35';
    c.fillRect(0, 0, 360, 270);
    if (this.game instanceof Shooter) this.renderShooter(this.game);
    else this.renderCrossing(this.game);
  }

  private renderShooter(game: Shooter) {
    const c = this.context;
    c.fillStyle = '#10272e';
    c.fillRect(14, 14, 216, 242);
    c.fillStyle = '#4c777f';
    for (let i = 0; i < 32; i++) c.fillRect(20 + (i * 43) % 204, 20 + (i * 71) % 230, 1, 1);
    for (const target of game.targets) {
      if (target.alive) sprite(c, ENEMY, 14 + target.x - 8, 14 + target.y - 6, target.y < 60 ? '#ba96ec' : '#80e7ad');
    }
    for (const shot of game.shots) {
      c.fillStyle = shot.enemy ? '#ff8b9b' : '#ffe153';
      c.fillRect(Math.round(14 + shot.x), Math.round(14 + shot.y), 2, 5);
    }
    if (Math.floor(game.invulnerable / 100) % 2 === 0) sprite(c, SHIP, game.playerX + 7, 234, '#38d6e5');
    c.fillStyle = '#407c76';
    c.fillRect(14, 253, 216, 2);
    sprite(c, SHIP, 270, 163, '#38d6e5', 3);
  }

  private renderCrossing(game: Crossing) {
    const c = this.context;
    const camera = Math.max(0, game.farthest - 2);
    c.save();
    c.beginPath();
    c.rect(14, 14, 216, 240);
    c.clip();
    c.fillStyle = '#547f45';
    c.fillRect(14, 14, 216, 240);
    for (const lane of game.lanes) {
      const y = 230 - (lane.row - camera) * 24;
      if (y < -10 || y > 254) continue;
      c.fillStyle = lane.kind === 'grass' ? (lane.row % 2 ? '#608c4c' : '#547f45') : lane.kind === 'road' ? '#29383e' : '#286d88';
      c.fillRect(14, y, 216, 24);
      if (lane.kind === 'grass') {
        c.fillStyle = '#7fa55a';
        for (let i = 0; i < 8; i++) c.fillRect(20 + (lane.row * 17 + i * 31) % 204, y + 7 + i % 3 * 4, 3, 2);
      } else if (lane.kind === 'road') {
        c.fillStyle = '#8a958b';
        for (let x = 20; x < 230; x += 24) c.fillRect(x, y + 22, 10, 1);
      } else {
        c.fillStyle = '#438ca0';
        for (let x = 20; x < 230; x += 28) c.fillRect(x, y + 18, 8, 1);
      }
      for (const object of laneObjects(lane)) {
        const x = Math.round(14 + object.x * 24);
        const width = Math.round(object.width * 24);
        if (lane.kind === 'river') {
          c.fillStyle = '#aa8352';
          c.fillRect(x, y + 4, width, 16);
          c.fillStyle = '#725836';
          c.fillRect(x + 3, y + 7, width - 6, 2);
          c.fillRect(x + 3, y + 15, width - 6, 2);
        } else {
          c.fillStyle = '#111e26';
          c.fillRect(x + 3, y + 2, width - 6, 20);
          c.fillStyle = lane.row % 2 ? '#ffb762' : '#fa7188';
          c.fillRect(x, y + 5, width, 14);
          c.fillStyle = '#bce6df';
          c.fillRect(x + 6, y + 7, 7, 10);
          c.fillStyle = '#e9e9a1';
          c.fillRect(lane.speed > 0 ? x + width - 3 : x + 1, y + 6, 2, 3);
        }
      }
    }
    const hop = game.phase === 'playing' ? Math.sin(Math.min(1, (game.elapsed % 180) / 180) * Math.PI) : 0;
    sprite(c, WALKER, 14 + game.playerX * 24 - 8, 233 - (game.row - camera) * 24 - hop, '#ffe153');
    c.restore();
    c.fillStyle = '#8bad9d';
    c.font = '9px monospace';
    c.fillText('GO FAR!', 252, 145);
    sprite(c, WALKER, 270, 163, '#ffe153', 3);
  }
}

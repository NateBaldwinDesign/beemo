import { cells, Game, HIDDEN, type Kind, type Piece } from './rules';
import { RepeatInput, type HeldDirection } from '../input/gestures';

const COLORS: Record<Kind, string> = {
  I: '#38d6e5', O: '#ffe153', T: '#ba96ec', S: '#48e58a', Z: '#fa7188', J: '#729aff', L: '#ffb762',
};

export class GameView {
  readonly game = new Game();
  readonly input = new RepeatInput(direction => this.move(direction));
  private context: CanvasRenderingContext2D;
  private frame = 0;
  private previous = 0;
  private accumulator = 0;
  private lastSummary = '';
  private lastDraw = '';

  constructor(
    canvas: HTMLCanvasElement,
    private status: (game: Game) => void,
    private sound: (event: 'lock' | 'clear' | 'over') => void,
  ) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser does not support the game display.');
    this.context = context;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = 360 * ratio;
    canvas.height = 270 * ratio;
    context.scale(ratio, ratio);
    this.render();
  }

  start() { this.stop(); this.game.start(); this.changed(); this.run(); }
  pause() { this.game.pause(); this.stop(); this.changed(); }
  resume() { this.game.resume(); this.changed(); this.run(); }
  rotate() { if (this.game.rotate()) this.changed(); }
  drop() { this.game.drop(); this.changed(); if (this.game.phase !== 'playing') this.stop(); }

  private move(direction: HeldDirection) {
    if (this.game.move(direction === 'left' ? -1 : direction === 'right' ? 1 : 0, direction === 'down' ? 1 : 0)) this.changed();
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
    const summary = `${this.game.phase}:${this.game.score}:${this.game.lines}:${this.game.next}`;
    if (summary !== this.lastSummary) {
      this.lastSummary = summary;
      this.status(this.game);
    }
    this.render();
  }

  private render() {
    const { game, context: c } = this;
    const key = `${game.revision}:${game.phase}:${game.piece.kind}:${game.piece.rotation}:${game.piece.x}:${game.piece.y}`;
    if (key === this.lastDraw) return;
    this.lastDraw = key;
    c.fillStyle = '#173c35';
    c.fillRect(0, 0, 360, 270);
    c.fillStyle = '#102f2b';
    c.fillRect(29, 13, 142, 242);
    c.strokeStyle = '#25483e';
    c.lineWidth = 0.5;
    for (let x = 0; x <= 10; x++) {
      c.beginPath(); c.moveTo(40 + x * 12, 14); c.lineTo(40 + x * 12, 254); c.stroke();
    }
    for (let y = 0; y <= 20; y++) {
      c.beginPath(); c.moveTo(40, 14 + y * 12); c.lineTo(160, 14 + y * 12); c.stroke();
    }
    game.board.forEach((row, y) => row.forEach((cell, x) => {
      if (cell && y >= HIDDEN) this.block(x, y - HIDDEN, cell);
    }));
    if (game.phase !== 'ready' && game.phase !== 'over') {
      this.piece(game.ghost(), true);
      this.piece(game.piece);
    }
    c.fillStyle = '#8bad9d';
    c.font = '9px monospace';
    c.fillText('NEXT', 204, 121);
    for (const [x, y] of cells(game.next)) {
      c.fillStyle = COLORS[game.next];
      c.fillRect(204 + x * 10, 132 + y * 10, 9, 9);
    }
  }

  private piece(piece: Piece, ghost = false) {
    for (const [x, y] of cells(piece.kind, piece.rotation)) {
      if (piece.y + y >= HIDDEN) this.block(piece.x + x, piece.y + y - HIDDEN, piece.kind, ghost);
    }
  }

  private block(x: number, y: number, kind: Kind, ghost = false) {
    const c = this.context;
    c.fillStyle = COLORS[kind];
    c.strokeStyle = COLORS[kind];
    if (ghost) {
      c.globalAlpha = 0.5;
      c.lineWidth = 1;
      c.strokeRect(41 + x * 12, 15 + y * 12, 9, 9);
      c.globalAlpha = 1;
    } else {
      c.fillRect(40 + x * 12, 14 + y * 12, 11, 11);
      c.fillStyle = '#ffffff55';
      c.fillRect(41 + x * 12, 15 + y * 12, 9, 2);
    }
  }
}

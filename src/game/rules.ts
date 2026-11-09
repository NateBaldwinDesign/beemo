export const WIDTH = 10;
export const HEIGHT = 22;
export const HIDDEN = 2;
export type Kind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type Cell = Kind | null;
export type Board = Cell[][];
export type Phase = 'ready' | 'playing' | 'paused' | 'over';
export interface Piece { kind: Kind; rotation: number; x: number; y: number }
export type GameEvent = 'lock' | 'clear' | 'over';

const SHAPES: Record<Kind, string[]> = {
  I: ['....', 'IIII', '....', '....'],
  O: ['OO', 'OO'],
  T: ['.T.', 'TTT', '...'],
  S: ['.SS', 'SS.', '...'],
  Z: ['ZZ.', '.ZZ', '...'],
  J: ['J..', 'JJJ', '...'],
  L: ['..L', 'LLL', '...'],
};

// Clockwise SRS kick offsets, converted from upward-positive to screen coordinates.
const KICKS = [
  [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
] as const;
const I_KICKS = [
  [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
] as const;

export function cells(kind: Kind, rotation = 0): [number, number][] {
  const shape = SHAPES[kind];
  const result: [number, number][] = [];
  shape.forEach((row, y) => [...row].forEach((value, x) => {
    if (value === '.') return;
    let xx = x;
    let yy = y;
    for (let turn = 0; turn < (kind === 'O' ? 0 : rotation % 4); turn++) {
      [xx, yy] = [shape.length - 1 - yy, xx];
    }
    result.push([xx, yy]);
  }));
  return result;
}

export function emptyBoard(): Board {
  return Array.from({ length: HEIGHT }, () => Array<Cell>(WIDTH).fill(null));
}

export function fits(board: Board, piece: Piece): boolean {
  return cells(piece.kind, piece.rotation).every(([x, y]) => {
    const xx = piece.x + x;
    const yy = piece.y + y;
    return xx >= 0 && xx < WIDTH && yy >= 0 && yy < HEIGHT && board[yy]![xx] === null;
  });
}

export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export class Bag {
  private pieces: Kind[] = [];
  constructor(private random: () => number) {}
  next(): Kind {
    if (!this.pieces.length) {
      this.pieces = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
      for (let i = this.pieces.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.pieces[i], this.pieces[j]] = [this.pieces[j]!, this.pieces[i]!];
      }
    }
    return this.pieces.pop()!;
  }
}

export class Game {
  board = emptyBoard();
  piece: Piece = { kind: 'T', rotation: 0, x: 3, y: 0 };
  next: Kind = 'I';
  phase: Phase = 'ready';
  score = 0;
  lines = 0;
  revision = 0;
  private bag: Bag;
  private gravity = 0;
  private grounded = 0;
  private resets = 0;
  private events: GameEvent[] = [];

  constructor(private random: () => number = Math.random) {
    this.bag = new Bag(random);
  }

  get level() { return 1 + Math.floor(this.lines / 10); }
  get interval() { return Math.max(75, 800 * 0.8 ** (this.level - 1)); }

  start() {
    this.board = emptyBoard();
    this.revision++;
    this.bag = new Bag(this.random);
    this.score = 0;
    this.lines = 0;
    this.events = [];
    this.phase = 'playing';
    this.next = this.bag.next();
    this.spawn();
  }

  pause() { if (this.phase === 'playing') this.phase = 'paused'; }
  resume() { if (this.phase === 'paused') this.phase = 'playing'; }

  move(dx: number, dy = 0): boolean {
    if (this.phase !== 'playing') return false;
    const candidate = { ...this.piece, x: this.piece.x + dx, y: this.piece.y + dy };
    if (!fits(this.board, candidate)) return false;
    const wasGrounded = !fits(this.board, { ...this.piece, y: this.piece.y + 1 });
    this.piece = candidate;
    if (dy > 0) this.score += dy;
    if (wasGrounded && dx && this.resets < 15) {
      this.grounded = 0;
      this.resets++;
    }
    return true;
  }

  rotate(): boolean {
    if (this.phase !== 'playing' || this.piece.kind === 'O') return false;
    const rotation = (this.piece.rotation + 1) % 4;
    const offsets = (this.piece.kind === 'I' ? I_KICKS : KICKS)[this.piece.rotation]!;
    const wasGrounded = !fits(this.board, { ...this.piece, y: this.piece.y + 1 });
    for (const [x, y] of offsets) {
      const candidate = { ...this.piece, rotation, x: this.piece.x + x, y: this.piece.y + y };
      if (!fits(this.board, candidate)) continue;
      this.piece = candidate;
      if (wasGrounded && this.resets < 15) {
        this.grounded = 0;
        this.resets++;
      }
      return true;
    }
    return false;
  }

  ghost(): Piece {
    const ghost = { ...this.piece };
    while (fits(this.board, { ...ghost, y: ghost.y + 1 })) ghost.y++;
    return ghost;
  }

  drop() {
    if (this.phase !== 'playing') return;
    const ghost = this.ghost();
    this.score += (ghost.y - this.piece.y) * 2;
    this.piece = ghost;
    this.lock();
  }

  tick(delta: number) {
    if (this.phase !== 'playing') return;
    this.gravity += delta;
    while (this.gravity >= this.interval) {
      this.gravity -= this.interval;
      const candidate = { ...this.piece, y: this.piece.y + 1 };
      if (fits(this.board, candidate)) this.piece = candidate;
    }
    if (!fits(this.board, { ...this.piece, y: this.piece.y + 1 })) {
      this.grounded += delta;
      if (this.grounded >= 500) this.lock();
    } else {
      this.grounded = 0;
    }
  }

  takeEvents(): GameEvent[] { return this.events.splice(0); }

  private spawn() {
    this.piece = { kind: this.next, rotation: 0, x: this.next === 'O' ? 4 : 3, y: 1 };
    this.next = this.bag.next();
    this.gravity = this.grounded = this.resets = 0;
    if (!fits(this.board, this.piece)) {
      this.phase = 'over';
      this.events.push('over');
    }
  }

  private lock() {
    this.revision++;
    for (const [x, y] of cells(this.piece.kind, this.piece.rotation)) {
      this.board[this.piece.y + y]![this.piece.x + x] = this.piece.kind;
    }
    const rows = this.board.filter(row => row.some(cell => cell === null));
    const cleared = HEIGHT - rows.length;
    const points = [0, 100, 300, 500, 800][cleared]!;
    this.score += points * this.level;
    this.lines += cleared;
    while (rows.length < HEIGHT) rows.unshift(Array<Cell>(WIDTH).fill(null));
    this.board = rows;
    this.events.push(cleared ? 'clear' : 'lock');
    if (this.board.slice(0, HIDDEN).some(row => row.some(cell => cell !== null))) {
      this.phase = 'over';
      this.events.push('over');
    } else {
      this.spawn();
    }
  }
}

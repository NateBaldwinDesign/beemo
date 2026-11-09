import { describe, expect, it } from 'vitest';
import { Bag, cells, emptyBoard, fits, Game, HEIGHT, seededRandom, type Kind } from './rules';

describe('piece generation and geometry', () => {
  it('produces every piece once per bag and is reproducible with a seed', () => {
    const a = new Bag(seededRandom(42));
    const b = new Bag(seededRandom(42));
    for (let bag = 0; bag < 10; bag++) {
      const pieces = Array.from({ length: 7 }, () => a.next());
      expect(new Set(pieces).size).toBe(7);
      expect(pieces).toEqual(Array.from({ length: 7 }, () => b.next()));
    }
  });
  it.each<Kind>(['I', 'O', 'T', 'S', 'Z', 'J', 'L'])('%s keeps four unique cells in every rotation', kind => {
    for (let rotation = 0; rotation < 4; rotation++) {
      expect(new Set(cells(kind, rotation).map(cell => cell.join(','))).size).toBe(4);
    }
    expect(cells(kind, 4)).toEqual(cells(kind));
  });
  it('rejects walls, floor, ceiling, and occupied cells', () => {
    const board = emptyBoard();
    const piece = { kind: 'O' as const, rotation: 0, x: 4, y: 2 };
    expect(fits(board, piece)).toBe(true);
    for (const [x, y] of [[-1, 2], [9, 2], [4, -1], [4, HEIGHT - 1]]) {
      expect(fits(board, { ...piece, x: x!, y: y! })).toBe(false);
    }
    board[2]![4] = 'T';
    expect(fits(board, piece)).toBe(false);
  });
});

describe('game rules', () => {
  it('starts fresh, pauses without advancing, and deliberately resumes', () => {
    const game = new Game(seededRandom(10));
    expect(game.phase).toBe('ready');
    game.start();
    const piece = { ...game.piece };
    game.pause(); game.tick(5000);
    expect(game.move(-1)).toBe(false);
    game.drop();
    expect(game.piece).toEqual(piece);
    game.resume(); game.tick(800);
    expect(game.piece.y).toBe(piece.y + 1);
    game.start();
    expect(game.score).toBe(0);
    expect(game.board.flat().every(cell => cell === null)).toBe(true);
  });
  it('soft-drops for points, projects a ghost, and hard-drops to lock immediately', () => {
    const game = new Game(seededRandom(3)); game.start();
    const y = game.piece.y;
    expect(game.move(0, 1)).toBe(true);
    expect(game.score).toBe(1);
    const ghost = game.ghost();
    expect(ghost.y).toBeGreaterThan(y);
    expect(fits(game.board, { ...ghost, y: ghost.y + 1 })).toBe(false);
    game.drop();
    expect(game.score).toBe(1 + (ghost.y - y - 1) * 2);
    expect(game.board.flat().filter(Boolean)).toHaveLength(4);
    expect(game.takeEvents()).toContain('lock');
  });
  it('uses ordinary and straight-piece wall kicks', () => {
    const game = new Game(); game.start();
    game.piece = { kind: 'T', rotation: 1, x: -1, y: 5 };
    expect(fits(game.board, game.piece)).toBe(true);
    expect(game.rotate()).toBe(true);
    expect(game.piece.x).toBe(0);
    game.piece = { kind: 'I', rotation: 1, x: -2, y: 5 };
    expect(game.rotate()).toBe(true);
    expect(game.piece.x).toBe(0);
    game.piece = { kind: 'O', rotation: 0, x: 4, y: 5 };
    expect(game.rotate()).toBe(false);
    expect(game.piece.rotation).toBe(0);
  });
  it.each([[1, 100], [2, 300], [3, 500], [4, 800]])('clears %i rows for %i points', (count, points) => {
    const game = new Game(); game.start();
    for (let y = HEIGHT - count; y < HEIGHT; y++) game.board[y] = Array.from({ length: 10 }, (_, x) => x === 4 ? null : 'J');
    game.piece = { kind: 'I', rotation: 1, x: 2, y: HEIGHT - 4 };
    game.drop();
    expect(game.lines).toBe(count);
    expect(game.score).toBe(points);
    expect(game.board).toHaveLength(HEIGHT);
    expect(game.takeEvents()).toContain('clear');
  });
  it('levels up every ten lines and speeds up with a floor', () => {
    const game = new Game(); game.start(); game.lines = 9;
    game.board[21] = Array.from({ length: 10 }, (_, x) => x === 4 ? null : 'J');
    game.piece = { kind: 'I', rotation: 1, x: 2, y: 18 }; game.drop();
    expect(game.level).toBe(2);
    expect(game.interval).toBeLessThan(800);
    game.lines = 10000;
    expect(game.interval).toBe(75);
  });
  it('locks after 500 ms grounded and caps movement resets', () => {
    const game = new Game(); game.start();
    game.piece = { kind: 'O', rotation: 0, x: 4, y: 20 };
    game.tick(490);
    expect(game.board.flat().some(Boolean)).toBe(false);
    for (let i = 0; i < 16; i++) {
      game.move(i % 2 ? -1 : 1);
      game.tick(30);
    }
    game.tick(500);
    expect(game.board.flat().filter(Boolean)).toHaveLength(4);
  });
  it('ends when locked pieces reach the hidden spawn area', () => {
    const game = new Game(); game.start();
    game.board[1]![4] = 'J';
    game.drop();
    expect(game.phase).toBe('over');
    expect(game.takeEvents()).toContain('over');
  });
});

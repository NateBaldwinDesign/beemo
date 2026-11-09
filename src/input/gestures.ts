interface TouchPoint {
  x: number;
  time: number;
  direction: number;
  turns: number;
}

export class TickleGesture {
  private points = new Map<number, TouchPoint>();

  start(id: number, x: number, time: number) {
    this.points.set(id, { x, time, direction: 0, turns: 0 });
  }

  move(id: number, x: number, time: number): boolean {
    const point = this.points.get(id);
    if (!point) return false;
    if (time - point.time > 700) {
      this.start(id, x, time);
      return false;
    }
    const delta = x - point.x;
    if (Math.abs(delta) < 14) return false;
    const direction = Math.sign(delta);
    if (point.direction && point.direction !== direction) point.turns++;
    point.direction = direction;
    point.x = x;
    if (point.turns >= 3) {
      this.start(id, x, time);
      return true;
    }
    return false;
  }

  end(id: number) { this.points.delete(id); }
  clear() { this.points.clear(); }
}

export type HeldDirection = 'left' | 'right' | 'down';

export class RepeatInput {
  private held = new Map<string, { direction: HeldDirection; elapsed: number; next: number }>();
  constructor(private perform: (direction: HeldDirection) => void) {}

  press(source: string, direction: HeldDirection) {
    if (this.held.has(source)) return;
    this.held.set(source, { direction, elapsed: 0, next: direction === 'down' ? 65 : 180 });
    this.perform(direction);
  }

  release(source: string) { this.held.delete(source); }
  clear() { this.held.clear(); }

  tick(delta: number) {
    for (const item of this.held.values()) {
      item.elapsed += delta;
      while (item.elapsed >= item.next) {
        this.perform(item.direction);
        item.next += item.direction === 'down' ? 65 : 70;
      }
    }
  }
}

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

export type HeldDirection = 'left' | 'right' | 'down' | 'up';
export type HeldControl = HeldDirection | 'fire';

export class RepeatInput {
  private held = new Map<string, { direction: HeldControl; elapsed: number; next: number }>();
  constructor(
    private perform: (direction: HeldControl) => void,
    private timing: (direction: HeldControl) => { delay: number; interval: number } = direction => ({
      delay: direction === 'down' ? 65 : 180, interval: direction === 'down' ? 65 : 70,
    }),
  ) {}

  press(source: string, direction: HeldControl) {
    if (this.held.has(source)) return;
    this.held.set(source, { direction, elapsed: 0, next: this.timing(direction).delay });
    this.perform(direction);
  }

  release(source: string) { this.held.delete(source); }
  clear() { this.held.clear(); }

  tick(delta: number) {
    for (const item of this.held.values()) {
      item.elapsed += delta;
      while (item.elapsed >= item.next) {
        this.perform(item.direction);
        item.next += this.timing(item.direction).interval;
      }
    }
  }
}

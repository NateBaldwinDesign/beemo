type Permission = 'granted' | 'denied';
interface MotionAPI { requestPermission?: () => Promise<Permission> }

export class ShakeDetector {
  private previous: [number, number, number] | null = null;
  private last = -Infinity;
  private peaks = 0;
  private peakTime = 0;

  sample(x: number, y: number, z: number, time: number): boolean {
    if (![x, y, z, time].every(Number.isFinite)) return false;
    const previous = this.previous;
    this.previous = [x, y, z];
    if (!previous) return false;
    const change = Math.hypot(x - previous[0], y - previous[1], z - previous[2]);
    if (time - this.peakTime > 500) this.peaks = 0;
    if (change < 16 || time - this.last < 1400) return false;
    this.peakTime = time;
    if (++this.peaks < 3) return false;
    this.last = time;
    this.peaks = 0;
    return true;
  }

  reset() { this.previous = null; this.peaks = 0; this.last = -Infinity; }
}

export class MotionInput {
  private detector = new ShakeDetector();
  private enabled = false;
  private listening = false;
  constructor(
    private shake: () => void,
    private report: (message: string) => void,
    private api: MotionAPI | undefined = globalThis.DeviceMotionEvent as MotionAPI | undefined,
  ) {}

  async enable(): Promise<boolean> {
    if (!this.api) {
      this.report('Motion is not supported here. Use Shake reaction instead.');
      return false;
    }
    try {
      if (this.api.requestPermission && await this.api.requestPermission() !== 'granted') {
        this.report('Motion access was not allowed. Use Shake reaction instead.');
        return false;
      }
      this.enabled = true;
      this.resume();
      return true;
    } catch (error) {
      console.warn('Motion permission failed', error);
      this.report('Motion could not be enabled. Use Shake reaction instead.');
      return false;
    }
  }

  private onMotion = (event: DeviceMotionEvent) => {
    const acceleration = event.acceleration ?? event.accelerationIncludingGravity;
    if (acceleration?.x == null || acceleration.y == null || acceleration.z == null) return;
    if (this.detector.sample(acceleration.x, acceleration.y, acceleration.z, performance.now())) this.shake();
  };

  suspend() {
    window.removeEventListener('devicemotion', this.onMotion);
    this.listening = false;
    this.detector.reset();
  }

  resume() {
    if (this.enabled && !this.listening && !document.hidden) {
      window.addEventListener('devicemotion', this.onMotion, { passive: true });
      this.listening = true;
    }
  }

  disable() { this.enabled = false; this.suspend(); }
}

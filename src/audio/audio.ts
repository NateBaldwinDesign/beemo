import type { Reaction } from '../face/face';

export type Clip = 'ouch' | 'hey' | 'giggle';
const CLIPS: Clip[] = ['ouch', 'hey', 'giggle'];

export class RobotAudio {
  private context?: AudioContext;
  private buffers = new Map<Clip, AudioBuffer>();
  private loading?: Promise<void>;
  private sources = new Set<AudioScheduledSourceNode>();
  private voice?: AudioBufferSourceNode;
  private lastVoice = -Infinity;
  muted = false;
  volume = 0.55;

  constructor(private report: (message: string) => void) {}

  async unlock(): Promise<boolean> {
    if (this.muted) return false;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') await this.context.resume();
      if (this.context.state !== 'running') throw new Error('Audio is not running');
      if (!this.loading) {
        this.loading = this.load(this.context).catch(error => {
          this.loading = undefined;
          throw error;
        });
      }
      await this.loading;
      return true;
    } catch (error) {
      console.warn('Beemo audio unavailable', error);
      this.report('Sound could not start. Switch sound off and on to try again.');
      return false;
    }
  }

  private async load(context: AudioContext) {
    const loaded = await Promise.all(CLIPS.map(async clip => {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/${clip}.wav`);
      if (!response.ok) throw new Error(`Could not load ${clip}: ${response.status}`);
      return [clip, await context.decodeAudioData(await response.arrayBuffer())] as const;
    }));
    loaded.forEach(([clip, buffer]) => this.buffers.set(clip, buffer));
  }

  react(reaction: Reaction) {
    if (reaction === 'love') return;
    const clip = reaction === 'ouch' ? 'ouch' : reaction === 'laugh' ? 'giggle' : 'hey';
    void this.unlock().then(ready => {
      const context = this.context;
      if (!ready || !context || this.muted || document.hidden || performance.now() - this.lastVoice < 300) return;
      this.lastVoice = performance.now();
      this.voice?.stop();
      const source = context.createBufferSource();
      source.buffer = this.buffers.get(clip)!;
      const gain = context.createGain();
      gain.gain.value = this.volume * 0.65;
      source.connect(gain).connect(context.destination);
      this.track(source, gain);
      this.voice = source;
      source.start();
    });
  }

  effect(event: 'lock' | 'clear' | 'over' | 'tap') {
    const context = this.context;
    if (this.muted || !context || context.state !== 'running' || this.sources.size >= 4) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const duration = event === 'clear' ? 0.22 : event === 'over' ? 0.3 : 0.055;
    const start = event === 'clear' ? 440 : event === 'over' ? 180 : 240;
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(event === 'clear' ? 880 : 100, now + duration);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(this.volume * 0.18, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    this.track(oscillator, gain);
    oscillator.start();
    oscillator.stop(now + duration);
  }

  private track(source: AudioScheduledSourceNode, gain: GainNode) {
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      if (this.voice === source) this.voice = undefined;
      source.disconnect();
      gain.disconnect();
    };
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) this.stop();
  }

  private stop() {
    this.sources.forEach(source => source.stop());
    this.sources.clear();
    this.voice = undefined;
  }

  suspend() {
    this.stop();
    if (this.context?.state === 'running') {
      void this.context.suspend().catch(error => {
        console.warn('Could not suspend Beemo audio', error);
        this.report('Sound could not be suspended. Mute sound if it continues.');
      });
    }
  }
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RobotAudio } from './audio';

class Param {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}
class Node {
  onended?: () => void;
  connect(node: Node) { return node; }
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn(() => this.onended?.());
  frequency = new Param();
  gain = new Param();
  buffer?: unknown;
  type = '';
}
class Context {
  static latest: Context;
  state = 'suspended';
  currentTime = 0;
  destination = new Node();
  sources: Node[] = [];
  resume = vi.fn(async () => { this.state = 'running'; });
  suspend = vi.fn(async () => { this.state = 'suspended'; });
  decodeAudioData = vi.fn(async () => ({}));
  constructor() { Context.latest = this; }
  createGain() { return new Node(); }
  createBufferSource() { const node = new Node(); this.sources.push(node); return node; }
  createOscillator() { const node = new Node(); this.sources.push(node); return node; }
}

beforeEach(() => {
  vi.stubGlobal('AudioContext', Context);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new ArrayBuffer(100))));
});
afterEach(() => vi.unstubAllGlobals());

describe('robot audio', () => {
  it('does not substitute an unrelated voice clip for the visual love note', () => {
    const audio = new RobotAudio(vi.fn());
    audio.react('love');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('unlocks once and caches the three bundled clips under the base path', async () => {
    const audio = new RobotAudio(vi.fn());
    expect(await audio.unlock()).toBe(true);
    expect(await audio.unlock()).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetch).mock.calls.every(call => String(call[0]).includes('/beemo/audio/'))).toBe(true);
  });
  it('never creates a context while muted, and stops playing sources on mute', async () => {
    const audio = new RobotAudio(vi.fn());
    audio.setMuted(true);
    expect(await audio.unlock()).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    audio.setMuted(false);
    await audio.unlock();
    audio.effect('clear');
    const source = Context.latest.sources[0]!;
    expect(source.start).toHaveBeenCalledOnce();
    audio.setMuted(true);
    expect(source.stop).toHaveBeenCalled();
    expect(source.disconnect).toHaveBeenCalled();
  });
  it('caps concurrent effects and suspends the audio context', async () => {
    const audio = new RobotAudio(vi.fn());
    await audio.unlock();
    // Keep scheduled sounds pending, as they are in a real audio context.
    const create = Context.latest.createOscillator.bind(Context.latest);
    vi.spyOn(Context.latest, 'createOscillator').mockImplementation(() => {
      const source = create();
      source.stop = vi.fn();
      return source;
    });
    for (let i = 0; i < 50; i++) audio.effect('lock');
    expect(Context.latest.sources).toHaveLength(4);
    audio.suspend();
    expect(Context.latest.suspend).toHaveBeenCalledOnce();
    expect(Context.latest.sources.every(source => source.stop.mock.calls.length >= 2)).toBe(true);
  });
  it('reports load failures and allows a subsequent retry', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    const report = vi.fn();
    const audio = new RobotAudio(report);
    expect(await audio.unlock()).toBe(false);
    expect(report).toHaveBeenCalledOnce();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ArrayBuffer(100))));
    expect(await audio.unlock()).toBe(true);
  });
  it('bounds rapid voice requests without an accumulating speech queue', async () => {
    const audio = new RobotAudio(vi.fn());
    await audio.unlock();
    for (let i = 0; i < 100; i++) audio.react('ouch');
    await vi.waitFor(() => expect(Context.latest.sources).toHaveLength(1));
    audio.suspend();
  });
});

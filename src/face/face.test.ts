import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Face, interpolate, mouthPath } from './face';

let reduced = false;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
});
afterEach(() => { reduced = false; vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('expression geometry', () => {
  it('uses four matching curves for smooth transitions across every expression', () => {
    const host = document.createElement('div');
    const face = new Face(host, vi.fn(), vi.fn());
    for (const reaction of ['ouch', 'wink', 'shake', 'love', 'laugh', 'hello'] as const) {
      face.react(reaction);
      vi.advanceTimersByTime(200);
      const path = host.querySelector('.mouth')!.getAttribute('d')!;
      expect(path.match(/C/g)).toHaveLength(4);
      expect(path).not.toContain('NaN');
      expect(path).not.toContain('undefined');
    }
    face.suspend();
  });
  it('interpolates matching path coordinates and clamps progress', () => {
    const a = { mouth: Array(14).fill(0) as number[], eye: 1, tilt: 0, tongue: 0 };
    const b = { mouth: Array(14).fill(10) as number[], eye: 0, tilt: 10, tongue: 1 };
    expect(interpolate(a, b, 0.5).mouth).toEqual(Array(14).fill(5));
    expect(interpolate(a, b, 2)).toEqual(b);
    expect(interpolate(a, b, -1)).toEqual(a);
    expect(mouthPath(a.mouth).match(/C/g)).toHaveLength(2);
  });
});

describe('face lifecycle', () => {
  it('shows two heart eyes and the exact love note for three seconds, then recovers', () => {
    const host = document.createElement('div');
    const announce = vi.fn();
    const face = new Face(host, vi.fn(), announce);
    const bubble = host.querySelector<HTMLParagraphElement>('.speech-bubble')!;
    expect(bubble.hidden).toBe(true);
    face.react('love');
    expect(face.expression).toBe('love');
    expect(host.dataset.expression).toBe('love');
    expect(host.querySelectorAll('.eye .heart-eye')).toHaveLength(2);
    expect(bubble.hidden).toBe(false);
    expect(bubble.textContent).toBe('I love you Azalea');
    expect(announce).toHaveBeenCalledWith('I love you Azalea');
    vi.advanceTimersByTime(2999);
    expect(bubble.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(face.expression).toBe('happy');
    expect(bubble.hidden).toBe(true);
    vi.advanceTimersByTime(800);
    expect(face.expression).toBe('idle');
    face.suspend();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('clears the love note on another reaction or suspension without stale recovery timers', () => {
    const host = document.createElement('div');
    const face = new Face(host, vi.fn(), vi.fn());
    const bubble = host.querySelector<HTMLParagraphElement>('.speech-bubble')!;
    face.react('love');
    vi.advanceTimersByTime(2000);
    face.react('love');
    vi.advanceTimersByTime(2000);
    expect(face.expression).toBe('love');
    face.react('ouch');
    expect(bubble.hidden).toBe(true);
    face.react('love');
    face.suspend();
    expect(bubble.hidden).toBe(true);
    face.resume();
    expect(face.expression).toBe('idle');
    expect(vi.getTimerCount()).toBe(1);
    face.suspend();
  });
  it('keeps the love note readable with reduced motion enabled', () => {
    reduced = true;
    const host = document.createElement('div');
    const face = new Face(host, vi.fn(), vi.fn());
    face.react('love');
    vi.advanceTimersByTime(1000);
    expect(face.expression).toBe('love');
    expect(host.querySelector<HTMLParagraphElement>('.speech-bubble')!.hidden).toBe(false);
    vi.advanceTimersByTime(2100);
    expect(face.expression).toBe('happy');
    vi.advanceTimersByTime(800);
    expect(face.expression).toBe('idle');
    expect(vi.getTimerCount()).toBe(1);
    face.suspend();
  });
  it('reacts immediately, prevents shake from starving touch, and recovers', () => {
    const host = document.createElement('div');
    const speak = vi.fn();
    const face = new Face(host, speak, vi.fn());
    face.react('ouch', -1);
    expect(face.expression).toBe('ouch');
    face.react('shake', 0, 'motion');
    expect(face.expression).toBe('ouch');
    face.react('laugh');
    expect(face.expression).toBe('laugh');
    vi.advanceTimersByTime(900);
    expect(face.expression).toBe('delighted');
    vi.advanceTimersByTime(800);
    expect(face.expression).toBe('idle');
    face.suspend();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('bounds repeated reactions and suspends every timer', () => {
    const face = new Face(document.createElement('div'), vi.fn(), vi.fn());
    for (let i = 0; i < 200; i++) face.react('ouch');
    expect(vi.getTimerCount()).toBeLessThanOrEqual(2);
    face.suspend();
    expect(vi.getTimerCount()).toBe(0);
    face.react('hello');
    expect(face.expression).toBe('idle');
    face.resume();
    expect(vi.getTimerCount()).toBe(1);
    face.suspend();
  });
  it('does not schedule idle motion when reduced motion is requested', () => {
    reduced = true;
    const face = new Face(document.createElement('div'), vi.fn(), vi.fn());
    expect(vi.getTimerCount()).toBe(1);
    face.react('ouch'); vi.advanceTimersByTime(1200);
    expect(face.expression).toBe('idle');
    expect(vi.getTimerCount()).toBe(1);
    face.suspend();
  });
});

describe('additional reactions', () => {
  it.each([-1, 1])('closes only the tapped eye on side %i', side => {
    const host = document.createElement('div');
    const face = new Face(host, vi.fn(), vi.fn());
    face.react('wink', side);
    vi.advanceTimersByTime(160);
    const eyes = [...host.querySelectorAll<SVGGElement>('.eye')];
    expect(eyes.map(eye => eye.dataset.closed)).toEqual(side === -1 ? ['true', 'false'] : ['false', 'true']);
    vi.advanceTimersByTime(800);
    expect(face.expression).toBe('idle');
    expect(eyes.map(eye => eye.dataset.closed)).toEqual(['false', 'false']);
    face.suspend();
  });
  it('retains the first shake and escalates a second shake within five seconds', () => {
    const face = new Face(document.createElement('div'), vi.fn(), vi.fn());
    face.react('shake', 0, 'motion');
    expect(face.expression).toBe('shake');
    vi.advanceTimersByTime(1500);
    face.react('shake', 0, 'motion');
    expect(face.expression).toBe('dizzy');
    vi.advanceTimersByTime(1400);
    expect(face.expression).toBe('frown');
    vi.advanceTimersByTime(800);
    expect(face.expression).toBe('idle');
    vi.advanceTimersByTime(3000);
    face.react('shake', 0, 'motion');
    expect(face.expression).toBe('shake');
    face.suspend();
  });
  it('lets touch interrupt dizziness and does not count ignored motion as a shake', () => {
    const face = new Face(document.createElement('div'), vi.fn(), vi.fn());
    face.react('ouch');
    face.react('shake', 0, 'motion');
    vi.advanceTimersByTime(1500);
    face.react('shake', 0, 'motion');
    expect(face.expression).toBe('shake');
    vi.advanceTimersByTime(1500);
    face.react('shake', 0, 'motion');
    expect(face.expression).toBe('dizzy');
    face.react('love');
    expect(face.expression).toBe('love');
    vi.advanceTimersByTime(1400);
    expect(face.expression).toBe('love');
    face.suspend();
  });
  it('keeps every poke immediate and adds a grimace after three rapid pokes', () => {
    const face = new Face(document.createElement('div'), vi.fn(), vi.fn());
    for (let i = 0; i < 3; i++) {
      face.react('ouch');
      expect(face.expression).toBe('ouch');
      vi.advanceTimersByTime(200);
    }
    vi.advanceTimersByTime(450);
    expect(face.expression).toBe('grimace');
    vi.advanceTimersByTime(800);
    expect(face.expression).toBe('idle');
    face.react('ouch');
    vi.advanceTimersByTime(650);
    expect(face.expression).toBe('idle');
    face.suspend();
  });
  it.each([['hello', 'content', 650], ['laugh', 'delighted', 850], ['love', 'happy', 3000]] as const)(
    'keeps %s before its %s follow-up without adding speech',
    (reaction, followUp, duration) => {
      const speak = vi.fn();
      const face = new Face(document.createElement('div'), speak, vi.fn());
      face.react(reaction);
      expect(face.expression).toBe(reaction);
      vi.advanceTimersByTime(duration);
      expect(face.expression).toBe(followUp);
      expect(speak).toHaveBeenCalledOnce();
      face.react('ouch');
      vi.advanceTimersByTime(800);
      expect(face.expression).toBe('idle');
      face.suspend();
    },
  );
});

describe('quiet-time expressions', () => {
  it('blinks after 5-10 quiet seconds, resetting the delay after interaction', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const host = document.createElement('div');
    const face = new Face(host, vi.fn(), vi.fn());
    vi.advanceTimersByTime(4999);
    expect(face.expression).toBe('idle');
    vi.advanceTimersByTime(1);
    expect(face.expression).toBe('blink');
    vi.advanceTimersByTime(160);
    expect(face.expression).toBe('idle');
    face.react('ouch');
    vi.advanceTimersByTime(4999);
    expect(face.expression).toBe('idle');
    vi.advanceTimersByTime(1);
    expect(face.expression).toBe('blink');
    face.suspend();
  });
  it('yawns at 30 seconds even if it has blinked, without speech or repeated frames while idle', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const speak = vi.fn();
    const face = new Face(document.createElement('div'), speak, vi.fn());
    vi.advanceTimersByTime(29999);
    expect(face.expression).not.toBe('yawn');
    vi.advanceTimersByTime(1);
    expect(face.expression).toBe('yawn');
    expect(speak).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1800);
    expect(face.expression).toBe('idle');
    face.suspend();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('restarts quiet time on activity and on returning from a hidden screen', () => {
    const face = new Face(document.createElement('div'), vi.fn(), vi.fn());
    vi.advanceTimersByTime(29000);
    face.activity();
    vi.advanceTimersByTime(1000);
    expect(face.expression).not.toBe('yawn');
    face.suspend();
    vi.advanceTimersByTime(60000);
    expect(vi.getTimerCount()).toBe(0);
    face.resume();
    vi.advanceTimersByTime(29999);
    expect(face.expression).not.toBe('yawn');
    vi.advanceTimersByTime(1);
    expect(face.expression).toBe('yawn');
    face.react('wink', 1);
    expect(face.expression).toBe('wink');
    face.suspend();
  });
  it('shows a short static yawn with reduced motion but does not restore blinking', () => {
    reduced = true;
    const face = new Face(document.createElement('div'), vi.fn(), vi.fn());
    vi.advanceTimersByTime(10000);
    expect(face.expression).toBe('idle');
    vi.advanceTimersByTime(20000);
    expect(face.expression).toBe('yawn');
    vi.advanceTimersByTime(1800);
    expect(face.expression).toBe('idle');
    face.suspend();
  });
});

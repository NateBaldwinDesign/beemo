import { describe, expect, it } from 'vitest';
import { tappedEye, type EyeCenter } from './hit-test';

const centers: EyeCenter[] = [{ x: 100, y: 120, side: -1 }, { x: 300, y: 120, side: 1 }];

describe('32 CSS-pixel eye touch targets', () => {
  it('identifies each eye independently, including target boundaries', () => {
    expect(tappedEye(100, 120, centers)).toBe(-1);
    expect(tappedEye(300, 120, centers)).toBe(1);
    expect(tappedEye(84, 104, centers)).toBe(-1);
    expect(tappedEye(116, 136, centers)).toBe(-1);
  });
  it('does not steal general face taps outside the targets', () => {
    expect(tappedEye(116.1, 120, centers)).toBeUndefined();
    expect(tappedEye(100, 136.1, centers)).toBeUndefined();
    expect(tappedEye(200, 120, centers)).toBeUndefined();
    expect(tappedEye(0, 0, [])).toBeUndefined();
  });
});

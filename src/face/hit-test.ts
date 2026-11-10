export type EyeSide = -1 | 1;
export interface EyeCenter { x: number; y: number; side: EyeSide }

export function tappedEye(x: number, y: number, centers: EyeCenter[]): EyeSide | undefined {
  return centers.find(center => Math.abs(x - center.x) <= 16 && Math.abs(y - center.y) <= 16)?.side;
}

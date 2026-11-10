import type { Phase } from './rules';

export type GameId = 'blocks' | 'stars' | 'crossing';
export type ArcadeSound = 'lock' | 'clear' | 'over';
export interface GameSummary {
  phase: Phase;
  score: number;
  level: number;
  detailLabel: string;
  detailValue: number;
  message?: string;
}

export const GAMES = {
  blocks: {
    title: 'Pocket Blocks',
    description: 'Find a little order in the falling pieces.',
    controls: 'Pad: move / soft drop. Triangle: rotate. Green: hard drop.',
    best: 'best',
  },
  stars: {
    title: 'Star Patrol',
    description: 'A little ship. A whole sky to protect.',
    controls: 'Pad: left / right. Hold triangle or green to fire.',
    best: 'bestStars',
  },
  crossing: {
    title: 'Pixel Crossing',
    description: 'Dodge the traffic. Catch a log. Go a little farther.',
    controls: 'Pad: hop in four directions. Triangle or green: hop forward.',
    best: 'bestCrossing',
  },
} as const;

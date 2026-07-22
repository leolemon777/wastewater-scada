export type PoolLadderWall = 'front' | 'back' | 'left' | 'right';

function seededUnit(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

/** Pick a stable wall that is not blocked by overflow weirs. */
export function pickLadderWall(
  id: string,
  overflowLeft = false,
  overflowRight = false,
): PoolLadderWall {
  const candidates: PoolLadderWall[] = [];
  if (!overflowLeft) candidates.push('left');
  if (!overflowRight) candidates.push('right');
  candidates.push('front', 'back');
  const seed = id.split('').reduce((total, character) => total + character.charCodeAt(0), 0);
  return candidates[Math.floor(seededUnit(seed * 2.17) * candidates.length)] ?? 'front';
}

export function pickLadderLateral(id: string): number {
  const seed = id.split('').reduce((total, character) => total + character.charCodeAt(0), 0);
  return -0.55 + seededUnit(seed * 4.83) * 1.1;
}

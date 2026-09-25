/** Pieces that can be previewed with the camera try-on. */
export function isTryOnCategory(category: string) {
  return tryOnTarget(category) !== null;
}

/** Earrings and necklaces track the face; rings and bracelets track a hand. */
export function tryOnTarget(category: string): 'face' | 'hand' | null {
  if (category === 'earring' || category === 'necklace' || category === 'pendant') return 'face';
  if (category === 'ring' || category === 'bracelet') return 'hand';
  return null;
}

/** Pieces that can be previewed with the camera try-on. */
export function isTryOnCategory(category: string) {
  return category === 'earring' || category === 'necklace' || category === 'pendant';
}

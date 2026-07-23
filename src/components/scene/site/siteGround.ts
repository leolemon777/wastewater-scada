/** Site ground plane color — keep roads/pads/ramps aligned with the main floor mesh. */
export function resolveSiteGroundSurfaceColor(options: {
  isNight: boolean;
  isRainy: boolean;
  isBrightPalette: boolean;
}): string {
  const { isNight, isRainy, isBrightPalette } = options;
  if (isNight) return '#222222';
  if (isRainy) return '#555555';
  if (isBrightPalette) return '#777777';
  return '#5A5D60';
}

/** Cast-in-place pool / basin wall tone — cooler and darker than the site ground slab. */
export function resolveSitePoolWallColor(options: {
  isNight: boolean;
  isRainy: boolean;
  isBrightPalette: boolean;
}): string {
  const { isNight, isRainy, isBrightPalette } = options;
  if (isNight) return '#555555';
  if (isRainy) return '#B0B0B0';
  if (isBrightPalette) return '#FAFAFA';
  return '#D0D3D6';
}

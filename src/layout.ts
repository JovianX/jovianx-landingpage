/** Polar radius divided by equatorial radius. */
export const polarSquash = 0.935;

/** Equatorial radius, in the same units as width and height. */
export function planetRadius(width: number, height: number) {
  return Math.max(width * 0.52, height * 0.46);
}

/** Crown of the planet, as a fraction down the screen. The sphere center sits on the bottom edge. */
export function crestFraction(width: number, height: number) {
  const radius = planetRadius(width, height) * polarSquash;
  return Math.min(0.72, Math.max(0, (height - radius) / height));
}

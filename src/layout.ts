/** Sphere radius as a fraction of the viewport, in the same units as width and height. */
export function planetRadius(width: number, height: number) {
  return Math.max(width * 0.52, height * 0.46);
}

/** Crown of the planet, as a fraction down the screen. The equator sits on the bottom edge. */
export function crestFraction(width: number, height: number) {
  const radius = planetRadius(width, height);
  return Math.max(0.16, (height - radius) / height);
}

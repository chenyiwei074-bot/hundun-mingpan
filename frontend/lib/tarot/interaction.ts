/** Keep pointer-driven deck tilt tactile without making the cards feel unstable. */
export function getDeckTilt(normalizedX: number, normalizedY: number) {
  const x = Math.max(-1, Math.min(1, normalizedX));
  const y = Math.max(-1, Math.min(1, normalizedY));

  return {
    x: y === 0 ? 0 : Math.round(-y * 6 * 100) / 100,
    y: x === 0 ? 0 : Math.round(x * 8 * 100) / 100,
  };
}

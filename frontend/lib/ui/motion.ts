export function getRevealDelay(index: number) {
  const safeIndex = Math.max(0, Math.floor(index));
  return `${Math.min(safeIndex, 4) * 45}ms`;
}

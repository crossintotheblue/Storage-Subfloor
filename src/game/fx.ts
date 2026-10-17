// Shared mutable effect state read inside useFrame (no React re-renders).
export type RushState = { phase: "warn" | "run"; t: number; timer: number; endT: number };
export const fx = {
  flicker: 0, // seconds of flicker remaining
  rush: null as RushState | null,
  shake: 0,
};
export function resetFx() {
  fx.flicker = 0;
  fx.rush = null;
  fx.shake = 0;
}

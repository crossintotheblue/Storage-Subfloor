// Procedural room chain. Rooms run along -Z; each room's entry door = previous exit door.
export type RoomKind = "hall" | "loft" | "storage";
export type Crate = { x: number; z: number; s: number; h: number };
export type Room = {
  i: number;
  cx: number;
  z0: number; // front wall z
  w: number;
  l: number;
  h: number;
  entryX: number;
  exitX: number;
  kind: RoomKind;
  lever: { x: number; z: number; side: 1 | -1 } | null;
  crates: Crate[];
  closets: Closet[];
  final: boolean;
};
export type Closet = { x: number; z: number; side: 1 | -1 };
export type Box = { minX: number; maxX: number; minZ: number; maxZ: number };

export const DOOR_W = 2;
export const DOOR_H = 3;
export const START_TIME = 120;
export const LEVER_BONUS = 60;
export const FIRST_DOOR = -54;
export const LAST_ROOM = -FIRST_DOOR; // room whose exit door is door 0
export const LEVER_EVERY = 7;
export const RUSH_MIN_ROOM = 10;
export const RUSH_CHANCE = 1 / 7;
export const RUSH_SPEED = 3; // rooms per second
export const DELOAD_AFTER = 20;
export const doorLabel = (i: number) => FIRST_DOOR + i;
export const isLeverRoom = (i: number) => i > 0 && i <= LAST_ROOM && i % LEVER_EVERY === 0;
/** Lowest room index still loaded when the player is in room `cur`. */
export const firstLoadedRoom = (cur: number) => Math.max(0, cur - DELOAD_AFTER + 1);

let seed = 1337;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
const r = (a: number, b: number) => a + rand() * (b - a);

const rooms: Room[] = [];

export function resetWorld() {
  rooms.length = 0;
  seed = Math.floor(Math.random() * 1e9) + 1;
}

function makeRoom(i: number): Room {
  const prev = rooms[i - 1];
  const kinds: RoomKind[] = ["hall", "loft", "storage"];
  const kind: RoomKind = i === 0 ? "loft" : kinds[Math.floor(rand() * 3)]!;
  const w = kind === "hall" ? r(4.5, 6) : kind === "loft" ? r(9, 14) : r(7, 10);
  const l = kind === "hall" ? r(12, 20) : r(10, 16);
  const h = kind === "loft" ? 5 : 3.8;
  const entryX = prev ? prev.exitX : 0;
  const z0 = prev ? prev.z0 - prev.l : 0;
  const half = w / 2 - DOOR_W / 2 - 0.4;
  const cx = i === 0 ? 0 : entryX + r(-half, half);
  const exitX = cx + r(-half, half);
  let lever: Room["lever"] = null;
  if (isLeverRoom(i)) {
    const side = rand() > 0.5 ? 1 : -1;
    lever = { x: cx + side * (w / 2 - 0.05), z: z0 - l * 0.5, side };
  }
  const closets: Closet[] = [];
  const nc = i === 0 ? 0 : 1 + (rand() > 0.6 ? 1 : 0);
  for (let k = 0; k < nc; k++) {
    const side: 1 | -1 = lever ? (-lever.side as 1 | -1) : k === 0 ? (rand() > 0.5 ? 1 : -1) : (-closets[0]!.side as 1 | -1);
    const z = z0 - l * (nc === 1 ? 0.5 : k === 0 ? 0.35 : 0.65);
    closets.push({ x: cx + side * (w / 2 - 0.55), z, side });
  }
  const crates: Crate[] = [];
  const n = kind === "storage" ? 4 + Math.floor(rand() * 4) : Math.floor(rand() * 3);
  for (let k = 0; k < n; k++) {
    const s = r(0.7, 1.3);
    const side = rand() > 0.5 ? 1 : -1;
    const x = cx + side * (w / 2 - s / 2 - 0.2);
    const z = z0 - r(2, l - 2);
    if (lever && Math.abs(z - lever.z) < 2 && side === lever.side) continue;
    if (closets.some((c) => c.side === side && Math.abs(c.z - z) < 1.8)) continue;
    crates.push({ x, z, s, h: s * r(0.6, 1) });
  }
  return { i, cx, z0, w, l, h, entryX, exitX, kind, lever, crates, closets, final: i > LAST_ROOM };
}

export function getRoom(i: number): Room {
  while (rooms.length <= i) rooms.push(makeRoom(rooms.length));
  return rooms[i]!;
}

export function roomIndexAt(z: number, hint: number): number {
  let i = Math.max(0, hint - 2);
  for (; i < hint + 4; i++) {
    const rm = getRoom(i);
    if (z <= rm.z0 && z > rm.z0 - rm.l) return i;
  }
  return hint;
}

const T = 0.3;
export function roomColliders(rm: Room, exitOpen: boolean): Box[] {
  const L = rm.cx - rm.w / 2;
  const R = rm.cx + rm.w / 2;
  const zb = rm.z0 - rm.l;
  const d = DOOR_W / 2;
  const boxes: Box[] = [
    { minX: L - T, maxX: L, minZ: zb, maxZ: rm.z0 },
    { minX: R, maxX: R + T, minZ: zb, maxZ: rm.z0 },
    { minX: L - T, maxX: rm.exitX - d, minZ: zb - T, maxZ: zb },
    { minX: rm.exitX + d, maxX: R + T, minZ: zb - T, maxZ: zb },
  ];
  if (rm.i === 0) boxes.push({ minX: L - T, maxX: R + T, minZ: rm.z0, maxZ: rm.z0 + T });
  else {
    boxes.push({ minX: L - T, maxX: rm.entryX - d, minZ: rm.z0 - 0.05, maxZ: rm.z0 + 0.05 });
    boxes.push({ minX: rm.entryX + d, maxX: R + T, minZ: rm.z0 - 0.05, maxZ: rm.z0 + 0.05 });
  }
  if (rm.final) boxes.push({ minX: rm.exitX - d, maxX: rm.exitX + d, minZ: zb - T, maxZ: zb });
  else if (!exitOpen) boxes.push({ minX: rm.exitX - d, maxX: rm.exitX + d, minZ: zb - T, maxZ: zb });
  for (const c of rm.closets)
    boxes.push({ minX: c.x - 0.55, maxX: c.x + 0.55, minZ: c.z - 0.65, maxZ: c.z + 0.65 });
  for (const c of rm.crates)
    boxes.push({ minX: c.x - c.s / 2, maxX: c.x + c.s / 2, minZ: c.z - c.s / 2, maxZ: c.z + c.s / 2 });
  return boxes;
}

export function formatTime(t: number) {
  const s = Math.max(0, Math.ceil(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Point along the room chain; t = room index + fraction (entry door -> exit door). */
export function pathPoint(t: number): [number, number] {
  const k = Math.max(0, Math.floor(t));
  const f = Math.min(1, Math.max(0, t - k));
  const rm = getRoom(k);
  return [rm.entryX + (rm.exitX - rm.entryX) * f, rm.z0 - rm.l * f];
}

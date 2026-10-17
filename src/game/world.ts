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
};
export type Box = { minX: number; maxX: number; minZ: number; maxZ: number };

export const DOOR_W = 2;
export const DOOR_H = 3;
export const START_TIME = 300;
export const LEVER_BONUS = 240;

let seed = 1337;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
const r = (a: number, b: number) => a + rand() * (b - a);

const rooms: Room[] = [];
let nextLever = 70;

export function resetWorld() {
  rooms.length = 0;
  seed = Math.floor(Math.random() * 1e9) + 1;
  nextLever = 70;
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
  if (i === nextLever) {
    const side = rand() > 0.5 ? 1 : -1;
    lever = { x: cx + side * (w / 2 - 0.05), z: z0 - l * 0.5, side };
    nextLever += 65 + Math.floor(rand() * 11);
  }
  const crates: Crate[] = [];
  const n = kind === "storage" ? 4 + Math.floor(rand() * 4) : Math.floor(rand() * 3);
  for (let k = 0; k < n; k++) {
    const s = r(0.7, 1.3);
    const side = rand() > 0.5 ? 1 : -1;
    const x = cx + side * (w / 2 - s / 2 - 0.2);
    const z = z0 - r(2, l - 2);
    if (lever && Math.abs(z - lever.z) < 2 && side === lever.side) continue;
    crates.push({ x, z, s, h: s * r(0.6, 1) });
  }
  return { i, cx, z0, w, l, h, entryX, exitX, kind, lever, crates };
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
  if (!exitOpen) boxes.push({ minX: rm.exitX - d, maxX: rm.exitX + d, minZ: zb - T, maxZ: zb });
  for (const c of rm.crates)
    boxes.push({ minX: c.x - c.s / 2, maxX: c.x + c.s / 2, minZ: c.z - c.s / 2, maxZ: c.z + c.s / 2 });
  return boxes;
}

export function formatTime(t: number) {
  const s = Math.max(0, Math.ceil(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

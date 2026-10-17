import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { DOOR_H, DOOR_W, type Room } from "./world";
import { getTextures, numberTexture } from "./textures";

function Panel({
  w, h, position, rotation, map, color = "#ffffff", transparent,
}: {
  w: number; h: number; position: [number, number, number]; rotation?: [number, number, number];
  map: THREE.Texture; color?: string; transparent?: boolean;
}) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 3), uv.getY(i) * (h / 3));
    return g;
  }, [w, h]);
  return (
    <mesh geometry={geo} position={position} rotation={rotation}>
      <meshStandardMaterial map={map} color={color} roughness={0.85} transparent={transparent} alphaTest={transparent ? 0.5 : 0} side={transparent ? THREE.DoubleSide : THREE.FrontSide} />
    </mesh>
  );
}

function WallWithGap({ L, R, z, h, gapX, facing }: { L: number; R: number; z: number; h: number; gapX: number | null; facing: 1 | -1 }) {
  const t = getTextures();
  const rot: [number, number, number] = [0, facing === 1 ? 0 : Math.PI, 0];
  if (gapX === null)
    return <Panel w={R - L} h={h} position={[(L + R) / 2, h / 2, z]} rotation={rot} map={t.wall} />;
  const a = gapX - DOOR_W / 2, b = gapX + DOOR_W / 2;
  return (
    <>
      {a - L > 0.01 && <Panel w={a - L} h={h} position={[(L + a) / 2, h / 2, z]} rotation={rot} map={t.wall} />}
      {R - b > 0.01 && <Panel w={R - b} h={h} position={[(b + R) / 2, h / 2, z]} rotation={rot} map={t.wall} />}
      <Panel w={DOOR_W} h={h - DOOR_H} position={[gapX, DOOR_H + (h - DOOR_H) / 2, z]} rotation={rot} map={t.wall} />
    </>
  );
}

function Door({ x, z, n, openRef }: { x: number; z: number; n: number; openRef: { current: number } }) {
  const t = getTextures();
  const hinge = useRef<THREE.Group>(null);
  const plate = useMemo(() => numberTexture(n), [n]);
  useFrame((_, dt) => {
    if (!hinge.current) return;
    const target = openRef.current > 0 ? -Math.PI * 0.55 : 0;
    hinge.current.rotation.y += (target - hinge.current.rotation.y) * (1 - Math.exp(-6 * Math.min(dt, 0.05)));
  });
  return (
    <group position={[x, 0, z]}>
      {/* frame */}
      <mesh position={[-DOOR_W / 2 - 0.08, DOOR_H / 2, 0]}><boxGeometry args={[0.16, DOOR_H, 0.35]} /><meshStandardMaterial color="#3b2414" /></mesh>
      <mesh position={[DOOR_W / 2 + 0.08, DOOR_H / 2, 0]}><boxGeometry args={[0.16, DOOR_H, 0.35]} /><meshStandardMaterial color="#3b2414" /></mesh>
      <mesh position={[0, DOOR_H + 0.08, 0]}><boxGeometry args={[DOOR_W + 0.32, 0.16, 0.35]} /><meshStandardMaterial color="#3b2414" /></mesh>
      <mesh position={[0, DOOR_H + 0.45, 0.2]}><planeGeometry args={[0.8, 0.4]} /><meshStandardMaterial map={plate} emissive="#3a2a10" emissiveIntensity={0.4} /></mesh>
      <group ref={hinge} position={[-DOOR_W / 2, 0, 0]}>
        <mesh position={[DOOR_W / 2, DOOR_H / 2, 0]}>
          <boxGeometry args={[DOOR_W, DOOR_H, 0.1]} />
          <meshStandardMaterial map={t.door} color="#b08a66" roughness={0.7} />
        </mesh>
        <mesh position={[DOOR_W - 0.2, DOOR_H / 2, 0.08]}><sphereGeometry args={[0.06, 12, 12]} /><meshStandardMaterial color="#c9a14a" metalness={0.8} roughness={0.3} /></mesh>
      </group>
    </group>
  );
}

function Lever({ rm, usedRef }: { rm: Room; usedRef: { current: boolean } }) {
  const handle = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!handle.current) return;
    const target = usedRef.current ? -0.9 : 0.9;
    handle.current.rotation.x += (target - handle.current.rotation.x) * (1 - Math.exp(-8 * Math.min(dt, 0.05)));
  });
  const lv = rm.lever!;
  return (
    <group position={[lv.x, 1.4, lv.z]} rotation={[0, lv.side === 1 ? -Math.PI / 2 : Math.PI / 2, 0]}>
      <mesh position={[0, 0, 0.05]}><boxGeometry args={[0.5, 0.8, 0.1]} /><meshStandardMaterial color="#4a4038" metalness={0.6} roughness={0.5} /></mesh>
      <group ref={handle} position={[0, 0, 0.12]}>
        <mesh position={[0, 0.25, 0.1]} rotation={[0.3, 0, 0]}><cylinderGeometry args={[0.035, 0.035, 0.55]} /><meshStandardMaterial color="#888" metalness={0.9} roughness={0.3} /></mesh>
        <mesh position={[0, 0.52, 0.18]}><sphereGeometry args={[0.08, 12, 12]} /><meshStandardMaterial color="#b3261e" emissive="#5a0d08" /></mesh>
      </group>
      <pointLight position={[0, 0.5, 0.6]} color="#ff8a4a" intensity={2} distance={3} />
    </group>
  );
}

function Bulb({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.01, 0.01, 0.8]} /><meshBasicMaterial color="#111" /></mesh>
      <mesh><sphereGeometry args={[0.1, 12, 12]} /><meshBasicMaterial color="#ffd27a" toneMapped={false} /></mesh>
      <pointLight color="#ffb35c" intensity={14} distance={13} decay={1.6} />
    </group>
  );
}

export function RoomView({ rm, doorOpen, leverUsed }: { rm: Room; doorOpen: { current: number }; leverUsed: { current: boolean } }) {
  const t = getTextures();
  const L = rm.cx - rm.w / 2, R = rm.cx + rm.w / 2;
  const zb = rm.z0 - rm.l, zc = rm.z0 - rm.l / 2;
  const beams = Math.floor(rm.l / 3);
  return (
    <group>
      <Panel w={rm.w} h={rm.l} position={[rm.cx, 0, zc]} rotation={[-Math.PI / 2, 0, 0]} map={t.floor} />
      <Panel w={rm.w} h={rm.l} position={[rm.cx, rm.h, zc]} rotation={[Math.PI / 2, 0, 0]} map={t.ceiling} color="#9a8070" />
      <Panel w={rm.l} h={rm.h} position={[L, rm.h / 2, zc]} rotation={[0, Math.PI / 2, 0]} map={t.wall} />
      <Panel w={rm.l} h={rm.h} position={[R, rm.h / 2, zc]} rotation={[0, -Math.PI / 2, 0]} map={t.wall} />
      <WallWithGap L={L} R={R} z={rm.z0 - 0.05} h={rm.h} gapX={rm.i === 0 ? null : rm.entryX} facing={-1} />
      <WallWithGap L={L} R={R} z={zb + 0.05} h={rm.h} gapX={rm.exitX} facing={1} />

      {/* ceiling beams and posts */}
      {Array.from({ length: beams }).map((_, k) => {
        const z = rm.z0 - (k + 0.5) * (rm.l / beams);
        return (
          <group key={k}>
            <mesh position={[rm.cx, rm.h - 0.15, z]}><boxGeometry args={[rm.w, 0.3, 0.3]} /><meshStandardMaterial map={t.door} color="#a07850" /></mesh>
            {rm.kind !== "storage" && (
              <>
                <mesh position={[L + 0.15, rm.h / 2, z]}><boxGeometry args={[0.3, rm.h, 0.3]} /><meshStandardMaterial map={t.door} color="#a07850" /></mesh>
                <mesh position={[R - 0.15, rm.h / 2, z]}><boxGeometry args={[0.3, rm.h, 0.3]} /><meshStandardMaterial map={t.door} color="#a07850" /></mesh>
              </>
            )}
          </group>
        );
      })}

      {/* lattice arches (hall) */}
      {rm.kind === "hall" &&
        [0.33, 0.66].map((f) => {
          const z = rm.z0 - rm.l * f;
          return (
            <group key={f}>
              <Panel w={0.9} h={rm.h} position={[L + 0.5, rm.h / 2, z]} map={t.lattice} transparent />
              <Panel w={0.9} h={rm.h} position={[R - 0.5, rm.h / 2, z]} map={t.lattice} transparent />
              <Panel w={rm.w} h={0.7} position={[rm.cx, rm.h - 0.35, z]} map={t.lattice} transparent />
            </group>
          );
        })}

      {/* lattice side screens + railing (loft) */}
      {rm.kind === "loft" && (
        <>
          <Panel w={rm.l * 0.6} h={2.2} position={[L + 1.2, 1.1, zc]} rotation={[0, Math.PI / 2, 0]} map={t.lattice} transparent />
          <mesh position={[L + 1.4, 1.0, zc]}><boxGeometry args={[0.1, 0.1, rm.l * 0.6]} /><meshStandardMaterial color="#6b4428" /></mesh>
          {Array.from({ length: 10 }).map((_, k) => (
            <mesh key={k} position={[L + 1.4, 0.5, zc - rm.l * 0.3 + (k * rm.l * 0.6) / 9]}>
              <boxGeometry args={[0.08, 1, 0.08]} /><meshStandardMaterial color="#6b4428" />
            </mesh>
          ))}
        </>
      )}

      {rm.crates.map((c, k) => (
        <mesh key={k} position={[c.x, c.h / 2, c.z]}>
          <boxGeometry args={[c.s, c.h, c.s]} />
          <meshStandardMaterial map={t.crate} color="#d8b890" roughness={0.9} />
        </mesh>
      ))}

      <Bulb x={rm.cx} y={rm.h - 0.9} z={rm.z0 - rm.l * 0.3} />
      {rm.l > 13 && <Bulb x={rm.cx} y={rm.h - 0.9} z={rm.z0 - rm.l * 0.75} />}
      <Door x={rm.exitX} z={zb} n={rm.i + 1} openRef={doorOpen} />
      {rm.lever && <Lever rm={rm} usedRef={leverUsed} />}
    </group>
  );
}

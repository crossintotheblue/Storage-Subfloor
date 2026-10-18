import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { DOOR_H, DOOR_W, doorLabel, type Room } from "./world";
import { fx } from "./fx";
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
    <mesh geometry={geo} position={position} rotation={rotation ?? [0, 0, 0]}>
      <meshStandardMaterial map={map} color={color} roughness={0.85} transparent={!!transparent} alphaTest={transparent ? 0.5 : 0} side={transparent ? THREE.DoubleSide : THREE.FrontSide} />
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
  const plate = useMemo(() => numberTexture(doorLabel(n)), [n]);
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
  const lamp = useRef<THREE.PointLight>(null);
  const bulb = useRef<THREE.MeshStandardMaterial>(null);
  const st = useRef({ a: 0.75, v: 0 });
  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const s = st.current;
    const target = usedRef.current ? -0.75 : 0.75; // up -> down swing
    // damped spring for a heavy, snappy pull with a small overshoot
    s.v += ((target - s.a) * 180 - s.v * 14) * dt;
    s.a += s.v * dt;
    if (handle.current) handle.current.rotation.x = s.a;
    const col = usedRef.current ? "#3fdc6a" : "#ff4a2a";
    if (lamp.current) lamp.current.color.set(col);
    if (bulb.current) { bulb.current.color.set(col); bulb.current.emissive.set(col); }
  });
  const lv = rm.lever!;
  return (
    <group position={[lv.x, 1.3, lv.z]} rotation={[0, lv.side === 1 ? -Math.PI / 2 : Math.PI / 2, 0]}>
      {/* backplate */}
      <mesh position={[0, 0, 0.04]}><boxGeometry args={[0.55, 0.95, 0.08]} /><meshStandardMaterial color="#3a332c" metalness={0.6} roughness={0.55} /></mesh>
      {/* slot */}
      <mesh position={[0, 0, 0.085]}><boxGeometry args={[0.08, 0.6, 0.01]} /><meshStandardMaterial color="#0d0b09" /></mesh>
      {/* pivot hub */}
      <mesh position={[0, 0, 0.12]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.07, 0.07, 0.22, 16]} /><meshStandardMaterial color="#5c5248" metalness={0.8} roughness={0.35} /></mesh>
      {/* handle pivots at hub; points along local +y, tilted by rotation.x */}
      <group ref={handle} position={[0, 0, 0.12]}>
        <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.03, 0.03, 0.5, 10]} /><meshStandardMaterial color="#9a9a9a" metalness={0.9} roughness={0.3} /></mesh>
        <mesh position={[0, 0.52, 0]}><sphereGeometry args={[0.075, 14, 14]} /><meshStandardMaterial color="#1d1d1d" roughness={0.6} /></mesh>
      </group>
      {/* status lamp */}
      <mesh position={[0, 0.4, 0.1]}><sphereGeometry args={[0.04, 10, 10]} /><meshStandardMaterial ref={bulb} color="#ff4a2a" emissive="#ff4a2a" emissiveIntensity={2} toneMapped={false} /></mesh>
      <pointLight ref={lamp} position={[0, 0.4, 0.5]} color="#ff4a2a" intensity={2.5} distance={3.5} />
    </group>
  );
}

function Bulb({ x, y, z, lit }: { x: number; y: number; z: number; lit: boolean }) {
  const light = useRef<THREE.PointLight>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const on = fx.flicker > 0 ? (Math.random() > 0.45 ? Math.random() * 0.8 : 0.03) : 1;
    if (light.current) light.current.intensity = 14 * on;
    if (glow.current) glow.current.color.setScalar(0.15 + 0.85 * on).multiply(new THREE.Color("#ffd27a"));
  });
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.01, 0.01, 0.8]} /><meshBasicMaterial color="#111" /></mesh>
      <mesh><sphereGeometry args={[0.1, 12, 12]} /><meshBasicMaterial ref={glow} color="#ffd27a" toneMapped={false} /></mesh>
      {lit && <pointLight ref={light} color="#ffb35c" intensity={14} distance={13} decay={1.6} />}
    </group>
  );
}

function Closet({ x, z, side }: { x: number; z: number; side: 1 | -1 }) {
  const t = getTextures();
  return (
    <group position={[x, 0, z]} rotation={[0, side === 1 ? -Math.PI / 2 : Math.PI / 2, 0]}>
      <mesh position={[0, 1.25, 0]}><boxGeometry args={[1.3, 2.5, 1.1]} /><meshStandardMaterial map={t.crate} color="#cbb89a" roughness={0.8} /></mesh>
      <mesh position={[0, 1.25, 0.56]}><boxGeometry args={[0.03, 2.3, 0.02]} /><meshStandardMaterial color="#2a1a0e" /></mesh>
      <mesh position={[-0.1, 1.3, 0.57]}><boxGeometry args={[0.03, 0.25, 0.03]} /><meshStandardMaterial color="#888" metalness={0.8} /></mesh>
      <mesh position={[0.1, 1.3, 0.57]}><boxGeometry args={[0.03, 0.25, 0.03]} /><meshStandardMaterial color="#888" metalness={0.8} /></mesh>
    </group>
  );
}

function Dust({ rm }: { rm: Room }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const n = Math.floor(rm.w * rm.l * 0.6);
    const p = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      p[k * 3] = rm.cx + (Math.random() - 0.5) * rm.w;
      p[k * 3 + 1] = Math.random() * rm.h;
      p[k * 3 + 2] = rm.z0 - Math.random() * rm.l;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, [rm]);
  useFrame((st, raw) => {
    const dt = Math.min(raw, 0.05);
    const a = geo.getAttribute("position") as THREE.BufferAttribute;
    const t = st.clock.elapsedTime;
    for (let k = 0; k < a.count; k++) {
      let y = a.getY(k) - dt * 0.04;
      if (y < 0) y = rm.h;
      a.setY(k, y);
      a.setX(k, a.getX(k) + Math.sin(t * 0.5 + k) * dt * 0.03);
    }
    a.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color="#ffd9a0" size={0.025} transparent opacity={0.55} depthWrite={false} sizeAttenuation />
    </points>
  );
}

function Painting({ x, z, side, seed }: { x: number; z: number; side: 1 | -1; seed: number }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 160;
    const g = c.getContext("2d")!;
    const hue = 20 + (seed * 47) % 40;
    g.fillStyle = `hsl(${hue},30%,14%)`; g.fillRect(0, 0, 128, 160);
    const gr = g.createRadialGradient(64, 70, 5, 64, 70, 70);
    gr.addColorStop(0, `hsla(${hue + 10},40%,40%,0.9)`); gr.addColorStop(1, "transparent");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 160);
    g.fillStyle = "rgba(10,6,3,0.85)";
    g.beginPath(); g.ellipse(64, 80, 22, 34, 0, 0, Math.PI * 2); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [seed]);
  return (
    <group position={[x, 2, z]} rotation={[0, side === 1 ? -Math.PI / 2 : Math.PI / 2, 0]}>
      <mesh position={[0, 0, 0.03]}><boxGeometry args={[0.9, 1.1, 0.06]} /><meshStandardMaterial color="#6b4a1e" metalness={0.5} roughness={0.4} /></mesh>
      <mesh position={[0, 0, 0.065]}><planeGeometry args={[0.72, 0.92]} /><meshStandardMaterial map={tex} roughness={0.9} /></mesh>
    </group>
  );
}

export function RoomView({ rm, doorOpen, leverUsed, lit }: { rm: Room; doorOpen: { current: number }; leverUsed: { current: boolean }; lit: boolean }) {
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
      <WallWithGap L={L} R={R} z={zb + 0.05} h={rm.h} gapX={rm.final ? null : rm.exitX} facing={1} />

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

      <Bulb lit={lit} x={rm.cx} y={rm.h - 0.9} z={rm.z0 - rm.l * 0.3} />
      {rm.l > 13 && <Bulb lit={lit} x={rm.cx} y={rm.h - 0.9} z={rm.z0 - rm.l * 0.75} />}
      {rm.closets.map((c, k) => <Closet key={k} {...c} />)}
      {!rm.final && <Door x={rm.exitX} z={zb} n={rm.i} openRef={doorOpen} />}
      {rm.lever && <Lever rm={rm} usedRef={leverUsed} />}
    </group>
  );
}

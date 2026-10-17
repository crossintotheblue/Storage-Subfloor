import { Billboard, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import faceAsset from "@/assets/rush-face.webp.asset.json";
import { fx } from "./fx";
import { pathPoint } from "./world";

function smokeTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, "rgba(10,0,0,0.95)");
  grd.addColorStop(0.5, "rgba(25,2,2,0.6)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const PUFFS = 14;

/** Visual for the rushing entity. Position is driven by fx.rush (updated in Player). */
export function Rush() {
  const face = useTexture(faceAsset.url);
  face.colorSpace = THREE.SRGBColorSpace;
  const smoke = useMemo(smokeTexture, []);
  const group = useRef<THREE.Group>(null);
  const faceRef = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const puffs = useRef<(THREE.Mesh | null)[]>([]);
  const trail = useRef<[number, number][]>([]);

  useFrame((state) => {
    const r = fx.rush;
    const g = group.current;
    if (!g) return;
    const active = !!r && r.phase === "run";
    g.visible = active;
    if (light.current) light.current.intensity = active ? 40 : 0;
    if (!active || !r) { trail.current = []; return; }
    const [x, z] = pathPoint(r.t);
    g.position.set(x, 1.7, z);
    const time = state.clock.elapsedTime;
    if (faceRef.current) {
      const s = 1 + Math.sin(time * 40) * 0.06;
      faceRef.current.scale.setScalar(s);
      faceRef.current.position.set((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12, 0);
    }
    trail.current.unshift([x, z]);
    if (trail.current.length > PUFFS * 2) trail.current.pop();
    puffs.current.forEach((m, k) => {
      if (!m) return;
      const p = trail.current[Math.min(trail.current.length - 1, k * 2)] ?? [x, z];
      const a = time * 3 + k;
      m.position.set(p[0] - x + Math.cos(a) * 0.5, Math.sin(a * 1.3) * 0.5, p[1] - z);
      m.scale.setScalar(1.6 + (k / PUFFS) * 1.5);
    });
  });

  return (
    <group ref={group} visible={false}>
      <pointLight ref={light} color="#ff2a1a" intensity={0} distance={14} decay={1.4} />
      {Array.from({ length: PUFFS }).map((_, k) => (
        <Billboard key={k}>
          <mesh ref={(m) => { puffs.current[k] = m; }}>
            <planeGeometry args={[1.6, 1.6]} />
            <meshBasicMaterial map={smoke} transparent depthWrite={false} opacity={0.85 - k * 0.05} />
          </mesh>
        </Billboard>
      ))}
      <Billboard>
        <group ref={faceRef}>
          <mesh renderOrder={10}>
            <planeGeometry args={[2.2, 2.2]} />
            <meshBasicMaterial map={face} transparent alphaTest={0.05} toneMapped={false} depthWrite={false} />
          </mesh>
        </group>
      </Billboard>
    </group>
  );
}

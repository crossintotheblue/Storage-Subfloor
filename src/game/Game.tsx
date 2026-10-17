import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomView } from "./RoomView";
import {
  LEVER_BONUS, START_TIME, formatTime, getRoom, resetWorld, roomColliders, roomIndexAt,
} from "./world";

const SPEED = 4.2;
const RADIUS = 0.35;
const EYE = 1.6;
const OPEN_DIST = 3.2;

type Refs = {
  doors: Map<number, { current: number }>;
  levers: Map<number, { current: boolean }>;
};
const getRef = <T,>(m: Map<number, { current: T }>, i: number, d: T) => {
  let r = m.get(i);
  if (!r) { r = { current: d }; m.set(i, r); }
  return r;
};

function Player({ refs, playing, onRoom, onLever, setHint }: {
  refs: Refs; playing: boolean; onRoom: (i: number) => void; onLever: () => void; setHint: (s: string) => void;
}) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const roomIdx = useRef(0);
  const hintRef = useRef("");

  useEffect(() => {
    camera.position.set(0, EYE, -2);
    camera.rotation.set(0, 0, 0);
    const d = (e: KeyboardEvent) => (keys.current[e.code] = true);
    const u = (e: KeyboardEvent) => (keys.current[e.code] = false);
    window.addEventListener("keydown", d);
    window.addEventListener("keyup", u);
    return () => { window.removeEventListener("keydown", d); window.removeEventListener("keyup", u); };
  }, [camera]);

  const lookingAtLever = useCallback(() => {
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    for (let i = roomIdx.current - 1; i <= roomIdx.current + 1; i++) {
      if (i < 0) continue;
      const rm = getRoom(i);
      if (!rm.lever || getRef(refs.levers, i, false).current) continue;
      const to = new THREE.Vector3(rm.lever.x, 1.4, rm.lever.z).sub(camera.position);
      const dist = to.length();
      if (dist < 3 && to.normalize().dot(fwd) > 0.88) return i;
    }
    return -1;
  }, [camera, refs]);

  useEffect(() => {
    const click = () => {
      if (!playing) return;
      const i = lookingAtLever();
      if (i >= 0) { getRef(refs.levers, i, false).current = true; onLever(); }
    };
    window.addEventListener("mousedown", click);
    return () => window.removeEventListener("mousedown", click);
  }, [playing, lookingAtLever, onLever, refs]);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    if (!playing) return;
    const k = keys.current;
    const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const s = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0; fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const mv = fwd.multiplyScalar(f).add(right.multiplyScalar(s));
    if (mv.lengthSq() > 0) mv.normalize().multiplyScalar(SPEED * (k.ShiftLeft ? 1.4 : 1) * dt);

    const cur = roomIndexAt(camera.position.z, roomIdx.current);
    const boxes = [cur - 1, cur, cur + 1].filter((i) => i >= 0).flatMap((i) =>
      roomColliders(getRoom(i), getRef(refs.doors, i, 0).current > 0),
    );
    const p = camera.position;
    const hit = (x: number, z: number) =>
      boxes.some((b) => x + RADIUS > b.minX && x - RADIUS < b.maxX && z + RADIUS > b.minZ && z - RADIUS < b.maxZ);
    if (!hit(p.x + mv.x, p.z)) p.x += mv.x;
    if (!hit(p.x, p.z + mv.z)) p.z += mv.z;
    p.y = EYE + (mv.lengthSq() > 0 ? Math.sin(performance.now() / 110) * 0.03 : 0);

    // auto-open doors by proximity
    for (const i of [cur, cur + 1]) {
      const rm = getRoom(i);
      const d = Math.hypot(p.x - rm.exitX, p.z - (rm.z0 - rm.l));
      const ref = getRef(refs.doors, i, 0);
      if (d < OPEN_DIST && ref.current === 0) ref.current = 1;
    }

    const nowIdx = roomIndexAt(p.z, cur);
    if (nowIdx !== roomIdx.current) { roomIdx.current = nowIdx; onRoom(nowIdx); }

    const h = lookingAtLever() >= 0 ? `Click to pull lever (+${formatTime(LEVER_BONUS)})` : "";
    if (h !== hintRef.current) { hintRef.current = h; setHint(h); }
  });

  return null;
}

function World({ cur, refs }: { cur: number; refs: Refs }) {
  const ids = [];
  for (let i = Math.max(0, cur - 1); i <= cur + 3; i++) ids.push(i);
  return (
    <>
      {ids.map((i) => (
        <RoomView key={i} rm={getRoom(i)} doorOpen={getRef(refs.doors, i, 0)} leverUsed={getRef(refs.levers, i, false)} />
      ))}
    </>
  );
}

export function Game() {
  const [status, setStatus] = useState<"menu" | "playing" | "paused" | "dead">("menu");
  const [time, setTime] = useState(START_TIME);
  const [cur, setCur] = useState(0);
  const [best, setBest] = useState(0);
  const [hint, setHint] = useState("");
  const [flash, setFlash] = useState(0);
  const [run, setRun] = useState(0);
  const refs = useRef<Refs>({ doors: new Map(), levers: new Map() });
  const controls = useRef<any>(null);

  useEffect(() => {
    setBest(Number(localStorage.getItem("backdoor-best") || 0));
  }, []);

  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(() => setTime((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (time <= 0 && status === "playing") {
      setStatus("dead");
      document.exitPointerLock?.();
      if (cur > best) { setBest(cur); localStorage.setItem("backdoor-best", String(cur)); }
    }
  }, [time, status, cur, best]);

  const start = () => {
    resetWorld();
    refs.current = { doors: new Map(), levers: new Map() };
    setTime(START_TIME); setCur(0); setRun((r) => r + 1); setStatus("playing");
    setTimeout(() => controls.current?.lock(), 50);
  };

  const onLever = useCallback(() => {
    setTime((t) => t + LEVER_BONUS);
    setFlash((f) => f + 1);
  }, []);

  const low = time <= 30;

  return (
    <div className="fixed inset-0 bg-background">
      <Canvas key={run} dpr={[1, 1.75]} camera={{ fov: 72, near: 0.05, far: 60 }} gl={{ antialias: true }}
        onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1; }}>
        <color attach="background" args={["#0b0603"]} />
        <fog attach="fog" args={["#0b0603", 8, 30]} />
        <ambientLight intensity={0.35} color="#ffcf9a" />
        <hemisphereLight args={["#ffd7a0", "#2a1708", 0.35]} />
        <World cur={cur} refs={refs.current} />
        <Player refs={refs.current} playing={status === "playing"} onRoom={setCur} onLever={onLever} setHint={setHint} />
        {status !== "menu" && status !== "dead" && (
          <PointerLockControls ref={controls}
            onUnlock={() => setStatus((s) => (s === "playing" ? "paused" : s))}
            onLock={() => setStatus((s) => (s === "paused" ? "playing" : s))} />
        )}
      </Canvas>

      {/* HUD */}
      <div className="pointer-events-none fixed inset-0 z-10 text-foreground">
        {(status === "playing" || status === "paused") && (
          <>
            <div className="absolute left-1/2 top-6 -translate-x-1/2 text-center">
              <div key={flash} className={`hud-timer ${low ? "hud-timer-low" : ""} ${flash ? "animate-bonus" : ""}`}>{formatTime(time)}</div>
              <div className="mt-1 text-sm tracking-[0.3em] text-muted-foreground">DOOR {String(cur + 1).padStart(4, "0")}</div>
            </div>
            <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/70" />
            {hint && <div className="absolute left-1/2 top-[58%] -translate-x-1/2 rounded bg-card/80 px-3 py-1 text-sm text-primary">{hint}</div>}
          </>
        )}
      </div>

      {status !== "playing" && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="max-w-md text-center">
            <h1 className="font-display text-6xl text-primary">
              {status === "dead" ? "Time's up" : status === "paused" ? "Paused" : "The Backdoor"}
            </h1>
            <p className="mt-4 text-muted-foreground">
              {status === "dead"
                ? `You reached door ${cur + 1}. Best: ${Math.max(best, cur) + 1}.`
                : "Walk up to a door and it opens. The clock never stops — find levers roughly every 70 doors to buy more time."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">WASD to move · Shift to run · Mouse to look · Click levers</p>
            <button
              className="btn-hero mt-8"
              onClick={() => (status === "paused" ? controls.current?.lock() : start())}
            >
              {status === "paused" ? "Resume" : status === "dead" ? "Try again" : "Enter"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

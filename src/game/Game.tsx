import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import ambianceAsset from "@/assets/rush-ambiance.mp3.asset.json";
import { RoomView } from "./RoomView";
import { Rush } from "./Rush";
import { fx, resetFx } from "./fx";
import {
  LAST_ROOM, LEVER_BONUS, RUSH_CHANCE, RUSH_MIN_ROOM, RUSH_SPEED, START_TIME, doorLabel, firstLoadedRoom,
  formatTime, getRoom, pathPoint, resetWorld, roomColliders, roomIndexAt, type Closet,
} from "./world";

const SPEED = 4.2;
const RADIUS = 0.35;
const EYE = 1.6;
const OPEN_DIST = 4;
const WARN_TIME = 3.5;
const KILL_DIST = 1.6;

type Refs = {
  doors: Map<number, { current: number }>;
  levers: Map<number, { current: boolean }>;
};
const getRef = <T,>(m: Map<number, { current: T }>, i: number, d: T) => {
  let r = m.get(i);
  if (!r) { r = { current: d }; m.set(i, r); }
  return r;
};

function Player({ refs, playing, onRoom, onLever, setHint, onDeath, setHidden, audio }: {
  refs: Refs; playing: boolean; onRoom: (i: number) => void; onLever: () => void; setHint: (s: string) => void;
  onDeath: () => void; setHidden: (h: boolean) => void; audio: React.RefObject<HTMLAudioElement | null>;
}) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const roomIdx = useRef(0);
  const hintRef = useRef("");
  const hidden = useRef<{ c: Closet; back: THREE.Vector3 } | null>(null);
  const base = useRef(new THREE.Vector3(0, EYE, -2));

  const nearCloset = useCallback(() => {
    const p = base.current;
    for (let i = roomIdx.current - 1; i <= roomIdx.current + 1; i++) {
      if (i < 0) continue;
      for (const c of getRoom(i).closets) if (Math.hypot(p.x - c.x, p.z - c.z) < 1.9) return c;
    }
    return null;
  }, []);

  const toggleHide = useCallback(() => {
    if (hidden.current) {
      base.current.copy(hidden.current.back);
      hidden.current = null;
      setHidden(false);
      return;
    }
    const c = nearCloset();
    if (!c) return;
    hidden.current = { c, back: new THREE.Vector3(c.x - c.side * 1.05, EYE, c.z) };
    base.current.set(c.x - c.side * 0.1, EYE, c.z);
    camera.rotation.set(0, c.side === 1 ? Math.PI / 2 : -Math.PI / 2, 0, "YXZ");
    setHidden(true);
  }, [camera, nearCloset, setHidden]);

  useEffect(() => {
    camera.position.copy(base.current);
    camera.rotation.set(0, 0, 0);
    const d = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === "KeyE" && playing) toggleHide();
    };
    const u = (e: KeyboardEvent) => (keys.current[e.code] = false);
    window.addEventListener("keydown", d);
    window.addEventListener("keyup", u);
    return () => { window.removeEventListener("keydown", d); window.removeEventListener("keyup", u); };
  }, [camera, playing, toggleHide]);

  const lookingAtLever = useCallback(() => {
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    for (let i = roomIdx.current - 1; i <= roomIdx.current + 1; i++) {
      if (i < 0) continue;
      const rm = getRoom(i);
      if (!rm.lever || getRef(refs.levers, i, false).current) continue;
      const to = new THREE.Vector3(rm.lever.x, 1.4, rm.lever.z).sub(camera.position);
      if (to.length() < 3 && to.normalize().dot(fwd) > 0.88) return i;
    }
    return -1;
  }, [camera, refs]);

  useEffect(() => {
    const click = () => {
      if (!playing || hidden.current) return;
      const i = lookingAtLever();
      if (i >= 0) { getRef(refs.levers, i, false).current = true; onLever(); }
    };
    window.addEventListener("mousedown", click);
    return () => window.removeEventListener("mousedown", click);
  }, [playing, lookingAtLever, onLever, refs]);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    if (!playing) return;
    const K = (c: string) => !!keys.current[c];
    const p = base.current;
    const cur = roomIndexAt(p.z, roomIdx.current);
    let moving = false;

    if (!hidden.current) {
      const f = (K("KeyW") || K("ArrowUp") ? 1 : 0) - (K("KeyS") || K("ArrowDown") ? 1 : 0);
      const s = (K("KeyD") || K("ArrowRight") ? 1 : 0) - (K("KeyA") || K("ArrowLeft") ? 1 : 0);
      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      fwd.y = 0; fwd.normalize();
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const mv = fwd.multiplyScalar(f).add(right.multiplyScalar(s));
      moving = mv.lengthSq() > 0;
      if (moving) mv.normalize().multiplyScalar(SPEED * (K("ShiftLeft") ? 1.4 : 1) * dt);
      const boxes = [cur - 1, cur, cur + 1].filter((i) => i >= 0).flatMap((i) =>
        roomColliders(getRoom(i), getRef(refs.doors, i, 0).current > 0),
      );
      const hit = (x: number, z: number) =>
        boxes.some((b) => x + RADIUS > b.minX && x - RADIUS < b.maxX && z + RADIUS > b.minZ && z - RADIUS < b.maxZ);
      if (!hit(p.x + mv.x, p.z)) p.x += mv.x;
      if (!hit(p.x, p.z + mv.z)) p.z += mv.z;

      for (const i of [cur, cur + 1]) {
        const rm = getRoom(i);
        if (rm.final) continue;
        const ref = getRef(refs.doors, i, 0);
        if (ref.current === 0 && Math.hypot(p.x - rm.exitX, p.z - (rm.z0 - rm.l)) < OPEN_DIST) ref.current = 1;
      }
    }

    // --- Rush ---
    fx.flicker = Math.max(0, fx.flicker - dt);
    const r = fx.rush;
    const a = audio.current;
    if (r) {
      r.endT = Math.max(r.endT, cur + 1); // it stops at the exit door of the player's current room
      if (r.phase === "warn") {
        r.timer -= dt;
        if (a) a.volume = Math.min(1, 0.15 + (1 - r.timer / WARN_TIME) * 0.35);
        if (r.timer <= 0) r.phase = "run";
      } else {
        const steps = Math.ceil((RUSH_SPEED * dt) / 0.04);
        for (let k = 0; k < steps && fx.rush; k++) {
          r.t = Math.min(r.endT, r.t + (RUSH_SPEED * dt) / steps);
          const ki = Math.floor(r.t);
          if (r.t - ki > 0.85) getRef(refs.doors, ki, 0).current = 1;
          const [ex, ez] = pathPoint(r.t);
          const dist = Math.hypot(ex - p.x, ez - p.z);
          if (dist < KILL_DIST && !hidden.current) { onDeath(); return; }
        }
        const [ex, ez] = pathPoint(r.t);
        const dist = Math.hypot(ex - p.x, ez - p.z);
        fx.shake = Math.max(0, 1 - dist / 25);
        if (a) a.volume = Math.min(1, 0.4 + fx.shake * 0.6);
        if (r.t >= r.endT) {
          getRef(refs.doors, Math.floor(r.endT) - 1, 0).current = 1; // slams the door on its way out
          fx.rush = null;
          fx.shake = 0.6;
          if (a) { a.pause(); a.currentTime = 0; }
        }
      }
    } else fx.shake = Math.max(0, fx.shake - dt * 1.5);

    const sh = fx.shake * 0.08;
    camera.position.set(
      p.x + (Math.random() - 0.5) * sh,
      EYE + (moving ? Math.sin(performance.now() / 110) * 0.03 : 0) + (Math.random() - 0.5) * sh,
      p.z + (Math.random() - 0.5) * sh,
    );

    const nowIdx = roomIndexAt(p.z, cur);
    if (nowIdx !== roomIdx.current) {
      const entered = nowIdx > roomIdx.current;
      roomIdx.current = nowIdx;
      onRoom(nowIdx);
      if (entered && !fx.rush && nowIdx >= RUSH_MIN_ROOM && nowIdx <= LAST_ROOM && Math.random() < RUSH_CHANCE) {
        fx.rush = { phase: "warn", timer: WARN_TIME, t: Math.max(0, nowIdx - 1), endT: nowIdx + 1 };
        fx.flicker = WARN_TIME;
        if (a) { a.currentTime = 0; a.volume = 0.15; void a.play().catch(() => {}); }
      }
    }

    let h = "";
    if (hidden.current) h = "Press E to leave the closet";
    else if (lookingAtLever() >= 0) h = `Click to pull lever (+${formatTime(LEVER_BONUS)})`;
    else if (nearCloset()) h = "Press E to hide";
    if (h !== hintRef.current) { hintRef.current = h; setHint(h); }
  });

  return null;
}

function World({ cur, refs }: { cur: number; refs: Refs }) {
  const ids = [];
  for (let i = firstLoadedRoom(cur); i <= Math.min(cur + 3, LAST_ROOM + 1); i++) ids.push(i);
  return (
    <>
      {ids.map((i) => (
        <RoomView key={i} rm={getRoom(i)} lit={i >= cur - 1 && i <= cur + 2}
          doorOpen={getRef(refs.doors, i, 0)} leverUsed={getRef(refs.levers, i, false)} />
      ))}
    </>
  );
}

type Status = "menu" | "playing" | "paused" | "dead" | "won";

export function Game() {
  const [status, setStatus] = useState<Status>("menu");
  const [reason, setReason] = useState("");
  const [time, setTime] = useState(START_TIME);
  const [cur, setCur] = useState(0);
  const [hint, setHint] = useState("");
  const [hidden, setHidden] = useState(false);
  const [flash, setFlash] = useState(0);
  const [run, setRun] = useState(0);
  const refs = useRef<Refs>({ doors: new Map(), levers: new Map() });
  const controls = useRef<any>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const a = new Audio(ambianceAsset.url);
    a.loop = true;
    a.preload = "auto";
    audio.current = a;
    return () => a.pause();
  }, []);

  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(() => setTime((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const end = useCallback((s: Status, why: string) => {
    setStatus(s);
    setReason(why);
    document.exitPointerLock?.();
    audio.current?.pause();
  }, []);

  useEffect(() => {
    if (time <= 0 && status === "playing") end("dead", "Time ran out.");
  }, [time, status, end]);

  useEffect(() => {
    if (cur > LAST_ROOM && status === "playing") end("won", "You made it through door 0.");
  }, [cur, status, end]);

  const start = () => {
    resetWorld();
    resetFx();
    refs.current = { doors: new Map(), levers: new Map() };
    setTime(START_TIME); setCur(0); setHidden(false); setRun((r) => r + 1); setStatus("playing");
    setTimeout(() => controls.current?.lock(), 50);
  };

  const onLever = useCallback(() => {
    setTime((t) => t + LEVER_BONUS);
    setFlash((f) => f + 1);
  }, []);
  const onDeath = useCallback(() => end("dead", "Something rushed through the room."), [end]);

  const low = time <= 30;
  const title = status === "won" ? "Escaped" : status === "dead" ? "You died" : status === "paused" ? "Paused" : "The Storage Rooms";

  return (
    <div className="fixed inset-0 bg-background">
      <Canvas key={run} dpr={[1, 1.75]} camera={{ fov: 72, near: 0.05, far: 60 }} gl={{ antialias: true }}
        onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1; }}>
        <color attach="background" args={["#0b0603"]} />
        <fog attach="fog" args={["#0b0603", 8, 30]} />
        <ambientLight intensity={0.35} color="#ffcf9a" />
        <hemisphereLight args={["#ffd7a0", "#2a1708", 0.35]} />
        <World cur={cur} refs={refs.current} />
        <Suspense fallback={null}><Rush /></Suspense>
        <Player refs={refs.current} playing={status === "playing"} onRoom={setCur} onLever={onLever}
          setHint={setHint} onDeath={onDeath} setHidden={setHidden} audio={audio} />
        {(status === "playing" || status === "paused") && (
          <PointerLockControls ref={controls}
            onUnlock={() => setStatus((s) => (s === "playing" ? "paused" : s))}
            onLock={() => setStatus((s) => (s === "paused" ? "playing" : s))} />
        )}
      </Canvas>

      <div className="pointer-events-none fixed inset-0 z-10 text-foreground">
        {hidden && <div className="closet-view absolute inset-0" />}
        {(status === "playing" || status === "paused") && (
          <>
            <div className="absolute left-1/2 top-6 -translate-x-1/2 text-center">
              <div key={flash} className={`hud-timer ${low ? "hud-timer-low" : ""} ${flash ? "animate-bonus" : ""}`}>{formatTime(time)}</div>
              <div className="mt-1 text-sm tracking-[0.3em] text-muted-foreground">DOOR {doorLabel(Math.min(cur, LAST_ROOM))}</div>
            </div>
            <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/70" />
            {hint && <div className="absolute left-1/2 top-[58%] -translate-x-1/2 rounded bg-card/80 px-3 py-1 text-sm text-primary">{hint}</div>}
          </>
        )}
      </div>

      {status !== "playing" && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="max-w-md text-center">
            <h1 className="font-display text-6xl text-primary">{title}</h1>
            <p className="mt-4 text-muted-foreground">
              {status === "dead" || status === "won"
                ? `${reason} You reached door ${doorLabel(Math.min(cur, LAST_ROOM))}.`
                : "Doors open as you approach. Pull levers every 7 doors for more time. When the lights flicker, hide in a closet."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">WASD move · Shift run · Mouse look · Click levers · E hide</p>
            <button className="btn-hero mt-8" onClick={() => (status === "paused" ? controls.current?.lock() : start())}>
              {status === "paused" ? "Resume" : status === "menu" ? "Enter" : "Try again"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

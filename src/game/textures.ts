import * as THREE from "three";

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function planks(base: [number, number, number], vertical: boolean) {
  const [c, g] = canvas(512, 512);
  const rows = 8;
  for (let i = 0; i < rows; i++) {
    const v = 0.8 + Math.random() * 0.35;
    g.fillStyle = `rgb(${base[0] * v},${base[1] * v},${base[2] * v})`;
    g.fillRect(0, i * 64, 512, 64);
    for (let k = 0; k < 40; k++) {
      g.strokeStyle = `rgba(30,15,5,${Math.random() * 0.18})`;
      g.beginPath();
      const y = i * 64 + Math.random() * 64;
      g.moveTo(0, y);
      g.bezierCurveTo(170, y + Math.random() * 6 - 3, 340, y + Math.random() * 6 - 3, 512, y);
      g.stroke();
    }
    g.fillStyle = "rgba(20,10,3,0.7)";
    g.fillRect(0, i * 64, 512, 3);
    const off = Math.random() * 512;
    g.fillRect(off, i * 64, 3, 64);
  }
  const t = new THREE.CanvasTexture(c);
  if (vertical) {
    t.rotation = Math.PI / 2;
    t.center.set(0.5, 0.5);
  }
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function lattice() {
  const [c, g] = canvas(256, 256);
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = "#3a2516";
  g.lineWidth = 22;
  for (let k = -256; k <= 512; k += 128) {
    g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 256, 256); g.stroke();
    g.beginPath(); g.moveTo(k + 256, 0); g.lineTo(k, 256); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let cache: ReturnType<typeof build> | null = null;
function build() {
  return {
    floor: planks([120, 78, 45], false),
    wall: planks([95, 62, 38], true),
    ceiling: planks([105, 70, 42], false),
    door: planks([70, 44, 28], true),
    crate: planks([170, 125, 80], false),
    lattice: lattice(),
  };
}
export function getTextures() {
  if (!cache) cache = build();
  return cache;
}

export function numberTexture(n: number) {
  const [c, g] = canvas(256, 128);
  g.fillStyle = "#2a1a0e";
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = "#c79a52";
  g.lineWidth = 8;
  g.strokeRect(8, 8, 240, 112);
  g.fillStyle = "#e8c27a";
  g.font = "bold 72px Georgia, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(n).padStart(4, "0"), 128, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

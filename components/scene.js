// The 3D room: Mira, her table, the deck and all choreography. Imperative Three.js,
// driven by TarotRoom.jsx through the small API returned from createScene().
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { emblemSVG } from "@/lib/tarot";
import { audio } from "@/lib/audio";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = (h) => new THREE.Color(h);
const PI = Math.PI;

export function createScene(canvas, hooks) {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  // Render resolution adapts to the device: up to 1.5x on sharp screens (the anti-aliasing keeps edges clean),
  // stepping down on devices that cannot hold a smooth frame rate, and back up when they can.
  const maxPR = Math.min(devicePixelRatio || 1, 1.5), minPR = Math.min(maxPR, 0.85);
  let pr = maxPR;
  renderer.setPixelRatio(pr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = C(0x0b0609); scene.fog = new THREE.FogExp2(0x0b0609, 0.13);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 40);
  // Soft reflections for gold, glass and glossy eyes.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.22;
  // Anti-aliased render target, bloom for the flames, then a gentle vignette and film grain.
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.7, 0.85);
  composer.addPass(bloom); composer.addPass(new OutputPass());
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform sampler2D tDiffuse; uniform float time; varying vec2 vUv; float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); } void main(){ vec4 c = texture2D(tDiffuse, vUv); float d = distance(vUv, vec2(0.5, 0.48)); c.rgb *= mix(1.0, 0.74, smoothstep(0.35, 0.85, d)); c.rgb += (rnd(vUv * 1000.0) - 0.5) * 0.028; gl_FragColor = c; }",
  });
  composer.addPass(grade);

  const clock = new THREE.Clock(); let t = 0, raf = 0, disposed = false;
  const camBase = V(0, 1.78, 3.45), camLook = V(0, 0.96, -0.1), camPos = V(0, 2.5, 7);
  let camTarget = camPos.clone();
  const pointer = new THREE.Vector2(0, 0), ndc = new THREE.Vector2(-9, -9);
  const raycaster = new THREE.Raycaster();
  const st = { entered: false, choosing: false, thinking: false, talking: false, shuffling: false, lookMode: "user", handFollow: null, chosen: -1, reading: false, breathTarget: 0, cutting: false, washCenter: null };

  /* ---------- helpers ---------- */
  function canvasTex(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); draw(g, w, h); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx; }
  function glowTex(stops) { return canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([o, c]) => r.addColorStop(o, c)); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }); }
  function svgImg(svg, cb) { const img = new Image(); img.onload = () => cb(img); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); }
  const tweens = [];
  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  function anim(dur, fn, delay = 0) { return new Promise((r) => tweens.push({ dur: Math.max(dur, 0.001), fn, t: -delay, r })); }
  const wait = (s) => anim(s, () => {});
  let capturing = null;
  function mesh(geo, mat, parent, pos, scale, rot) {
    const m = new THREE.Mesh(geo, mat); if (pos) m.position.copy(pos); if (scale) m.scale.copy(scale); if (rot) m.rotation.set(rot.x, rot.y, rot.z);
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    // beads, pearls and other tiny pieces would only add cost to the shadow pass, not visible shadows
    m.castShadow = geo.boundingSphere.radius * Math.max(m.scale.x, m.scale.y, m.scale.z) > 0.012; m.receiveShadow = true;
    parent.add(m); if (capturing) capturing.push(m); return m;
  }
  // Runs build(), then merges the static meshes it made into one mesh per material under root.
  // Jewellery, hands and candles are dozens of small parts; merged they cost a few draw calls instead of hundreds.
  function batched(root, build) {
    const prev = capturing; capturing = []; const out = build(); const list = capturing; capturing = prev;
    bakeInto(root, list); return out;
  }
  function bakeInto(root, list) {
    root.updateMatrixWorld(true);
    const inv = root.matrixWorld.clone().invert(), groups = new Map();
    for (const m of list) { if (!m.parent || m.userData.keep) continue; const k = m.material.uuid; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); }
    for (const ms of groups.values()) {
      if (ms.length < 2) continue;
      const geos = ms.map((m) => {
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const a of Object.keys(g.attributes)) if (a !== "position" && a !== "normal" && a !== "uv") g.deleteAttribute(a);
        g.morphAttributes = {}; g.clearGroups();
        return g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      });
      const merged = mergeGeometries(geos); geos.forEach((g) => g.dispose());
      if (!merged) continue;
      for (const m of ms) { m.parent.remove(m); m.geometry.dispose(); }
      const out = new THREE.Mesh(merged, ms[0].material); out.castShadow = ms.some((m) => m.castShadow); out.receiveShadow = true; root.add(out);
    }
    // drop empty helper groups left behind
    const empty = []; root.traverse((o) => { if (o !== root && o.type === "Group" && o.children.length === 0 && !o.userData.keep) empty.push(o); });
    empty.forEach((o) => o.parent && o.parent.remove(o));
  }
  const additive = (map, extra = {}) => new THREE.SpriteMaterial({ map, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, ...extra });

  /* ---------- materials ---------- */
  // Same seeded random for every pass of a texture, so colour and gloss maps line up.
  const seeded = (s) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  // Draws one design twice: a colour map and an "ORM" map (green = roughness, blue = metalness).
  function texturePair(w, h, draw) {
    const mk = () => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
    const cc = mk(), oc = mk(); draw(cc.getContext("2d"), "color", w, h); draw(oc.getContext("2d"), "orm", w, h);
    const map = new THREE.CanvasTexture(cc); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    return { map, orm: new THREE.CanvasTexture(oc) };
  }
  const goldFill = (g, pass, x0, y0, x1, y1) => {
    if (pass !== "color") return "rgb(0,80,255)";
    const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, "#f6d993"); gr.addColorStop(0.45, "#b8873c"); gr.addColorStop(0.7, "#f2d088"); gr.addColorStop(1, "#a87a34"); return gr;
  };
  const M = {
    skinPlain: new THREE.MeshPhysicalMaterial({ color: C(0xb0714c), roughness: 0.55, sheen: 0.35, sheenColor: C(0xffb59a), sheenRoughness: 0.6 }),
    lid: new THREE.MeshPhysicalMaterial({ color: C(0x8f5440), roughness: 0.6, sheen: 0.3, sheenColor: C(0xffb59a) }),
    velvet: new THREE.MeshPhysicalMaterial({ color: C(0x4e1123), roughness: 0.85, sheen: 1, sheenColor: C(0xb03a5c), sheenRoughness: 0.35, side: THREE.DoubleSide }),
    cloak: new THREE.MeshPhysicalMaterial({ color: C(0x220810), roughness: 0.9, sheen: 1, sheenColor: C(0x6a1d33), sheenRoughness: 0.35, side: THREE.DoubleSide }),
    gold: new THREE.MeshStandardMaterial({ color: C(0xe0b468), metalness: 1, roughness: 0.26 }),
    gem: new THREE.MeshPhysicalMaterial({ color: C(0xb0213f), roughness: 0.05, clearcoat: 1, emissive: C(0x40061a) }),
    pearl: new THREE.MeshPhysicalMaterial({ color: C(0xf3eadb), roughness: 0.25, sheen: 1, sheenColor: C(0xffffff), clearcoat: 0.6 }),
    black: new THREE.MeshStandardMaterial({ color: C(0x0a0506), roughness: 0.4 }),
    dark: new THREE.MeshStandardMaterial({ color: C(0x2a0a10), roughness: 0.8 }),
    lips: new THREE.MeshPhysicalMaterial({ color: C(0x86283b), roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.4 }),
    spark: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    wax: new THREE.MeshPhysicalMaterial({ color: C(0xeadcbc), roughness: 0.55, sheen: 0.5, sheenColor: C(0xfff0d0), emissive: C(0x3a2410) }),
  };

  /* ---------- Mira ---------- */
  const mira = {};
  // Her head is a soft oval with a gentle jaw and chin. Her features are painted on a face layer
  // that redraws when she blinks, glances or speaks, so her expression always stays soft.
  const HS = V(0.115, 0.136, 0.13);
  const YU = 0.97, YD = 1.02; // vertical stretch above / below the eye line
  const clamp = THREE.MathUtils.clamp;
  const gauss = (dx, dy, s) => Math.exp(-(dx * dx + dy * dy) / s);
  const smooth = (k) => k * k * (3 - 2 * k);
  const jawK = (y) => smooth(clamp((-y - 0.18) / 0.84, 0, 1)); // the jaw narrows only below the nose
  function sculpt(v) {
    let x = v.x, y = v.y * (v.y > 0 ? YU : YD), z = v.z, kk = 0;
    if (y < 0) { kk = jawK(y); x *= 1 - 0.26 * kk; z *= 1 - 0.05 * kk; }
    if (z < 0) z *= 1.05;
    if (z > 0.5) z = 0.5 + (z - 0.5) * 0.8;
    if (z > 0) {
      if (y < 0 && z > 0.3) z += 0.07 * kk * Math.exp(-(x * x) / 0.25);                           // rounded jaw front
      z -= 0.022 * (gauss(x - 0.33, y - 0.07, 0.03) + gauss(x + 0.33, y - 0.07, 0.03));          // soft eye hollows
      const ny = clamp((0.02 - y) / 0.29, 0, 1), fall = y < -0.27 ? Math.exp(-((y + 0.27) ** 2) / 0.003) : 1;
      z += 0.07 * Math.pow(ny, 1.4) * fall * Math.exp(-(x * x) / (0.006 + 0.014 * ny));          // small, straight nose
      z += 0.03 * (gauss(x - 0.42, y + 0.12, 0.05) + gauss(x + 0.42, y + 0.12, 0.05));           // cheeks
      z += 0.016 * Math.exp(-(x * x) / 0.03 - ((y + 0.57) ** 2) / 0.008);                       // lips
      z += 0.028 * Math.exp(-(x * x) / 0.05 - ((y + 0.92) ** 2) / 0.012);                       // chin
    }
    return V(x * HS.x, y * HS.y, z * HS.z);
  }
  // Point on the unit sphere that sculpts to face coordinates (x, y).
  function unitFor(xs, ys) {
    const uy = clamp(ys / (ys > 0 ? YU : YD), -0.99, 0.99);
    let ux = xs; if (ys < 0) ux = xs / (1 - 0.26 * jawK(ys));
    return V(ux, uy, Math.sqrt(Math.max(0.0001, 1 - ux * ux - uy * uy)));
  }
  const fp = (xs, ys) => sculpt(unitFor(xs, ys));

  // Skin: warm, even tone with soft contouring, painted on the head sphere's UVs (u = 0.25 is the front).
  const SKIN = "#c4876a";
  const FW = 2048, FH = 1024;
  function faceUV(xs, ys) { const u = unitFor(xs, ys); return [(0.25 + Math.atan2(u.x, u.z) / (2 * PI)) * FW, (Math.acos(u.y) / PI) * FH]; }
  const faceTex = canvasTex(FW, FH, (g) => {
    const r = seeded(5);
    g.fillStyle = SKIN; g.fillRect(0, 0, FW, FH);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "150,80,60" : "235,180,150"},${r() * 0.035})`; g.beginPath(); g.arc(r() * FW, r() * FH, 2 + r() * 10, 0, 7); g.fill(); }
    const blob = (xs, ys, rx, ry, rgb, a) => {
      const [x, y] = faceUV(xs, ys), gr = g.createRadialGradient(x, y, 0, x, y, rx);
      gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rx, 0, 7); g.fill(); g.restore();
    };
    blob(0, -1.05, 300, 110, "110,55,40", 0.35);
    blob(0, 0.55, 240, 100, "235,190,160", 0.16);
  });
  faceTex.anisotropy = 8;
  M.skin = new THREE.MeshPhysicalMaterial({ map: faceTex, roughness: 0.5, sheen: 0.4, sheenColor: C(0xffbfa5), sheenRoughness: 0.6, clearcoat: 0.06, clearcoatRoughness: 0.6 });
  M.skinPlain.color = C(SKIN);

  // Face layer: a patch over the front of the head with its own canvas, so features get full resolution.
  const PH0 = PI / 2 - 1.1, PHL = 2.2, TH0 = 0.45, THL = 2.35, FC = 1024;
  function fpx(xs, ys) { const u = unitFor(xs, ys); return [((Math.atan2(u.z, -u.x) - PH0) / PHL) * FC, ((Math.acos(u.y) - TH0) / THL) * FC]; }
  function spline(pts, n = 10) {
    const out = [], f = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < n; k++) out.push(fpx(f(p0[0], p1[0], p2[0], p3[0], k / n), f(p0[1], p1[1], p2[1], p3[1], k / n)));
    }
    const l = pts[pts.length - 1]; out.push(fpx(l[0], l[1])); return out;
  }
  const faceCanvas = document.createElement("canvas"); faceCanvas.width = faceCanvas.height = FC;
  const fg = faceCanvas.getContext("2d");
  const faceLayerTex = new THREE.CanvasTexture(faceCanvas); faceLayerTex.colorSpace = THREE.SRGBColorSpace; faceLayerTex.anisotropy = 8;
  M.faceLayer = new THREE.MeshPhysicalMaterial({ map: faceLayerTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, roughness: 0.45, sheen: 0.4, sheenColor: C(0xffbfa5), sheenRoughness: 0.6 });

  // Eye shape for her left side (x > 0); the right side is mirrored.
  const EYE_UP = [[0.185, 0.062], [0.24, 0.128], [0.33, 0.158], [0.43, 0.148], [0.505, 0.102]];
  const EYE_SHUT = [[0.185, 0.062], [0.25, 0.05], [0.34, 0.042], [0.44, 0.055], [0.505, 0.102]];
  const EYE_LOW = [[0.185, 0.062], [0.25, 0.03], [0.34, 0.016], [0.44, 0.034], [0.505, 0.102]];
  const LIP_TOP = [[-0.165, -0.545], [-0.11, -0.506], [-0.042, -0.49], [0, -0.501], [0.042, -0.49], [0.11, -0.506], [0.165, -0.545]];
  const LIP_SEAM = [[-0.165, -0.545], [-0.09, -0.551], [0, -0.555], [0.09, -0.551], [0.165, -0.545]];
  const LIP_BOT = [[-0.165, -0.545], [-0.12, -0.584], [-0.05, -0.612], [0, -0.616], [0.05, -0.612], [0.12, -0.584], [0.165, -0.545]];

  // smile: 0 neutral … 1 a warm, open smile (lip corners rise, lower lids lift, cheeks warm, brows soften upward)
  function drawFace(blink, open, gx, gy, smile = 0.25) {
    const g = fg;
    g.clearRect(0, 0, FC, FC);
    const trace = (px, close) => { g.beginPath(); px.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (close) g.closePath(); };
    const blob = (xs, ys, rx, ry, rgb, a) => {
      const [x, y] = fpx(xs, ys), gr = g.createRadialGradient(x, y, 0, x, y, rx);
      gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rx, 0, 7); g.fill(); g.restore();
    };
    const taper = (px, w0, w1, color, pow = 1) => {
      g.strokeStyle = color; g.lineCap = "round";
      for (let i = 1; i < px.length; i++) { g.lineWidth = w0 + (w1 - w0) * Math.pow(i / px.length, pow); g.beginPath(); g.moveTo(...px[i - 1]); g.lineTo(...px[i]); g.stroke(); }
    };

    // soft makeup: blush, highlights, contour
    for (const s of [-1, 1]) {
      blob(s * 0.43, -0.2 + smile * 0.015, 80, 52, "215,105,110", 0.22 + smile * 0.1);
      blob(s * 0.4, -0.07, 48, 22, "255,214,190", 0.14);
    }
    blob(0, -0.665, 46, 12, "110,55,40", 0.22);
    blob(0, -0.43, 12, 26, "120,60,45", 0.12);

    // nose: gentle shading only, no hard edges
    for (const s of [-1, 1]) {
      blob(s * 0.07, -0.1, 14, 62, "125,65,48", 0.16);
      g.save(); const [nx, ny] = fpx(s * 0.052, -0.288); g.translate(nx, ny); g.rotate(s * 0.35); g.scale(1, 0.5);
      const ng = g.createRadialGradient(0, 0, 0, 0, 0, 9); ng.addColorStop(0, "rgba(70,30,24,.7)"); ng.addColorStop(1, "rgba(70,30,24,0)"); g.fillStyle = ng; g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill(); g.restore();
      g.strokeStyle = "rgba(110,55,40,.25)"; g.lineWidth = 2; trace(spline([[s * 0.075, -0.235], [s * 0.095, -0.262], [s * 0.08, -0.29]], 6)); g.stroke();
    }
    blob(0, 0.02, 10, 60, "255,220,195", 0.16);
    blob(0, -0.215, 20, 16, "255,220,195", 0.3);
    blob(0, -0.3, 34, 10, "100,48,35", 0.28);

    // brows: soft arch, full at the start, tapering to a fine tail
    for (const s of [-1, 1]) {
      const lift = smile * 0.012;
      const px = spline([[0.16, 0.245 + lift * 1.3], [0.25, 0.292 + lift], [0.36, 0.316 + lift * 0.6], [0.47, 0.298], [0.56, 0.245]].map(([x, y]) => [s * x, y]), 12);
      const top = [], bot = [];
      px.forEach((p, i) => {
        const q = px[Math.min(px.length - 1, i + 1)], o = px[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], L = Math.hypot(dx, dy) || 1;
        const t = i / (px.length - 1), w = (t < 0.15 ? 5 + t * 20 : 8 * (1 - (t - 0.15) / 0.85) + 1.2), nx = -dy / L, ny = dx / L;
        top.push([p[0] + nx * w * s, p[1] + ny * w * s]); bot.push([p[0] - nx * w * s, p[1] - ny * w * s]);
      });
      const [ax] = px[0], [bx] = px[px.length - 1], lg = g.createLinearGradient(ax, 0, bx, 0);
      lg.addColorStop(0, "rgba(45,24,18,.35)"); lg.addColorStop(0.25, "rgba(35,18,14,.82)"); lg.addColorStop(1, "rgba(30,15,12,.85)");
      g.fillStyle = lg; trace(top.concat(bot.reverse()), true); g.fill();
      g.strokeStyle = "rgba(20,10,8,.35)"; g.lineWidth = 1.2;
      for (let i = 2; i < px.length - 2; i += 1) { const [x, y] = px[i]; g.beginPath(); g.moveTo(x - s * 3, y + 4); g.lineTo(x + s * 4, y - 4); g.stroke(); }
    }

    // eyes
    for (const s of [-1, 1]) {
      const mir = (pts) => pts.map(([x, y]) => [s * x, y]);
      const up = EYE_UP.map((p, i) => [p[0], p[1] + (EYE_SHUT[i][1] - p[1]) * blink]);
      blob(s * 0.34, 0.165, 92, 46, "125,62,75", 0.32);
      blob(s * 0.46, 0.14, 46, 28, "85,38,48", 0.28);
      blob(s * 0.33, 0.215, 60, 16, "255,215,190", 0.14 * (1 - blink));
      g.strokeStyle = `rgba(95,48,42,${0.38 * (1 - blink * 0.7)})`; g.lineWidth = 2.6;
      trace(spline(mir([[0.2, 0.135 - 0.05 * blink], [0.3, 0.205 - 0.07 * blink], [0.42, 0.2 - 0.07 * blink], [0.51, 0.13 - 0.02 * blink]]))); g.stroke();
      const low = EYE_LOW.map(([x, y], i) => [x, y + (i > 0 && i < EYE_LOW.length - 1 ? smile * 0.016 : 0)]);
      const upPx = spline(mir(up)), lowPx = spline(mir(low));
      if (blink < 0.96) {
        g.save(); trace(upPx.concat(lowPx.slice().reverse()), true); g.clip();
        const [ex, ey] = fpx(s * 0.345, 0.085);
        g.fillStyle = "#dccbbf"; g.fillRect(ex - 120, ey - 80, 240, 160);
        for (const [cx, a] of [[0.2, 0.55], [0.5, 0.35]]) blob(s * cx, 0.065, 30, 26, "200,125,118", a);
        const [ix, iy] = fpx(s * 0.335 + gx * 0.04, 0.084 + gy * 0.028), r = 31;
        const ir = g.createRadialGradient(ix, iy, 0, ix, iy, r);
        ir.addColorStop(0, "#080403"); ir.addColorStop(0.3, "#080403"); ir.addColorStop(0.36, "#3a1f0d"); ir.addColorStop(0.62, "#6e4220"); ir.addColorStop(0.86, "#2a170a"); ir.addColorStop(1, "#140904");
        g.fillStyle = ir; g.beginPath(); g.arc(ix, iy, r, 0, 7); g.fill();
        g.strokeStyle = "rgba(235,185,115,.28)"; g.lineWidth = 1;
        for (let k = 0; k < 40; k++) { const a = (k / 40) * PI * 2; g.beginPath(); g.moveTo(ix + Math.cos(a) * r * 0.38, iy + Math.sin(a) * r * 0.38); g.lineTo(ix + Math.cos(a) * r * 0.85, iy + Math.sin(a) * r * 0.85); g.stroke(); }
        g.strokeStyle = "rgba(45,18,12,.55)"; g.lineWidth = 16; trace(upPx); g.stroke();
        g.strokeStyle = "rgba(45,18,12,.25)"; g.lineWidth = 34; trace(upPx); g.stroke();
        g.fillStyle = "rgba(255,255,255,.95)"; g.beginPath(); g.arc(ix + r * 0.32, iy - r * 0.3, 5.5, 0, 7); g.fill();
        g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.arc(ix - r * 0.3, iy + r * 0.32, 2.4, 0, 7); g.fill();
        g.restore();
      }
      // lash line with a soft winged tip, then lashes
      taper(upPx, 2.5, 8.5, "#140907", 1.6);
      const o = fpx(s * 0.505, 0.102 + 0.0 * blink), w1 = fpx(s * 0.555, 0.138 - 0.03 * blink), w2 = fpx(s * 0.6, 0.165 - 0.05 * blink);
      g.fillStyle = "#140907"; g.beginPath(); g.moveTo(o[0], o[1] - 4); g.quadraticCurveTo(w1[0], w1[1] - 2, w2[0], w2[1]); g.quadraticCurveTo(w1[0], w1[1] + 5, o[0], o[1] + 4); g.closePath(); g.fill();
      g.strokeStyle = "rgba(20,9,7,.9)"; g.lineWidth = 1.6;
      const dirY = -1 + 1.75 * blink;
      for (let i = Math.floor(upPx.length * 0.35); i < upPx.length - 1; i += 2) {
        const t = i / upPx.length, [x, y] = upPx[i], len = 7 + 9 * t;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + s * len * 0.2, y + dirY * len * 0.8, x + s * len * 0.7, y + dirY * len); g.stroke();
      }
      if (blink < 0.96) {
        const lp = lowPx.slice(Math.floor(lowPx.length * 0.3));
        taper(lp, 1.4, 3.2, "rgba(30,14,11,.7)");
        taper(lp, 5, 8, "rgba(50,22,26,.1)"); taper(lp, 3, 5, "rgba(50,22,26,.12)"); // soft smudge without a canvas blur filter (blur is slow)
      }
    }

    // bindi
    { const [bx, by] = fpx(0, 0.33); g.fillStyle = "#a3122b"; g.beginPath(); g.arc(bx, by, 7.5, 0, 7); g.fill(); g.fillStyle = "rgba(255,200,200,.6)"; g.beginPath(); g.arc(bx - 2, by - 2.5, 2, 0, 7); g.fill(); }

    // lips: a gentle closed smile that parts when she speaks
    const bell = (x) => Math.exp(-(x * x) / 0.012);
    const up = (x) => smile * 0.05 * Math.abs(x / 0.165) ** 2.4; // corners rise as she smiles
    const wide = (x) => x * (1 + smile * 0.13);
    const seamU = LIP_SEAM.map(([x, y]) => [wide(x), y + up(x) + open * 0.018 * bell(x)]);
    const seamL = LIP_SEAM.map(([x, y]) => [wide(x), y + up(x) - open * 0.05 * bell(x)]);
    const bot = LIP_BOT.map(([x, y]) => [wide(x), y + up(x) * 0.8 - open * 0.045 * bell(x) * 1.4]);
    const sU = spline(seamU), sL = spline(seamL), top = spline(LIP_TOP.map(([x, y]) => [wide(x), y + up(x) * 0.7])), btm = spline(bot);
    if (open > 0.03) {
      g.fillStyle = "#33090f"; trace(sU.concat(sL.slice().reverse()), true); g.fill();
      g.save(); trace(sU.concat(sL.slice().reverse()), true); g.clip();
      const [tx, ty] = fpx(0, -0.552); g.fillStyle = "rgba(236,226,214,.9)"; g.beginPath(); g.ellipse(tx, ty + 2, 50, 7 + open * 4, 0, 0, 7); g.fill();
      g.restore();
    }
    const [lx0, ly0] = fpx(0, -0.49), [, ly1] = fpx(0, -0.62);
    const ug = g.createLinearGradient(0, ly0, 0, ly0 + (ly1 - ly0) * 0.5); ug.addColorStop(0, "#9a3346"); ug.addColorStop(1, "#7c2234");
    g.fillStyle = ug; trace(top.concat(sU.slice().reverse()), true); g.fill();
    const lg = g.createLinearGradient(0, ly0 + (ly1 - ly0) * 0.45, 0, ly1 + open * 18); lg.addColorStop(0, "#8e2c40"); lg.addColorStop(0.5, "#ad4357"); lg.addColorStop(1, "#8a2b3e");
    g.fillStyle = lg; trace(sL.concat(btm.slice().reverse()), true); g.fill();
    blob(0.035, -0.585 - open * 0.04, 24, 9, "255,200,205", 0.45);
    blob(-0.04, -0.512, 14, 5, "255,200,205", 0.25);
    g.strokeStyle = "rgba(60,12,22,.85)"; g.lineWidth = open > 0.03 ? 1.5 : 2.6; trace(sU); g.stroke();
    for (const s of [-1, 1]) {
      g.strokeStyle = `rgba(110,50,45,${0.25 + smile * 0.25})`; g.lineWidth = 2;
      const cx = wide(0.165), cy = -0.545 + smile * 0.05;
      trace(spline([[s * (cx - 0.003), cy - 0.003], [s * (cx + 0.015), cy + 0.008 + smile * 0.006], [s * (cx + 0.025), cy + 0.023 + smile * 0.01]], 5)); g.stroke();
    }
    faceLayerTex.needsUpdate = true;
  }

  const hairT = canvasTex(1024, 512, (g, w, h) => {
    const r = seeded(9);
    g.fillStyle = "#140a08"; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 2600; k++) {
      const x = r() * w, wv = r() * 6, light = r() < 0.5;
      g.strokeStyle = light ? `rgba(70,42,30,${0.25 + r() * 0.3})` : `rgba(6,3,2,${0.4 + r() * 0.4})`; g.lineWidth = 1 + r() * 1.5;
      g.beginPath(); g.moveTo(x, 0); for (let y = 16; y <= h; y += 16) g.lineTo(x + Math.sin(y * 0.02 + k) * wv, y); g.stroke();
    }
    const px = w * 0.25, gr = g.createLinearGradient(px - 6, 0, px + 6, 0); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.5, "rgba(150,90,65,.7)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(px - 6, 0, 12, h * 0.3);
  });
  const hairAlpha = canvasTex(1024, 512, (g, w, h) => {
    const r = seeded(13); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 2) { const end = h * (0.5 + r() * 0.04); const gr = g.createLinearGradient(0, end - 30, 0, end); gr.addColorStop(0, "#fff"); gr.addColorStop(1, "#000"); g.fillStyle = gr; g.fillRect(x, end - 30, 2, 30); g.fillStyle = "#000"; g.fillRect(x, end, 2, h - end); }
  });
  hairAlpha.colorSpace = THREE.NoColorSpace;
  M.hair = new THREE.MeshPhysicalMaterial({ map: hairT, alphaMap: hairAlpha, alphaTest: 0.5, roughness: 0.42, sheen: 0.8, sheenColor: C(0x6b4a3a), sheenRoughness: 0.3, side: THREE.DoubleSide });
  M.strand = new THREE.MeshPhysicalMaterial({ color: C(0x170c09), roughness: 0.4, sheen: 0.9, sheenColor: C(0x7a5442), sheenRoughness: 0.3 });

  const robeT = texturePair(1024, 1024, (g, pass, w, h) => {
    const r = seeded(3), gold = goldFill(g, pass, 0, 0, w, 0);
    if (pass === "color") {
      g.fillStyle = "#5a1428"; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x++) { const v = 0.5 + 0.5 * Math.sin((x / w) * PI * 2 * 14 + Math.sin(x * 0.05)); g.fillStyle = `rgba(0,0,0,${v * 0.3})`; g.fillRect(x, 0, 1, h); }
    } else { g.fillStyle = "rgb(0,215,0)"; g.fillRect(0, 0, w, h); }
    const y0 = h * 0.3, y1 = h * 0.42, ym = (y0 + y1) / 2;
    g.fillStyle = gold; g.fillRect(0, y0, w, 6); g.fillRect(0, y1, w, 6); g.fillRect(0, h * 0.93, w, 8);
    g.strokeStyle = gold; g.lineWidth = 2;
    for (let x = 0; x < w; x += 40) {
      g.fillStyle = gold; g.beginPath(); g.arc(x + 20, ym, 7, 0, 7); g.fill();
      g.beginPath(); g.moveTo(x, ym); g.lineTo(x + 20, y0 + 12); g.lineTo(x + 40, ym); g.lineTo(x + 20, y1 - 6); g.closePath(); g.stroke();
    }
    for (let k = 0; k < 450; k++) { g.fillStyle = gold; g.beginPath(); g.arc(r() * w, h * 0.46 + r() * h * 0.45, 1.6, 0, 7); g.fill(); }
  });
  M.robe = new THREE.MeshPhysicalMaterial({ map: robeT.map, roughnessMap: robeT.orm, metalnessMap: robeT.orm, roughness: 1, metalness: 1, sheen: 0.8, sheenColor: C(0xb03a5c), sheenRoughness: 0.35, side: THREE.DoubleSide });

  const PROFILE = [[0, 0.5], [0.33, 0.5], [0.34, 0.9], [0.31, 1.2], [0.3, 1.38], [0.26, 1.5], [0.17, 1.58], [0.075, 1.64], [0, 1.65]];
  const torsoR = (y) => { for (let i = 1; i < PROFILE.length; i++) { const [r0, y0] = PROFILE[i - 1], [r1, y1] = PROFILE[i]; if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0 || 1); } return 0; };
  const onChest = (x, y, lift = 0.008) => V(x, y, -0.98 + 0.62 * Math.sqrt(Math.max(0, torsoR(y) ** 2 - x * x)) + lift);

  function makeHand(s) {
    const hand = new THREE.Group();
    mesh(new THREE.SphereGeometry(1, 24, 16), M.skinPlain, hand, V(0, 0, 0.004), V(0.034, 0.012, 0.042));
    const finger = (x, len, curl) => {
      let parent = new THREE.Group(), first = null; parent.position.set(x, -0.002, 0.036); hand.add(parent);
      len.forEach((L, j) => {
        const seg = new THREE.Group(); seg.rotation.x = curl; parent.add(seg); first ||= seg;
        const rad = 0.0058 - j * 0.0008;
        mesh(new THREE.CapsuleGeometry(rad, L, 4, 10), M.skinPlain, seg, V(0, 0, L / 2), null, new THREE.Euler(PI / 2, 0, 0));
        const next = new THREE.Group(); next.position.z = L; seg.add(next); parent = next;
      });
      return first;
    };
    [[-0.019, 0.9], [-0.0065, 1], [0.0065, 0.97], [0.019, 0.8]].forEach(([fx, k], i) => {
      const base = finger(s * fx, [0.021 * k, 0.015 * k, 0.012 * k], 0.22 + i * 0.03);
      if (i === 2) mesh(new THREE.TorusGeometry(0.0062, 0.0013, 6, 16), M.gold, base, V(0, 0, 0.008));
    });
    const th = new THREE.Group(); th.position.set(s * 0.03, -0.004, 0.008); th.rotation.set(0.25, s * 0.75, 0); hand.add(th);
    mesh(new THREE.CapsuleGeometry(0.0064, 0.02, 4, 10), M.skinPlain, th, V(0, 0, 0.012), null, new THREE.Euler(PI / 2, 0, 0));
    const parts = []; hand.traverse((o) => o.isMesh && parts.push(o)); bakeInto(hand, parts);
    return hand;
  }

  (function buildMira() {
    const root = new THREE.Group(); scene.add(root);
    const lathe = (pts, seg, ps, pl) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg, ps, pl);
    mira.torso = mesh(lathe(PROFILE, 64), M.robe, root, V(0, 0, -0.98), V(1, 1, 0.62));
    mesh(new THREE.SphereGeometry(0.1, 32, 20), M.skinPlain, root, V(0, 1.57, -0.925), V(1, 0.6, 0.4));
    mesh(lathe([[0.17, 1.74], [0.28, 1.62], [0.38, 1.42], [0.42, 1.1], [0.46, 0.6]], 64, 0.6, PI * 2 - 1.2), M.cloak, root, V(0, 0, -0.99), V(1, 1, 0.78));
    mesh(new THREE.CylinderGeometry(0.041, 0.055, 0.2, 32), M.skinPlain, root, V(0, 1.7, -0.96));
    // necklace: gold beads, a pearl strand and a ruby pendant
    batched(root, () => {
    for (let i = 0; i <= 26; i++) { const a = -1 + (2 * i) / 26, y = 1.585 - 0.07 * Math.cos(a * PI / 2); mesh(new THREE.SphereGeometry(0.0055, 10, 8), M.gold, root, onChest(a * 0.105, y)); }
    for (let i = 0; i <= 30; i++) { const a = -1 + (2 * i) / 30, y = 1.575 - 0.115 * Math.cos(a * PI / 2); mesh(new THREE.SphereGeometry(0.0045, 10, 8), M.pearl, root, onChest(a * 0.13, y)); }
    const pend = onChest(0, 1.47, 0.012);
    mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 24), M.gold, root, pend, null, new THREE.Euler(PI / 2 - 0.25, 0, 0));
    mesh(new THREE.OctahedronGeometry(0.011), M.gem, root, pend.clone().add(V(0, 0, 0.004)), V(1, 1.3, 0.6));
    });

    const head = new THREE.Group(); head.position.set(0, 1.83, -0.95); root.add(head); mira.head = head;
    const hg = new THREE.SphereGeometry(1, 128, 96), hp = hg.attributes.position;
    for (let i = 0; i < hp.count; i++) { const s = sculpt(V(hp.getX(i), hp.getY(i), hp.getZ(i))); hp.setXYZ(i, s.x, s.y, s.z); }
    hg.computeVertexNormals();
    mesh(hg, M.skin, head);
    for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(1, 16, 12), M.skinPlain, head, V(s * 0.113, -0.012, -0.012), V(0.012, 0.026, 0.017));
    const fl = new THREE.SphereGeometry(1, 96, 96, PH0, PHL, TH0, THL), flp = fl.attributes.position;
    for (let i = 0; i < flp.count; i++) { const s = sculpt(V(flp.getX(i), flp.getY(i), flp.getZ(i))); flp.setXYZ(i, s.x, s.y, s.z); }
    fl.computeVertexNormals();
    const faceMesh = mesh(fl, M.faceLayer, head); faceMesh.castShadow = false;
    drawFace(0, 0, 0, 0);

    // hair: textured cap with a centre parting, and loose strands framing the face
    mesh(new THREE.SphereGeometry(1, 64, 40, 0, PI * 2, 0, PI * 0.62), M.hair, head, V(0, 0.006, -0.006), V(0.127, 0.168, 0.148), new THREE.Euler(-0.22, 0, 0));
    // Strands lie along the scalp from the parting, then fall past the jaw to the shoulders.
    const strands = [], hr = seeded(21);
    const onHead = (az, el, lift) => sculpt(V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))).multiplyScalar(lift);
    for (const s of [-1, 1]) for (let k = 0; k < 230; k++) {
      const q = hr(), az0 = s * (0.03 + hr() * 0.45), az1 = s * (1.0 + hr() * 1.0), lift = 1.045 + hr() * 0.02, front = Math.abs(az1) < 1.3;
      const pts = [[0.97, 0], [0.8, 0.45], [0.6, 0.8], [0.38, 1], [0.12, 1]].map(([el, f]) => onHead(az0 + (az1 - az0) * f, el, lift));
      const last = pts[pts.length - 1];
      pts.push(V(last.x * 1.04, -0.1 - q * 0.03, last.z * 0.9));
      pts.push(V(s * (0.108 + q * 0.04), -0.26 - q * 0.1, front ? 0.03 + q * 0.03 : -0.02 - q * 0.05));
      strands.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.0017 + hr() * 0.0012, 4, false));
    }
    mesh(mergeGeometries(strands), M.strand, head);
    // the long hair behind her head and shoulders, so the strands sit on a full, dark mass
    mesh(new THREE.SphereGeometry(1, 40, 28), M.strand, head, V(0, -0.075, -0.045), V(0.122, 0.21, 0.085));

    // jewellery: maang tikka, nose ring with chain, jhumka earrings
    batched(head, () => {
    const tik = fp(0, 0.62); tik.z += 0.003;
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0.16, 0.03), V(0, 0.13, 0.085), tik.clone().add(V(0, 0.012, 0))]), 20, 0.0009, 5), M.gold, head);
    mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.0015, 20), M.gold, head, tik, null, new THREE.Euler(PI / 2 - 0.2, 0, 0));
    mesh(new THREE.SphereGeometry(0.003, 12, 10), M.gem, head, tik.clone().add(V(0, 0, 0.0015)));
    mesh(new THREE.SphereGeometry(0.0028, 10, 8), M.pearl, head, tik.clone().add(V(0, -0.011, 0)));
    const nose = fp(-0.085, -0.27); nose.add(V(-0.002, -0.002, 0.001));
    mesh(new THREE.TorusGeometry(0.0068, 0.0009, 8, 28), M.gold, head, nose.clone().add(V(0, -0.005, 0)), null, new THREE.Euler(0, PI / 2 - 0.3, 0));
    mesh(new THREE.SphereGeometry(0.002, 8, 6), M.pearl, head, nose.clone().add(V(0, -0.0118, 0)));
    mira.ears = [];
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * 0.118, -0.04, -0.008); head.add(g); mira.ears.push(g); g.userData.keep = true;
      batched(g, () => {
      mesh(new THREE.SphereGeometry(0.004, 10, 8), M.gold, g);
      mesh(new THREE.CylinderGeometry(0.0008, 0.0008, 0.014, 4), M.gold, g, V(0, -0.009, 0));
      const bell = lathe([[0.001, 0], [0.006, -0.004], [0.011, -0.012], [0.015, -0.024], [0.016, -0.026]], 24);
      mesh(bell, M.gold, g, V(0, -0.014, 0));
      for (let k = 0; k < 8; k++) { const a = (k / 8) * PI * 2; mesh(new THREE.SphereGeometry(0.0022, 8, 6), M.pearl, g, V(Math.cos(a) * 0.015, -0.044, Math.sin(a) * 0.015)); }
      });
    }

    // hood with a gold-embroidered edge
    const a = 0.85, ps = PI / 2 + a, pl = PI * 2 - 2 * a, T = PI * 0.62, R = 0.235, hs = V(1, 1.12, 1.05), ho = V(0, 0.03, -0.03);
    mesh(new THREE.SphereGeometry(R, 64, 40, ps, pl, 0, T), M.velvet, head, ho, hs);
    const edge = (phi, th) => V(-R * Math.cos(phi) * Math.sin(th) * hs.x + ho.x, R * Math.cos(th) * hs.y + ho.y, R * Math.sin(phi) * Math.sin(th) * hs.z + ho.z);
    const pts = []; for (let i = 20; i >= 0; i--) pts.push(edge(ps, (T * i) / 20)); for (let i = 1; i <= 20; i++) pts.push(edge(ps + pl, (T * i) / 20));
    const hoodCurve = new THREE.CatmullRomCurve3(pts);
    mesh(new THREE.TubeGeometry(hoodCurve, 120, 0.006, 8, false), M.gold, head);
    for (let i = 1; i < 40; i++) mesh(new THREE.SphereGeometry(0.0035, 8, 6), i % 4 ? M.gold : M.gem, head, hoodCurve.getPoint(i / 40).multiplyScalar(0.985));
    });

    // arms: sleeves with flared, gold-trimmed cuffs, hands with fingers, stacked bangles
    mira.arms = [-1, 1].map((s) => {
      const S = V(s * 0.28, 1.46, -0.92);
      mesh(new THREE.SphereGeometry(0.075, 24, 16), M.robe, root, S);
      const tube = mesh(new THREE.BufferGeometry(), M.robe, root);
      const flare = mesh(new THREE.CylinderGeometry(0.05, 0.068, 0.06, 28, 1, true), M.velvet, root);
      const trim = mesh(new THREE.TorusGeometry(0.067, 0.004, 8, 32), M.gold, root);
      const hand = makeHand(s); root.add(hand);
      const bangles = [0, 1, 2].map(() => mesh(new THREE.TorusGeometry(0.031, 0.0028, 8, 28), M.gold, root));
      const rest = V(s * 0.19, 1.06, -0.43);
      return { s, S, tube, flare, trim, hand, bangles, cur: rest.clone(), target: rest.clone(), rest };
    });
  })();
  const Z = V(0, 0, 1), Y = V(0, 1, 0);
  function updateArm(arm) {
    const H = arm.cur, S = arm.S;
    const E = S.clone().lerp(H, 0.5).add(V(arm.s * 0.14, -0.11, -0.03));
    const dir = H.clone().sub(E).normalize(), wrist = H.clone().addScaledVector(dir, -0.055);
    arm.tube.geometry.dispose();
    arm.tube.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([S, E, wrist]), 18, 0.05, 12, false);
    arm.flare.position.copy(wrist).addScaledVector(dir, 0.02); arm.flare.quaternion.setFromUnitVectors(Y, dir);
    arm.trim.position.copy(wrist).addScaledVector(dir, 0.05); arm.trim.quaternion.setFromUnitVectors(Z, dir);
    arm.hand.position.copy(H).addScaledVector(dir, 0.012); arm.hand.quaternion.setFromUnitVectors(Z, dir);
    arm.bangles.forEach((b, i) => { b.position.copy(H).addScaledVector(dir, -0.012 - i * 0.006); b.quaternion.setFromUnitVectors(Z, dir); });
  }

  /* ---------- room ---------- */
  const candles = [], smoke = []; let orb, revealGlow, dust, sparks, smokeTip, gust = 0, breath = 0;
  (function buildRoom() {
    // Soft dark patches where objects touch the cloth, so nothing looks like it floats.
    const shadowTex = glowTex([[0, "rgba(0,0,0,.8)"], [0.55, "rgba(0,0,0,.3)"], [1, "rgba(0,0,0,0)"]]);
    const contact = (x, z, w, d, rz = 0, op = 0.8) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: op, polygonOffset: true, polygonOffsetFactor: -2 })); m.rotation.set(-PI / 2, 0, rz); m.position.set(x, 0.9515, z); scene.add(m); return m; };
    contact(0, -0.42, 0.42, 0.42, 0, 0.85); contact(-0.42, -0.66, 0.14, 0.14, 0, 0.6); contact(0.62, -0.3, 0.38, 0.54, -0.32, 0.7); contact(0, -0.74, 0.95, 0.38, 0, 0.9);
    const cloth = canvasTex(1024, 1024, (g, w) => {
      const r = g.createRadialGradient(512, 512, 40, 512, 512, 520); r.addColorStop(0, "#4f1527"); r.addColorStop(1, "#1d0910"); g.fillStyle = r; g.fillRect(0, 0, w, w);
      for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(255,220,200,${Math.random() * 0.025})`; g.fillRect(Math.random() * w, Math.random() * w, 2, 2); }
      g.strokeStyle = "rgba(207,164,92,.7)"; g.lineWidth = 3;
      [470, 440, 300, 288].forEach((rr) => { g.beginPath(); g.arc(512, 512, rr, 0, PI * 2); g.stroke(); });
      g.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const a = (i * PI) / 6; g.beginPath(); g.moveTo(512 + Math.cos(a) * 300, 512 + Math.sin(a) * 300); g.lineTo(512 + Math.cos(a) * 440, 512 + Math.sin(a) * 440); g.stroke();
        const b = a + PI / 12, x = 512 + Math.cos(b) * 370, y = 512 + Math.sin(b) * 370; g.fillStyle = "rgba(207,164,92,.75)"; g.beginPath();
        for (let k = 0; k < 8; k++) { const aa = (k * PI) / 4, rr = k % 2 ? 5 : 16; g.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr); } g.fill();
      }
      for (let i = 0; i < 72; i++) { const a = (i * PI) / 36; g.beginPath(); g.moveTo(512 + Math.cos(a) * 440, 512 + Math.sin(a) * 440); g.lineTo(512 + Math.cos(a) * (i % 2 ? 452 : 462), 512 + Math.sin(a) * (i % 2 ? 452 : 462)); g.stroke(); }
    });
    cloth.anisotropy = 8;
    const top = new THREE.Mesh(new THREE.CircleGeometry(1.25, 96), new THREE.MeshPhysicalMaterial({ map: cloth, roughness: 0.95, sheen: 0.8, sheenColor: C(0x8a2a44), sheenRoughness: 0.5 }));
    top.rotation.x = -PI / 2; top.position.set(0, 0.95, -0.2); top.receiveShadow = true; scene.add(top);
    const drape = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.38, 0.95, 96, 1, true), new THREE.MeshStandardMaterial({ color: C(0x3a0f1d), roughness: 1 }));
    drape.position.set(0, 0.475, -0.2); drape.receiveShadow = true; scene.add(drape);
    const fringe = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.012, 6, 120), M.gold); fringe.rotation.x = PI / 2; fringe.position.set(0, 0.945, -0.2); scene.add(fringe);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 48), new THREE.MeshStandardMaterial({ color: C(0x120709), roughness: 1 }));
    floor.rotation.x = -PI / 2; floor.receiveShadow = true; scene.add(floor);
    const curtain = canvasTex(512, 64, (g, w, h) => { for (let x = 0; x < w; x++) { const v = 0.5 + 0.5 * Math.sin((x / w) * PI * 2 * 3) * 0.8 + 0.2 * Math.sin((x / w) * PI * 2 * 7); const l = Math.round(14 + v * 36); g.fillStyle = `rgb(${l + 18},${Math.round(l * 0.28)},${Math.round(l * 0.42)})`; g.fillRect(x, 0, 1, h); } });
    curtain.wrapS = THREE.RepeatWrapping; curtain.repeat.set(10, 1);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 7, 96, 1, true), new THREE.MeshStandardMaterial({ map: curtain, roughness: 1, side: THREE.BackSide }));
    wall.position.set(0, 3.2, -0.4); scene.add(wall);
    // crystal ball
    const og = new THREE.Group(); og.position.set(0, 0.95, -0.42); scene.add(og);
    mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.05, 32), M.gold, og, V(0, 0.025, 0));
    mesh(new THREE.TorusGeometry(0.085, 0.012, 10, 40), M.gold, og, V(0, 0.06, 0), null, new THREE.Euler(PI / 2, 0, 0));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 48, 32), new THREE.MeshPhysicalMaterial({ color: C(0xe7dcff), transparent: true, opacity: 0.32, roughness: 0.03, clearcoat: 1, emissive: C(0x3d2560), emissiveIntensity: 0.8 }));
    ball.position.y = 0.17; og.add(ball);
    const inner = []; const tA = glowTex([[0, "rgba(255,240,210,1)"], [0.4, "rgba(220,170,255,.5)"], [1, "rgba(120,60,180,0)"]]);
    for (let i = 0; i < 5; i++) { const sp = new THREE.Sprite(additive(tA, { opacity: 0.7 })); sp.scale.setScalar(0.08 + Math.random() * 0.06); og.add(sp); inner.push({ sp, ph: Math.random() * 6, sp2: 0.5 + Math.random() }); }
    const halo = new THREE.Sprite(additive(glowTex([[0, "rgba(200,160,255,.55)"], [1, "rgba(200,160,255,0)"]])));
    halo.scale.setScalar(0.7); halo.position.y = 0.17; og.add(halo);
    const ol = new THREE.PointLight(C(0xbfa2ff), 0.6, 2.6, 2); ol.position.y = 0.2; og.add(ol);
    orb = { inner, halo, light: ol, energy: 0 };
    // candles
    const flameT = canvasTex(64, 128, (g) => { const r = g.createRadialGradient(32, 80, 2, 32, 72, 48); r.addColorStop(0, "rgba(255,255,235,1)"); r.addColorStop(0.25, "rgba(255,210,120,.95)"); r.addColorStop(0.6, "rgba(255,120,40,.35)"); r.addColorStop(1, "rgba(255,80,20,0)"); g.fillStyle = r; g.beginPath(); g.ellipse(32, 72, 22, 54, 0, 0, PI * 2); g.fill(); });
    const glowT = glowTex([[0, "rgba(255,190,110,.6)"], [0.3, "rgba(255,150,70,.18)"], [1, "rgba(255,120,40,0)"]]);
    [[-0.92, 0.15, 0.2], [-0.68, -0.78, 0.32], [0.95, 0.0, 0.26], [0.72, -0.88, 0.36], [-1.0, -0.35, 0.14]].forEach(([x, z, h], i) => {
      const g = new THREE.Group(); g.position.set(x, 0.95, z); scene.add(g);
      mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 24), M.gold, g, V(0, 0.01, 0));
      batched(g, () => {
      mesh(new THREE.LatheGeometry([[0, 0], [0.036, 0], [0.035, h * 0.4], [0.033, h * 0.85], [0.034, h - 0.004], [0.029, h], [0.012, h - 0.006], [0, h - 0.006]].map(([a, b]) => new THREE.Vector2(a, b)), 32), M.wax, g, V(0, 0.02, 0));
      for (let k = 0; k < 3; k++) { const a = Math.random() * PI * 2, L = 0.02 + Math.random() * h * 0.4; mesh(new THREE.CapsuleGeometry(0.005, L, 4, 8), M.wax, g, V(Math.cos(a) * 0.034, 0.02 + h - L / 2 - 0.006, Math.sin(a) * 0.034)); }
      });
      contact(x, z, 0.24, 0.24, 0, 0.7);
      const fl = new THREE.Sprite(additive(flameT)); fl.position.y = 0.02 + h + 0.035; fl.scale.set(0.04, 0.08, 1); g.add(fl);
      const gl = new THREE.Sprite(additive(glowT, { opacity: 0.9 })); gl.position.y = fl.position.y; gl.scale.setScalar(0.6); g.add(gl);
      let light = null; if (i < 3) { light = new THREE.PointLight(C(0xffa055), 1.0, 4, 2); light.position.y = fl.position.y + 0.12; g.add(light); }
      candles.push({ fl, gl, light, ph: Math.random() * 10, base: light ? light.intensity : 0 });
    });
    const lantT = glowTex([[0, "rgba(255,200,130,.9)"], [0.2, "rgba(255,160,80,.3)"], [1, "rgba(255,120,40,0)"]]);
    [[-2.4, 2.9, -2.8], [2.5, 2.6, -2.5], [-0.4, 3.4, -3.6]].forEach(([x, y, z]) => { const s = new THREE.Sprite(additive(lantT)); s.position.set(x, y, z); s.scale.setScalar(0.9); scene.add(s); });
    revealGlow = new THREE.Sprite(additive(glowTex([[0, "rgba(255,230,170,.85)"], [0.35, "rgba(230,170,90,.3)"], [1, "rgba(200,120,60,0)"]]), { opacity: 0 }));
    revealGlow.scale.setScalar(1.6); scene.add(revealGlow);
    const n = 420, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 6; pos[i * 3 + 1] = 0.9 + Math.random() * 2.6; pos[i * 3 + 2] = -2 + Math.random() * 4.5; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.012, map: glowTex([[0, "rgba(255,230,180,1)"], [1, "rgba(255,230,180,0)"]]), color: 0xffe2b0, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(dust);
    // moonlit window
    const win = new THREE.Group(); win.position.set(1.95, 2.7, -4.45); win.lookAt(0, 1.7, 3); scene.add(win);
    const arch = new THREE.Shape(); arch.moveTo(-0.55, -0.85); arch.lineTo(0.55, -0.85); arch.lineTo(0.55, 0.3); arch.absarc(0, 0.3, 0.55, 0, PI, false); arch.lineTo(-0.55, -0.85);
    const sky = canvasTex(256, 400, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#0a1430"); gr.addColorStop(1, "#28324f"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.8})`; const s = Math.random() < 0.1 ? 2 : 1; g.fillRect(Math.random() * w, Math.random() * h * 0.8, s, s); }
      g.fillStyle = "rgba(8,10,22,.95)"; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 16) g.lineTo(x, h - 40 - Math.sin(x * 0.03) * 18 - Math.random() * 10); g.lineTo(w, h); g.fill();
    });
    const ag = new THREE.ShapeGeometry(arch, 32), uv = ag.attributes.uv, pa = ag.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pa.getX(i) + 0.55) / 1.1, (pa.getY(i) + 0.85) / 1.7);
    win.add(new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ map: sky, fog: false })));
    const moon = new THREE.Mesh(new THREE.CircleGeometry(0.09, 32), new THREE.MeshBasicMaterial({ color: 0xf4f0e0, fog: false })); moon.position.set(0.2, 0.42, 0.01); win.add(moon);
    const mg = new THREE.Sprite(additive(glowTex([[0, "rgba(220,230,255,.7)"], [1, "rgba(160,180,255,0)"]]), { fog: false })); mg.position.set(0.2, 0.42, 0.02); mg.scale.setScalar(0.75); win.add(mg);
    const frameM = new THREE.MeshBasicMaterial({ color: 0x1b0e0a, fog: false });
    const outline = [V(0.55, -0.85, 0)]; for (let i = 0; i <= 24; i++) { const a = (PI * i) / 24; outline.push(V(Math.cos(a) * 0.55, 0.3 + Math.sin(a) * 0.55, 0)); }
    outline.push(V(-0.55, -0.85, 0), V(0.55, -0.85, 0));
    const cp = new THREE.CurvePath(); for (let i = 0; i < outline.length - 1; i++) cp.add(new THREE.LineCurve3(outline[i], outline[i + 1]));
    win.add(new THREE.Mesh(new THREE.TubeGeometry(cp, 160, 0.035, 6, false), frameM));
    const mu1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.7, 0.03), frameM); mu1.position.z = 0.01; win.add(mu1);
    const mu2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 0.03), frameM); mu2.position.set(0, 0.1, 0.01); win.add(mu2);
    const ml = new THREE.DirectionalLight(C(0x8aa2e0), 1.2); ml.position.set(1.9, 2.8, -4.2); ml.target.position.set(0, 1.6, -0.9); scene.add(ml); scene.add(ml.target);
    // incense
    const inc = new THREE.Group(); inc.position.set(-0.42, 0.95, -0.66); scene.add(inc);
    mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.015, 20), M.gold, inc, V(0, 0.008, 0));
    mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.24, 6), new THREE.MeshStandardMaterial({ color: C(0x5a2e1a) }), inc, V(0.03, 0.125, 0), null, new THREE.Euler(0, 0, -0.25));
    smokeTip = V(-0.36, 1.19, -0.66);
    const ember = new THREE.Sprite(additive(glowTex([[0, "rgba(255,160,80,1)"], [1, "rgba(255,80,20,0)"]]))); ember.position.copy(smokeTip); ember.scale.setScalar(0.03); scene.add(ember);
    const smT = glowTex([[0, "rgba(225,215,225,.55)"], [0.5, "rgba(200,190,200,.18)"], [1, "rgba(200,190,200,0)"]]);
    for (let i = 0; i < 24; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smT, transparent: true, depthWrite: false, opacity: 0 })); scene.add(sp); smoke.push({ sp, age: i * (4.5 / 24), life: 4.5, seed: Math.random() * 10 }); }
    // sparks
    const sn = 180, sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(sn * 3), 3));
    sparks = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.025, map: glowTex([[0, "rgba(255,240,200,1)"], [0.4, "rgba(255,190,90,.6)"], [1, "rgba(255,150,50,0)"]]), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    sparks.userData = { vel: Array.from({ length: sn }, () => V(0, 0, 0)), life: 0 }; sparks.frustumCulled = false; scene.add(sparks);
    // lights
    scene.add(new THREE.HemisphereLight(C(0x4a2a3a), C(0x070304), 1.4));
    const spot = new THREE.SpotLight(C(0xffd9a8), 70, 12, 0.5, 0.75, 2);
    spot.position.set(0.5, 4.4, 1.8); spot.target.position.set(0, 1, -0.3); scene.add(spot); scene.add(spot.target);
    spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0004; spot.shadow.camera.near = 1; spot.shadow.camera.far = 8;
    const rim = new THREE.PointLight(C(0xd0506e), 5, 4, 2); rim.position.set(0, 2.4, -2.1); scene.add(rim);
    const face = new THREE.PointLight(C(0xffc89a), 1.5, 3, 2); face.position.set(0.55, 2.05, 0.15); scene.add(face);
    const fill = new THREE.PointLight(C(0x9a7cff), 0.35, 3, 2); fill.position.set(-0.6, 1.8, 0.2); scene.add(fill);
  })();
  function burst(p) {
    const a = sparks.geometry.attributes.position;
    sparks.userData.vel.forEach((v, i) => { a.setXYZ(i, p.x + (Math.random() - 0.5) * 0.3, p.y + (Math.random() - 0.5) * 0.5, p.z); const th = Math.random() * PI * 2, sp = 0.3 + Math.random() * 0.9; v.set(Math.cos(th) * sp, Math.sin(th) * sp * 0.8 + 0.3, (Math.random() - 0.2) * 0.5); });
    a.needsUpdate = true; sparks.userData.life = 2.2;
  }

  /* ---------- cards ---------- */
  const CW = 0.26, CH = 0.44, CT = 0.004, deckMeshes = [], dealt = [];
  const slots = [{ p: V(-0.42, 0.958, 0.32), ry: 0.16 }, { p: V(0, 0.958, 0.4), ry: 0 }, { p: V(0.42, 0.958, 0.32), ry: -0.16 }];
  let hovered = -1, holdIdx = -1, holdT = 0, deckTop;
  const TW = 512, TH = 868;

  // Each card side is drawn three times: colour, gloss (gold foil is metal, paper is matte), and relief.
  function cardMaterial(draw, emblems = []) {
    const mk = () => { const c = document.createElement("canvas"); c.width = TW; c.height = TH; return c; };
    const canv = { color: mk(), orm: mk(), bump: mk() };
    for (const pass of ["color", "orm", "bump"]) draw(canv[pass].getContext("2d"), pass);
    const map = new THREE.CanvasTexture(canv.color); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    const orm = new THREE.CanvasTexture(canv.orm), bump = new THREE.CanvasTexture(canv.bump);
    const tex = { color: map, orm, bump };
    const ink = { color: "#ecc77a", orm: "rgb(0,70,255)", bump: "#ffffff" };
    for (const e of emblems) for (const pass of ["color", "orm", "bump"]) {
      svgImg(emblemSVG(e.t, e.ink?.[pass] || ink[pass]), (img) => { canv[pass].getContext("2d").drawImage(img, e.x, e.y, e.s, e.s); tex[pass].needsUpdate = true; });
    }
    return new THREE.MeshPhysicalMaterial({
      map, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1, bumpMap: bump, bumpScale: 1.2,
      clearcoat: 0.2, clearcoatRoughness: 0.5, emissive: C(0xffffff), emissiveMap: map, emissiveIntensity: 0,
    });
  }
  // Pass-aware paint: gold foil, plain ink, or paper.
  const P = (g, pass) => ({
    gold: () => goldFill(g, pass, 0, 0, TW, TH),
    ink: (c) => (pass === "color" ? c : pass === "orm" ? "rgb(0,200,0)" : "#262626"),
    paper: (c) => (pass === "color" ? c : pass === "orm" ? "rgb(0,205,0)" : "#000000"),
  });
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function grain(g, pass, seed, alpha) {
    const r = seeded(seed);
    for (let i = 0; i < 9000; i++) {
      const v = r();
      g.fillStyle = pass === "color" ? `rgba(${v < 0.5 ? "90,60,30" : "255,250,235"},${alpha * r()})` : pass === "orm" ? `rgba(0,${180 + Math.floor(r() * 60)},0,0.25)` : `rgba(255,255,255,${0.05 * r()})`;
      g.fillRect(r() * TW, r() * TH, 1 + r() * 2, 1 + r() * 2);
    }
  }
  function faceMaterial(c, reversed) {
    const hue = (c.index * 47) % 360;
    const mat = cardMaterial((g, pass) => {
      const p = P(g, pass);
      g.fillStyle = p.paper("#efe2c4"); g.fillRect(0, 0, TW, TH);
      if (pass === "color") { const v = g.createRadialGradient(TW / 2, TH / 2, 200, TW / 2, TH / 2, 560); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(110,70,30,.35)"); g.fillStyle = v; g.fillRect(0, 0, TW, TH); }
      // arched picture window with a painted sky
      g.save(); g.beginPath(); g.moveTo(66, 690); g.lineTo(66, 300); g.arc(TW / 2, 300, TW / 2 - 66, PI, 0); g.lineTo(TW - 66, 690); g.closePath(); g.clip();
      if (pass === "color") {
        const sky = g.createLinearGradient(0, 110, 0, 690); sky.addColorStop(0, `hsl(${hue},38%,16%)`); sky.addColorStop(0.65, `hsl(${(hue + 25) % 360},42%,34%)`); sky.addColorStop(1, `hsl(${(hue + 40) % 360},48%,52%)`);
        g.fillStyle = sky; g.fillRect(0, 0, TW, TH);
        const r = seeded(c.index + 1); for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,245,220,${0.3 + r() * 0.6})`; g.beginPath(); g.arc(70 + r() * (TW - 140), 120 + r() * 330, r() * 1.8 + 0.4, 0, 7); g.fill(); }
        g.save(); g.translate(TW / 2, 430); g.strokeStyle = "rgba(255,225,160,.18)"; g.lineWidth = 2; for (let i = 0; i < 36; i++) { g.rotate(PI / 18); g.beginPath(); g.moveTo(0, 150); g.lineTo(0, 320); g.stroke(); } g.restore();
        g.fillStyle = `hsl(${(hue + 30) % 360},35%,14%)`; g.beginPath(); g.moveTo(0, 690); for (let x = 0; x <= TW; x += 24) g.lineTo(x, 640 - Math.sin(x * 0.018 + c.index) * 22 - Math.sin(x * 0.05) * 8); g.lineTo(TW, 690); g.fill();
      } else { g.fillStyle = p.ink("#000"); g.fillRect(0, 0, TW, TH); }
      g.restore();
      // gold foil frame
      g.strokeStyle = p.gold(); g.lineWidth = 9; roundRect(g, 20, 20, TW - 40, TH - 40, 18); g.stroke();
      g.lineWidth = 2.5; roundRect(g, 36, 36, TW - 72, TH - 72, 12); g.stroke();
      g.lineWidth = 4; g.beginPath(); g.moveTo(66, 690); g.lineTo(66, 300); g.arc(TW / 2, 300, TW / 2 - 66, PI, 0); g.lineTo(TW - 66, 690); g.closePath(); g.stroke();
      g.fillStyle = p.gold(); for (const [x, y] of [[36, 36], [TW - 36, 36], [36, TH - 36], [TW - 36, TH - 36]]) { g.save(); g.translate(x, y); g.rotate(PI / 4); g.fillRect(-9, -9, 18, 18); g.restore(); }
      // numeral and name plates
      g.fillStyle = p.ink("#3a1220"); roundRect(g, TW / 2 - 70, 62, 140, 62, 10); g.fill();
      g.strokeStyle = p.gold(); g.lineWidth = 2; roundRect(g, TW / 2 - 70, 62, 140, 62, 10); g.stroke();
      g.fillStyle = p.gold(); g.textAlign = "center"; g.textBaseline = "middle";
      g.font = '52px "Marcellus SC", Georgia, serif'; g.fillText(c.num, TW / 2, 96);
      g.fillStyle = p.ink("#3a1220"); roundRect(g, 60, 712, TW - 120, 78, 10); g.fill();
      g.strokeStyle = p.gold(); roundRect(g, 60, 712, TW - 120, 78, 10); g.stroke();
      let fs = 44; const nm = c.name.toUpperCase(); do { g.font = `${fs}px "Marcellus SC", Georgia, serif`; fs -= 2; } while (g.measureText(nm).width > TW - 150 && fs > 20);
      g.fillStyle = p.gold(); g.fillText(nm, TW / 2, 752);
      g.font = 'italic 24px "EB Garamond", Georgia, serif'; g.fillStyle = p.ink("#5a2030"); g.fillText(c.kw, TW / 2, 820);
      grain(g, pass, 100 + c.index, 0.08);
    }, [{ t: c.emb, x: TW / 2 - 150, y: 280, s: 300 }]);
    if (reversed) for (const t of [mat.map, mat.roughnessMap, mat.bumpMap]) { t.center.set(0.5, 0.5); t.rotation = PI; }
    return mat;
  }
  const backMat = cardMaterial((g, pass) => {
    const p = P(g, pass);
    g.fillStyle = p.paper("#4a1022"); g.fillRect(0, 0, TW, TH);
    if (pass === "color") { const r = g.createRadialGradient(TW / 2, TH / 2, 40, TW / 2, TH / 2, 520); r.addColorStop(0, "rgba(160,50,80,.45)"); r.addColorStop(1, "rgba(0,0,0,.45)"); g.fillStyle = r; g.fillRect(0, 0, TW, TH); }
    g.save(); roundRect(g, 46, 46, TW - 92, TH - 92, 10); g.clip();
    g.strokeStyle = p.gold(); g.lineWidth = 1.6;
    for (let i = -TH; i < TW + TH; i += 38) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + TH, TH); g.stroke(); g.beginPath(); g.moveTo(i, TH); g.lineTo(i + TH, 0); g.stroke(); }
    g.fillStyle = p.gold(); for (let x = 0; x < TW + 40; x += 38) for (let y = 0; y < TH + 40; y += 38) { if ((x / 38 + y / 38) % 2) continue; g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); }
    g.restore();
    g.fillStyle = p.paper("#3a0c1a"); g.beginPath(); g.arc(TW / 2, TH / 2, 150, 0, 7); g.fill();
    g.strokeStyle = p.gold(); g.lineWidth = 9; roundRect(g, 20, 20, TW - 40, TH - 40, 18); g.stroke();
    g.lineWidth = 3; roundRect(g, 46, 46, TW - 92, TH - 92, 10); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.arc(TW / 2, TH / 2, 150, 0, 7); g.stroke(); g.lineWidth = 1.5; g.beginPath(); g.arc(TW / 2, TH / 2, 138, 0, 7); g.stroke();
    grain(g, pass, 7, 0.06);
  }, [{ t: "back", x: TW / 2 - 130, y: TH / 2 - 130, s: 260 }, { t: "moon", x: TW / 2 - 40, y: 80, s: 80 }, { t: "sun", x: TW / 2 - 40, y: TH - 160, s: 80 }]);
  const blankFace = new THREE.MeshStandardMaterial({ color: C(0xe9dcbd), roughness: 0.8 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: C(0xd9ae62), metalness: 1, roughness: 0.32 });

  // Rounded card: two faces and a gilded edge.
  const cardShape = (() => { const s = new THREE.Shape(), w = CW / 2, h = CH / 2, r = 0.016;
    s.moveTo(-w + r, -h); s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r); s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h);
    s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r); s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h); return s; })();
  function faceGeo(mirror) { const g = new THREE.ShapeGeometry(cardShape, 6), p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) { const u = p.getX(i) / CW + 0.5; uv.setXY(i, mirror ? 1 - u : u, p.getY(i) / CH + 0.5); } return g; }
  const FRONT_GEO = faceGeo(false), BACK_GEO = faceGeo(true);
  const EDGE_GEO = new THREE.ExtrudeGeometry(cardShape, { depth: CT, bevelEnabled: false, curveSegments: 6 }); EDGE_GEO.translate(0, 0, -CT / 2);
  function makeCard(front) {
    const g = new THREE.Group(); g.rotation.order = "YXZ";
    const f = new THREE.Mesh(FRONT_GEO, front || blankFace); f.position.z = CT / 2 + 0.0003;
    const b = new THREE.Mesh(BACK_GEO, backMat); b.rotation.y = PI; b.position.z = -CT / 2 - 0.0003;
    const e = new THREE.Mesh(EDGE_GEO, edgeMat);
    for (const m of [f, b, e]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
    g.userData.front = f;
    return g;
  }
  (function buildCards() {
    const N = 14;
    for (let i = 0; i < N; i++) { const m = makeCard(); m.position.set(0.62 + (Math.random() - 0.5) * 0.006, 0.955 + i * CT * 1.05, -0.3 + (Math.random() - 0.5) * 0.006); m.rotation.set(PI / 2, 0.32 + (Math.random() - 0.5) * 0.04, 0); scene.add(m); deckMeshes.push(m); }
    deckTop = V(0.62, 0.955 + N * CT * 1.05 + 0.002, -0.3);
    for (let i = 0; i < 3; i++) { const m = makeCard(); m.visible = false; Object.assign(m.userData, { i, hover: 0 }); scene.add(m); dealt.push(m); }
  })();
  // Invisible, fixed hit areas for the three dealt cards and the two cut piles. Hover is tested
  // against these, not the cards, so a card lifting under the cursor can't flicker on and off.
  const hitMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  const cardHits = [0, 1, 2].map((i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(CW * 1.3, CH * 1.2), hitMat); m.rotation.order = "YXZ"; m.userData.i = i; scene.add(m); return m; });
  const pileHits = [0, 1].map((i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(CW * 1.3, CH * 1.2), hitMat); m.rotation.order = "YXZ"; m.userData.i = i; m.position.y = -10; scene.add(m); return m; });
  function placeHit(m, p, ry) { m.position.set(p.x, p.y + 0.03, p.z); m.rotation.set(-PI / 2, ry, 0); }
  function moveCard(c, pos, rot, dur, arc = 0, scale = null, delay = 0) {
    let p0, r0, s0, init = false;
    return anim(dur, (p) => {
      if (!init) { p0 = c.position.clone(); r0 = V(c.rotation.x, c.rotation.y, c.rotation.z); s0 = c.scale.x; init = true; }
      c.position.lerpVectors(p0, pos, p); c.position.y += Math.sin(PI * p) * arc;
      c.rotation.x = r0.x + (rot.x - r0.x) * p; c.rotation.y = r0.y + (rot.y - r0.y) * p; c.rotation.z = r0.z + (rot.z - r0.z) * p;
      if (scale != null) c.scale.setScalar(s0 + (scale - s0) * p);
    }, delay);
  }

  /* ---------- shuffles: three techniques, chosen at random each reading ---------- */
  const HOME = V(0.62, 0.955, -0.3), HOME_RY = 0.32, LAYER = CT * 1.05;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const homePos = (k) => V(HOME.x + rnd(-0.003, 0.003), HOME.y + k * LAYER, HOME.z + rnd(-0.003, 0.003));
  const flat = (ry, rz = 0) => V(PI / 2, ry, rz);
  let curSlots = slots, lastStyle = null, cutResolve = null, cutPiles = null;
  const pileHover = [0, 0];
  const restHands = () => mira.arms.forEach((a) => a.target.copy(a.rest));

  // Split into two halves, then let them fall together card by card.
  async function riffle() {
    const n = deckMeshes.length, half = Math.round(n / 2 + rnd(-2, 2));
    const L = deckMeshes.slice(0, half), R = deckMeshes.slice(half);
    const pL = V(0.44, HOME.y, -0.2), pR = V(0.8, HOME.y, -0.22);
    mira.arms[0].target.copy(pL.clone().add(V(0, 0.07, -0.12))); mira.arms[1].target.copy(pR.clone().add(V(0, 0.07, -0.12)));
    await Promise.all([
      ...L.map((c, k) => moveCard(c, V(pL.x, HOME.y + k * LAYER, pL.z), flat(HOME_RY + 0.35), 0.45, 0.05, null, k * 0.008)),
      ...R.map((c, k) => moveCard(c, V(pR.x, HOME.y + k * LAYER, pR.z), flat(HOME_RY - 0.3), 0.45, 0.05, null, k * 0.008)),
    ]);
    await wait(rnd(0.1, 0.3));
    mira.arms[0].target.copy(V(0.5, 1.1, -0.32)); mira.arms[1].target.copy(V(0.74, 1.1, -0.32));
    const pile = [];
    while (L.length || R.length) {
      const fromL = !R.length || (L.length && Math.random() < L.length / (L.length + R.length));
      const src = fromL ? L : R, take = Math.random() < 0.3 ? 2 : 1;
      for (let k = 0; k < take && src.length; k++) pile.push(src.pop());
    }
    await Promise.all(pile.map((c, k) => {
      if (k % 2 === 0) setTimeout(() => audio.flick(1, 0, 0.16), k * 45);
      return moveCard(c, V(HOME.x + rnd(-0.004, 0.004), HOME.y + k * LAYER, HOME.z + rnd(-0.004, 0.004)), flat(HOME_RY + rnd(-0.06, 0.06), rnd(-0.08, 0.08)), 0.22, 0.04, null, k * 0.045);
    }));
    deckMeshes.splice(0, n, ...pile);
  }

  // Lift the deck and drop it back in small packets, top first.
  async function overhand() {
    const n = deckMeshes.length, lift = V(rnd(0.5, 0.58), 1.13, -0.2);
    mira.arms[1].target.copy(lift.clone().add(V(0.08, -0.04, -0.06))); mira.arms[0].target.copy(V(0.38, 1.08, -0.3));
    await Promise.all(deckMeshes.map((c, k) => moveCard(c, V(lift.x, lift.y + k * LAYER, lift.z), V(PI / 2 - 0.55, 0.15, 0), 0.5, 0.03, null, k * 0.004)));
    const held = deckMeshes.slice(), pile = [];
    while (held.length) {
      const k = Math.min(held.length, 2 + Math.floor(Math.random() * 3)), packet = held.splice(held.length - k, k), base = pile.length;
      audio.flick(k, 0.02, 0.2); pile.push(...packet);
      await Promise.all(packet.map((c, j) => moveCard(c, V(HOME.x + rnd(-0.006, 0.006), HOME.y + (base + j) * LAYER, HOME.z + rnd(-0.006, 0.006)), flat(HOME_RY + rnd(-0.1, 0.1)), 0.26, 0.03)));
      await wait(rnd(0.04, 0.14));
    }
    deckMeshes.splice(0, n, ...pile);
  }

  // Spread the cards face down across the cloth, swirl them, gather them back.
  async function wash() {
    const center = V(0.45, HOME.y, 0.06), X0 = 0.16, X1 = 0.74, Z0 = -0.16, Z1 = 0.34;
    st.washCenter = V(center.x, 1.0, center.z);
    audio.flick(6, 0.06, 0.12);
    await Promise.all(deckMeshes.map((c, k) => moveCard(c, V(rnd(X0, X1), HOME.y + 0.001 + k * 0.0007, rnd(Z0, Z1)), flat(rnd(0, PI * 2)), 0.55, 0.06, null, k * 0.03)));
    for (let round = 0; round < 2; round++) {
      audio.flick(8, 0.08, 0.1);
      await Promise.all(deckMeshes.map((c, k) => {
        const rel = c.position.clone().sub(center), a = rnd(0.5, 1.0) * (round % 2 ? -1 : 1);
        const np = V(center.x + rel.x * Math.cos(a) - rel.z * Math.sin(a), c.position.y, center.z + rel.x * Math.sin(a) + rel.z * Math.cos(a));
        np.x = THREE.MathUtils.clamp(np.x, X0, X1); np.z = THREE.MathUtils.clamp(np.z, Z0, Z1);
        return moveCard(c, np, flat(c.rotation.y + a * 1.3), 0.8, 0, null, k * 0.01);
      }));
    }
    st.washCenter = null; mira.arms[1].target.copy(V(0.55, 1.08, -0.3)); mira.arms[0].target.copy(V(0.4, 1.08, -0.3));
    const order = deckMeshes.slice().sort(() => Math.random() - 0.5);
    await Promise.all(order.map((c, k) => moveCard(c, homePos(k), flat(HOME_RY + rnd(-0.05, 0.05)), 0.45, 0.05, null, k * 0.035)));
    deckMeshes.splice(0, deckMeshes.length, ...order);
  }

  async function squareUp() {
    mira.arms[1].target.copy(V(0.58, 1.06, -0.25)); mira.arms[0].target.copy(V(0.66, 1.06, -0.36));
    await Promise.all(deckMeshes.map((c, k) => moveCard(c, homePos(k), flat(HOME_RY + rnd(-0.02, 0.02)), 0.25)));
    audio.flick(2, 0.03, 0.15);
  }

  /* ---------- choreography (public API) ---------- */
  const api = {
    enter() { st.entered = true; camTarget = camBase.clone(); },
    setTalking(v) { st.talking = v; },
    setThinking(v) { st.thinking = v; },
    setBreath(v) { st.breathTarget = v; },
    setChoosing(v) { st.choosing = v; if (!v) { hovered = -1; holdIdx = -1; hooks.onHold?.(null); canvas.style.cursor = ""; } },
    // Opens with a technique different from last time, often followed by a second one.
    async shuffle() {
      st.shuffling = true; st.thinking = true;
      const fns = { riffle, overhand, wash };
      const opts = Object.keys(fns).filter((n) => n !== lastStyle), first = opts[Math.floor(Math.random() * opts.length)];
      lastStyle = first; hooks.onShuffleStyle?.(first, false); await fns[first]();
      if (Math.random() < 0.65) {
        const seconds = ["riffle", "overhand"].filter((n) => n !== first), second = seconds[Math.floor(Math.random() * seconds.length)];
        hooks.onShuffleStyle?.(second, true); await fns[second]();
      }
      await squareUp(); restHands();
      st.thinking = false; st.shuffling = false;
    },
    // Mira cuts off part of the deck; resolves with the pile the user chose to go on top (0 = left, 1 = right).
    async cut() {
      const n = deckMeshes.length, k = Math.round(n * rnd(0.35, 0.6));
      const bottom = deckMeshes.slice(0, n - k), top = deckMeshes.slice(n - k), cutAt = V(0.3, HOME.y, -0.08);
      mira.arms[1].target.copy(cutAt.clone().add(V(0.05, 0.07, -0.1)));
      await Promise.all(top.map((c, j) => moveCard(c, V(cutAt.x + rnd(-0.003, 0.003), HOME.y + j * LAYER, cutAt.z), flat(HOME_RY - 0.15), 0.5, 0.08)));
      restHands(); cutPiles = [top, bottom];
      placeHit(pileHits[0], cutAt, HOME_RY - 0.15); placeHit(pileHits[1], HOME, HOME_RY);
      deckMeshes.forEach((c) => { c.userData.base = c.position.clone(); c.userData.pile = top.includes(c) ? 0 : 1; });
      st.cutting = true;
      const choice = await new Promise((r) => (cutResolve = r));
      st.cutting = false; pileHover[0] = pileHover[1] = 0; canvas.style.cursor = ""; pileHits.forEach((m) => (m.position.y = -10));
      deckMeshes.forEach((c) => { delete c.userData.base; delete c.userData.pile; });
      const onTop = cutPiles[choice], under = cutPiles[1 - choice];
      audio.bell(523.25, 0.04); mira.arms[choice === 0 ? 0 : 1].target.copy(V(choice === 0 ? 0.3 : 0.62, 1.12, -0.2));
      await Promise.all(onTop.map((c) => moveCard(c, c.position.clone().add(V(0, 0.14, 0.02)), flat(c.rotation.y), 0.35)));
      await Promise.all(under.map((c, j) => moveCard(c, homePos(j), flat(HOME_RY), 0.4, 0.03)));
      await Promise.all(onTop.map((c, j) => moveCard(c, homePos(under.length + j), flat(HOME_RY + rnd(-0.02, 0.02)), 0.5, 0.04, null, j * 0.01)));
      deckMeshes.splice(0, n, ...under, ...onTop); audio.flick(3, 0.03, 0.18); restHands();
      return choice;
    },
    chooseCut(i) { if (st.cutting && cutResolve) { const r = cutResolve; cutResolve = null; r(i); } },
    async deal() {
      curSlots = slots.map((s) => ({ p: s.p.clone().add(V(rnd(-0.03, 0.03), 0, rnd(-0.025, 0.025))), ry: s.ry + rnd(-0.08, 0.08) }));
      curSlots.forEach((sl, i) => placeHit(cardHits[i], sl.p, sl.ry));
      const orders = [[0, 1, 2], [2, 1, 0], [1, 0, 2], [0, 2, 1]], order = orders[Math.floor(Math.random() * orders.length)];
      for (const i of order) {
        const c = dealt[i]; c.position.copy(deckTop); c.rotation.set(PI / 2, HOME_RY, 0); c.scale.setScalar(1); c.visible = true; c.userData.hover = 0;
        st.handFollow = c; audio.flick(1, 0, 0.35);
        await moveCard(c, curSlots[i].p, V(PI / 2, curSlots[i].ry, 0), rnd(0.5, 0.7), rnd(0.14, 0.26));
        await wait(rnd(0, 0.15));
      }
      st.handFollow = null; restHands();
    },
    // Turns over the chosen card. `card` is the deck entry the server revealed.
    async reveal(i, card, reversed) {
      api.setChoosing(false); st.chosen = i; const c = dealt[i], front = c.userData.front;
      if (front.material !== blankFace) { const m = front.material; [m.map, m.roughnessMap, m.bumpMap].forEach((t) => t?.dispose()); m.dispose(); }
      const fm = faceMaterial(card, reversed); fm.emissiveIntensity = 0.12; front.material = fm;
      dealt.forEach((d, j) => { if (j !== i) moveCard(d, deckTop.clone().add(V(0, 0.004 * j, 0)), V(PI / 2, 0.32, 0), 0.8, 0.15, null, 0.1).then(() => { d.visible = false; }); });
      mira.arms[1].target.copy(V(0.25, 1.08, -0.05)); st.thinking = true; st.lookMode = "card";
      await wait(0.45);
      const narrow = camera.aspect < 1.15, rp = narrow ? V(0, 1.3, 1.0) : V(-0.45, 1.13, 1.05);
      revealGlow.position.copy(rp).add(V(0, 0, -0.08));
      moveCard(c, rp, V(-0.22, PI * 2 + (narrow ? 0 : 0.12), 0), 1.7, 0.28, narrow ? 1.1 : 1.3);
      anim(1.6, (p) => { revealGlow.material.opacity = p * 0.9; }, 0.4);
      await wait(1.3);
      gust = 1; burst(rp); orb.energy = 1; audio.chime(); audio.wind();
      try { navigator.vibrate && navigator.vibrate([30, 40, 60]); } catch { /* not supported */ }
      anim(1.4, (p) => { fm.emissiveIntensity = 0.12 + 0.6 * Math.sin(PI * p); });
      mira.arms.forEach((a) => a.target.copy(V(a.s * 0.4, 1.3, -0.38)));
      await wait(0.9);
      st.thinking = false; st.lookMode = "user"; st.reading = true; st.revealAt = t; st.revealSmile = reversed || [13, 15, 16, 18].includes(card.index) ? 0.45 : 0.85; restHands(); // a gentler smile for heavy cards
      camTarget = camBase.clone().add(V(0, -0.05, -0.35));
    },
    // Returns whatever is on the table to the deck.
    async putBack() {
      st.reading = false; st.lookMode = "user"; camTarget = camBase.clone(); api.setChoosing(false);
      anim(0.6, (p) => { revealGlow.material.opacity = Math.min(revealGlow.material.opacity, 0.9 * (1 - p)); });
      const moves = dealt.filter((d) => d.visible).map((d) => moveCard(d, deckTop, V(PI / 2, 0.32, 0), 0.9, 0.2, 1).then(() => { d.visible = false; }));
      await Promise.all(moves); st.chosen = -1;
    },
    dispose() { disposed = true; cancelAnimationFrame(raf); removeEventListener("resize", fit); removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointerup", endHold); canvas.removeEventListener("pointercancel", endHold); pmrem.dispose(); renderer.dispose(); },
  };

  /* ---------- input ---------- */
  function hitCard() { if (!dealt.some((d) => d.visible)) return -1; raycaster.setFromCamera(ndc, camera); const hit = raycaster.intersectObjects(cardHits, false)[0]; return hit ? hit.object.userData.i : -1; }
  function hitPile() { raycaster.setFromCamera(ndc, camera); const hit = raycaster.intersectObjects(pileHits, false)[0]; return hit ? hit.object.userData.i : -1; }
  function onMove(e) { pointer.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)); if (e.target === canvas) ndc.copy(pointer); else ndc.set(-9, -9); }
  function onDown(e) {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
    if (st.cutting) { const p = hitPile(); if (p >= 0) api.chooseCut(p); return; }
    if (!st.choosing) return;
    const i = hitCard(); if (i < 0) return;
    holdIdx = i; holdT = 0; hooks.onHold?.(0, e.clientX, e.clientY);
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    audio.bell(440, 0.03);
  }
  function endHold() { if (holdIdx < 0) return; if (holdT < 0.3 && st.choosing) hooks.onShortTap?.(); holdIdx = -1; hooks.onHold?.(null); }
  function fit() {
    const w = innerWidth, h = innerHeight; renderer.setPixelRatio(pr); composer.setPixelRatio(pr); renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h;
    const tanV = Math.max(Math.tan(THREE.MathUtils.degToRad(19)), 1.0 / 2.9 / camera.aspect);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanV)); camera.updateProjectionMatrix();
  }
  addEventListener("resize", fit); addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointerup", endHold); canvas.addEventListener("pointercancel", endHold);
  fit();

  /* ---------- frame loop ---------- */
  // Measures frame time in 1.5 s windows and adjusts the render resolution with hysteresis.
  const perf = { sum: 0, n: 0, good: 0, wait: 3 };
  function adapt(rawDt) {
    if (rawDt > 0.25 || document.hidden) return; // tab switches and stalls say nothing about steady speed
    if (perf.wait > 0) { perf.wait -= rawDt; return; }
    perf.sum += rawDt; perf.n++;
    if (perf.sum < 1.5) return;
    const avg = perf.sum / perf.n; perf.sum = 0; perf.n = 0;
    if (avg > 1 / 42 && pr > minPR) { pr = Math.max(minPR, Math.round((pr - 0.2) * 100) / 100); perf.good = 0; perf.wait = 1; fit(); }
    else if (avg < 1 / 56 && pr < maxPR) { if (++perf.good >= 4) { pr = Math.min(maxPR, Math.round((pr + 0.1) * 100) / 100); perf.good = 0; perf.wait = 1; fit(); } }
    else perf.good = 0;
  }
  let blinkAt = 2, headYaw = 0, headPitch = 0, saccadeAt = 1; const sacc = new THREE.Vector2(), face = { open: 0, at: 0, q: [0, 0, 0, 0, 0], smile: 0.28, shut: 0 };
  function loop() {
    if (disposed) return; raf = requestAnimationFrame(loop);
    const rawDt = clock.getDelta(), dt = Math.min(rawDt, 0.05); t += dt;
    adapt(rawDt);
    for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += dt; if (w.t < 0) continue; const p = Math.min(w.t / w.dur, 1); w.fn(ease(p), p); if (p >= 1) { tweens.splice(i, 1); w.r(); } }
    const par = V(pointer.x * 0.14, pointer.y * 0.06, 0);
    camPos.lerp(camTarget.clone().add(par), reduceMotion ? 1 : 1 - Math.exp(-dt * (st.entered && camPos.z > 3.6 ? 0.9 : 2.2)));
    camera.position.copy(camPos); camera.lookAt(camLook);
    gust = Math.max(0, gust - dt * 0.6); breath += (st.breathTarget - breath) * (1 - Math.exp(-dt * 0.9));
    for (const c of candles) {
      let f = 0.82 + 0.18 * Math.sin(t * 9 + c.ph) * Math.sin(t * 5.3 + c.ph * 2) + Math.random() * 0.06;
      f *= 1 - 0.55 * gust * (0.6 + 0.4 * Math.sin(t * 20 + c.ph));
      c.fl.scale.set(0.04 * (0.9 + 0.1 * f) * (1 + gust * 0.6), 0.085 * f, 1); c.fl.position.x = Math.sin(t * 3 + c.ph) * 0.003 + gust * 0.016; c.gl.material.opacity = 0.65 + 0.3 * f;
      if (c.light) c.light.intensity = c.base * (0.75 + 0.3 * f) * (1 - 0.2 * breath);
    }
    orb.energy = Math.max(st.thinking ? 0.8 : 0, orb.energy - dt * 0.5);
    const oe = 0.55 + 0.25 * Math.sin(t * 1.6) + orb.energy;
    orb.light.intensity = 0.4 + oe * 0.7 + breath * 0.8; orb.halo.material.opacity = 0.35 + oe * 0.35; orb.halo.scale.setScalar(0.6 + oe * 0.25 + breath * 0.45);
    orb.inner.forEach((o) => { const a = t * o.sp2 * (st.thinking ? 3 : 1) + o.ph; o.sp.position.set(Math.cos(a) * 0.05, 0.17 + Math.sin(a * 1.3) * 0.04, Math.sin(a) * 0.05); });
    const dp = dust.geometry.attributes.position; for (let i = 0; i < dp.count; i++) { let y = dp.getY(i) + dt * 0.02; if (y > 3.6) y = 0.9; dp.setY(i, y); dp.setX(i, dp.getX(i) + Math.sin(t * 0.3 + i) * 0.0004); } dp.needsUpdate = true;
    mira.torso.scale.y = 1 + Math.sin(t * 1.5) * 0.006; mira.head.position.y = 1.83 + Math.sin(t * 1.5) * 0.004;
    let target;
    if (st.lookMode === "card" && st.chosen >= 0) target = dealt[st.chosen].position;
    else if (hovered >= 0) target = dealt[hovered].position;
    else if (st.shuffling) target = V(0.55, 1, -0.3);
    else if (st.choosing || st.cutting) target = V(pointer.x * 1.2, 1.2 + pointer.y * 0.4, 2);
    else target = camera.position.clone().add(V(pointer.x * 0.4, pointer.y * 0.2, 0));
    const d = target.clone().sub(V(0, 1.83, -0.95));
    const yaw = THREE.MathUtils.clamp(Math.atan2(d.x, d.z), -0.55, 0.55), pitch = THREE.MathUtils.clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.15, 0.45);
    headYaw += (yaw - headYaw) * (1 - Math.exp(-dt * 3)); headPitch += (pitch - headPitch) * (1 - Math.exp(-dt * 3));
    const nod = st.talking ? Math.sin(t * 2.3) * 0.02 : 0;
    mira.head.rotation.set(headPitch * 0.7 + nod, headYaw * 0.75, Math.sin(t * 0.7) * 0.025);
    // her eyes glance with small natural flicks, lids follow when she looks down, and she blinks
    saccadeAt -= dt; if (saccadeAt < 0) { saccadeAt = 0.8 + Math.random() * 2.2; sacc.set((Math.random() - 0.5) * 0.14, (Math.random() - 0.5) * 0.08); }
    blinkAt -= dt; let bl = 1; if (blinkAt < 0.16) bl = Math.min(1, Math.abs(blinkAt - 0.08) / 0.08); if (blinkAt < 0) blinkAt = 2 + Math.random() * 3.5;
    const lidDrop = clamp(headPitch * 0.9, 0, 0.35);
    const mo = st.talking ? 0.15 + Math.abs(Math.sin(t * 11)) * 0.45 * (0.6 + 0.4 * Math.sin(t * 3.7)) : 0;
    face.open += (mo - face.open) * (1 - Math.exp(-dt * 16));
    // her mood: eyes closed while she meditates over the orb, a warm smile when the card is revealed
    const meditating = st.thinking && !st.shuffling && st.chosen < 0;
    const smileT = meditating ? 0.15 : st.reading ? (t - st.revealAt < 8 ? st.revealSmile : 0.45) : st.talking ? 0.35 : 0.28;
    face.smile += (smileT - face.smile) * (1 - Math.exp(-dt * 2.5)); face.shut += ((meditating ? 1 : 0) - face.shut) * (1 - Math.exp(-dt * 3));
    const fq = [Math.round(Math.max(1 - bl, lidDrop, face.shut * 0.97) * 8) / 8, Math.round(face.open * 6) / 6, Math.round(clamp(sacc.x * 5, -0.6, 0.6) * 6) / 6, Math.round(clamp(sacc.y * 5 - headPitch * 1.3, -0.8, 0.5) * 6) / 6, Math.round(face.smile * 10) / 10];
    if (fq.some((v, i) => v !== face.q[i]) && t - face.at > 0.05) { face.q = fq; face.at = t; drawFace(...fq); }
    mira.ears.forEach((e, i) => { e.rotation.z = Math.sin(t * 2 + i) * 0.12 + headYaw * -0.3; });
    mira.arms.forEach((a) => {
      let tg = a.target.clone();
      if (st.handFollow && a.s === 1) tg = st.handFollow.position.clone().add(V(0.02, 0.06, -0.07));
      else if (st.washCenter) tg = st.washCenter.clone().add(V(a.s * 0.15 * Math.cos(t * 2.6 + a.s * 1.5), 0.03, 0.11 * Math.sin(t * 2.6 + a.s * 1.5)));
      else if (st.thinking && !st.shuffling && st.chosen < 0) tg = V(a.s * 0.15 * Math.cos(t * 2), 1.2, -0.42 + 0.06 * Math.sin(t * 2));
      else if (st.talking && st.reading) tg.add(V(0, 0.03 + Math.sin(t * 1.7 + a.s) * 0.025, 0.04));
      if (!st.handFollow && !st.thinking) tg.y += Math.sin(t * 1.2 + a.s) * 0.008;
      a.cur.lerp(tg, 1 - Math.exp(-dt * (st.handFollow ? 14 : 5))); updateArm(a);
    });
    if (st.cutting) {
      const hp = hitPile(); canvas.style.cursor = hp >= 0 ? "pointer" : "";
      for (let p = 0; p < 2; p++) pileHover[p] += ((p === hp ? 1 : 0) - pileHover[p]) * (1 - Math.exp(-dt * 10));
      deckMeshes.forEach((c) => { const b = c.userData.base; if (b) c.position.y = b.y + pileHover[c.userData.pile] * 0.04 + Math.sin(t * 2 + c.userData.pile * 2) * 0.002; });
    }
    if (st.choosing) {
      const h = holdIdx >= 0 ? holdIdx : hitCard();
      if (h !== hovered) { hovered = h; canvas.style.cursor = h >= 0 ? "pointer" : ""; if (h >= 0) audio.bell(1318.5, 0.02); }
      dealt.forEach((c, i) => {
        const s = curSlots[i]; c.userData.hover += ((i === hovered ? 1 : 0) - c.userData.hover) * (1 - Math.exp(-dt * 10));
        const hv = c.userData.hover, hold = i === holdIdx ? holdT : 0, jit = Math.sin(t * 38 + i * 2) * 0.0015 * hold;
        c.position.set(s.p.x + jit, s.p.y + hv * 0.06 + hold * 0.1 + Math.sin(t * 2 + i) * 0.003, s.p.z + hv * 0.04 + jit); c.rotation.set(PI / 2 - hv * 0.45 - hold * 0.2, s.ry, 0);
      });
      if (holdIdx >= 0) {
        holdT += dt; hooks.onHold?.(Math.min(holdT / 1.1, 1)); orb.energy = Math.max(orb.energy, holdT * 0.8);
        if (holdT >= 1.1) { const i = holdIdx; api.setChoosing(false); hooks.onPick?.(i); }
      }
    }
    if (st.chosen >= 0 && st.reading) { const c = dealt[st.chosen]; c.position.y += Math.sin(t * 1.4) * 0.0006; c.rotation.z = Math.sin(t * 0.9) * 0.03; }
    for (const s of smoke) {
      s.age += dt; if (s.age > s.life) { s.age = 0; s.seed = Math.random() * 10; } const k = s.age / s.life;
      s.sp.position.set(smokeTip.x + Math.sin(k * 5 + s.seed) * 0.05 * k + gust * k * 0.3, smokeTip.y + k * 0.95, smokeTip.z + Math.cos(k * 4 + s.seed) * 0.03 * k);
      s.sp.scale.setScalar(0.03 + k * 0.3); s.sp.material.opacity = Math.sin(PI * k) * 0.2;
    }
    if (sparks.userData.life > 0) {
      const u = sparks.userData; u.life -= dt; const a = sparks.geometry.attributes.position;
      u.vel.forEach((v, i) => { v.y -= dt * 0.35; v.multiplyScalar(1 - dt * 1.2); a.setXYZ(i, a.getX(i) + v.x * dt, a.getY(i) + v.y * dt, a.getZ(i) + v.z * dt); });
      a.needsUpdate = true; sparks.material.opacity = Math.max(0, u.life / 2.2) * (0.7 + 0.3 * Math.random());
    }
    grade.uniforms.time.value = t % 100;
    composer.render();
  }
  // Development only: move the camera from the browser console to inspect the models.
  if (process.env.NODE_ENV !== "production") { window.__miraCam = (p, l) => { camTarget.set(...p); camPos.set(...p); camLook.set(...l); }; window.__miraFace = drawFace; }
  loop();
  return api;
}

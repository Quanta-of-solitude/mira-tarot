// The 3D room: Mira, her table, the deck and all choreography. Imperative Three.js,
// driven by TarotRoom.jsx through the small API returned from createScene().
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { emblemSVG } from "@/lib/tarot";
import { audio } from "@/lib/audio";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = (h) => new THREE.Color(h);
const PI = Math.PI;

export function createScene(canvas, hooks) {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = C(0x0b0609); scene.fog = new THREE.FogExp2(0x0b0609, 0.13);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 40);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.7, 0.82);
  composer.addPass(bloom); composer.addPass(new OutputPass());

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
  function mesh(geo, mat, parent, pos, scale, rot) { const m = new THREE.Mesh(geo, mat); if (pos) m.position.copy(pos); if (scale) m.scale.copy(scale); if (rot) m.rotation.set(rot.x, rot.y, rot.z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  const additive = (map, extra = {}) => new THREE.SpriteMaterial({ map, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, ...extra });

  /* ---------- materials ---------- */
  const M = {
    skin: new THREE.MeshPhysicalMaterial({ color: C(0xb5764f), roughness: 0.5, sheen: 0.4, sheenColor: C(0xffc9a0), sheenRoughness: 0.5 }),
    skinDark: new THREE.MeshStandardMaterial({ color: C(0x9a5f3e), roughness: 0.6 }),
    robe: new THREE.MeshPhysicalMaterial({ color: C(0x5c1629), roughness: 0.8, sheen: 1, sheenColor: C(0xb03a5c), sheenRoughness: 0.4, side: THREE.DoubleSide }),
    cloak: new THREE.MeshStandardMaterial({ color: C(0x2b0b16), roughness: 0.9, side: THREE.DoubleSide }),
    hair: new THREE.MeshStandardMaterial({ color: C(0x120a0c), roughness: 0.4, side: THREE.DoubleSide }),
    gold: new THREE.MeshStandardMaterial({ color: C(0xd9ae62), metalness: 0.9, roughness: 0.28, emissive: C(0x3a2508) }),
    white: new THREE.MeshStandardMaterial({ color: C(0xf3ebe0), roughness: 0.25 }),
    iris: new THREE.MeshStandardMaterial({ color: C(0x3a1d0e), roughness: 0.2 }),
    black: new THREE.MeshStandardMaterial({ color: C(0x0a0506), roughness: 0.3 }),
    lips: new THREE.MeshStandardMaterial({ color: C(0x8e2c41), roughness: 0.35 }),
    gem: new THREE.MeshStandardMaterial({ color: C(0xb0213f), roughness: 0.1, emissive: C(0x50081a) }),
    spark: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    wax: new THREE.MeshStandardMaterial({ color: C(0xeadcbc), roughness: 0.6, emissive: C(0x3a2410) }),
  };

  /* ---------- Mira ---------- */
  const mira = {};
  (function buildMira() {
    const root = new THREE.Group(); scene.add(root);
    const lathe = (pts, seg, ps, pl) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg, ps, pl);
    mira.torso = mesh(lathe([[0, 0.5], [0.33, 0.5], [0.34, 0.9], [0.31, 1.2], [0.3, 1.38], [0.26, 1.5], [0.17, 1.58], [0.075, 1.64], [0, 1.65]], 48), M.robe, root, V(0, 0, -0.98), V(1, 1, 0.62));
    mesh(new THREE.SphereGeometry(0.1, 24, 16), M.skin, root, V(0, 1.57, -0.93), V(1, 0.6, 0.4));
    mesh(lathe([[0.17, 1.74], [0.28, 1.62], [0.38, 1.42], [0.42, 1.1], [0.46, 0.6]], 48, 0.6, PI * 2 - 1.2), M.cloak, root, V(0, 0, -0.99), V(1, 1, 0.78));
    mesh(new THREE.TorusGeometry(0.105, 0.009, 8, 40, PI), M.gold, root, V(0, 1.585, -0.93), V(1, 1.1, 1), new THREE.Euler(PI * 0.62, 0, PI));
    mesh(new THREE.OctahedronGeometry(0.018), M.gem, root, V(0, 1.48, -0.86), V(1, 1.4, 0.6));
    mesh(new THREE.TorusGeometry(0.13, 0.006, 8, 40, PI), M.gold, root, V(0, 1.56, -0.92), V(1, 1.3, 1), new THREE.Euler(PI * 0.62, 0, PI));
    mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.18, 24), M.skinDark, root, V(0, 1.7, -0.96));
    const head = new THREE.Group(); head.position.set(0, 1.86, -0.95); root.add(head); mira.head = head;
    mesh(new THREE.SphereGeometry(0.16, 48, 32), M.skin, head, null, V(0.88, 1.08, 0.95));
    mesh(new THREE.SphereGeometry(0.1, 32, 24), M.skin, head, V(0, -0.09, 0.05), V(0.9, 0.8, 0.9));
    mira.eyes = [];
    for (const s of [-1, 1]) {
      const eg = new THREE.Group(); eg.position.set(s * 0.056, 0.02, 0.128); head.add(eg); mira.eyes.push(eg);
      mesh(new THREE.SphereGeometry(0.03, 24, 16), M.white, eg, null, V(1, 0.62, 0.6));
      const ir = new THREE.Group(); eg.add(ir); eg.userData.iris = ir;
      mesh(new THREE.SphereGeometry(0.017, 20, 14), M.iris, ir, V(0, 0, 0.012), V(1, 1, 0.7));
      mesh(new THREE.SphereGeometry(0.008, 12, 10), M.black, ir, V(0, 0, 0.021));
      mesh(new THREE.SphereGeometry(0.0038, 8, 6), M.spark, ir, V(0.006, 0.006, 0.027));
      mesh(new THREE.TorusGeometry(0.031, 0.0045, 6, 20, PI), M.black, eg, V(0, 0.001, 0.006), V(1, 0.64, 1));
      mesh(new THREE.ConeGeometry(0.004, 0.022, 6), M.black, eg, V(s * 0.034, 0.008, 0.004), null, new THREE.Euler(0, 0, -s * 1.1));
      mesh(new THREE.BoxGeometry(0.052, 0.006, 0.012), M.hair, head, V(s * 0.058, 0.064, 0.13), null, new THREE.Euler(0, 0, -s * 0.14));
    }
    mesh(new THREE.ConeGeometry(0.018, 0.05, 16), M.skin, head, V(0, -0.028, 0.152), V(1, 1, 0.7), new THREE.Euler(1.3, 0, 0));
    mesh(new THREE.SphereGeometry(0.0035, 8, 6), M.gold, head, V(0.013, -0.045, 0.162));
    const mouth = new THREE.Group(); mouth.position.set(0, -0.087, 0.135); head.add(mouth); mira.mouth = mouth;
    mesh(new THREE.SphereGeometry(0.026, 20, 12), M.lips, mouth, V(0, 0.006, 0), V(1, 0.28, 0.45));
    mesh(new THREE.SphereGeometry(0.026, 20, 12), M.lips, mouth, V(0, -0.006, 0), V(0.9, 0.34, 0.5));
    mesh(new THREE.SphereGeometry(0.007, 10, 8), M.gem, head, V(0, 0.1, 0.129));
    mesh(new THREE.SphereGeometry(0.172, 48, 32, 0, PI * 2, 0, PI * 0.5), M.hair, head, V(0, 0.005, -0.005), V(0.92, 1.1, 0.98), new THREE.Euler(-0.38, 0, 0));
    mesh(new THREE.CylinderGeometry(0.165, 0.27, 0.6, 40, 1, true, PI * 0.38, PI * 1.24), M.hair, head, V(0, -0.24, -0.03));
    mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.1, 6), M.gold, head, V(0, 0.155, 0.09), null, new THREE.Euler(-0.9, 0, 0));
    mira.ears = [];
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * 0.138, -0.03, 0); head.add(g); mira.ears.push(g);
      mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.03, 6), M.gold, g, V(0, -0.015, 0));
      mesh(new THREE.ConeGeometry(0.02, 0.03, 16, 1, true), M.gold, g, V(0, -0.04, 0));
      mesh(new THREE.SphereGeometry(0.006, 8, 6), M.gem, g, V(0, -0.058, 0));
    }
    const a = 0.85, ps = PI / 2 + a, pl = PI * 2 - 2 * a, T = PI * 0.62, R = 0.235, hs = V(1, 1.12, 1.05), ho = V(0, 0.03, -0.03);
    mesh(new THREE.SphereGeometry(R, 48, 32, ps, pl, 0, T), M.robe, head, ho, hs);
    const edge = (phi, th) => V(-R * Math.cos(phi) * Math.sin(th) * hs.x + ho.x, R * Math.cos(th) * hs.y + ho.y, R * Math.sin(phi) * Math.sin(th) * hs.z + ho.z);
    const pts = []; for (let i = 20; i >= 0; i--) pts.push(edge(ps, (T * i) / 20)); for (let i = 1; i <= 20; i++) pts.push(edge(ps + pl, (T * i) / 20));
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.007, 6, false), M.gold, head);
    mira.arms = [-1, 1].map((s) => {
      const S = V(s * 0.28, 1.46, -0.92);
      mesh(new THREE.SphereGeometry(0.075, 20, 14), M.robe, root, S);
      const tube = mesh(new THREE.BufferGeometry(), M.robe, root);
      const hand = new THREE.Group(); root.add(hand);
      mesh(new THREE.SphereGeometry(0.045, 20, 14), M.skin, hand, null, V(0.85, 0.45, 1.25));
      mesh(new THREE.SphereGeometry(0.03, 14, 10), M.skin, hand, V(-s * 0.03, 0, -0.01), V(0.5, 0.4, 0.8));
      const cuff = mesh(new THREE.TorusGeometry(0.05, 0.008, 8, 24), M.gold, root);
      const rest = V(s * 0.19, 1.06, -0.43);
      return { s, S, tube, hand, cuff, cur: rest.clone(), target: rest.clone(), rest };
    });
  })();
  function updateArm(arm) {
    const H = arm.cur, S = arm.S;
    const E = S.clone().lerp(H, 0.5).add(V(arm.s * 0.14, -0.11, -0.03));
    arm.tube.geometry.dispose();
    arm.tube.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([S, E, H.clone().add(V(0, 0.01, 0))]), 18, 0.052, 10, false);
    const dir = H.clone().sub(E).normalize();
    arm.hand.position.copy(H).addScaledVector(dir, 0.03); arm.hand.quaternion.setFromUnitVectors(V(0, 0, 1), dir);
    arm.cuff.position.copy(H).addScaledVector(dir, -0.01); arm.cuff.quaternion.setFromUnitVectors(V(0, 0, 1), dir);
  }

  /* ---------- room ---------- */
  const candles = [], smoke = []; let orb, revealGlow, dust, sparks, smokeTip, gust = 0, breath = 0;
  (function buildRoom() {
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
      mesh(new THREE.CylinderGeometry(0.032, 0.036, h, 24), M.wax, g, V(0, 0.02 + h / 2, 0));
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
    spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0004; spot.shadow.camera.near = 1; spot.shadow.camera.far = 8;
    const rim = new THREE.PointLight(C(0xd0506e), 5, 4, 2); rim.position.set(0, 2.4, -2.1); scene.add(rim);
    const face = new THREE.PointLight(C(0xffc89a), 1.6, 3, 2); face.position.set(0, 1.95, 0.4); scene.add(face);
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
  function faceTexture(c, reversed) {
    const tx = canvasTex(512, 868, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#f6ecd6"); gr.addColorStop(1, "#dcc59c"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const r = g.createRadialGradient(w / 2, h / 2, 120, w / 2, h / 2, 540); r.addColorStop(0, "rgba(255,255,255,0)"); r.addColorStop(1, "rgba(106,29,51,.28)"); g.fillStyle = r; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#6a1d33"; g.lineWidth = 7; g.strokeRect(16, 16, w - 32, h - 32); g.strokeStyle = "#b08440"; g.lineWidth = 2; g.strokeRect(32, 32, w - 64, h - 64);
      g.save(); g.translate(w / 2, 428); g.strokeStyle = "rgba(176,132,64,.4)"; g.lineWidth = 2;
      for (let i = 0; i < 48; i++) { g.rotate(PI / 24); g.beginPath(); g.moveTo(0, 168); g.lineTo(0, i % 2 ? 205 : 228); g.stroke(); }
      g.beginPath(); g.arc(0, 0, 166, 0, PI * 2); g.stroke(); g.restore();
      g.fillStyle = "#4a1424"; g.textAlign = "center";
      g.font = '64px "Marcellus SC", Georgia, serif'; g.fillText(c.num, w / 2, 122);
      let fs = 48; const nm = c.name.toUpperCase(); do { g.font = `${fs}px "Marcellus SC", Georgia, serif`; fs -= 2; } while (g.measureText(nm).width > 420 && fs > 20);
      g.fillText(nm, w / 2, 742);
      g.font = 'italic 26px "EB Garamond", Georgia, serif'; g.fillStyle = "#6a1d33"; g.fillText(c.kw, w / 2, 796);
    });
    svgImg(emblemSVG(c.emb, "#6a1d33"), (img) => { tx.image.getContext("2d").drawImage(img, 106, 278, 300, 300); tx.needsUpdate = true; });
    tx.anisotropy = 8; if (reversed) { tx.center.set(0.5, 0.5); tx.rotation = PI; }
    return tx;
  }
  const backTex = canvasTex(512, 868, (g, w, h) => {
    g.fillStyle = "#5d1830"; g.fillRect(0, 0, w, h);
    const r = g.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, 480); r.addColorStop(0, "rgba(207,164,92,.28)"); r.addColorStop(1, "rgba(0,0,0,.35)"); g.fillStyle = r; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(207,164,92,.22)"; g.lineWidth = 2;
    for (let i = -h; i < w + h; i += 34) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke(); }
    g.strokeStyle = "#cfa45c"; g.lineWidth = 6; g.strokeRect(16, 16, w - 32, h - 32); g.lineWidth = 2; g.strokeRect(30, 30, w - 60, h - 60);
  });
  svgImg(emblemSVG("back", "#e0b86c"), (img) => { backTex.image.getContext("2d").drawImage(img, 106, 284, 300, 300); backTex.needsUpdate = true; });
  backTex.anisotropy = 8;
  const backMat = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.5, metalness: 0.1 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: C(0xd9ae62), metalness: 0.8, roughness: 0.3, emissive: C(0x2a1a06) });
  function makeCard(front) { const m = new THREE.Mesh(new THREE.BoxGeometry(CW, CH, CT), [edgeMat, edgeMat, edgeMat, edgeMat, front || backMat, backMat]); m.castShadow = true; m.receiveShadow = true; m.rotation.order = "YXZ"; return m; }
  (function buildCards() {
    const N = 14;
    for (let i = 0; i < N; i++) { const m = makeCard(); m.position.set(0.62 + (Math.random() - 0.5) * 0.006, 0.955 + i * CT * 1.05, -0.3 + (Math.random() - 0.5) * 0.006); m.rotation.set(PI / 2, 0.32 + (Math.random() - 0.5) * 0.04, 0); scene.add(m); deckMeshes.push(m); }
    deckTop = V(0.62, 0.955 + N * CT * 1.05 + 0.002, -0.3);
    for (let i = 0; i < 3; i++) { const fm = new THREE.MeshStandardMaterial({ color: C(0xf6ecd6), roughness: 0.55, emissive: C(0xffffff), emissiveIntensity: 0 }); const m = makeCard(fm); m.visible = false; m.userData = { fm, i, hover: 0 }; scene.add(m); dealt.push(m); }
  })();
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
      deckMeshes.forEach((c) => { c.userData.base = c.position.clone(); c.userData.pile = top.includes(c) ? 0 : 1; });
      st.cutting = true;
      const choice = await new Promise((r) => (cutResolve = r));
      st.cutting = false; pileHover[0] = pileHover[1] = 0; canvas.style.cursor = "";
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
      api.setChoosing(false); st.chosen = i; const c = dealt[i], fm = c.userData.fm;
      if (fm.map) fm.map.dispose();
      fm.map = faceTexture(card, reversed); fm.emissiveMap = fm.map; fm.color.set(0xffffff); fm.emissiveIntensity = 0.18; fm.needsUpdate = true;
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
      anim(1.4, (p) => { fm.emissiveIntensity = 0.18 + 0.7 * Math.sin(PI * p); });
      mira.arms.forEach((a) => a.target.copy(V(a.s * 0.4, 1.3, -0.38)));
      await wait(0.9);
      st.thinking = false; st.lookMode = "user"; st.reading = true; restHands();
      camTarget = camBase.clone().add(V(0, -0.05, -0.35));
    },
    // Returns whatever is on the table to the deck.
    async putBack() {
      st.reading = false; st.lookMode = "user"; camTarget = camBase.clone(); api.setChoosing(false);
      anim(0.6, (p) => { revealGlow.material.opacity = Math.min(revealGlow.material.opacity, 0.9 * (1 - p)); });
      const moves = dealt.filter((d) => d.visible).map((d) => moveCard(d, deckTop, V(PI / 2, 0.32, 0), 0.9, 0.2, 1).then(() => { d.visible = false; }));
      await Promise.all(moves); st.chosen = -1;
    },
    dispose() { disposed = true; cancelAnimationFrame(raf); removeEventListener("resize", fit); removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointerup", endHold); canvas.removeEventListener("pointercancel", endHold); renderer.dispose(); },
  };

  /* ---------- input ---------- */
  function hitCard() { raycaster.setFromCamera(ndc, camera); const hit = raycaster.intersectObjects(dealt.filter((d) => d.visible))[0]; return hit ? hit.object.userData.i : -1; }
  function hitPile() { raycaster.setFromCamera(ndc, camera); const hit = raycaster.intersectObjects(deckMeshes)[0]; return hit && hit.object.userData.pile != null ? hit.object.userData.pile : -1; }
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
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h;
    const tanV = Math.max(Math.tan(THREE.MathUtils.degToRad(19)), 1.0 / 2.9 / camera.aspect);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanV)); camera.updateProjectionMatrix();
  }
  addEventListener("resize", fit); addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointerup", endHold); canvas.addEventListener("pointercancel", endHold);
  fit();

  /* ---------- frame loop ---------- */
  let blinkAt = 2, headYaw = 0, headPitch = 0;
  function loop() {
    if (disposed) return; raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05); t += dt;
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
    mira.torso.scale.y = 1 + Math.sin(t * 1.5) * 0.006; mira.head.position.y = 1.86 + Math.sin(t * 1.5) * 0.004;
    let target;
    if (st.lookMode === "card" && st.chosen >= 0) target = dealt[st.chosen].position;
    else if (hovered >= 0) target = dealt[hovered].position;
    else if (st.shuffling) target = V(0.55, 1, -0.3);
    else if (st.choosing || st.cutting) target = V(pointer.x * 1.2, 1.2 + pointer.y * 0.4, 2);
    else target = camera.position.clone().add(V(pointer.x * 0.4, pointer.y * 0.2, 0));
    const d = target.clone().sub(V(0, 1.86, -0.95));
    const yaw = THREE.MathUtils.clamp(Math.atan2(d.x, d.z), -0.55, 0.55), pitch = THREE.MathUtils.clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.15, 0.45);
    headYaw += (yaw - headYaw) * (1 - Math.exp(-dt * 3)); headPitch += (pitch - headPitch) * (1 - Math.exp(-dt * 3));
    const nod = st.talking ? Math.sin(t * 2.3) * 0.02 : 0;
    mira.head.rotation.set(headPitch * 0.7 + nod, headYaw * 0.75, Math.sin(t * 0.7) * 0.025);
    mira.eyes.forEach((e) => e.userData.iris.rotation.set(headPitch * 0.4, headYaw * 0.5, 0));
    blinkAt -= dt; let bl = 1; if (blinkAt < 0.14) bl = Math.max(0.06, Math.abs(blinkAt - 0.07) / 0.07); if (blinkAt < 0) blinkAt = 2 + Math.random() * 3.5;
    mira.eyes.forEach((e) => (e.scale.y = bl));
    const ms = st.talking ? 0.75 + Math.abs(Math.sin(t * 15)) * 1.3 * (0.6 + 0.4 * Math.sin(t * 4.3)) : 1;
    mira.mouth.scale.y += (ms - mira.mouth.scale.y) * (1 - Math.exp(-dt * 20));
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
        const hv = c.userData.hover, hold = i === holdIdx ? holdT : 0, jit = (Math.random() - 0.5) * 0.006 * hold;
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
    composer.render();
  }
  loop();
  return api;
}

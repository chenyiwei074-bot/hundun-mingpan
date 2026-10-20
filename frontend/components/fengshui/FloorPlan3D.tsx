'use client';

// 户型 3D 舞台。所有场景数值都来自 lib/fengshui/stage.ts（那份是批准过的参数稿），
// 这个文件只负责把它落到 three.js 上 —— 数值写在这里套件就读不到，参数就是这一页的实现。
//
// 三条硬约束：
//  1. three.js 只在**进入 3D 这一步**时动态 import，不污染其它路由的包。
//  2. 拿不到 WebGL / import 失败 / 首帧超时 / 上下文丢失 → 交回调用方切 SVG，
//     并把原因写在页面上。不许黑屏、不许转圈、不许静默。
//  3. 粒子只在可行走网格上移动，沿"离窗最近"的方向场走。墙对它是结构上不可穿过，
//     不是每帧做碰撞检测补救出来的。

import { useEffect, useRef, useState } from 'react';
import { randomFloat } from '@/lib/crypto/random';
// 只取类型：值形式的 three 一律在函数内部动态 import，否则这 141KB 会跟着 /fengshui 的首屏包走。
import type * as THREE from 'three';
import { buildWalkGrid, cellCenter, nearestWalkable, passable } from '@/lib/fengshui/geometry';
import type { FloorGeometry, WalkGrid } from '@/lib/fengshui/geometry';
import { BUDGET, CAMERA, LIGHTS, PARTICLES, SCENE, SURFACE, particleBudget, readStage, tierFor } from '@/lib/fengshui/stage';

export type StageStatus =
  | { kind: 'ready'; 首帧毫秒: number; 粒子数: number }
  | { kind: 'degraded'; 原因: string }
  | { kind: 'throttled'; 说明: string };

interface Props {
  几何: FloorGeometry;
  onStatus: (s: StageStatus) => void;
}

/** 图纸坐标（x 右、y 下、米）→ three 坐标（x 右、y 上、z 朝屏幕外）。整个应用只有这一处映射。 */
function makeTo3(geom: FloorGeometry) {
  const all = [...geom.房间.flatMap(r => r.外环), ...geom.墙体.flatMap(w => w.折线)];
  const cx = all.length ? (Math.min(...all.map(p => p.x)) + Math.max(...all.map(p => p.x))) / 2 : 0;
  const cy = all.length ? (Math.min(...all.map(p => p.y)) + Math.max(...all.map(p => p.y))) / 2 : 0;
  return (x: number, y: number, z = 0): [number, number, number] => [x - cx, z, y - cy];
}

function spanOf(geom: FloorGeometry) {
  const all = [...geom.房间.flatMap(r => r.外环), ...geom.墙体.flatMap(w => w.折线)];
  if (all.length < 2) return 4;
  return Math.max(
    Math.max(...all.map(p => p.x)) - Math.min(...all.map(p => p.x)),
    Math.max(...all.map(p => p.y)) - Math.min(...all.map(p => p.y)),
  );
}

export default function FloorPlan3D({ 几何, onStatus }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [说明, set说明] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let teardown: (() => void) | null = null;
    const t0 = performance.now();                 // 首帧计时起点 = 进入这一步，与 BUDGET.首帧毫秒 同口径

    const fail = (原因: string) => {
      if (disposed) return;
      set说明(原因);
      onStatus({ kind: 'degraded', 原因 });
    };

    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) {
      fail('这台设备没有可用的 WebGL，已改用等轴测平面图。');
      return;
    }
    const 移动 = matchMedia('(pointer: coarse)').matches;
    const 减动效 = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const 档位 = tierFor({ mobile: 移动, deviceMemory: (navigator as unknown as { deviceMemory?: number }).deviceMemory });

    // 看门狗：连 three 都没下载完/没出第一帧，也要在预算之外一点点就交回 SVG，不能永远转圈。
    const watchdog = setTimeout(() => {
      if (!disposed && performance.now() - t0 > BUDGET.首帧毫秒 + 1500) fail('3D 首帧超出预算，已改用等轴测平面图。');
    }, BUDGET.首帧毫秒 + 1500);

    (async () => {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      if (disposed) return;
      teardown = build(THREE, OrbitControls, host, 几何, {
        移动, 减动效, 档位, t0,
        onStatus: s => { if (!disposed) onStatus(s); },
        onNotice: s => { if (!disposed) set说明(s); },
      });
    })().catch((e: unknown) => fail(`3D 资源没能载入（${(e as Error)?.message || String(e)}），已改用等轴测平面图。`));

    return () => { disposed = true; clearTimeout(watchdog); teardown?.(); };
  }, [几何, onStatus]);

  return (
    <div>
      <div ref={hostRef} data-fp-stage="1" aria-label="户型三维模型"
        style={{ width: '100%', aspectRatio: '16 / 10', minHeight: 260, borderRadius: 12,
          border: '1px solid var(--color-fp-stage-line)', background: 'var(--color-fp-stage-bg)', touchAction: 'none', overflow: 'hidden' }} />
      <p className="qn-note" style={{ marginTop: 6, minHeight: 18 }}>
        {说明 ?? '拖动转视角，滚轮或双指缩放。这块画布不抢页面的纵向滚动。'}
      </p>
    </div>
  );
}

// ── 场景构建 ──
type Three = typeof import('three');
type ControlsCtor = typeof import('three/examples/jsm/controls/OrbitControls.js').OrbitControls;

interface Env {
  移动: boolean; 减动效: boolean; 档位: 'full' | 'half' | 'minimal'; t0: number;
  onStatus: (s: StageStatus) => void; onNotice: (s: string) => void;
}

function build(THREE: Three, Controls: ControlsCtor, host: HTMLElement, geom: FloorGeometry, env: Env): () => void {
  const to3 = makeTo3(geom);
  const stage = readStage(host);   // 颜色只从 CSS 变量读一次：SVG 降级图吃的是同一批变量
  const span = spanOf(geom);
  const dist = Math.max(6, span * 1.15);
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T): T => { disposables.push(x); return x; };

  const renderer = new THREE.WebGLRenderer({ antialias: !env.移动, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, env.移动 ? PARTICLES.dpr移动 : PARTICLES.dpr上限));
  renderer.setSize(host.clientWidth || 640, host.clientHeight || 400, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = LIGHTS.toneMappingExposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(stage.bg);

  const camera = new THREE.PerspectiveCamera(CAMERA.fov, (host.clientWidth || 640) / (host.clientHeight || 400), CAMERA.near, CAMERA.far);

  scene.add(new THREE.HemisphereLight(new THREE.Color(LIGHTS.hemi.sky), new THREE.Color(stage.bg), LIGHTS.hemi.intensity));
  const key = new THREE.DirectionalLight(new THREE.Color(LIGHTS.key.color), LIGHTS.key.intensity);
  key.position.set(LIGHTS.key.offset[0] * span / 9, LIGHTS.key.offset[1] * span / 9, LIGHTS.key.offset[2] * span / 9);
  key.castShadow = true;
  const mapSize = env.移动 ? LIGHTS.shadowMapMobile : LIGHTS.shadowMap;
  key.shadow.mapSize.set(mapSize, mapSize);
  key.shadow.camera.left = -span; key.shadow.camera.right = span;
  key.shadow.camera.top = span; key.shadow.camera.bottom = -span;
  key.shadow.camera.far = span * 6;
  scene.add(key);

  // 地面：一块哑光板。不做网格地板、不用任何贴图资源。
  const floorMat = keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(stage.floor), roughness: 0.95, metalness: 0 }));
  const wallMat = keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(stage.wall), roughness: SURFACE.wallRoughness, metalness: SURFACE.wallMetalness }));
  const goldMat = keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(stage.gold), roughness: 0.4, metalness: 0.1 }));

  const outline = geom.房间.flatMap(r => r.外环);
  if (outline.length > 2) {
    const shape = new THREE.Shape(outline.map(p => new THREE.Vector2(p.x, p.y)));
    const mesh = new THREE.Mesh(keep(new THREE.ShapeGeometry(shape)), floorMat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = 0.002;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  /**
   * 墙全部并进"每种材质一个 mesh"。
   * 原来每段墙一个 BoxGeometry + 一个 Mesh：一套普通户型 30–50 段墙就是 30–50 个 draw call，
   * 软件渲染下实测 42.9fps（下限 45）。合并后一个材质一次提交，阴影也只需走一遍。
   */
  const 模板 = keep(new THREE.BoxGeometry(1, 1, 1));
  const 模板位 = 模板.getAttribute('position') as THREE.BufferAttribute;
  const 模板法 = 模板.getAttribute('normal') as THREE.BufferAttribute;
  const 模板索 = 模板.getIndex() as THREE.BufferAttribute;
  const 批 = new Map<THREE.Material, { pos: number[]; nrm: number[]; idx: number[] }>();
  const 暂向 = new THREE.Vector3();
  const 暂欧 = new THREE.Euler();
  const 暂四 = new THREE.Quaternion();
  const 暂阵 = new THREE.Matrix4();
  const 暂法阵 = new THREE.Matrix3();

  /** 一段墙的一个矩形块：起点终点（图纸平面）+ 上下高度。 */
  const addBox = (ax: number, ay: number, bx: number, by: number, z0: number, z1: number, mat: THREE.Material) => {
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1e-4 || z1 <= z0) return;
    let b = 批.get(mat);
    if (!b) { b = { pos: [], nrm: [], idx: [] }; 批.set(mat, b); }
    const c = to3((ax + bx) / 2, (ay + by) / 2, (z0 + z1) / 2);
    暂向.set(c[0], c[1], c[2]);
    暂欧.set(0, -Math.atan2(by - ay, bx - ax), 0);
    暂四.setFromEuler(暂欧);
    暂阵.compose(暂向, 暂四, new THREE.Vector3(len, z1 - z0, SCENE.墙厚));
    暂法阵.getNormalMatrix(暂阵);
    const base = b.pos.length / 3;
    for (let i = 0; i < 模板位.count; i++) {
      暂向.fromBufferAttribute(模板位, i).applyMatrix4(暂阵);
      b.pos.push(暂向.x, 暂向.y, 暂向.z);
      暂向.fromBufferAttribute(模板法, i).applyMatrix3(暂法阵).normalize();
      b.nrm.push(暂向.x, 暂向.y, 暂向.z);
    }
    for (let i = 0; i < 模板索.count; i++) b.idx.push(模板索.getX(i) + base);
  };

  for (const w of geom.墙体) {
    const n = w.闭合 ? w.折线.length : w.折线.length - 1;
    for (let i = 0; i < n; i++) {
      const a = w.折线[i], b = w.折线[(i + 1) % w.折线.length];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const at = (t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      const ops = geom.开口
        .filter(o => o.墙 === w.id && o.段 === i && o.已确认)
        .map(o => {
          const half = (o.宽 / 2) / len;
          return { lo: Math.max(0, o.位 - half), hi: Math.min(1, o.位 + half), o };
        })
        .sort((p, q) => p.lo - q.lo);
      let cursor = 0;
      for (const { lo, hi, o } of ops) {
        if (lo > cursor) { const p = at(cursor); addBox(p.x, p.y, at(lo).x, at(lo).y, 0, SCENE.墙高, wallMat); }
        const L = at(lo), R = at(hi);
        if (o.类型 === '门') {
          if (SCENE.门高 < SCENE.墙高) addBox(L.x, L.y, R.x, R.y, SCENE.门高, SCENE.墙高, wallMat);      // 门楣
          addBox(L.x, L.y, R.x, R.y, 0, 0.02, goldMat);                                                  // 全场景唯一的金：门口那一缕
        } else {
          if (SCENE.窗台 > 0) addBox(L.x, L.y, R.x, R.y, 0, SCENE.窗台, wallMat);                        // 窗下墙
          const top = SCENE.窗台 + SCENE.窗高;
          if (top < SCENE.墙高) addBox(L.x, L.y, R.x, R.y, top, SCENE.墙高, wallMat);                    // 窗上墙
        }
        cursor = hi;
      }
      if (cursor < 1) { const p = at(cursor); addBox(p.x, p.y, b.x, b.y, 0, SCENE.墙高, wallMat); }
    }
  }

  // 每种材质一次提交：整片墙一个 mesh，门口那一缕金另一个 mesh。
  for (const [mat, b] of 批) {
    if (!b.pos.length) continue;
    const geo = keep(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
    geo.setIndex(b.idx);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  批.clear();

  // 气流场：窗是汇，门是源。距离场只在可通行的边上扩展，所以粒子永远走不出墙。
  const grid = buildWalkGrid(geom, PARTICLES.步长);
  const 门格: number[] = [];
  const 窗格: number[] = [];
  if (grid) {
    for (const o of geom.开口.filter(x => x.已确认)) {
      const w = geom.墙体.find(x => x.id === o.墙);
      const a = w?.折线[o.段], b = w?.折线[o.段 + 1];
      if (!a || !b) continue;
      const i = nearestWalkable(grid, { x: a.x + (b.x - a.x) * o.位, y: a.y + (b.y - a.y) * o.位 });
      if (i == null) continue;
      (o.类型 === '门' ? 门格 : 窗格).push(i);
    }
  }
  const 距离 = grid && 窗格.length ? flowField(grid, geom, 窗格) : null;
  const 可流 = !!(grid && 距离 && 门格.length && 窗格.length);
  const 上限 = 可流 ? particleBudget(env.档位, 门格.length, 窗格.length) : 0;

  let points: THREE.Points | null = null;
  let 粒子: { 格: Int32Array; 计时: Float32Array } | null = null;
  if (grid && 可流 && 上限 > 0) {
    const pos = new Float32Array(上限 * 3);
    const geo = keep(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    points = new THREE.Points(geo, keep(new THREE.PointsMaterial({
      color: new THREE.Color(stage.flow), size: 0.07, transparent: true, opacity: 0.9,
    })));
    scene.add(points);
    粒子 = { 格: new Int32Array(上限).fill(-1), 计时: new Float32Array(上限) };
    for (let k = 0; k < 上限; k++) {
      粒子.格[k] = 门格[k % 门格.length];
      粒子.计时[k] = randomFloat() * (grid.步长 / PARTICLES.速度);   // 错开起步，不要整排同帧跳格
    }
  }

  const controls = new Controls(camera, renderer.domElement);
  controls.enablePan = false;                       // 平移会把房子转出画面，用户只能怪我们
  controls.minPolarAngle = CAMERA.minPolar;
  controls.maxPolarAngle = CAMERA.maxPolar;
  controls.minDistance = dist * CAMERA.minDistanceFactor;
  controls.maxDistance = dist * CAMERA.maxDistanceFactor;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, SCENE.墙高 * 0.35, 0);

  const 起点 = new THREE.Vector3(CAMERA.start[0], CAMERA.start[1] * dist / 9, CAMERA.start[2] * dist / 9);
  const 终点 = new THREE.Vector3(CAMERA.end[0], CAMERA.end[1] * dist / 9, CAMERA.end[2] * dist / 9);
  camera.position.copy(env.减动效 ? 终点 : 起点);    // reduced-motion：直接落位，不跑开场动画
  let openT = env.减动效 ? 1 : 0;

  const ro = new ResizeObserver(() => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  ro.observe(host);

  const onLost = (e: Event) => {
    e.preventDefault();
    env.onNotice('显卡上下文被系统收回，3D 已停止；几何与判定不受影响，可切回平面图。');
    env.onStatus({ kind: 'degraded', 原因: 'WebGL 上下文丢失' });
  };
  renderer.domElement.addEventListener('webglcontextlost', onLost);

  let raf = 0;
  let 已出粒子 = 上限;
  let 降级档 = 0;
  const 帧时: number[] = [];
  let last = performance.now();

  // 先无条件画一帧。首帧计时与"这台设备到底画得出来吗"都必须独立于 IntersectionObserver：
  // 舞台挂在长页面下方时，io 还没判定可见 → rAF 不跑 → 没有第一帧 → 看门狗会把一台完全
  // 能跑的机器判成"不支持 3D"。降级必须是真降级，不能是"还没轮到它画"。
  renderer.render(scene, camera);
  env.onStatus({ kind: 'ready', 首帧毫秒: Math.round(performance.now() - env.t0), 粒子数: 已出粒子 });
  let 首帧出过 = true;

  const tick = () => {
    raf = requestAnimationFrame(tick);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (openT < 1) {
      openT = Math.min(1, openT + (dt * 1000) / CAMERA.openMs);
      const e = openT < 0.5 ? 4 * openT ** 3 : 1 - (-2 * openT + 2) ** 3 / 2;   // easeInOutCubic
      camera.position.lerpVectors(起点, 终点, e);
    }
    controls.update();
    if (grid && 距离 && 粒子 && points && 已出粒子 > 0) step(grid, 距离, 门格, 粒子, points, 已出粒子, dt);
    renderer.render(scene, camera);

    if (!首帧出过) {
      首帧出过 = true;
      env.onStatus({ kind: 'ready', 首帧毫秒: Math.round(performance.now() - env.t0), 粒子数: 已出粒子 });
    }

    if (openT >= 1 && 降级档 < 2) {
      帧时.push(dt);
      if (帧时.length > PARTICLES.掉帧窗口帧) 帧时.shift();
      if (帧时.length === PARTICLES.掉帧窗口帧) {
        const fps = PARTICLES.掉帧窗口帧 / (帧时.reduce((x, y) => x + y, 0) || 1);
        if (fps < PARTICLES.下限fps) {
          帧时.length = 0;
          if (降级档 === 0 && 已出粒子 > 40) {
            降级档 = 1;
            已出粒子 = Math.floor(已出粒子 / 2);
            env.onNotice(`帧率 ${Math.round(fps)}fps 偏低，粒子已减半到 ${已出粒子} 个。`);
            env.onStatus({ kind: 'throttled', 说明: `帧率 ${Math.round(fps)}fps，粒子减半` });
          } else if (降级档 === 1) {
            降级档 = 2;
            已出粒子 = 0;
            points!.visible = false;
            env.onNotice('帧率仍然偏低，已停掉流动粒子。判定与几何不受影响，可切回平面图看流向。');
            env.onStatus({ kind: 'throttled', 说明: `帧率 ${Math.round(fps)}fps，已停粒子` });
          }
        }
      }
    }
  };

  // 画布不在视口里或标签页在后台时不渲染 —— 省电，也免得把"没在看"算成"掉帧"。
  const io = new IntersectionObserver(es => {
    const vis = es.some(e => e.isIntersecting) && !document.hidden;
    if (vis && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    else if (!vis && raf) { cancelAnimationFrame(raf); raf = 0; }
  });
  io.observe(host);

  return () => {
    if (raf) cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    renderer.domElement.removeEventListener('webglcontextlost', onLost);
    controls.dispose();
    for (const x of disposables) x.dispose();
    renderer.dispose();
    if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
  };
}

/** 从所有窗格做 BFS：距离越小说明越靠近出风口。不可达的格子保持 -1。 */
function flowField(g: WalkGrid, geom: FloorGeometry, 源: number[]): Int32Array {
  const 距离 = new Int32Array(g.列 * g.行).fill(-1);
  const q: number[] = [];
  for (const i of 源) if (i != null && g.通[i] && 距离[i] === -1) { 距离[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % g.列, y = (i - x) / g.列;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= g.列 || ny >= g.行) continue;
      const j = ny * g.列 + nx;
      if (距离[j] !== -1) continue;
      if (!passable(g, geom, i, j)) continue;
      距离[j] = 距离[i] + 1;
      q.push(j);
    }
  }
  return 距离;
}

function step(g: WalkGrid, 距离: Int32Array, 门格: number[], 粒子: { 格: Int32Array; 计时: Float32Array },
  points: import('three').Points, n: number, dt: number) {
  const attr = points.geometry.getAttribute('position') as import('three').BufferAttribute;
  const arr = attr.array as Float32Array;
  const 跳格秒 = g.步长 / PARTICLES.速度;
  for (let k = 0; k < n; k++) {
    let cell = 粒子.格[k];
    if (cell < 0) { cell = 门格[0] ?? -1; if (cell < 0) continue; 粒子.格[k] = cell; }
    const c = cellCenter(g, cell % g.列, Math.floor(cell / g.列));
    arr[k * 3] = c.x;
    arr[k * 3 + 1] = 0.6;
    arr[k * 3 + 2] = c.y;
    粒子.计时[k] += dt;
    if (粒子.计时[k] < 跳格秒) continue;
    粒子.计时[k] = 0;
    const x = cell % g.列, y = (cell - x) / g.列;
    let best = cell, bestD = 距离[cell];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= g.列 || ny >= g.行) continue;
      const j = ny * g.列 + nx;
      if (距离[j] === -1 || 距离[j] >= bestD) continue;
      best = j;
      bestD = 距离[j];
    }
    // 到窗（距离 0）或者无路可走 → 从某个门重新出发，形成持续的进风→出风流向
    粒子.格[k] = bestD <= 0 || best === cell ? 门格[Math.floor(randomFloat() * 门格.length)] : best;
  }
  attr.needsUpdate = true;
}

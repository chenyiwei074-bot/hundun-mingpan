'use client';

// 户型工作室（东方）：上传 → 识别候选 → 2D 人工确认 → 交给几何层与规则层。
//
// 四条不能含糊的口径：
//  1. 识别只是**候选**。没有人工确认过的墙、房间、门窗，一律不参与判定，也不进 3D。
//     自动下结论是这一页最容易做错的事：识别错一堵墙，穿堂煞就从"没有"变成"有"。
//  2. 上传的图只用于识别，不进报告、不进回执、不进台账，也不写进任何公开数据。
//     服务端存储与 7 天自动删由运维负责，这一层只负责：本地校验、显式告知、勾选同意。
//  3. 识别只有三种落点，而且每种都要在页面上说得出话：
//     失败（服务端 code 原样带上，不转圈、不假装算过）/ 成功但待确认（默认一个都不算输入）/
//     用户勾了确认（这才进 3D 与规则层）。
//  4. 5xx 与网络失败都不自动重试。上游是"落盘 + 视觉模型"，一次失败已经花了 110s 预算，
//     客户端再循环等于把这份开销乘几遍，还会让按钮反复转圈看着像坏了。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { analyzeFloor } from '@/lib/fengshui/analysis';
import ToolInterpretation from '@/components/ai/ToolInterpretation';
import { MAX_SPAN_M, buildWalkGrid, openingSegment, palaceCells, toFloorInput } from '@/lib/fengshui/geometry';
import type { FloorGeometry, Opening, Pt, RoomShape, Wall } from '@/lib/fengshui/geometry';
import {
  RECOGNIZE_SPAN_M, buildRecognizeRequest, confidenceText, failReason, parseRecognize,
} from '@/lib/fengshui/recognize';
import type { RecognizeResult } from '@/lib/fengshui/recognize';
import {
  OPENING_LIMITS, addOpening, addWall, deleteOpening, deleteWall, moveRoomVertex, moveWallVertex,
  resizeOpening, setOpeningConfirmed, setRoomKind, setRoomName, shiftOpening, toggleOpeningKind,
} from '@/lib/fengshui/edit';
import { FACING_LIST, ROOM_KINDS } from '@/lib/fengshui/types';
import type { FacingInput } from '@/lib/fengshui/types';
import { openingTags, placeTag, tagOf } from '@/lib/fengshui/labels';
import { CONCERNS, currentStep, orderNotes, stepStates } from '@/lib/fengshui/steps';
import type { Concern } from '@/lib/fengshui/steps';
import { isoSvg, planProject, planSvg } from '@/lib/fengshui/svg';
import { SYNTHETIC_FLOORPLANS } from '@/lib/fengshui/synthetic';
import { ACCEPT_MIME, validateFloorplanFile } from '@/lib/fengshui/upload';
import { getVisitorId } from '@/lib/auth/visitor';
import Callout from '@/components/ui/Callout';
import type { CalloutTier } from '@/components/ui/Callout';
import type { StageStatus } from './FloorPlan3D';

// three.js 只在用户真的按下「进入 3D」之后才被下载：这一路由的增量预算是 200KB gzip，
// 让 141KB 跟着首屏走等于把预算花在没人看的画面上。
const FloorPlan3D = dynamic(() => import('./FloorPlan3D'), { ssr: false });

const SNAP = 0.1;                 // 吸附到 10cm：图纸上再细的点人也没法凭手感放准
const CANVAS_W = 720;
const CANVAS_H = 420;

let seq = 0;
const uid = (p: string) => `${p}${++seq}`;


const emptyGeom = (): FloorGeometry => ({ 墙体: [], 房间: [], 开口: [] });

/** 拿图片宽高比。识别响应只有 0..1 的归一化坐标，长边米数是本站约定，
 *  而另一边必须按这张图自己的比例缩 —— 没有它就只能按正方画，2:1 的厅会被画成 1:1，
 *  后面宫位归属和动线算的都是从这些点推出来的米。 */
function readImageAspect(url: string): Promise<number> {
  return new Promise(resolve => {
    const img = new Image();
    const done = (v: number) => resolve(v);
    img.onload = () => done(img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1);
    img.onerror = () => done(1);
    img.src = url;
  });
}

/** 候选态那一句汇总。数字全部来自适配层，UI 不复算 —— 复算一遍就多一处会分家的地方。
 *  这一行要能被探针逐字钉住，所以措辞里带单位与口径。 */
function 候选汇总(p: RecognizeResult): string {
  return `墙 ${p.geom.墙体.length} 道 · 房间 ${p.geom.房间.length} 间 · 门 ${p.门数} · 窗 ${p.窗数} · 跨度按 ${p.跨度米}m`;
}

/** 四种"认出来了但要人看一眼"的情况各写一条。次序固定：先说没认出来的，再说要确认的。 */
function 候选提醒(p: RecognizeResult): string {
  const 部: string[] = [`候选已载入：${候选汇总(p)}。每一项都要你逐条确认，没确认的一律不参与判定，也进不了 3D。`];
  if (p.门数 + p.窗数 === 0) {
    部.push('一个门窗都没认出来。这不等于你家没门窗 —— 请手动补上，否则采光、对流、动线三类判定都会写成缺输入。');
  }
  if (p.未挂上数 > 0) {
    部.push(`有 ${p.未挂上数} 个门窗的中心点落不到任何一道墙上（自动识别可能把房间中心误认为洞口），本站没有把它们硬按到某道墙上，请核对后手动补。`);
  }
  if (p.未命名房间数 > 0) {
    部.push(`有 ${p.未命名房间数} 间房的名字没认出来，用途先记作储物 —— 这会直接影响"厨卫相邻""私密区"那几条判定，请逐间改对。`);
  }
  部.push(`归一化坐标没有幅面信息：长边按 ${p.跨度米}m 估，比例照这张图自己的宽高比。这不是测量值，请在俯视图里拖角点对一下。`);
  return 部.join(' ');
}

/** 一堵矩形外墙 + 一把十字内墙：手工画的最短起点。 */
function starterGeometry(): FloorGeometry {
  const outer: Wall = { id: 'w-outer', 折线: [{ x: 0, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 6 }, { x: 0, y: 6 }], 闭合: true };
  const v: Wall = { id: 'w-v', 折线: [{ x: 4.5, y: 0 }, { x: 4.5, y: 6 }], 闭合: false };
  const rooms: RoomShape[] = [
    { id: 'r-a', 名称: '客厅', 用途: '客厅', 外环: [{ x: 0.12, y: 0.12 }, { x: 4.38, y: 0.12 }, { x: 4.38, y: 5.88 }, { x: 0.12, y: 5.88 }] },
    { id: 'r-b', 名称: '主卧', 用途: '卧室', 外环: [{ x: 4.62, y: 0.12 }, { x: 8.88, y: 0.12 }, { x: 8.88, y: 5.88 }, { x: 4.62, y: 5.88 }] },
  ];
  return { 墙体: [outer, v], 房间: rooms, 开口: [
    { id: 'o-door', 类型: '门', 墙: 'w-v', 段: 0, 位: 0.5, 宽: 0.9, 置信度: null, 已确认: false },
  ] };
}

const round = (n: number) => Math.round(n / SNAP) * SNAP;

/** 识别这一段的四种落点。它必须活成页面状态，而不是只活在一句 toast 里：
 *  失败要说清是哪一种失败，候选要说清还差什么才算输入。 */
type 识别态 = '未识别' | '在识别' | '失败' | '候选待确认';

export default function FloorPlanStudio() {
  const [geom, setGeom] = useState<FloorGeometry>(emptyGeom);
  const [朝向, set朝向] = useState<FacingInput>('未确认');
  const [已确认, set已确认] = useState(false);
  const [选中, set选中] = useState<string | null>(null);
  const [选中墙, set选中墙] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ 档: CalloutTier; 文: string } | null>(null);
  const [consent, setConsent] = useState(false);
  const [视图, set视图] = useState<'俯视' | '等轴' | '3D'>('俯视');
  const [舞台, set舞台] = useState<StageStatus | null>(null);
  const [舞台说明, set舞台说明] = useState<string | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [image, setImage] = useState<{ name: string; url: string; kind: 'jpg' | 'png' | 'webp'; bytes: Uint8Array; aspect: number } | null>(null);
  const [识别态, set识别态] = useState<识别态>('未识别');
  const [识别汇总, set识别汇总] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState('');
  // ② 与 ④ 各要一个"答过没有"的标记：朝向未确认 是一个合法答案，
  // 拿 值!==未确认 当"完成"会把默认值读成已完成，步条就变成替用户撒。
  const [朝向已答, set朝向已答] = useState(false);
  const [关心点, set关心点] = useState<Concern[]>([]);
  const [关心点已答, set关心点已答] = useState(false);
  // 「移除这张图」的二次确认：第一次点击只把按钮换成"确认移除"，第二次才清。
  const [要移除, set要移除] = useState(false);
  // 服务端入库的图 id：有它就意味着服务端有一份副本，移除时要调 DELETE。
  const [serverImageId, setServerImageId] = useState<string | null>(null);

  /** 回执一律走 Callout，档位是必填的第一个参数 —— 于是"忘了给档"在类型上就过不去，
   *  而不是所有消息都默认套一个红底（那正是这一批要修的毛病）。 */
  const say = (档: CalloutTier, 文: string) => setNotice({ 档, 文 });
  const dragRef = useRef<{ 种类: '房' | '墙'; id: string; 点: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 访客 id 就是这次上传的归属凭据（服务端按它落盘、按它取图），只能在客户端拿。
  useEffect(() => { setVisitorId(getVisitorId()); }, []);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

  const onPick = useCallback(async (file: File | undefined) => {
    if (!file) return;
    const v = await validateFloorplanFile(file);
    if (!v.ok) { say('danger', `已拒绝：${v.error}`); return; }
    // 字节在选图这一刻就读进内存：识别要的是同一份字节，事后从 objectURL 反_fetch_
    // 等于让预览这条显示路径变成上传路径的一部分，两件事不该耦合。
    const bytes = new Uint8Array(await file.arrayBuffer());
    const url = URL.createObjectURL(file);
    const aspect = await readImageAspect(url);
    setImage({ name: file.name, url, kind: v.kind, bytes, aspect });
    set识别态('未识别'); set识别汇总(null);
    say('info', `已读取本地预览（${v.kind}，${(file.size / 1024).toFixed(0)}KB）。勾选同意之前，这张图还在这台设备上。`);
  }, []);

  /** 移除这张图（缺陷④）。清的不止是图：几何、候选、朝向、同意勾选一起回第①步 ——
   *  只清图会留下一份"来自那张图"的几何在屏上，那正是用户以为已经毁掉的东西。
   *  objectURL 不用这里管：image 一变，上面那个 effect 就回收旧地址。 */
  const 移除这张图 = () => {
    if (!image) return;
    if (!要移除) {
      set要移除(true);
      say('pending', '再按一次「确认移除」才会丢掉这张图与在它上面改过的全部几何。这一步不可撤销：这一页不存草稿。');
      return;
    }
    if (serverImageId) {
      // 先删服务端那份：失败也不阻塞本地清空，但要如实提示（7 天内仍会保留）。
      const target = serverImageId;
      void fetch(`/api/fengshui/image/${target}`, { method: 'DELETE', headers: { 'x-visitor-id': visitorId } })
        .then(res => { if (!res.ok) say('danger', '页面已清空，但图片删除未能确认；主存储最长保留 7 天，备份副本最多再保留 7 天。'); })
        .catch(() => say('danger', '页面已清空，但图片删除未能确认；主存储最长保留 7 天，备份副本最多再保留 7 天。'));
      setServerImageId(null);
    }
    setImage(null); setGeom(emptyGeom()); set已确认(false);
    set选中(null); set选中墙(null); set视图('俯视');
    set朝向('未确认'); set朝向已答(false);
    set识别态('未识别'); set识别汇总(null);
    // 同意是"对这张图"给的，不跟着图走就等于替下一次上传预先同意。
    setConsent(false); set要移除(false);
    say('info', '已移除：图、几何、候选与朝向都清掉了，回到第①步。');
  };

  const recognize = useCallback(async () => {
    if (!image) { say('pending', '先选一张图。'); return; }
    if (!consent) { say('pending', '要先勾选同意，才能使用混沌自研 AI 辅助识别这张图。'); return; }
    if (recognizing) return;   // 双击不重发：一次识别已经花掉上游一分钟预算
    setRecognizing(true); set识别态('在识别'); setNotice(null);
    const fail = (line: string) => {
      set识别态('失败'); set识别汇总(null); say('danger', line + ' 这条不装作成功：几何可以用「手工画」或「载入合成样例」继续。');
    };
    try {
      const req = buildRecognizeRequest(visitorId, image.bytes, image.kind);
      if (!req.ok) { fail(req.reason); return; }
      let res: Response;
      try {
        res = await fetch(req.url, req.init);
      } catch {
        fail('混沌自研 AI 辅助识别暂时不可用，请稍后重试或手工绘制。');
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok) { fail(failReason(res.status, json)); return; }
      if (json === null) {
        fail('这次识别结果无法读取，请稍后重试或手工绘制。');
        return;
      }
      const parsed = parseRecognize(json, { spanM: RECOGNIZE_SPAN_M, aspect: image.aspect });
      if (!parsed.ok) { fail('这次识别结果不完整，请稍后重试或手工绘制。'); return; }
      setGeom(parsed.geom);
      set已确认(false); set视图('俯视'); set选中(null);
      set识别态('候选待确认');
      set识别汇总(候选汇总(parsed));
      say('pending', 候选提醒(parsed));
    } finally {
      setRecognizing(false);
    }
  }, [image, consent, recognizing, visitorId]);

  const plan = useMemo(() => planSvg(geom, CANVAS_W, CANVAS_H), [geom]);
  // 九宫格与门窗编号都从"规则层用的同一份算法"取：图上那格写着巽，依据里的巽才是同一格。
  const cells = useMemo(() => palaceCells(geom), [geom]);
  const tags = useMemo(() => openingTags(geom), [geom]);
  const translated = useMemo(() => toFloorInput(geom, 朝向, 已确认), [geom, 朝向, 已确认]);
  const report = useMemo(() => analyzeFloor(translated.输入 as never), [translated]);
  const walkable = useMemo(() => buildWalkGrid(geom, 0.25), [geom]);

  const span = useMemo(() => {
    const all = geom.房间.flatMap(r => r.外环).concat(geom.墙体.flatMap(w => w.折线));
    if (!all.length) return 0;
    return Math.max(Math.max(...all.map(p => p.x)) - Math.min(...all.map(p => p.x)),
      Math.max(...all.map(p => p.y)) - Math.min(...all.map(p => p.y)));
  }, [geom]);

  /** 拖角点。房与墙走同一套手柄语义，但改的是各自的折线，所以种类必须带在拖拽现场里
   *  —— 否则一次拖动能把墙的点写进房间，而画面看起来"也对"。 */
  const moveHandle = (d: { 种类: '房' | '墙'; id: string; 点: number }, p: Pt) => {
    const q = { x: round(p.x), y: round(p.y) };
    setGeom(g => (d.种类 === '房' ? moveRoomVertex(g, d.id, d.点, q) : moveWallVertex(g, d.id, d.点, q)));
  };

  const 删墙 = (id: string) => {
    const r = deleteWall(geom, id);
    setGeom(r.几何);
    if (选中墙 === id) set选中墙(null);
    say('info', r.连带删掉开口数
      ? `删掉了这道墙，挂在它上面的 ${r.连带删掉开口数} 个门窗也一起删了 —— 开口必须钉在一段墙上，没有墙就没有洞。`
      : '删掉了这道墙。');
  };

  const 加门窗 = (墙id: string, 类型: '门' | '窗') => {
    const id = uid('o-');
    setGeom(g => addOpening(g, id, 墙id, 类型));
    say('info', `已在墙上开了一个${类型}（宽 ${OPENING_LIMITS[类型].默认}m）。自己画的东西算已确认，置信度标"手工标注"。`);
  };

  const svgPoint = (e: React.PointerEvent<SVGSVGElement>): Pt | null => {
    const svg = e.currentTarget;
    const box = svg.getBoundingClientRect();
    const sx = CANVAS_W / box.width, sy = CANVAS_H / box.height;
    const f = plan.frame;
    return { x: (e.clientX - box.left) * sx / f.scale + plan.box.minX, y: (e.clientY - box.top) * sy / f.scale + plan.box.minY };
  };

  const sel = geom.房间.find(r => r.id === 选中) || null;
  const selWall = geom.墙体.find(w => w.id === 选中墙) || null;
  // 角点手柄是最后画的、压在标签上面，所以标签必须绕开它们（r=9 是 SVG 用户单位，
  // 与下面 <circle r={9}> 同一个数 —— 两处不一致的话，"让开"就是让了个假位置）。
  const handleBoxes = [
    ...(sel ? sel.外环.map(p => planProject(p, plan.frame, plan.box)) : []),
    ...(selWall ? selWall.折线.map(p => planProject(p, plan.frame, plan.box)) : []),
  ].map(h => ({ x: h.x, y: h.y, r: 9 }));
  /** 墙上没有可读的名字（识别回来的只有 墙N，手工加的是 w-N），所以列表一律按序号称呼。
   *  序号取自 墙体 数组本身，删掉一道墙后面的会自动改号 —— 不会出现"墙3"其实只有两道。 */
  const 墙名 = (id: string) => `墙 ${geom.墙体.findIndex(w => w.id === id) + 1}`;

  // 步条与探针读同一份推导（lib/fengshui/steps.ts）：状态算错，屏上那句"已完成"就是假的。
  const steps = stepStates({
    有图: !!image, 房间数: geom.房间.length, 开口数: geom.开口.length,
    朝向已答, 朝向, 关心点数: 关心点.length, 关心点已答, 已确认,
  });
  const 现在 = currentStep(steps);
  // 关心点只排序，不增删、不改结论 —— 这条不变式由套件直接喂函数验。
  const 排过 = orderNotes(report.判定, 关心点);

  return (
    <div className="qn-stack">
      <nav className="fp-steps" aria-label="户型标注的五步">
        <ol className="fp-steps__list">
          {steps.map(s => (
            <li key={s.n} className="fp-steps__item" data-state={s.状态}
              aria-current={s.n === 现在 ? 'step' : undefined}>
              <span className="fp-steps__no" aria-hidden="true">{'①②③④⑤'[s.n - 1]}</span>
              <span className="fp-steps__name">{s.名称}</span>
              <span className="fp-steps__state">{s.状态}</span>
            </li>
          ))}
        </ol>
        <p className="fp-steps__hint" id="fp-step-hint">第 {现在} 步 · {steps.find(s => s.n === 现在)?.提示}</p>
        {/* 隐私这一句在步条与①各出现一次（§8）：勾选框在图出来之后才渲染，
            没有这一行的话，用户在按下「选户型图」之前读不到任何告知。 */}
        <p className="fp-steps__privacy">
          上传可选，不上传也能走完全部判定。图不进入报告、回执与公开台账，
          主存储最长保留 7 天，备份副本最多再保留 7 天；可随时移除图片。
        </p>
      </nav>
      <div className="fp-step-block" id="fp-start">
        <p className="qn-axis">① 选图或手绘</p>
        <div className="qn-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="qn-btn qn-btn--ghost" style={{ minHeight: 44 }} onClick={() => fileRef.current?.click()}>
            选户型图
          </button>
        <input ref={fileRef} type="file" accept={ACCEPT_MIME.join(',')} style={{ display: 'none' }}
          onChange={e => onPick(e.target.files?.[0])} />
        {image && (
          <button type="button" id="fp-remove-image" className="qn-btn qn-btn--danger" style={{ minHeight: 44 }}
            aria-pressed={要移除} onClick={移除这张图}>
            {要移除 ? '确认移除' : '移除这张图'}
          </button>
        )}
        <button type="button" className="qn-btn qn-btn--ghost" style={{ minHeight: 44 }}
          onClick={() => { setGeom(starterGeometry()); set已确认(false); set识别态('未识别'); set识别汇总(null); set要移除(false); say('info', '已铺一个矩形外框与一道内隔墙，拖角点改成你家的样子。'); }}>
          手工画
        </button>
        {SYNTHETIC_FLOORPLANS.map(s => (
          <button key={s.名称} type="button" className="qn-btn qn-btn--ghost" style={{ minHeight: 44 }}
            onClick={() => { setGeom(s.几何); set已确认(false); set识别态('未识别'); set识别汇总(null); set要移除(false); say('info', `已载入合成样例「${s.名称}」：${s.用途说明} 这是本站自己造的数据，不是任何人的真实户型。`); }}>
            样例 · {s.名称}
          </button>
        ))}
        {image && (
          <button type="button" className="qn-btn qn-btn--solid" style={{ minHeight: 44 }}
            disabled={recognizing || !consent} onClick={recognize}>
            {recognizing ? '在识别' : '混沌自研 AI 识别'}
          </button>
        )}
        </div>
      </div>

      {/* 三态的可见落点：失败 / 候选待确认 / 已确认。data 属性是给探针钉的，
          文案是给用户读的，两者读同一个状态变量 —— 不允许只在一处成立。 */}
      <p className="qn-meta" id="fp-recognize-state" data-recognize-state={识别态} style={{ margin: '10px 0 0' }}>
        {识别态 === '未识别' && '识别：还没送过图。'}
        {识别态 === '在识别' && '识别：混沌自研 AI 正在提取墙、门、窗候选位置。'}
        {识别态 === '失败' && '识别：失败。原因见下面那行。'}
        {识别态 === '候选待确认' && `识别：${识别汇总}。${已确认 ? '已确认，可以进 3D 与判定。' : '待你逐条确认。'}`}
      </p>

      {image && (
        <div className="qn-card" style={{ padding: 10 }}>
          {/* 预览图是用户自己的图纸：只在本机 objectURL 里显示，不上传、不进任何记录。 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt="所选户型图本地预览" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 6 }} />
          <label className="qn-note" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 8, cursor: 'pointer' }}>
            <input id="fp-consent" type="checkbox" style={{ width: 44, height: 44, flex: '0 0 auto', margin: 0, display: 'grid', placeItems: 'center' }}
              checked={consent} onChange={e => setConsent(e.target.checked)} />
            <span>我同意将这张户型图用于混沌自研 AI 辅助识别，提取墙、门、窗的候选位置。
              <span className="qn-note" style={{ display: 'block', marginTop: 2 }}>
                图不进入报告、回执与公开台账；主存储最长保留 7 天，备份副本最多再保留 7 天。
                移除图片会删除主存储副本。识别出来的东西只是候选，
                要你逐条确认过才算输入。
              </span>
            </span>
          </label>
        </div>
      )}

      {notice && <Callout tier={notice.档} id="fp-notice">{notice.文}</Callout>}

      {/* ② 定朝向。排在编辑器前面是按 §8 的步序；朝向不 disabled ——
          一个"看着能点、点了没反应"的控件比一个能点的更坏，而朝向本来就不依赖几何存在。 */}
      <div className="fp-step-block" id="fp-orientation">
        <p className="qn-axis">② 定朝向</p>
        <div className="qn-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {([...FACING_LIST, '未确认'] as const).map(k => (
            <button key={k} type="button" id={`fp-facing-${k}`}
              className={`qn-chip${朝向 === k ? ' qn-chip--on' : ''}`} style={{ minHeight: 44, minWidth: 44, borderRadius: 0 }}
              aria-pressed={朝向 === k}
              onClick={() => { set朝向(k); set朝向已答(true); }}>{k === '未确认' ? '朝向未确认' : `朝${k}`}</button>
          ))}
        </div>
        <p className="qn-note" style={{ margin: '6px 0 0' }}>
          {朝向已答
            ? `已答：${朝向}。` + (朝向 === '未确认' ? ' 结果段会明写"未据朝向判定"。' : '')
            : '没有把握就按「朝向未确认」—— 那是一个答案，不是没答。'}
        </p>
      </div>

      {geom.房间.length > 0 && (
        <>
          <p className="qn-axis" id="fp-editor-heading" style={{ marginTop: 14 }}>③ 标房间与门窗</p>
          <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} style={{ width: '100%', height: 'auto', marginTop: 12, touchAction: 'none', background: 'var(--color-bg-card)', borderRadius: 10, border: 'var(--qn-hairline)' }}
            onPointerMove={e => { const d = dragRef.current; if (!d) return; const p = svgPoint(e); if (p) moveHandle(d, p); }}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerLeave={() => { dragRef.current = null; }}>
            {/* 九宫底格：格子与宫名都取自 palaceCells（规则层算宫位用的就是这一份），
                所以"依据说巽宫"和"图上那格写着巽"必然是同一格。整组不吃指针事件，
                否则会把角点手柄盖住 —— 手柄要能拖。 */}
            <g data-fp="grid" pointerEvents="none">
              {(cells || []).map(c => {
                const a = planProject({ x: c.minX, y: c.minY }, plan.frame, plan.box);
                const b = planProject({ x: c.maxX, y: c.maxY }, plan.frame, plan.box);
                return (
                  <g key={`cell-${c.宫}`}>
                    <rect x={a.x} y={a.y} width={b.x - a.x} height={b.y - a.y}
                      fill="none" stroke="var(--color-hairline)" strokeWidth={0.8} strokeDasharray="3 4" />
                    <text x={a.x + 4} y={a.y + 12} fontSize={11} fill="var(--color-text-secondary)"
                      data-fp="palace" id={`fp-palace-${c.宫}`}>
                      <title>{`九宫 · ${c.宫}`}</title>
                      {c.宫}
                    </text>
                  </g>
                );
              })}
            </g>
            {plan.房间.map(r => (
              <polygon key={r.id} points={r.points} fill={r.id === 选中 ? 'rgba(178,149,93,.14)' : 'rgba(120,120,130,.07)'}
                stroke="var(--color-text-secondary)" strokeWidth={1.2}
                onClick={() => set选中(r.id)} style={{ cursor: 'pointer' }} />
            ))}
            {plan.墙.map(w => (
              <polyline key={w.id} points={w.points} fill="none" stroke="var(--color-text-primary)"
                strokeWidth={2.5} strokeLinejoin="round" />
            ))}
            {geom.开口.map(o => {
              const w = geom.墙体.find(x => x.id === o.墙); if (!w) return null;
              // 段→端点的解释只有一处（geometry.openingSegment）：2D、等轴、3D、判定读同一份几何。
              const seg = openingSegment(o, w); if (!seg) return null;
              const [a, b] = seg;
              const len = Math.hypot(b.x - a.x, b.y - a.y); const half = len ? (o.宽 / 2) / len : 0;
              const lo = Math.max(0, o.位 - half), hi = Math.min(1, o.位 + half);
              const f = plan.frame;
              const P = (t: number) => planProject({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, f, plan.box);
              const p0 = P(lo), p1 = P(hi);
              // 未确认不画红（运维 2026-10-22 裁定：红留给真正非法的输入，未确认是"等你处理"），
              // 也不靠颜色区分两态：形状走虚线、文字走下面那行图例与门窗那一排的 chip。
              return <line key={o.id} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y}
                stroke="var(--color-accent-gold-text)" strokeWidth={4} strokeLinecap="round"
                strokeDasharray={o.已确认 ? undefined : '7 5'} />;
            })}
            {/* 房间名与门窗编号画在几何之上、手柄之下（手柄是最后画的，压得住）。
                这一组是"依据指回图上"的那一半：规则层说「客厅 标在 巽」，
                图上就得同时有「客厅」这个字和「巽」这一格。 */}
            <g data-fp="labels" pointerEvents="none">
              {plan.房间.map(r => (
                <text key={`name-${r.id}`} x={r.cx} y={r.cy} fontSize={11} textAnchor="middle"
                  fill="var(--color-text-primary)" data-name={r.名称} data-fp="room" id={`fp-room-${r.id}`}>
                  <title>{`房间：${r.名称}`}</title>
                  {r.名称}
                </text>
              ))}
              {geom.开口.map(o => {
                const w = geom.墙体.find(x => x.id === o.墙); if (!w) return null;
                const seg = openingSegment(o, w); if (!seg) return null;
                const [a, b] = seg;
                const f = plan.frame;
                const mid = planProject({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, f, plan.box);
                const at = placeTag(mid, handleBoxes);
                return (
                  <text key={`tag-${o.id}`} x={at.x} y={at.y}
                    fontSize={11} textAnchor="middle" data-tag={tagOf(tags, o)}
                    fill="var(--color-accent-gold-text)" data-fp="opening-tag" id={`fp-tag-${o.id}`}>
                    <title>{`${tagOf(tags, o)}：${o.类型}，宽 ${Math.round(o.宽 * 100) / 100}m，${o.已确认 ? '已确认' : '还没确认'}`}</title>
                    {tagOf(tags, o)}
                  </text>
                );
              })}
            </g>
            {/* 角点只在选中的那一间上出现：一间房的顶点相距至少 1m，44px 手柄不会互相盖住。 */}
            {sel && sel.外环.map((p, i) => {
              const q = planProject(p, plan.frame, plan.box);
              return <circle key={`${sel.id}-${i}`} cx={q.x} cy={q.y} r={9} fill="var(--color-bg-card)"
                stroke="var(--color-accent-gold-text)" strokeWidth={2} style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); dragRef.current = { 种类: '房', id: sel.id, 点: i }; }}
                aria-label={`拖动 ${sel.名称} 的第 ${i + 1} 个角点`} />;
            })}
            {/* 墙端点的手柄只给选中的那道墙。墙本身不做点击目标：一条 2.5px 的线在
               44px 命中区这一关过不去，所以选墙走下面那张卡里的 chip（真按钮、够大）。 */}
            {selWall && selWall.折线.map((p, i) => {
              const q = planProject(p, plan.frame, plan.box);
              return <circle key={`${selWall.id}-v${i}`} cx={q.x} cy={q.y} r={9} fill="var(--color-bg-card)"
                stroke="var(--color-accent-gold-text)" strokeWidth={2} style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); dragRef.current = { 种类: '墙', id: selWall.id, 点: i }; }}
                aria-label={`拖动 ${墙名(selWall.id)} 的第 ${i + 1} 个端点`} />;
            })}
          </svg>

          <div className="qn-row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <button type="button" className="qn-btn qn-btn--quiet" style={{ minHeight: 44 }}
              onClick={() => setGeom(g => ({ ...g, 房间: g.房间.map(r => (r.id === 选中 ? { ...r, 外环: r.外环.slice(0, -1) } : r)) }))}
              disabled={!sel || (sel?.外环.length ?? 0) <= 3}>少一个角点</button>
            <button type="button" className="qn-btn qn-btn--quiet" style={{ minHeight: 44 }}
              onClick={() => setGeom(g => ({
                ...g,
                房间: g.房间.map(r => (r.id === 选中 ? { ...r, 外环: [...r.外环, { x: round(r.外环[0].x + 0.5), y: round(r.外环[0].y + 0.5) }] } : r)),
              }))}
              disabled={!sel}>多一个角点</button>
            <button type="button" className="qn-btn qn-btn--quiet" style={{ minHeight: 44 }}
              onClick={() => setGeom(g => ({ ...g, 房间: g.房间.filter(r => r.id !== 选中) }))}
              disabled={!sel}>删掉这一间</button>
            <button type="button" className="qn-btn qn-btn--quiet" style={{ minHeight: 44 }}
              onClick={() => {
                const id = uid('r-');
                setGeom(g => ({ ...g, 房间: [...g.房间, { id, 名称: `房间 ${g.房间.length + 1}`, 用途: '储物', 外环: [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 1, y: 3 }] }] }));
                set选中(id);
              }}>加一间房</button>
          </div>

          {/* 用途与名称：识别回来的房间有一半叫"房间N"（用途只能先记储物），
              而"厨卫相邻""私密区"那几条判据读的就是用途。没有这一排 chip，页面那句
              "请逐间改对"就是一句做不到的承诺。 */}
          <div className="qn-card" style={{ marginTop: 10 }}>
            <p className="qn-axis">这一间的名称与用途{sel ? `（已选：${sel.名称}）` : '（先在俯视图里点一间房）'}</p>
            <div className="qn-row" style={{ gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
              <label htmlFor="fp-room-name" className="qn-meta" style={{ minWidth: 44 }}>名称</label>
              <input id="fp-room-name" type="text" maxLength={12} value={sel?.名称 ?? ''} disabled={!sel}
                style={{ minHeight: 44, flex: '1 1 140px', padding: '0 10px', borderRadius: 8, border: 'var(--qn-hairline)' }}
                onChange={e => { if (选中) setGeom(g => setRoomName(g, 选中, e.target.value)); }} />
            </div>
            <div className="qn-row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {ROOM_KINDS.map(k => (
                <button key={k} type="button" id={`fp-kind-${k}`}
                  className={`qn-chip${sel?.用途 === k ? ' qn-chip--on' : ''}`}
                  style={{ minHeight: 44, minWidth: 44, borderRadius: 0 }} disabled={!sel}
                  onClick={() => { if (选中) setGeom(g => setRoomKind(g, 选中, k)); }}>{k}</button>
              ))}
            </div>
            <p className="qn-note" style={{ margin: '8px 0 0' }}>用途决定它进不进"厨卫相邻""私密区"那几条判定；认不准就先照着改，改完这一条才算你的输入。</p>
          </div>

          {/* 墙体：加墙 / 选墙 / 删墙 / 在墙上开门窗。墙本身不做点击目标（2.5px 的线过不了
              44px 命中区这一关），所以选墙走这里的 chip。 */}
          <div className="qn-card" id="fp-walls" style={{ marginTop: 10 }}>
            <p className="qn-axis">墙体（{geom.墙体.length} 道）</p>
            {geom.墙体.map(w => {
              const 段数 = w.闭合 ? w.折线.length : Math.max(0, w.折线.length - 1);
              const 长 = Math.round(w.折线.reduce((s, p, i) => (i ? s + Math.hypot(p.x - w.折线[i - 1].x, p.y - w.折线[i - 1].y) : 0), 0) * 10) / 10;
              const 名下 = geom.开口.filter(o => o.墙 === w.id).length;
              return (
                <div key={w.id} className="qn-row" style={{ gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                  <button type="button" id={`fp-wall-${墙名(w.id).replace(' ', '')}`}
                    className={`qn-chip${选中墙 === w.id ? ' qn-chip--on' : ''}`}
                    style={{ minHeight: 44, minWidth: 44, borderRadius: 0 }}
                    onClick={() => set选中墙(选中墙 === w.id ? null : w.id)}>{墙名(w.id)}</button>
                  <span className="qn-meta">{段数} 段 · 折线长 {长}m · 挂 {名下} 个门窗</span>
                  <button type="button" className="qn-btn qn-btn--quiet" style={{ minHeight: 44, marginLeft: 'auto' }}
                    onClick={() => 加门窗(w.id, '门')}>加门</button>
                  <button type="button" className="qn-btn qn-btn--quiet" style={{ minHeight: 44 }}
                    onClick={() => 加门窗(w.id, '窗')}>加窗</button>
                  <button type="button" className="qn-btn qn-btn--quiet" style={{ minHeight: 44 }}
                    onClick={() => 删墙(w.id)}>删墙</button>
                </div>
              );
            })}
            <div className="qn-row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button type="button" id="fp-add-wall" className="qn-btn qn-btn--quiet" style={{ minHeight: 44 }}
                onClick={() => { const id = uid('w-'); setGeom(g => addWall(g, id)); set选中墙(id); say('info', '加了一道贯通包围盒的隔墙，拖它的金色端点摆正。'); }}>加一道墙</button>
              {selWall && <span className="qn-meta">已选 {墙名(selWall.id)}：图上那两个金色端点可以拖。</span>}
            </div>
          </div>

          {/* 视图切换：俯视=编辑用，等轴=降级看，3D=主看。三者读的是同一个 FloorGeometry，
              所以"降级图和 3D 长得不一样"这种错在这一页不可能出现。 */}
          <div className="qn-row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {(['俯视', '等轴', '3D'] as const).map(k => (
              <button key={k} type="button" className={`qn-chip${视图 === k ? ' qn-chip--on' : ''}`}
                style={{ minHeight: 44, minWidth: 44, borderRadius: 0 }} disabled={k === '3D' && !已确认}
                title={k === '3D' && !已确认 ? '几何确认之后才进 3D' : undefined}
                onClick={() => { if (k !== '3D' || 已确认) set视图(k); }}>{k}</button>
            ))}
            {视图 !== '3D' && !已确认 && (
              <span className="qn-meta">勾了「我自己核对过」才进 3D：没确认的几何先别变成一面立体的墙。</span>
            )}
            {视图 === '3D' && 舞台?.kind === 'ready' && (
              <span className="qn-meta">首帧 {舞台.首帧毫秒}ms · 粒子 {舞台.粒子数} 个</span>
            )}
          </div>

          {/* 降级的原因必须留在父层：3D 一降级就整个卸载，把话说在它自己肚子里等于没说。
              裁定里"降级要可见"要的是这一行，不是切换成功这件事本身。 */}
          {舞台说明 && <Callout tier="info" id="fp-stage-note">{舞台说明}</Callout>}

          {视图 === '俯视' && (
            <p className="qn-note" id="fp-legend" style={{ marginTop: 6 }}>
              俯视图用来核对几何：点一间房选中它，再拖角点。
              门窗画在墙上 —— <b>实线 = 已确认，虚线 = 还没确认</b>（下面那一排的「未确认」按钮点一下就变实线）。
              形状与文字各说一遍，不靠颜色说话。
            </p>
          )}

          {视图 === '等轴' && (
            <svg viewBox="0 0 720 420" style={{ width: '100%', height: 'auto', marginTop: 10, borderRadius: 10, background: 'var(--color-fp-stage-bg)' }}
              role="img" aria-label="户型等轴测示意图">
              {isoSvg(geom, 720, 420).faces.map(f => (
                <polygon key={`${f.kind}-${f.id}`} points={f.points}
                  fill={f.kind === 'wall' ? 'var(--color-fp-stage-wall)' : f.kind === 'room' ? 'var(--color-fp-stage-floor)' : 'var(--color-fp-stage-open)'}
                  stroke={f.kind === 'wall' ? 'var(--color-fp-stage-line)' : 'none'} strokeWidth={0.6} />
              ))}
            </svg>
          )}

          {视图 === '3D' && (
            <FloorPlan3D 几何={geom} onStatus={s => {
              set舞台(s);
              if (s.kind === 'degraded') { set舞台说明(`已改用等轴测平面图：${s.原因}`); set视图('等轴'); }
              else if (s.kind === 'throttled') set舞台说明(s.说明);
              else set舞台说明(null);
            }} />
          )}

          {/* id 是给探针划的界：这一页下面还收着一份降级用的九宫格表单，它自己也有
              「未确认」chip。不划界的话 hidden <details> 里的东西会被一起数进去。 */}
          <div className="qn-card" id="fp-openings" style={{ marginTop: 12 }}>
            <p className="qn-axis">门窗（识别来的都标着未确认）</p>
            {geom.开口.length === 0 && <p className="qn-note" style={{ margin: '6px 0 0' }}>一个开口都没标：采光、对流与动线三类判定都会写成"缺输入"，不猜。要补的话，在下面「墙体」那一格里对着某道墙按「加门」「加窗」。</p>}
            {geom.开口.map(o => (
              <div key={o.id} id={`fp-opening-${o.id}`} className="qn-row" style={{ gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                {/* 图上那个 D1/W2 与这里同一支：编号只由 openingTags() 发一次。 */}
                <span className="qn-meta" id={`fp-opening-tag-${o.id}`} style={{ minWidth: 28, fontVariantNumeric: 'tabular-nums' }}>
                  {tagOf(tags, o)}
                </span>
                <button type="button" className="qn-chip" style={{ minHeight: 48, minWidth: 48, borderRadius: 0 }}
                  onClick={() => setGeom(g => toggleOpeningKind(g, o.id))}
                  title="点一下换成另一种：宽度会按新类型重新夹">
                  {o.类型}
                </button>
                <button type="button" className="qn-chip" style={{ minHeight: 44, minWidth: 44, borderRadius: 0 }}
                  onClick={() => setGeom(g => setOpeningConfirmed(g, o.id, !o.已确认))}>
                  {o.已确认 ? '已确认' : '未确认'}
                </button>
                <span className="qn-meta">{墙名(o.墙)} · 宽 {Math.round(o.宽 * 100) / 100}m · 位置 {Math.round(o.位 * 100)}% · {o.置信度 == null ? '手工标注' : confidenceText(o.置信度).文本}</span>
                <button type="button" className="qn-btn qn-btn--quiet" style={{ minHeight: 48, minWidth: 48, borderRadius: 0, padding: '0 8px' }}
                  onClick={() => setGeom(g => shiftOpening(g, o.id, -1))} aria-label={`把 ${o.类型} 沿墙往一头挪`}>◀</button>
                <button type="button" className="qn-btn qn-btn--quiet" style={{ minHeight: 48, minWidth: 48, borderRadius: 0, padding: '0 8px' }}
                  onClick={() => setGeom(g => shiftOpening(g, o.id, 1))} aria-label={`把 ${o.类型} 沿墙往另一头挪`}>▶</button>
                <button type="button" className="qn-btn qn-btn--quiet" style={{ minHeight: 48, minWidth: 48, borderRadius: 0, padding: '0 8px' }}
                  onClick={() => setGeom(g => resizeOpening(g, o.id, -1))} aria-label={`${o.类型} 变窄`}>窄</button>
                <button type="button" className="qn-btn qn-btn--quiet" style={{ minHeight: 48, minWidth: 48, borderRadius: 0, padding: '0 8px' }}
                  onClick={() => setGeom(g => resizeOpening(g, o.id, 1))} aria-label={`${o.类型} 变宽`}>宽</button>
                <button type="button" className="qn-btn qn-btn--quiet" style={{ minHeight: 48, minWidth: 48, marginLeft: 'auto' }}
                  onClick={() => setGeom(g => deleteOpening(g, o.id))}>删</button>
              </div>
            ))}
          </div>

          {/* ④ 关心点。这一格只决定"先讲哪几段"，一条判定都不增删 ——
              orderNotes 是纯排序，套件直接喂函数验这条不变式（勾选前后集合逐条相等）。 */}
          <div className="fp-step-block" id="fp-concerns">
            <p className="qn-axis">④ 说你最在意什么（可跳过）</p>
            <div className="qn-row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {CONCERNS.map(c => (
                <button key={c} type="button" id={`fp-concern-${c}`}
                  className={`qn-chip${关心点.includes(c) ? ' qn-chip--on' : ''}`}
                  style={{ minHeight: 44, minWidth: 44, borderRadius: 0 }} aria-pressed={关心点.includes(c)}
                  onClick={() => { set关心点(p => (p.includes(c) ? p.filter(x => x !== c) : [...p, c])); set关心点已答(true); }}>{c}</button>
              ))}
              <button type="button" id="fp-concern-skip" className="qn-chip" style={{ minHeight: 44 }}
                aria-pressed={关心点已答 && 关心点.length === 0}
                onClick={() => { set关心点([]); set关心点已答(true); }}>先跳过</button>
            </div>
            <p className="qn-note" style={{ margin: '6px 0 0' }}>
              {关心点已答
                ? (关心点.length ? `已选 ${关心点.length} 项：只把相关的几段排前面，判定的条数与内容一条不变。` : '已跳过：按规则层自己的次序讲。')
                : '选哪几项都不会多出一条判定，也不会少一条；不选就按几何本身讲。'}
            </p>
          </div>

          <label className="qn-note" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 12, cursor: 'pointer' }}>
            <input id="fp-confirm" type="checkbox" style={{ width: 44, height: 44, flex: '0 0 auto', margin: 0, display: 'grid', placeItems: 'center' }}
              checked={已确认} onChange={e => set已确认(e.target.checked)} />
            <span>上面每一项几何与门窗都是我自己核对过的，可以让规则层据此判定。
              <span className="qn-note" style={{ display: 'block', marginTop: 2 }}>
                不勾就只出提示不出判定。识别结果没确认就下结论，等于把自动识别结果当成用户的事实。
              </span>
            </span>
          </label>

          <div style={{ marginTop: 12 }}>
            <FloorReportView report={report} 判定={排过.排序后} 跨宫={translated.跨宫}
              关心点={关心点} 朝向={朝向}
              格数={walkable ? `${walkable.列}×${walkable.行}` : '无'} 跨度={span} />
            <ToolInterpretation tool="fengshui" title="户型九宫 · 混沌自研 AI 解读"
              payload={{ 判定: report.判定, 未判定: report.未判定, 跨宫: translated.跨宫,
                朝向, 关心点, 格数: walkable ? `${walkable.列}×${walkable.行}` : '无', 跨度: span }} />
            <p className="qn-note" style={{ marginTop: 12 }}>
              以上观察依据你标注的墙体、房间、门窗与朝向，不代表传统方位吉凶。本页规则由本站自研，目前不作八宅、玄空等传统方位判断。
            </p>
          </div>
        </>
      )}
      {geom.房间.length === 0 && (
        <p className="qn-note" style={{ marginTop: 12 }}>还没有几何：先「手工画」或「载入合成样例」，也可以上传户型图，让混沌自研 AI 辅助识别。</p>
      )}
    </div>
  );
}


function FloorReportView({ report, 判定, 跨宫, 关心点, 朝向, 格数, 跨度 }: {
  report: ReturnType<typeof analyzeFloor>; 判定: ReturnType<typeof analyzeFloor>['判定'];
  跨宫: string[]; 关心点: Concern[]; 朝向: FacingInput; 格数: string; 跨度: number;
}) {
  const over = 跨度 > MAX_SPAN_M;
  return (
    <section className="qn-card" aria-live="polite">
      <p className="qn-axis">⑤ 户型观察结果</p>
      <p className="qn-meta" style={{ marginTop: 4 }}>可行走网格 {格数} 格（0.25m 步长），最大跨度 {Math.round(跨度 * 10) / 10}m。</p>
      {/* §8 钉着的一句：朝向没确认，结果段就得自己说"这一层没据朝向判"。
          规则层把它写在「没判定的部分」里，但那一块只有非空时才渲染，
          所以这里再明写一次 —— 读结果的人不该往下翻才知道结论少了一层依据。 */}
      {朝向 === '未确认' && (
        <p className="qn-note" id="fp-facing-flag" style={{ margin: '6px 0 0' }}>
          未据朝向判定：下面这些结论只建立在几何上（相邻、对宫、通路、同宫），没有一条用到日照方位。
        </p>
      )}
      {关心点.length > 0 && (
        <p className="qn-meta" style={{ marginTop: 4 }}>按你选的关心点（{关心点.join('、')}）把相关的几段排了前面；判定条数与内容不受影响。</p>
      )}
      {over && <Callout tier="danger" id="fp-span-alert">跨度超过 {MAX_SPAN_M}m：3D 的相机与阴影范围会失控，请先把它缩小或只画一部分。</Callout>}
      {跨宫.length > 0 && (
        <p className="qn-note" style={{ marginTop: 6 }}>有 {跨宫.length} 间房与九宫的最大重叠不足六成（{跨宫.join('、')}），下面凡是提到这些宫的结论都只作参考。</p>
      )}
      <ul className="qn-meta" style={{ margin: '8px 0 0', paddingLeft: '1.1em' }}>
        {report.输入摘要.map(x => <li key={x}>{x}</li>)}
      </ul>
      {判定.length === 0 && <p className="qn-body" style={{ marginTop: 10 }}>这一组输入没有推出任何判定。</p>}
      {判定.map((n, i) => (
        <div key={`${n.规则}-${i}`} style={{ marginTop: 12, borderTop: 'var(--qn-hairline)', paddingTop: 10 }}>
          <p className="qn-title" style={{ margin: 0, fontSize: 'var(--qn-fs-title)' }}>{n.规则}</p>
          <p className="qn-body" style={{ marginTop: 4 }}>{n.结论}</p>
          <p className="qn-meta" style={{ marginTop: 4 }}>依据：{n.依据.join('；')}</p>
          <p className="qn-note" style={{ marginTop: 2 }}>说不准的：{n.不确定项.join('；')}</p>
        </div>
      ))}
      {report.未判定.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p className="qn-axis">没判定的部分</p>
          <ul className="qn-meta" style={{ margin: '6px 0 0', paddingLeft: '1.1em' }}>
            {report.未判定.map(x => <li key={x}>{x}</li>)}
          </ul>
        </div>
      )}
      <p className="qn-note" style={{ marginTop: 12 }}>
        以上观察依据你标注的墙体、房间、门窗与朝向，不代表传统方位吉凶。本页规则由本站自研，目前不作八宅、玄空等传统方位判断。
      </p>
    </section>
  );
}

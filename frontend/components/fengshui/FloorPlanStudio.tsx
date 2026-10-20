'use client';

// 户型工作室（东方）：上传 → 识别候选 → 2D 人工确认 → 交给几何层与规则层。
//
// 三条不能含糊的口径：
//  1. 识别只是**候选**。没有人工确认过的墙、房间、门窗，一律不参与判定，也不进 3D。
//     自动下结论是这一页最容易做错的事：识别错一堵墙，穿堂煞就从"没有"变成"有"。
//  2. 上传的图只用于识别，不进报告、不进回执、不进台账，也不写进任何公开数据。
//     服务端存储与 7 天自动删由运维负责，这一层只负责：本地校验、显式告知、勾选同意。
//  3. 识别服务还没上线时，页面必须**明说**并给出一条能走通的路（手工画 / 合成样例），
//     而不是转圈、报"网络错误"，或者假装算出来了。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { analyzeFloor } from '@/lib/fengshui/analysis';
import { MAX_SPAN_M, buildWalkGrid, toFloorInput } from '@/lib/fengshui/geometry';
import type { FloorGeometry, Opening, Pt, RoomShape, Wall } from '@/lib/fengshui/geometry';
import { isoSvg, planProject, planSvg } from '@/lib/fengshui/svg';
import { SYNTHETIC_FLOORPLANS } from '@/lib/fengshui/synthetic';
import { ACCEPT_MIME, validateFloorplanFile } from '@/lib/fengshui/upload';
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

export default function FloorPlanStudio() {
  const [geom, setGeom] = useState<FloorGeometry>(emptyGeom);
  const [朝向, set朝向] = useState<'南' | '北' | '未确认'>('未确认');
  const [已确认, set已确认] = useState(false);
  const [选中, set选中] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [视图, set视图] = useState<'俯视' | '等轴' | '3D'>('俯视');
  const [舞台, set舞台] = useState<StageStatus | null>(null);
  const [舞台说明, set舞台说明] = useState<string | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [image, setImage] = useState<{ name: string; url: string; kind: string } | null>(null);
  const dragRef = useRef<{ 房: string; 点: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

  const onPick = useCallback(async (file: File | undefined) => {
    if (!file) return;
    const v = await validateFloorplanFile(file);
    if (!v.ok) { setNotice(`已拒绝：${v.error}`); return; }
    setImage({ name: file.name, url: URL.createObjectURL(file), kind: v.kind });
    setNotice(`已读取本地预览（${v.kind}，${(file.size / 1024).toFixed(0)}KB）。图片没有离开这台设备。`);
  }, []);

  const recognize = useCallback(async () => {
    if (!image || !consent) { setNotice('要先勾选同意，才能把图送给模型。'); return; }
    setRecognizing(true);
    try {
      const form = new FormData();
      form.append('floorplan', new Blob([await (await fetch(image.url)).arrayBuffer()], { type: image.kind === 'jpg' ? 'image/jpeg' : `image/${image.kind}` }), image.name);
      const res = await fetch('/api/fengshui/recognize', { method: 'POST', body: form });
      const data = await res.json().catch(() => null) as { 候选?: FloorGeometry } | null;
      if (!res.ok || !data?.候选) {
        setNotice(`识别服务还没上线（服务端返回 ${res.status}）。先用「手工画」或「载入合成样例」，几何与判定这条链是通的。`);
      } else {
        setGeom({ ...data.候选, 开口: data.候选.开口.map(o => ({ ...o, 已确认: false })) });
        setNotice('候选已载入。每一项都要你逐条确认，没确认的一律不参与判定。');
      }
    } catch {
      setNotice('识别请求没发出去（服务未部署）。这条不装作成功：用「手工画」继续。');
    } finally {
      setRecognizing(false);
    }
  }, [image, consent]);

  const plan = useMemo(() => planSvg(geom, CANVAS_W, CANVAS_H), [geom]);
  const translated = useMemo(() => toFloorInput(geom, 朝向, 已确认), [geom, 朝向, 已确认]);
  const report = useMemo(() => analyzeFloor(translated.输入 as never), [translated]);
  const walkable = useMemo(() => buildWalkGrid(geom, 0.25), [geom]);

  const span = useMemo(() => {
    const all = geom.房间.flatMap(r => r.外环).concat(geom.墙体.flatMap(w => w.折线));
    if (!all.length) return 0;
    return Math.max(Math.max(...all.map(p => p.x)) - Math.min(...all.map(p => p.x)),
      Math.max(...all.map(p => p.y)) - Math.min(...all.map(p => p.y)));
  }, [geom]);

  const moveVertex = (房id: string, idx: number, p: Pt) => setGeom(g => ({
    ...g,
    房间: g.房间.map(r => r.id === 房id ? { ...r, 外环: r.外环.map((q, i) => (i === idx ? { x: round(p.x), y: round(p.y) } : q)) } : r),
  }));

  const svgPoint = (e: React.PointerEvent<SVGSVGElement>): Pt | null => {
    const svg = e.currentTarget;
    const box = svg.getBoundingClientRect();
    const sx = CANVAS_W / box.width, sy = CANVAS_H / box.height;
    const f = plan.frame;
    return { x: (e.clientX - box.left) * sx / f.scale + plan.box.minX, y: (e.clientY - box.top) * sy / f.scale + plan.box.minY };
  };

  const sel = geom.房间.find(r => r.id === 选中) || null;

  return (
    <div className="qn-stack">
      <div className="qn-row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="qn-btn qn-btn--ghost" style={{ minHeight: 44 }} onClick={() => fileRef.current?.click()}>
          选户型图
        </button>
        <input ref={fileRef} type="file" accept={ACCEPT_MIME.join(',')} style={{ display: 'none' }}
          onChange={e => onPick(e.target.files?.[0])} />
        <button type="button" className="qn-btn qn-btn--ghost" style={{ minHeight: 44 }}
          onClick={() => { setGeom(starterGeometry()); set已确认(false); setNotice('已铺一个矩形外框与一道内隔墙，拖角点改成你家的样子。'); }}>
          手工画
        </button>
        {SYNTHETIC_FLOORPLANS.map(s => (
          <button key={s.名称} type="button" className="qn-btn qn-btn--ghost" style={{ minHeight: 44 }}
            onClick={() => { setGeom(s.几何); set已确认(false); setNotice(`已载入合成样例「${s.名称}」：${s.用途说明} 这是本站自己造的数据，不是任何人的真实户型。`); }}>
            样例 · {s.名称}
          </button>
        ))}
        {image && (
          <button type="button" className="qn-btn qn-btn--solid" style={{ minHeight: 44 }}
            disabled={recognizing || !consent} onClick={recognize}>
            {recognizing ? '在识别' : '送给模型提候选'}
          </button>
        )}
      </div>

      {image && (
        <div className="qn-card" style={{ padding: 10 }}>
          {/* 预览图是用户自己的图纸：只在本机 objectURL 里显示，不上传、不进任何记录。 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt="所选手型图本地预览" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 6 }} />
          <label className="qn-note" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 8, cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 44, height: 44, flex: '0 0 auto', margin: 0, display: 'grid', placeItems: 'center' }}
              checked={consent} onChange={e => setConsent(e.target.checked)} />
            <span>我同意把这张户型图送给视觉模型提取墙、门、窗的候选位置。
              <span className="qn-note" style={{ display: 'block', marginTop: 2 }}>
                图不进入报告、回执与公开台账；服务端只按本人标识可取，7 天后自动删。识别出来的东西只是候选，
                要你逐条确认过才算输入。
              </span>
            </span>
          </label>
        </div>
      )}

      {notice && <p className="qn-alert" role="status" style={{ margin: '12px 0 0' }}>{notice}</p>}

      {geom.房间.length > 0 && (
        <>
          <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} style={{ width: '100%', height: 'auto', marginTop: 12, touchAction: 'none', background: 'var(--color-bg-card)', borderRadius: 10, border: 'var(--qn-hairline)' }}
            onPointerMove={e => { const d = dragRef.current; if (!d) return; const p = svgPoint(e); if (p) moveVertex(d.房, d.点, p); }}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerLeave={() => { dragRef.current = null; }}>
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
              const a = w.折线[o.段], b = w.折线[o.段 + 1]; if (!a || !b) return null;
              const len = Math.hypot(b.x - a.x, b.y - a.y); const half = len ? (o.宽 / 2) / len : 0;
              const lo = Math.max(0, o.位 - half), hi = Math.min(1, o.位 + half);
              const f = plan.frame;
              const P = (t: number) => planProject({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, f, plan.box);
              const p0 = P(lo), p1 = P(hi);
              return <line key={o.id} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y}
                stroke={o.已确认 ? 'var(--color-accent-gold-text)' : 'var(--color-danger)'} strokeWidth={4} strokeLinecap="round" />;
            })}
            {/* 角点只在选中的那一间上出现：一间房的顶点相距至少 1m，44px 手柄不会互相盖住。 */}
            {sel && sel.外环.map((p, i) => {
              const q = planProject(p, plan.frame, plan.box);
              return <circle key={`${sel.id}-${i}`} cx={q.x} cy={q.y} r={9} fill="var(--color-bg-card)"
                stroke="var(--color-accent-gold-text)" strokeWidth={2} style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); dragRef.current = { 房: sel.id, 点: i }; }}
                aria-label={`拖动 ${sel.名称} 的第 ${i + 1} 个角点`} />;
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
              onClick={() => setGeom(g => ({ ...g, 房间: g.房间.filter(r => r.id !== 选中), 开口: g.开口.filter(o => o.墙 !== 选中) }))}
              disabled={!sel}>删掉这一间</button>
            <button type="button" className="qn-btn qn-btn--quiet" style={{ minHeight: 44 }}
              onClick={() => {
                const id = uid('r-');
                setGeom(g => ({ ...g, 房间: [...g.房间, { id, 名称: `房间 ${g.房间.length + 1}`, 用途: '储物', 外环: [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 1, y: 3 }] }] }));
                set选中(id);
              }}>加一间房</button>
          </div>

          {/* 视图切换：俯视=编辑用，等轴=降级看，3D=主看。三者读的是同一个 FloorGeometry，
              所以"降级图和 3D 长得不一样"这种错在这一页不可能出现。 */}
          <div className="qn-row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {(['俯视', '等轴', '3D'] as const).map(k => (
              <button key={k} type="button" className={`qn-chip${视图 === k ? ' qn-chip--on' : ''}`}
                style={{ minHeight: 44, minWidth: 44 }} onClick={() => set视图(k)}>{k}</button>
            ))}
            {视图 === '3D' && 舞台?.kind === 'ready' && (
              <span className="qn-meta">首帧 {舞台.首帧毫秒}ms · 粒子 {舞台.粒子数} 个</span>
            )}
          </div>

          {/* 降级的原因必须留在父层：3D 一降级就整个卸载，把话说在它自己肚子里等于没说。
              裁定里"降级要可见"要的是这一行，不是切换成功这件事本身。 */}
          {舞台说明 && <p className="qn-alert" role="status" style={{ margin: '8px 0 0' }}>{舞台说明}</p>}

          {视图 === '俯视' && <p className="qn-note" style={{ marginTop: 6 }}>俯视图用来核对几何：点一间房选中它，再拖角点。</p>}

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

          <div className="qn-card" style={{ marginTop: 12 }}>
            <p className="qn-axis">门窗（识别来的都标着未确认）</p>
            {geom.开口.length === 0 && <p className="qn-note" style={{ margin: '6px 0 0' }}>一个开口都没标：采光、对流与动线三类判定都会写成"缺输入"，不猜。</p>}
            {geom.开口.map(o => (
              <div key={o.id} className="qn-row" style={{ gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                <button type="button" className="qn-chip" style={{ minHeight: 44 }}
                  onClick={() => setGeom(g => ({ ...g, 开口: g.开口.map(x => (x.id === o.id ? { ...x, 类型: x.类型 === '门' ? '窗' : '门' } : x)) }))}>
                  {o.类型}
                </button>
                <button type="button" className="qn-chip" style={{ minHeight: 44 }}
                  onClick={() => setGeom(g => ({ ...g, 开口: g.开口.map(x => (x.id === o.id ? { ...x, 已确认: !x.已确认 } : x)) }))}>
                  {o.已确认 ? '已确认' : '未确认'}
                </button>
                <span className="qn-meta">{o.置信度 != null ? `模型置信度 ${Math.round(o.置信度 * 100)}%` : '手工标注'}</span>
                <button type="button" className="qn-btn qn-btn--quiet" style={{ minHeight: 44, marginLeft: 'auto' }}
                  onClick={() => setGeom(g => ({ ...g, 开口: g.开口.filter(x => x.id !== o.id) }))}>删</button>
              </div>
            ))}
          </div>

          <div className="qn-row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {(['南', '北', '未确认'] as const).map(k => (
              <button key={k} type="button" className={`qn-chip${朝向 === k ? ' qn-chip--on' : ''}`} style={{ minHeight: 44, minWidth: 44 }}
                onClick={() => set朝向(k)}>{k === '未确认' ? '朝向未确认' : `朝${k}`}</button>
            ))}
          </div>

          <label className="qn-note" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 12, cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 44, height: 44, flex: '0 0 auto', margin: 0, display: 'grid', placeItems: 'center' }}
              checked={已确认} onChange={e => set已确认(e.target.checked)} />
            <span>上面每一项几何与门窗都是我自己核对过的，可以让规则层据此判定。
              <span className="qn-note" style={{ display: 'block', marginTop: 2 }}>
                不勾就只出提示不出判定。识别结果没确认就下结论，等于把模型的猜测当成用户的事实。
              </span>
            </span>
          </label>

          <div style={{ marginTop: 12 }}>
            <FloorReportView report={report} 跨宫={translated.跨宫}
              格数={walkable ? `${walkable.列}×${walkable.行}` : '无'} 跨度={span} />
          </div>
        </>
      )}
      {geom.房间.length === 0 && (
        <p className="qn-note" style={{ marginTop: 12 }}>还没有几何：先「手工画」或「载入合成样例」，或上传一张图让模型提候选。</p>
      )}
    </div>
  );
}


function FloorReportView({ report, 跨宫, 格数, 跨度 }: {
  report: ReturnType<typeof analyzeFloor>; 跨宫: string[]; 格数: string; 跨度: number;
}) {
  const over = 跨度 > MAX_SPAN_M;
  return (
    <section className="qn-card" aria-live="polite">
      <p className="qn-axis">规则层结果 · {report.口径戳}</p>
      <p className="qn-meta" style={{ marginTop: 4 }}>可行走网格 {格数} 格（0.25m 步长），最大跨度 {Math.round(跨度 * 10) / 10}m。</p>
      {over && <p className="qn-alert">跨度超过 {MAX_SPAN_M}m：3D 的相机与阴影范围会失控，请先把它缩小或只画一部分。</p>}
      {跨宫.length > 0 && (
        <p className="qn-note" style={{ marginTop: 6 }}>有 {跨宫.length} 间房与九宫的最大重叠不足六成（{跨宫.join('、')}），下面凡是提到这些宫的结论都只作参考。</p>
      )}
      <ul className="qn-meta" style={{ margin: '8px 0 0', paddingLeft: '1.1em' }}>
        {report.输入摘要.map(x => <li key={x}>{x}</li>)}
      </ul>
      {report.判定.length === 0 && <p className="qn-body" style={{ marginTop: 10 }}>这一组输入没有推出任何判定。</p>}
      {report.判定.map((n, i) => (
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
    </section>
  );
}

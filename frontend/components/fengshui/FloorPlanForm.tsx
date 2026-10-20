'use client';

// 户型标注与规则层结果。整块都在浏览器里算，没有上传、没有网络请求。
//
// 为什么没有"传张户型图"：图片要落地就要后端与存储，还要单独告知与确认（原图默认只在本
// 会话用这条纪律，一旦走服务端就得重新论证）。这一版只收用户自己确认过的结构化标注。

import { useMemo, useState } from 'react';
import { analyzeFloor, FENGSHUI_BASIS } from '@/lib/fengshui/analysis';
import { FACING_LIST, PALACES, ROOM_KINDS } from '@/lib/fengshui/types';
import type { FacingInput, Palace, Room, RoomKind } from '@/lib/fengshui/types';

const DEFAULT_ROOMS: Room[] = [
  { id: 'r1', 名称: '客厅', 用途: '客厅', 宫位: '离' },
  { id: 'r2', 名称: '主卧', 用途: '卧室', 宫位: '坎' },
  { id: 'r3', 名称: '厨房', 用途: '厨房', 宫位: '震' },
  { id: 'r4', 名称: '卫生间', 用途: '卫生间', 宫位: '兑' },
];

/** 九宫的显示顺序：上南下北、左东右西是中国古地图那一套，但用户手上的户型图是现代方向。
 *  这里按现代方向摆（上北下南、左西右东），并在界面上把每个格子的方位名写出来，不靠猜。 */
const LAYOUT: Palace[][] = [['乾', '坎', '艮'], ['兑', '中', '震'], ['坤', '离', '巽']];
const PALACE_HINT: Record<Palace, string> = {
  坎: '北', 艮: '东北', 震: '东', 巽: '东南', 离: '南', 坤: '西南', 兑: '西', 乾: '西北', 中: '正中',
};

function toggle(list: Palace[], p: Palace): Palace[] {
  return list.includes(p) ? list.filter(x => x !== p) : [...list, p];
}

export default function FloorPlanForm() {
  const [朝向, set朝向] = useState<FacingInput>('未确认');
  const [入户门, set入户门] = useState<Palace[]>([]);
  const [主窗, set主窗] = useState<Palace[]>([]);
  const [rooms, setRooms] = useState<Room[]>(DEFAULT_ROOMS);
  const [已确认, set已确认] = useState(false);
  const [ran, setRan] = useState(false);

  const report = useMemo(() => (ran ? analyzeFloor({ 朝向, 入户门, 主窗, 房间: rooms, 已确认 }) : null),
    [ran, 朝向, 入户门, 主窗, rooms, 已确认]);

  const setRoom = (id: string, patch: Partial<Room>) =>
    setRooms(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <>
      <section className="qn-card" style={{ marginTop: 16 }}>
        <p className="qn-axis">第一步 · 朝向</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, rowGap: 12, marginTop: 8 }}>
          {([...FACING_LIST, '未确认'] as FacingInput[]).map(f => (
            <button key={f} type="button" className={`qn-chip${朝向 === f ? ' qn-chip--on' : ''}`}
              style={{ minHeight: 44, minWidth: 44 }} aria-pressed={朝向 === f} onClick={() => set朝向(f)}>
              {f}
            </button>
          ))}
        </div>
        <p className="qn-note" style={{ marginTop: 8 }}>
          选不出朝向就留"未确认"。本站不会拿"图朝上"当南 —— 那是把猜当成输入。
        </p>
      </section>

      <section className="qn-card" style={{ marginTop: 12 }}>
        <p className="qn-axis">第二步 · 门与窗在哪个宫</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
          {LAYOUT.flat().map(p => (
            <div key={p} style={{ display: 'grid', gap: 4 }}>
              <p className="qn-cap" style={{ margin: 0 }}>{p} · {PALACE_HINT[p]}</p>
              <button type="button" data-mark="door" data-palace={p}
                className={`qn-chip${入户门.includes(p) ? ' qn-chip--on' : ''}`}
                style={{ minHeight: 44, fontSize: 'var(--qn-fs-meta)' }} aria-pressed={入户门.includes(p)}
                aria-label={`入户门在${p}`}
                onClick={() => set入户门(v => toggle(v, p))}>门</button>
              <button type="button" data-mark="window" data-palace={p}
                className={`qn-chip${主窗.includes(p) ? ' qn-chip--on' : ''}`}
                style={{ minHeight: 44, fontSize: 'var(--qn-fs-meta)' }} aria-pressed={主窗.includes(p)}
                aria-label={`主窗在${p}`}
                onClick={() => set主窗(v => toggle(v, p))}>窗</button>
            </div>
          ))}
        </div>
      </section>

      <section className="qn-card" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <p className="qn-axis" style={{ margin: 0 }}>第三步 · 房间摆进九宫</p>
          <button type="button" className="qn-btn qn-btn--ghost" style={{ minHeight: 44 }}
            onClick={() => setRooms(rs => [...rs, {
              id: `r${Date.now().toString(36)}`, 名称: `房间 ${rs.length + 1}`, 用途: '书房', 宫位: '中',
            }])}>
            加一间
          </button>
        </div>
        <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
          {rooms.map(r => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr) auto', gap: 8, alignItems: 'center' }}>
              <input className="qn-input" style={{ minHeight: 44, minWidth: 0 }} value={r.名称} aria-label="房间名称"
                onChange={e => setRoom(r.id, { 名称: e.target.value })} />
              <select className="qn-select" style={{ minHeight: 44 }} value={r.用途} aria-label="房间用途"
                onChange={e => setRoom(r.id, { 用途: e.target.value as RoomKind })}>
                {ROOM_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <select className="qn-select" style={{ minHeight: 44 }} value={r.宫位} aria-label="所在宫"
                onChange={e => setRoom(r.id, { 宫位: e.target.value as Palace })}>
                {PALACES.map(p => <option key={p} value={p}>{p} · {PALACE_HINT[p]}</option>)}
              </select>
              <button type="button" className="qn-btn qn-btn--quiet" style={{ minHeight: 44 }}
                aria-label={`删除 ${r.名称}`} onClick={() => setRooms(rs => rs.filter(x => x.id !== r.id))}>
                删
              </button>
            </div>
          ))}
          {rooms.length === 0 && <p className="qn-note" style={{ margin: 0 }}>一个房间都没有，规则层无从推起。</p>}
        </div>
      </section>

      <section className="qn-card" style={{ marginTop: 12 }}>
        <label className="qn-label" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
          {/* 命中区按 44 给：原生 checkbox 只有 13x13，整块 44x44 的盒子都是可点区，
              视觉上仍然是一个勾框（外观不动，只是把元素的盒子撑到指尖尺寸）。 */}
          <input type="checkbox" style={{ width: 44, height: 44, flex: '0 0 auto', margin: 0, display: 'grid', placeItems: 'center' }}
            checked={已确认} onChange={e => set已确认(e.target.checked)} />
          <span>以上每一项都是我自己标的，可以让规则层据此判定。
            <span className="qn-note" style={{ display: 'block', marginTop: 4 }}>
              不勾就只出提示不出判定：拿没确认的输入算出来的结论，在页面上和确认过的一模一样，这是最容易被读错的一种绿。
            </span>
          </span>
        </label>
        <button type="button" className="qn-btn qn-btn--solid" style={{ marginTop: 12, minHeight: 44 }}
          onClick={() => setRan(true)}>
          按这些标注算一遍
        </button>
      </section>

      {report && (
        <section className="qn-card" style={{ marginTop: 12 }} aria-live="polite">
          <p className="qn-axis">规则层结果 · {report.口径戳}</p>
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
          <p className="qn-note" style={{ marginTop: 12 }}>
            以上全部是几何与动线层面的观察（相邻、对宫、通路、同宫），不是方位吉凶。
            八宅、玄空那一层本站不做：docs/classics 里没有可引的宅经原文，原典之外不发明。
            同一组标注永远得到同一份结果（口径戳 {FENGSHUI_BASIS}），换判据会升这个号。
          </p>
        </section>
      )}
    </>
  );
}

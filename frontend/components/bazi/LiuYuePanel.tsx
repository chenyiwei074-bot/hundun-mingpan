'use client';

import { useMemo, useState } from 'react';
import type { BaziChart } from '@/app/lib/core/yiqi-core/types';
import ToolInterpretation from '@/components/ai/ToolInterpretation';
import { availableLiuYueYears, buildLiuYueYear, defaultLiuYueYear } from '@/lib/bazi/liuyue';

const ganZhiText = (value: { gan: string; zhi: string }) => `${value.gan}${value.zhi}`;

export default function LiuYuePanel({ chart }: { chart: BaziChart }) {
  const years = useMemo(() => availableLiuYueYears(chart), [chart]);
  const [year, setYear] = useState(() => defaultLiuYueYear(chart, Date.now()));
  const selectedYear = years.includes(year) ? year : years[0];
  const view = useMemo(() => buildLiuYueYear(chart, selectedYear), [chart, selectedYear]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const currentIndex = view?.months.findIndex(month =>
    Date.now() >= month.startUtcMs && Date.now() < month.endUtcMs) ?? -1;
  const index = selectedIndex >= 0 && selectedIndex < 12 ? selectedIndex : currentIndex >= 0 ? currentIndex : 0;
  const month = view?.months[index];

  if (!years.length || !view || !month) {
    return <section className="qn-card" id="liuyue" data-liuyue-state="unavailable">
      <h2 className="qn-title">流月暂时无法计算</h2>
      <p className="qn-meta">这份命盘缺少完整四柱、大运流年，或原盘与节气历法不一致；页面不会补造逐月结果。</p>
    </section>;
  }

  return <section id="liuyue" data-liuyue-state="ready" aria-label="流月十二节月">
    <div className="qn-card">
      <div className="qn-row" style={{ alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p className="qn-eyebrow" style={{ margin: 0 }}>从节气到节气</p>
          <h2 className="qn-title" style={{ margin: '6px 0' }}>流月 · 十二节月</h2>
          <p className="qn-meta" style={{ margin: 0 }}>选一个节月，看月柱、十神，以及它与原命盘的成对关系。</p>
        </div>
        <label className="qn-label" htmlFor="liuyue-year">流年
          <select id="liuyue-year" className="qn-input" style={{ display: 'block', marginTop: 5, minHeight: 44 }}
            value={selectedYear} onChange={event => { setYear(Number(event.target.value)); setSelectedIndex(-1); }}>
            {years.map(value => <option key={value} value={value}>{value} 年</option>)}
          </select>
        </label>
      </div>
      <p className="qn-cap" style={{ marginTop: 12 }}>
        {selectedYear} 流年 {ganZhiText(view.annualGanZhi)} · 所在大运 {ganZhiText(view.dayunGanZhi)} · 日主 {view.dayMaster}
      </p>
      <div role="group" aria-label="选一个节月" style={{ display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 8, marginTop: 14 }}>
        {view.months.map(item => {
          const current = Date.now() >= item.startUtcMs && Date.now() < item.endUtcMs;
          return <button key={item.index} type="button" className={`qn-chip${index === item.index ? ' qn-chip--on' : ''}`}
            aria-pressed={index === item.index} onClick={() => setSelectedIndex(item.index)}
            style={{ minHeight: 58, textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
            <strong>{item.name} · {ganZhiText(item.ganZhi)}{current ? ' · 当前' : ''}</strong>
            <span style={{ fontSize: 'var(--qn-fs-eyebrow)' }}>{item.startTerm}起 · {item.startBeijing.slice(5, 10)}</span>
          </button>;
        })}
      </div>
    </div>

    <div className="qn-card" style={{ marginTop: 14 }} data-liuyue-selected={month.name}>
      <p className="qn-eyebrow" style={{ margin: 0 }}>第 {index + 1} 节月</p>
      <h3 className="qn-title" style={{ margin: '6px 0 10px' }}>{month.name} · {ganZhiText(month.ganZhi)}</h3>
      <p className="qn-meta">{month.startTerm} {month.startBeijing} 至 {month.endTerm} {month.endBeijing}（北京时间）</p>
      <p className="qn-body" style={{ marginTop: 10 }}>月干相对日主：{month.ganShiShen}；月支藏干：{month.cangGan.map(item => `${item.gan}·${item.shiShen}`).join('、')}。</p>
      {[
        ['与原命盘四柱', month.natalRelations],
        ['与流年、大运', [...month.yearRelations, ...month.dayunRelations]],
      ].map(([title, items]) => <div key={title as string} style={{ marginTop: 12 }}>
        <h4 className="qn-axis" style={{ margin: '0 0 5px' }}>{title as string}</h4>
        {(items as string[]).length ? <ul className="qn-meta" style={{ margin: 0, paddingLeft: '1.3em' }}>
          {(items as string[]).map(item => <li key={item}>{item}</li>)}
        </ul> : <p className="qn-meta" style={{ margin: 0 }}>没有本站成对关系表可报的关系。</p>}
      </div>)}
      <p className="qn-note" style={{ marginBottom: 0 }}>这是节令与干支的结构对照，不代表这个月必然发生某件事，也不构成吉凶评分。</p>
    </div>

    <ToolInterpretation key={`${selectedYear}-${index}`} tool="liuyue" title={`${month.name} · 混沌自研 AI 辅助解读`} payload={{
      basis: view.basis, year: view.year, monthIndex: month.index + 1, monthName: month.name,
      startBeijing: month.startBeijing, endBeijing: month.endBeijing,
      monthGanZhi: month.ganZhi, annualGanZhi: view.annualGanZhi,
      dayunGanZhi: view.dayunGanZhi, dayMaster: view.dayMaster,
      ganShiShen: month.ganShiShen, cangGan: month.cangGan,
      natalRelations: month.natalRelations,
      yearRelations: month.yearRelations, dayunRelations: month.dayunRelations,
    }} />
    <p className="qn-cap" style={{ marginTop: 12 }}>
      节月以立春为起点，交节的准确时刻换月；这里统一显示北京时间（UTC+8），不是公历自然月或农历月。
      月柱沿用本站原排盘函数，十神与成对关系沿用现有规则。所选节月的数据才会送入 AI 解读。
    </p>
  </section>;
}

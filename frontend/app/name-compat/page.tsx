'use client';

import { useState } from 'react';
import Link from 'next/link';
import { calculateFiveGrids, elementRelation, GRID_NAMES, parseStrokes,
  type FiveGrids } from '@/lib/name-compat/five-grids';

type PersonInput = { label: string; surname: string; given: string };
const emptyPerson = (): PersonInput => ({ label: '', surname: '', given: '' });

function PersonFields({ person, onChange, title, prefix }: {
  person: PersonInput; onChange: (next: PersonInput) => void; title: string; prefix: string;
}) {
  return <fieldset className="qn-card" style={{ margin: 0, minWidth: 0 }}>
    <legend className="qn-title" style={{ padding: '0 8px' }}>{title}</legend>
    <label className="qn-label" htmlFor={`${prefix}-label`}>称呼（可选）
      <input id={`${prefix}-label`} className="qn-input" value={person.label} maxLength={20} autoComplete="off" onChange={e => onChange({ ...person, label: e.target.value })} placeholder={title} style={{ marginTop: 5, minHeight: 44 }} />
    </label>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 12 }}>
      <label className="qn-label" htmlFor={`${prefix}-surname`}>姓氏各字笔画
        <input id={`${prefix}-surname`} className="qn-input" inputMode="text" value={person.surname} onChange={e => onChange({ ...person, surname: e.target.value })} placeholder="单姓：7；复姓：7, 8" style={{ marginTop: 5, minHeight: 44 }} />
      </label>
      <label className="qn-label" htmlFor={`${prefix}-given`}>名字各字笔画
        <input id={`${prefix}-given`} className="qn-input" inputMode="text" value={person.given} onChange={e => onChange({ ...person, given: e.target.value })} placeholder="单名：6；双名：6, 5" style={{ marginTop: 5, minHeight: 44 }} />
      </label>
    </div>
  </fieldset>;
}

export default function NameCompatPage() {
  const [first, setFirst] = useState<PersonInput>(emptyPerson);
  const [second, setSecond] = useState<PersonInput>(emptyPerson);
  const [result, setResult] = useState<{ first: FiveGrids; second: FiveGrids } | null>(null);
  const [error, setError] = useState('');
  const updateFirst = (next: PersonInput) => { setFirst(next); setResult(null); };
  const updateSecond = (next: PersonInput) => { setSecond(next); setResult(null); };
  const calculate = () => {
    const aSurname = parseStrokes(first.surname);
    const aGiven = parseStrokes(first.given);
    const bSurname = parseStrokes(second.surname);
    const bGiven = parseStrokes(second.given);
    if (!aSurname || !aGiven || !bSurname || !bGiven) {
      setError('请为双方分别填写姓与名的逐字笔画：每项 1–2 个正整数，用逗号隔开。');
      setResult(null);
      return;
    }
    const a = calculateFiveGrids(aSurname, aGiven);
    const b = calculateFiveGrids(bSurname, bGiven);
    if (!a || !b) { setError('笔画超出支持范围，请核对每字笔画为 1–100。'); setResult(null); return; }
    setResult({ first: a, second: b });
    setError('');
  };

  return <main className="qn-shell">
    <header className="qn-rise" style={{ paddingTop: 24 }}>
      <Link href="/oriental" className="domain-back">← 返回东方目录</Link>
      <p className="qn-eyebrow" style={{ marginTop: 14 }}>东方 · 看关系</p>
      <h1 className="qn-hero">姓名五格 · 双人对照</h1>
      <p className="qn-meta">逐字确认笔画后，并排查看双方五格数与五行关系。页面展示取数过程，不给匹配分。</p>
    </header>

    <section style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
      <PersonFields title="甲方" prefix="first" person={first} onChange={updateFirst} />
      <PersonFields title="乙方" prefix="second" person={second} onChange={updateSecond} />
    </section>
    <section className="qn-card" style={{ marginTop: 14 }}>
      <p className="qn-note" style={{ marginTop: 0 }}>请先取得对方同意。笔画会受繁简字、异体字与所用字典影响；本站不自动猜测康熙笔画。双方应按同一笔画口径核对后再填。所有输入只在本机计算，不上传或保存。</p>
      <button className="qn-btn qn-btn--solid" type="button" onClick={calculate} style={{ minHeight: 44 }}>计算五格对照</button>
      {error && <p className="qn-note" role="alert" style={{ marginTop: 12 }}>{error}</p>}
    </section>

    {result && <section className="qn-card qn-rise" style={{ marginTop: 14 }} aria-live="polite">
      <h2 className="qn-title">两份五格并排看</h2>
      <p className="qn-meta">甲方：{first.label.trim() || '甲方'} · 乙方：{second.label.trim() || '乙方'}。中间写的是五行取数关系，不是对人的结论。</p>
      <div style={{ display: 'grid', gap: 10 }}>
        {GRID_NAMES.map(name => {
          const a = result.first.values[name];
          const b = result.second.values[name];
          return <article className="qn-row" key={name} style={{ padding: 14 }}>
            <p className="qn-cap" style={{ margin: 0 }}>{name}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <strong className="qn-title">{a.value} · {a.element}</strong>
              <span className="qn-cap">{elementRelation(a.element, b.element)}</span>
              <strong className="qn-title">{b.value} · {b.element}</strong>
            </div>
            <details style={{ marginTop: 7 }}><summary className="qn-link" style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>展开双方取数式</summary>
              <p className="qn-meta">甲：{a.formula} = {a.value}<br />乙：{b.formula} = {b.value}</p>
            </details>
          </article>;
        })}
      </div>
      <p className="qn-note">五行末位映射：1/2 木、3/4 火、5/6 土、7/8 金、9/0 水。生克关系按木→火→土→金→水→木及木克土、土克水、水克火、火克金、金克木展示；它不代表双方是否适合。</p>
    </section>}

    <section className="qn-card" style={{ marginTop: 14 }}>
      <p className="qn-cap" style={{ margin: 0 }}>方法边界</p>
      <p className="qn-meta">五格剖象是近代姓名数理方法，不作为中国古籍出处。单字姓或单字名的“虚数 1”只参与相应格；总格始终为全部真实笔画之和。比较层为本站自研。</p>
      <p className="qn-note">字形与笔画的来源由填写者确认。这里展示五格的数与五行关系，不套用未经核验的 81 数理吉凶表。</p>
    </section>
    <p className="qn-linkrow"><Link className="qn-link" href="/hepan">返回关系工具</Link><Link className="qn-link" href="/tools">查看全部工具</Link></p>
  </main>;
}

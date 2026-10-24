'use client';

import { useState } from 'react';
import Link from 'next/link';
import { calculateLifePath, calculateNameNumber, LETTER_ROW,
  type LifePathResult, type NameNumberResult } from '@/lib/numerology/core';

const chain = (steps: number[]) => steps.join(' → ');

export default function NumerologyPage() {
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [result, setResult] = useState<{ life: LifePathResult; name: NameNumberResult } | null>(null);
  const [error, setError] = useState('');
  const calculate = () => {
    const life = calculateLifePath(date);
    const nameResult = calculateNameNumber(name);
    if (!life) { setError('请选择有效的公历出生日期。'); setResult(null); return; }
    if (!nameResult) { setError('姓名数需输入你自己确认的拉丁字母拼写；可用空格或连字符分词，不能直接输入汉字。'); setResult(null); return; }
    setResult({ life, name: nameResult });
    setError('');
  };

  return <main className="qn-shell" data-mode="western">
    <header className="qn-rise" style={{ paddingTop: 24 }}>
      <Link href="/western" className="domain-back">← 返回西方目录</Link>
      <p className="qn-eyebrow" style={{ marginTop: 14 }}>西方 · 看名字与数字</p>
      <h1 className="qn-hero">数字命理 · 生命灵数</h1>
      <p className="qn-meta">把出生日期与拉丁拼写逐步换算成数字。每一步都摊开，你可以自己复算。</p>
    </header>

    <section className="qn-card" style={{ marginTop: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <label className="qn-label">出生日期（公历）<input className="qn-input" type="date" value={date} onChange={e => { setDate(e.target.value); setResult(null); }} style={{ marginTop: 5, minHeight: 44 }} /></label>
        <label className="qn-label">姓名的拉丁拼写<input className="qn-input" type="text" value={name} onChange={e => { setName(e.target.value); setResult(null); }} placeholder="例如：LI MING 或 ADA LOVELACE" autoComplete="off" maxLength={80} style={{ marginTop: 5, minHeight: 44 }} /></label>
      </div>
      <p className="qn-note">中文姓名请自行选择并填写你惯用的拼音写法。不同拼写可能得到不同数字；本站不会替你把汉字自动转写。</p>
      <button type="button" className="qn-btn qn-btn--solid" onClick={calculate} disabled={!date || !name.trim()} style={{ minHeight: 44 }}>计算并展开步骤</button>
      {error && <p role="alert" className="qn-note" style={{ marginTop: 12 }}>{error}</p>}
    </section>

    {result && <section className="qn-card qn-rise" aria-live="polite" style={{ marginTop: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div className="qn-row"><p className="qn-cap">生命灵数</p><p className="qn-hero" style={{ margin: 0 }}>{result.life.total.value}</p><p className="qn-meta">月、日、年分开化简后相加</p></div>
        <div className="qn-row"><p className="qn-cap">姓名数</p><p className="qn-hero" style={{ margin: 0 }}>{result.name.total.value}</p><p className="qn-meta">按你输入的拉丁拼写取数</p></div>
      </div>
      <h2 className="qn-title" style={{ marginTop: 22 }}>日期怎样算</h2>
      <ol className="qn-meta" style={{ paddingLeft: '1.5em' }}>
        <li>月份：{chain(result.life.month.steps)}</li>
        <li>日期：{chain(result.life.day.steps)}</li>
        <li>年份：{chain(result.life.year.steps)}</li>
        <li>合计：{result.life.month.value} + {result.life.day.value} + {result.life.year.value} = {chain(result.life.total.steps)}</li>
      </ol>
      <h2 className="qn-title">姓名怎样算</h2>
      <p className="qn-meta" style={{ overflowWrap: 'anywhere', lineHeight: 2 }}>
        {result.name.letters.map((item, index) => <span key={`${item.letter}-${index}`} style={{ display: 'inline-block', marginRight: 12 }}>{item.letter}={item.value}</span>)}
      </p>
      <p className="qn-meta">合计 {chain(result.name.total.steps)}</p>
      <p className="qn-note">结果是这套数表下的计算值，不代表人格、健康或关系的确定结论。</p>
    </section>}

    <section className="qn-card" style={{ marginTop: 14 }}>
      <p className="qn-cap" style={{ margin: 0 }}>取数表 · 1 至 9 循环</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
        {LETTER_ROW.map((letters, index) => <div className="qn-row" key={letters} style={{ fontSize: 'var(--qn-fs-body)' }}><strong>{index + 1}</strong><span style={{ marginLeft: 10 }}>{letters}</span></div>)}
      </div>
      <p className="qn-meta">固定规则：月、日、年各自逐位相加到 1–9，遇到 11、22、33 保留；三项再相加并按同一规则化简。姓名按 A=1 至 I=9 循环至 Z。</p>
      <p className="qn-note">这是现代拉丁字母数字表的一种实现选择，汉字没有被直接映射到英文字母；本站不把它称为古籍算法。输入只在本机计算，不上传或保存。</p>
    </section>
    <p className="qn-linkrow"><Link className="qn-link" href="/tools">查看全部工具</Link></p>
  </main>;
}

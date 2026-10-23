import Link from 'next/link';
import NatalPlanets from '@/components/western/NatalPlanets';
import { WESTERN_TOOL_BY_SLUG } from '@/lib/tools/western-catalog';
import { ASTRO_BASIS } from '@/lib/astro/planets';
import { MOMENT_BASIS } from '@/lib/astro/moment';

// 本命行星位置（西方 · 看本命）。标题、状态、说明全部从目录现读，页面自己不留第二份：
// 目录那侧一改（换显示名、改状态、写清缺什么），这一页跟着变；两处各抄一份就是缺陷6 的形状。
const ENTRY = WESTERN_TOOL_BY_SLUG['astro-natal'];

export default function AstroPage() {
  return (
    <main className="qn-shell" data-mode="western">
      <header className="qn-rise" style={{ paddingTop: 24 }}>
        <Link href="/western" className="domain-back">← 返回西方目录</Link>
        <p className="qn-eyebrow" style={{ marginTop: 14 }}>西方 · 看本命</p>
        <h1 className="qn-hero">{ENTRY.name}</h1>
        <p className="qn-meta" style={{ marginTop: 10, maxWidth: '62ch' }}>
          {ENTRY.question}
          口径 {ASTRO_BASIS} 与时间口径 {MOMENT_BASIS}，状态为「{ENTRY.status}」。
        </p>
      </header>

      <NatalPlanets />

      <section className="qn-legal" style={{ marginTop: 22 }}>
        <p className="qn-note" style={{ margin: 0 }}>
          这一页不发请求：日期、钟面时间与选定的时区只在这台设备里换算成一个世界时刻用来计算，
          不写日志、不落库、不进入任何回执与公开台账，刷新即失。要留结果请自己截图。
        </p>
        <p className="qn-linkrow">
          <Link className="qn-link" href="/western">返回西方目录</Link>
          <Link className="qn-link" href="/tools">全部工具目录</Link>
        </p>
      </section>
    </main>
  );
}

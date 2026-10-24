import Link from 'next/link';
import NatalPlanets from '@/components/western/NatalPlanets';
import { WESTERN_TOOL_BY_SLUG } from '@/lib/tools/western-catalog';

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
          {ENTRY.question} 当前仅开放行星落座与度数，详细范围与参考依据见下方说明。
        </p>
      </header>

      <NatalPlanets />

      <section className="qn-legal" style={{ marginTop: 22 }}>
        <p className="qn-note" style={{ margin: 0 }}>
          出生日期、时间与地点只在这台设备中用于计算，不上传或保存；刷新后结果清空。需要留存请自行截图。
        </p>
        <p className="qn-linkrow">
          <Link className="qn-link" href="/western">返回西方目录</Link>
          <Link className="qn-link" href="/tools">全部工具与取数口径</Link>
        </p>
      </section>
    </main>
  );
}

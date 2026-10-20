import Link from 'next/link';
import FloorPlanForm from '@/components/fengshui/FloorPlanForm';
import { FENGSHUI_BASIS } from '@/lib/fengshui/analysis';

// 户型风水（东方）。整页不联网：标注填在浏览器里，规则层也在浏览器里跑。
export default function FengshuiPage() {
  return (
    <main className="qn-shell">
      <header className="qn-rise" style={{ paddingTop: 24 }}>
        <Link href="/" className="domain-back">← 返回选择体系</Link>
        <p className="qn-eyebrow" style={{ marginTop: 14 }}>东方 · 居所</p>
        <h1 className="qn-hero">户型标注</h1>
        <p className="qn-meta" style={{ marginTop: 10, maxWidth: '62ch' }}>
          把房子摆进九宫，本站只从你标的相对位置推采光、通风、动线与分区关系，
          每一条都带着它的输入依据和说不准的地方。口径 {FENGSHUI_BASIS}。
        </p>
      </header>

      <FloorPlanForm />

      <section className="qn-legal" style={{ marginTop: 22 }}>
        <p className="qn-note" style={{ margin: 0 }}>
          这一页不上传户型图、不写日志、不进报告与台账：所有标注只存在这个页面的内存里，
          刷新即失。要留结果请自己截图。
        </p>
        <p className="qn-linkrow">
          <Link className="qn-link" href="/">返回选择体系</Link>
          <Link className="qn-link" href="/tools">全部工具与取数口径</Link>
        </p>
      </section>
    </main>
  );
}

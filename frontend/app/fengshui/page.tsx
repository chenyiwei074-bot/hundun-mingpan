import Link from 'next/link';
import FloorPlanStudio from '@/components/fengshui/FloorPlanStudio';
import FloorPlanForm from '@/components/fengshui/FloorPlanForm';
import { FENGSHUI_BASIS } from '@/lib/fengshui/analysis';

// 户型风水（东方）。默认路径是"画几何 → 人工确认 → 判定"；
// 原来那套逐条填宫位保留为降级入口，两条路最后喂给的是同一个规则层。
export default function FengshuiPage() {
  return (
    <main className="qn-shell">
      <header className="qn-rise" style={{ paddingTop: 24 }}>
        <Link href="/" className="domain-back">← 返回选择体系</Link>
        <p className="qn-eyebrow" style={{ marginTop: 14 }}>东方 · 居所</p>
        <h1 className="qn-hero">户型标注</h1>
        <p className="qn-meta" style={{ marginTop: 10, maxWidth: '62ch' }}>
          画出具体的墙、房间与门窗，本站从几何推采光、通风、动线与分区关系，
          每一条都带着它的输入依据和说不准的地方。口径 {FENGSHUI_BASIS}。
        </p>
      </header>

      <FloorPlanStudio />

      <details style={{ marginTop: 18 }}>
        <summary className="qn-meta" style={{ cursor: 'pointer', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
          不想画几何？改用逐条填宫位（九宫格标注，同一套规则层）
        </summary>
        <div style={{ marginTop: 8 }}>
          <FloorPlanForm />
        </div>
      </details>

      <section className="qn-legal" style={{ marginTop: 22 }}>
        <p className="qn-note" style={{ margin: 0 }}>
          上传是可选的，不上传也能走完全部判定。勾选同意之前，图片不会离开这台设备：
          预览用的是浏览器本地地址，识别这一步要显式同意才会发出去。
          服务端只按本人标识可取、7 天后自动删，且不进入报告、回执与任何公开台账。
          除此之外这一页不写日志、不联网：几何与判定都在这台设备的内存里，刷新即失，要留结果请自己截图。
        </p>
        <p className="qn-linkrow">
          <Link className="qn-link" href="/">返回选择体系</Link>
          <Link className="qn-link" href="/tools">全部工具与取数口径</Link>
        </p>
      </section>
    </main>
  );
}

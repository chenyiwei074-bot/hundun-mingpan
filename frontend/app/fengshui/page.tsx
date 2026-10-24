import Link from 'next/link';
import FloorPlanStudio from '@/components/fengshui/FloorPlanStudio';
import FloorPlanForm from '@/components/fengshui/FloorPlanForm';

// 户型风水（东方）。默认路径是"画几何 → 人工确认 → 判定"；
// 原来那套逐条填宫位保留为降级入口，两条路最后喂给的是同一个规则层。
export default function FengshuiPage() {
  return (
    <main className="qn-shell">
      <header className="qn-rise" style={{ paddingTop: 24 }}>
        <Link href="/" className="domain-back">← 返回选择体系</Link>
        <p className="qn-eyebrow" style={{ marginTop: 14 }}>东方术数与风水 · 居家空间</p>
        <h1 className="qn-hero">户型风水</h1>
        <p className="qn-meta" style={{ marginTop: 10, maxWidth: '62ch' }}>
          上传户型图或手动绘制，标注房间、门窗与朝向，查看空间关系、动线与采光提示。
          识别出的标注会先由你确认，再用于分析。
        </p>
      </header>

      <FloorPlanStudio />

      <details style={{ marginTop: 18 }}>
        <summary className="qn-meta" style={{ cursor: 'pointer', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
          也可以手动填写九宫方位
        </summary>
        <div style={{ marginTop: 8 }}>
          <FloorPlanForm />
        </div>
      </details>

      <section className="qn-legal" style={{ marginTop: 22 }}>
        <p className="qn-note" style={{ margin: 0 }}>
          上传户型图为可选，开始识别前会说明用途并征求同意。图片和相关资料的处理方式见隐私政策。
          手动绘制的内容只保留在当前页面，刷新后会清除。
        </p>
        <p className="qn-linkrow">
          <Link className="qn-link" href="/">返回选择体系</Link>
          <Link className="qn-link" href="/tools">查看全部工具</Link>
        </p>
      </section>
    </main>
  );
}

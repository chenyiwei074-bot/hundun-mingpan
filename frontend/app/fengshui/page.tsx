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
        <p className="qn-eyebrow" style={{ marginTop: 14 }}>东方 · 居所</p>
        <h1 className="qn-hero">户型标注</h1>
        <p className="qn-meta" style={{ marginTop: 10, maxWidth: '62ch' }}>
          画出墙、房间与门窗，查看户型中的采光、通风、动线与分区关系。每条观察都会列出依据和不确定项；
          本页规则由本站自研，目前不作八宅、玄空等传统方位吉凶判断。
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
          上传完全可选，不上传也能完成判定。选图后只在本机预览；勾选同意后，图片才会用于混沌自研 AI 辅助识别。
          图片不进入报告、回执或公开台账；主存储最长保留 7 天，备份副本最多再保留 7 天。移除图片会删除主存储副本。
          手绘几何与判定只在当前页面临时处理，刷新后会清空；需要留存时请自行截图。详细数据处理方式见下方隐私政策链接。
        </p>
        <p className="qn-linkrow">
          <Link className="qn-link" href="/">返回选择体系</Link>
          <Link className="qn-link" href="/tools">全部工具与取数口径</Link>
          <Link className="qn-link" href="/privacy">隐私政策</Link>
        </p>
      </section>
    </main>
  );
}

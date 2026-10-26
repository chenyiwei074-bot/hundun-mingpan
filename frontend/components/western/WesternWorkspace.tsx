import { WESTERN_INTENTS } from '@/lib/tools/western-catalog';
import ToolCatalog from '@/components/tools/ToolCatalog';

// 西方目录与东方目录共享卡片、状态和图标规则，只通过主题属性呈现各自色彩。

export default function WesternWorkspace() {
  return (
    <>
      <section className="qn-card qn-rise" style={{ marginTop: 18 }}>
        <p className="qn-meta" style={{ margin: 0 }}>
          下方列出西方体系工具、支持功能、使用方式与适用范围。
        </p>
      </section>
      <ToolCatalog groups={WESTERN_INTENTS} />
    </>
  );
}

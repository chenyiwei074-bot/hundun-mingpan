import { WESTERN_INTENTS } from '@/lib/tools/western-catalog';
import { statusCounts, statusTally } from '@/lib/tools/status';
import ToolCatalog from '@/components/tools/ToolCatalog';

// 西方目录与东方目录共享卡片、状态和图标规则，只通过主题属性呈现各自色彩。

export default function WesternWorkspace() {
  const tally = statusCounts(WESTERN_INTENTS);
  return (
    <>
      <section className="qn-card qn-rise" style={{ marginTop: 18 }}>
        <p className="qn-meta" style={{ margin: 0 }}>
          目录 {statusTally(tally)}。
          {tally.live === 0
            ? ' 当前暂无开放的西方工具，目录卡片会说明开放状态与参考依据。'
            : ` 已开放 ${tally.live} 项，下面列出每项的使用方式、计算范围与参考依据。`}
        </p>
      </section>
      <ToolCatalog groups={WESTERN_INTENTS} />
    </>
  );
}

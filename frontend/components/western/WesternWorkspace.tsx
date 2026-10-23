import { WESTERN_INTENTS } from '@/lib/tools/western-catalog';
import { statusCounts, statusTally } from '@/lib/tools/status';
import ToolCatalog from '@/components/tools/ToolCatalog';

// 西方目录的渲染（批F 起与 /tools 共用 components/tools/ToolCatalog 那一份卡片）。
//
// 这一页以前自己写了一份卡片：字段标签叫「算法口径」而 /tools 叫「计算口径」，
// 并且只有这一页渲染"已做/未做"、/tools 不渲染 —— 同一个「部分可用」在两个地方
// 说到的详细程度不一样，读者在目录页就看不见缺什么。判据仍是同一条（lib/tools/status.ts
// 的 isLiveEntry：状态不是未开放且有 href 才给入口），只是那份判定现在只住在一个地方。

export default function WesternWorkspace() {
  const tally = statusCounts(WESTERN_INTENTS);
  return (
    <>
      <section className="qn-card qn-rise" style={{ marginTop: 18 }}>
        <p className="qn-meta" style={{ margin: 0 }}>
          目录 {statusTally(tally)}。
          {tally.live === 0
            ? ' 现在一项都进不去：每一项的算法口径都还没有可引的出处与验收样例，'
              + '与其先做个能点的空壳，不如把缺什么写在门上。'
            : ` 有入口的 ${tally.live} 项在下面的卡里；「部分可用」的那一项，缺的样子里未做一栏逐条写着。`}
        </p>
      </section>
      <ToolCatalog groups={WESTERN_INTENTS} />
    </>
  );
}

import Link from 'next/link';
import ModeLanding from '@/components/home/ModeLanding';
import ToolCatalog from '@/components/tools/ToolCatalog';
import { INTENTS } from '@/lib/tools/catalog';

export default function OrientalBody() {
  return (
    <ModeLanding mode="oriental">
      <div className="hd-hub__quicklinks" aria-label="常用入口">
        <Link href="/create">八字紫微排盘 <span aria-hidden="true">↗</span></Link>
        <Link href="/create?mode=pillars">已知四柱解读 <span aria-hidden="true">↗</span></Link>
        <Link href="/liuyao/create">六爻起卦 <span aria-hidden="true">↗</span></Link>
        <Link href="/fengshui">户型九宫 <span aria-hidden="true">↗</span></Link>
        <Link href="/tools">全部工具 <span aria-hidden="true">↗</span></Link>
      </div>
      <ToolCatalog groups={INTENTS} />
    </ModeLanding>
  );
}

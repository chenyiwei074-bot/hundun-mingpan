import { WESTERN_INTENTS } from '@/lib/tools/western-catalog';
import ToolCatalog from '@/components/tools/ToolCatalog';

// 西方目录与东方目录共享卡片、状态和图标规则，只通过主题属性呈现各自色彩。

export default function WesternWorkspace() {
  return <ToolCatalog groups={WESTERN_INTENTS} />;
}

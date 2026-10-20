import ModeLanding from '@/components/home/ModeLanding';
import WesternWorkspace from '@/components/western/WesternWorkspace';

// 西方工作页。页面上每一个状态、每一句"缺什么"都从 lib/tools/western-catalog.ts 现读，
// 这里不写第二份清单 —— 目录说未开放，页面就不许出现入口。
export default function WesternPage() {
  return (
    <ModeLanding mode="western">
      <WesternWorkspace />
    </ModeLanding>
  );
}

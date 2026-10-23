// 裁定过的依赖白名单，只有一个出处。
//
// 为什么单开一份：kline 与 scenario 两套里各写过一份 `new Set(['three','@types/three'])`，
// E2 又要加第三个（astronomy-engine）。三份清单迟早有一份忘了改，而"忘了改"表现为一条红
// 或一条静默放行 —— 都不是我们想要的信号。
//
// 两类放行不一样，故意分开：
//  · SANCTIONED_DEPS：按名字放行，不钉版本（three 那种渲染依赖，版本漂了顶多是画面）。
//  · VETTED_PINNED：按名字**且按精确版本**放行。天文历表属于这一类 —— 与 JPL 的对拍
//    能不能复现，取决于跑的是不是同一张 DE441 积分表；^ 或 ~ 会让"绿"和"权威"脱钩。
export const SANCTIONED_DEPS = new Set(['three', '@types/three']);

export const VETTED_PINNED: Record<string, string> = {
  'astronomy-engine': '2.1.19',
};

/** 新增依赖里既不在名字白名单、也不在钉版本白名单的那些。 */
export function unvettedDeps(pkgDeps: string[], baseDeps: string[]): string[] {
  return pkgDeps.filter(k => !baseDeps.includes(k)
    && !SANCTIONED_DEPS.has(k) && !VETTED_PINNED[k]);
}

/** 钉版本的那几个是不是还钉着（^ ~ 或改版都算不钉）。 */
export function unpinned(deps: Record<string, string> | undefined): string[] {
  return Object.entries(VETTED_PINNED)
    .filter(([name, ver]) => (deps || {})[name] !== ver)
    .map(([name, ver]) => `${name} 应为 ${ver}，实得 ${(deps || {})[name] || '不在依赖里'}`);
}

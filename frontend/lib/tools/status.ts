import type { IntentGroup, ToolEntry, ToolStatus } from './catalog';

// 工具状态的唯一出处：圆点令牌、"算不算已开放"那条判据、门廊上的计数与那行文案。
// 2026-10-21 之前这些散在三处（门廊 app/page.tsx、目录 app/tools/page.tsx、
// 西方工作台 components/western/WesternWorkspace.tsx），三份 `status !== '未开放' && href`
// 迟早各数各的；而西方那份圆点还指向一个并不存在的令牌 `--color-border-strong`，
// 于是深底上"未开放"那个点根本看不见。

/** 「已开放」= 状态不是未开放**且**有入口。只看状态会放过"标了可用却没页面"的那种条目。 */
export function isLiveEntry(t: Pick<ToolEntry, 'status' | 'href'>): boolean {
  return t.status !== '未开放' && !!t.href;
}

/**
 * 圆点只当颜色编码，徽章上永远同时有文字（census 钉这条）。
 * 值走 token：`[data-mode="western"]` 里重指向，浅底与墨底各有各的达标取值 —— 同一支金
 * 在两种底上不可能同时达标（#b2955d 在白底只有 2.87:1）。
 * 实测对比度（非文本下限 3:1），底取 `#f5f5f7` / `#ffffff` 与 `#241a3d` / `#1b1030`：
 *   亮底 可用 4.44·4.83 / 未开放 3.33·3.62
 *   墨底 可用 5.69·6.29 / 未开放 4.49·4.98
 */
export const STATUS_DOT: Record<ToolStatus, string> = {
  可用: 'var(--color-status-open)',
  未开放: 'var(--color-status-closed)',
};

export interface StatusCount {
  live: number;
  open: number;
  closed: number;
  total: number;
}

/** 计数一律从目录现算。门廊抄一份数字，目录一改它就开始说谎。 */
export function statusCounts(groups: IntentGroup[]): StatusCount {
  const tools = groups.flatMap(g => g.tools);
  return {
    live: tools.filter(isLiveEntry).length,
    open: tools.filter(t => t.status === '可用').length,
    closed: tools.filter(t => t.status === '未开放').length,
    total: tools.length,
  };
}

/**
 * 门廊栏底那一行，计数始终由目录数据现场计算。
 */
export function statusTally(c: StatusCount): string {
  return `已开放 ${c.open} · 未开放 ${c.closed} · 共 ${c.total} 项`;
}

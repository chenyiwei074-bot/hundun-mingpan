'use client';

// 回执条（三档）。运维 2026-10-22 裁定：这一页不许再有"什么都穿红"的状态条 ——
// 载入一个样例、删掉一道墙，和识别失败，在旧版里长得一模一样，都是红底。
//
// 三档各自要同时满足两件事，缺一档就算没做：
//  · 颜色：info 中性 / pending 等待金 / danger 红（红只留给真正非法或失败）；
//  · 非颜色：档位前缀是**写出来的中文**，role 也不同（danger=alert 会打断读屏，
//    info/pending=status 只播报）。只靠颜色分档 = 色觉之外的人读不到这是哪一档。
//
// 前缀住在这里而不是各调用点自己写：一处定义，闸门钉的就是这一份表。

import type { ReactNode } from 'react';

export type CalloutTier = 'info' | 'pending' | 'danger';

export const CALLOUT_TAG: Record<CalloutTier, string> = {
  info: '提示', pending: '待你处理', danger: '失败',
};

export default function Callout({ tier, id, children }: {
  tier: CalloutTier; id?: string; children: ReactNode;
}) {
  return (
    <p className={`qn-callout qn-callout--${tier}`} id={id}
      role={tier === 'danger' ? 'alert' : 'status'} style={{ margin: '12px 0 0' }}>
      <span className="qn-callout__tag">{CALLOUT_TAG[tier]}</span>
      <span className="qn-callout__text">{children}</span>
    </p>
  );
}

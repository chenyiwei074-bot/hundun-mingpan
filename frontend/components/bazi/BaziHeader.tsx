"use client";

import type { BaziBasic } from "./types";
import { type as t, colors } from "./tokens";

interface BaziHeaderProps { basic: BaziBasic; }

export function BaziHeader({ basic }: BaziHeaderProps) {
  return (
    <div className="rounded-[18px] bg-white overflow-hidden"
      style={{ boxShadow: "none" }}>
      <div className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* 头像 — Apple 44px touch target */}
          <div className="w-[44px] h-[44px] rounded-full flex items-center justify-center text-sm font-serif font-bold"
            style={{ background: "rgba(178,149,93,0.10)", color: colors.accent }}>
            {basic.name?.charAt(0) || "?"}
          </div>
          <div>
            <p className="font-serif font-semibold tracking-[0.1em]" style={{ fontSize: t.body.size, fontWeight: 600, color: colors.ink }}>
              {basic.name || "未命名"}
            </p>
            <p style={{ fontSize: t.caption.size, color: "rgba(0,0,0,0.35)" }} className="mt-0.5">
              {basic.gender} · {basic.currentAge || "-"}岁
            </p>
          </div>
        </div>

        {/* 编辑 — 最小存在感，44px touch target */}
        <button className="w-[44px] h-[44px] flex items-center justify-center rounded-full
                           transition-all duration-300 active:scale-95"
          style={{ color: "rgba(0,0,0,0.20)" }}>
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/>
          </svg>
        </button>
      </div>

      {/* 日期行 — 无 border-top，靠留白分隔 */}
      <div className="px-6 pb-5 grid grid-cols-2 gap-2">
        <div>
          <span className="mr-2" style={{ fontSize: t.caption.size, color: "rgba(0,0,0,0.22)" }}>阴历</span>
          <span className="font-serif" style={{ fontSize: t.body.size, color: "rgba(0,0,0,0.50)" }}>{basic.lunarDate}</span>
        </div>
        <div>
          <span className="mr-2" style={{ fontSize: t.caption.size, color: "rgba(0,0,0,0.22)" }}>阳历</span>
          <span className="font-serif" style={{ fontSize: t.body.size, color: "rgba(0,0,0,0.50)" }}>{basic.solarDate}</span>
        </div>
      </div>
    </div>
  );
}

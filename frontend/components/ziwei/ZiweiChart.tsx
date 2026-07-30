"use client";

import type { ZiweiChartData } from "./types";
import ZiweiGongs from "./ZiweiGongs";

interface ZiweiChartProps {
  data: ZiweiChartData;
  className?: string;
}

export function ZiweiChart({ data, className = "" }: ZiweiChartProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      <ZiweiGongs
        gongs={data.gongs}
        mingGongIndex={data.mingGongIndex}
        shenGongIndex={data.shenGongIndex}
      />
    </div>
  );
}

export default ZiweiChart;

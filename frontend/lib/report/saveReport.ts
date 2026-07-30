// 统一报告保存 — 八字/紫微/六爻 共用

import { getVisitorId } from '@/lib/auth/visitor';
import type { ReportType } from './types';

interface SaveParams {
  type: ReportType;
  title: string;
  inputJson: Record<string, any>;
  resultJson?: Record<string, any>;
  analysisJson?: Record<string, any>;
  reportText?: string;
}

export async function saveReport(params: SaveParams): Promise<{ id: string } | null> {
  const visitorId = getVisitorId();
  if (!visitorId) return null;

  try {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId,
        type: params.type,
        title: params.title,
        inputJson: params.inputJson,
        resultJson: params.resultJson || null,
        analysisJson: params.analysisJson || null,
        reportText: params.reportText || null,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      console.error('saveReport failed:', data.error);
      return null;
    }
    return { id: data.data.id };
  } catch (e) {
    console.error('saveReport error:', e);
    return null;
  }
}
import type { Request, Response } from 'express';
import { allSources, findSources, type SourceRef } from '../services/classics-registry';

/**
 * GET /api/classics/sources?ids=a,b,c
 *
 * 只读登记表出口：
 *  - 无 ids → 返回全部（条数很少，用于前端/验收浏览）；
 *  - 有 ids → 只回这些；含未知 id 时 404 并列出缺失（不返回半条，避免前端以为拿到完整依据）；
 *  - 单次 ids 上限 50；空串按无参处理。
 *
 * 这个接口不生成任何文字、不调模型：quote 一律来自 docs/classics 已入仓底本。
 */
export function getClassicSources(req: Request, res: Response) {
  try {
    const raw = String(req.query.ids || '').trim();
    const ids = raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (ids.length > 50) {
      return res.status(400).json({ success: false, error: '单次最多 50 个 id' });
    }
    if (!ids.length) {
      const sources: SourceRef[] = allSources();
      return res.json({ success: true, data: { count: sources.length, sources } });
    }
    const { found, missing } = findSources(ids);
    if (missing.length) {
      return res.status(404).json({
        success: false,
        error: `以下 id 不在已入仓底本登记表：${missing.join(', ')}`,
        data: { found: found.map(s => s.sourceId), missing },
      });
    }
    return res.json({ success: true, data: { count: found.length, sources: found } });
  } catch (error) {
    console.error('[classics/sources] 失败:', error instanceof Error ? error.message : error);
    return res.status(500).json({ success: false, error: '来源登记表读取失败' });
  }
}

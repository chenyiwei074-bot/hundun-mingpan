/**
 * 数据保留期清理（2026-10-24 裁定：命盘与报告保留 7 天）。
 *
 * 用法：
 *   node server/node_modules/tsx/dist/cli.mjs --tsconfig=server/tsconfig.json \
 *     server/src/scripts/retention.ts            # dry-run（默认，只打印数量）
 *     ... retention.ts --apply                   # 真正删除
 *
 * - 删除范围：charts 与 reports 中 createdAt 早于保留期的行；回执摘要/台账不在此列
 *   （哈希不含原文，且台账不可篡改）。
 * - dry-run 是默认值：不传 --apply 永远不删。
 * - 保留天数由 DATA_RETENTION_DAYS 覆盖，默认 7。
 */
import prisma from '../database';

const APPLY = process.argv.includes('--apply');
const DAYS = Number(process.env.DATA_RETENTION_DAYS || 7);

async function main() {
  const cutoff = new Date(Date.now() - DAYS * 86400000);
  const where = { createdAt: { lt: cutoff } };

  const [charts, reports] = await Promise.all([
    prisma.chart.count({ where: where as any }),
    prisma.report.count({ where: where as any }),
  ]);

  console.log(JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    retentionDays: DAYS,
    cutoff: cutoff.toISOString(),
    chartsToDelete: charts,
    reportsToDelete: reports,
  }));

  if (!APPLY) {
    console.log('dry-run：没有删除任何行；加 --apply 才执行。');
    return;
  }

  // 先删报告再删命盘：报告没有外键指向 charts，但顺序保持"派生数据先走"。
  const deletedReports = await prisma.report.deleteMany({ where: where as any });
  const deletedCharts = await prisma.chart.deleteMany({ where: where as any });
  console.log(JSON.stringify({
    deletedReports: deletedReports.count,
    deletedCharts: deletedCharts.count,
  }));
}

main()
  .catch(error => {
    console.error('[retention] 失败:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

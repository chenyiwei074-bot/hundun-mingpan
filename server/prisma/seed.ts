// 初始化产品数据 — npx ts-node server/prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const products = [
  {
    type: 'bazi',
    name: '八字深度解析报告',
    description: 'AI驱动的八字命盘深度分析，包含五行强弱、格局判断、大运走势',
    price: 138,
    features: JSON.stringify([
      '五行旺衰分析',
      '十神格局判断',
      '大运走势推演',
      '流年运势分析',
      '用神喜忌建议',
      'PDF报告下载',
    ]),
  },
  {
    type: 'ziwei',
    name: '紫微斗数深度报告',
    description: '紫微斗数十二宫完整排盘与分析，涵盖命宫、财帛、事业、感情',
    price: 138,
    features: JSON.stringify([
      '十二宫完整排盘',
      '主星辅星解析',
      '四化飞星推演',
      '三方四正对照',
      '大限流年分析',
      'PDF报告下载',
    ]),
  },
  {
    type: 'liuyao',
    name: '六爻深度预测报告',
    description: '六爻纳甲完整排盘与AI深度解读，包含世应、用神、动爻分析',
    price: 68,
    features: JSON.stringify([
      '世应关系分析',
      '用神旺衰判断',
      '动爻变化详解',
      '冲合关系解析',
      '趋势吉凶判断',
      '行动时机建议',
    ]),
  },
];

async function main() {
  console.log('Seeding products...');
  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { type: p.type } });
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data: p });
      console.log(`  Updated: ${p.name}`);
    } else {
      await prisma.product.create({ data: p });
      console.log(`  Created: ${p.name}`);
    }
  }
  console.log('Done.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
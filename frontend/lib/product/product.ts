// 产品服务

import type { ReportType } from '@/lib/report/types';

export interface ProductInfo {
  id: string;
  type: ReportType;
  name: string;
  description: string;
  price: number;
  features: string[];
  enabled: boolean;
}

const MOCK_PRODUCTS: Record<string, ProductInfo> = {
  bazi: {
    id: 'prod_bazi',
    type: 'bazi',
    name: '八字深度解析报告',
    description: 'AI驱动的八字命盘深度分析',
    price: 138,
    features: ['五行旺衰分析', '十神格局判断', '大运走势推演', '流年运势分析', '用神喜忌建议'],
    enabled: true,
  },
  ziwei: {
    id: 'prod_ziwei',
    type: 'ziwei',
    name: '紫微斗数深度报告',
    description: '紫微斗数十二宫完整排盘与分析',
    price: 138,
    features: ['十二宫完整排盘', '主星辅星解析', '四化飞星推演', '三方四正对照', '大限流年分析'],
    enabled: true,
  },
  liuyao: {
    id: 'prod_liuyao',
    type: 'liuyao',
    name: '六爻深度预测报告',
    description: '六爻纳甲完整排盘与AI深度解读',
    price: 68,
    features: ['世应关系分析', '用神旺衰判断', '动爻变化详解', '冲合关系解析', '趋势吉凶判断'],
    enabled: true,
  },
};

/** 根据类型获取产品信息（兜底用前端 mock，后续接 API） */
export function getProductByType(type: ReportType): ProductInfo | null {
  return MOCK_PRODUCTS[type] || null;
}

export function getProductPrice(type: ReportType): number {
  return MOCK_PRODUCTS[type]?.price || 0;
}
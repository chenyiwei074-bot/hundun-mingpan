// 报告上下文构建器 — LiuyaoResult + LiuyaoAnalysisData → LiuyaoReportContext

import type { LiuyaoResult } from '@/types/liuyao';
import type { LiuyaoAnalysisData } from '@/lib/liuyao/analysis';
import type { LiuyaoReportContext, ReportShiYing, ReportYongShen, ReportDongYaoItem, ReportWangShuaiItem, ReportRelationSummary, FuShenSummary } from './types';

const YAO_LABELS = ['初爻','二爻','三爻','四爻','五爻','上爻'];
const METHOD_LABELS: Record<string,string> = { coin:'铜钱摇卦', time:'时间起卦', number:'数字起卦' };

/** 世应关系增强文本 */
function describeRelation(data: LiuyaoAnalysisData['shiYing']): ReportShiYing | null {
  if (!data) return null;
  return {
    shiPosition: data.shiPosition + 1,
    shiLabel: YAO_LABELS[data.shiPosition],
    shiLiuQin: data.shiLiuQin,
    shiWuxing: data.shiWx,
    shiGanZhi: '', // 从 naJia 补充
    yingPosition: data.yingPosition + 1,
    yingLabel: YAO_LABELS[data.yingPosition],
    yingLiuQin: data.yingLiuQin,
    yingWuxing: data.yingWx,
    yingGanZhi: '',
    relation: data.relation,
    chongHe: data.relation.includes('相冲') ? '相冲' : data.relation.includes('相合') ? '相合' : '—',
  };
}

/** 用神评估 */
function assessYongShen(pos: { wangShuai: string; isShi: boolean; isDong: boolean }): string {
  if (pos.isShi && pos.isDong) return '用神持世且动，吉象明显';
  if (pos.isShi) return '用神持世，根基稳固';
  if (pos.isDong && (pos.wangShuai === '旺' || pos.wangShuai === '相')) return '用神发动得时，力强可用';
  if (pos.wangShuai === '旺' || pos.wangShuai === '相') return '用神旺相，得月日之气';
  if (pos.wangShuai === '死' || pos.wangShuai === '囚') return '用神衰弱，需待时转运';
  return '用神平位';
}

/** 动爻影响说明 */
function describeDongImpact(from: string, to: string, fromWx: string, toWx: string): string {
  const WX_SHENG: Record<string,string> = { '木':'火','火':'土','土':'金','金':'水','水':'木' };
  const WX_KE: Record<string,string> = { '木':'土','土':'水','水':'火','火':'金','金':'木' };
  if (WX_SHENG[fromWx] === toWx) return `${from}${fromWx}化${to}${toWx}为化生，吉`;
  if (WX_KE[fromWx] === toWx) return `${from}${fromWx}化${to}${toWx}为化克，不吉`;
  if (fromWx === toWx) return `${from}化${to}，同位不变`;
  return `${from}${fromWx}变${to}${toWx}`;
}

/** 构建完整报告上下文 */
export function buildReportContext(
  result: LiuyaoResult,
  analysis: LiuyaoAnalysisData
): LiuyaoReportContext {

  // 世应
  const shiYing: ReportShiYing = describeRelation(analysis.shiYing) || {
    shiPosition: 0, shiLabel: '', shiLiuQin: '', shiWuxing: '', shiGanZhi: '',
    yingPosition: 0, yingLabel: '', yingLiuQin: '', yingWuxing: '', yingGanZhi: '',
    relation: '', chongHe: '—',
  };

  // 补充世应干支
  if (analysis.shiYing) {
    const sYao = result.naJia.find(y => y.position === analysis.shiYing!.shiPosition + 1);
    const yYao = result.naJia.find(y => y.position === analysis.shiYing!.yingPosition + 1);
    if (sYao) shiYing.shiGanZhi = sYao.ganZhi;
    if (yYao) shiYing.yingGanZhi = yYao.ganZhi;
  }

  // 用神
  const yongShen: ReportYongShen = {
    name: analysis.yongShen.yongShen,
    found: analysis.yongShen.positions.length > 0,
    positions: analysis.yongShen.positions.map(p => ({
      position: p.position,
      label: YAO_LABELS[p.position - 1],
      liuQin: p.liuQin,
      ganZhi: p.ganZhi,
      wuxing: p.wuxing,
      wangShuai: p.wangShuai,
      isShi: p.shiYing === '世',
      isYing: p.shiYing === '应',
      isDong: p.isDong,
      assessment: assessYongShen({ wangShuai: p.wangShuai, isShi: p.shiYing === '世', isDong: p.isDong }),
    })),
  };

  // 动爻
  const dongYao: ReportDongYaoItem[] = analysis.dongYao.map(d => ({
    position: d.position,
    label: YAO_LABELS[d.position - 1],
    yaoLabel: d.before.label,
    from: { liuQin: d.before.liuQin, ganZhi: d.before.ganZhi, wuxing: d.before.wuxing },
    to: d.after ? { liuQin: d.after.liuQin, ganZhi: d.after.ganZhi, wuxing: d.after.wuxing } : null,
    impact: d.after ? describeDongImpact(d.before.liuQin, d.after.liuQin, d.before.wuxing, d.after.wuxing) : '—',
  }));

  // 旺衰
  const wangShuai: ReportWangShuaiItem[] = analysis.yaoStatus.map((ws, i) => {
    const nj = result.naJia[i];
    return {
      position: i + 1,
      label: YAO_LABELS[i],
      liuQin: nj?.liuQin || '',
      zhi: nj?.naZhi || '',
      wuxing: nj?.naZhi || '?',
      level: ws.wangShuai,
      monthInfluence: ws.monthInfluence,
      dayInfluence: ws.dayInfluence,
    };
  });

  // 冲合关系
  const relations: ReportRelationSummary = {
    liuHeCount: analysis.hexagramRelations.liuHe.length,
    liuChongCount: analysis.hexagramRelations.liuChong.length,
    sanHeCount: analysis.hexagramRelations.sanHe.length,
    details: [
      ...analysis.hexagramRelations.liuHe.map(h => `${YAO_LABELS[h.positions[0]-1]}${h.zhi[0]}与${YAO_LABELS[h.positions[1]-1]}${h.zhi[1]}六合`),
      ...analysis.hexagramRelations.liuChong.map(c => `${YAO_LABELS[c.positions[0]-1]}${c.zhi[0]}与${YAO_LABELS[c.positions[1]-1]}${c.zhi[1]}六冲`),
      ...analysis.hexagramRelations.sanHe.map(s => `${YAO_LABELS[s.positions[0]-1]}${s.zhi[0]}、${YAO_LABELS[s.positions[1]-1]}${s.zhi[1]}、${YAO_LABELS[s.positions[2]-1]}${s.zhi[2]}三合${s.ju}`),
    ],
  };

  // 伏神
  const fuShen: FuShenSummary = {
    exist: analysis.fuShen.length > 0,
    items: analysis.fuShen.map(f => ({
      position: f.position,
      label: YAO_LABELS[f.position - 1],
      flying: `${f.flyingLiuQin} ${f.flyingGanZhi}(${f.flyingWuxing})`,
      hidden: `${f.hiddenLiuQin} ${f.hiddenGanZhi}(${f.hiddenWuxing})`,
      hiddenGanZhi: f.hiddenGanZhi,
    })),
  };

  return {
    question: result.question,
    questionType: result.questionType,
    method: METHOD_LABELS[result.method] || result.method,
    dateTime: `${result.date.year}年${String(result.date.month).padStart(2,'0')}月${String(result.date.day).padStart(2,'0')}日 ${String(result.date.hour).padStart(2,'0')}:${String(result.date.minute).padStart(2,'0')}`,
    ganZhi: {
      year: result.ganZhi.year,
      month: result.ganZhi.month,
      day: result.ganZhi.day,
      hour: result.ganZhi.hour,
    },
    xunKong: result.xunKong,
    benGua: {
      name: result.benGua.name,
      gong: result.benGua.gong,
      wuxing: result.benGua.wuxing,
      shangGua: result.benGua.shangGua,
      xiaGua: result.benGua.xiaGua,
    },
    bianGua: result.bianGua.name ? {
      name: result.bianGua.name,
      gong: result.bianGua.gong || '',
      wuxing: result.bianGua.wuxing || '',
      shangGua: '',
      xiaGua: '',
    } : null,
    shiYing,
    yongShen,
    dongYao,
    wangShuai,
    relations,
    fuShen,
  };
}
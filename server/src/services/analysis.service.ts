import { DeepSeekProvider } from './ai/DeepSeekProvider';
import { FreeModelProvider } from './ai/FreeModelProvider';
import type { ChartResult } from '../core';
import * as path from 'path';
import * as fs from 'fs';

const deepseekProvider = new DeepSeekProvider();
const freeModelProvider = new FreeModelProvider();

/** 免费模型优先（A 方案）；未配置 FREE_AI_* 时回落 DeepSeek，行为与之前一致 */
async function pickProvider() {
  if (await freeModelProvider.isAvailable()) return freeModelProvider;
  return deepseekProvider;
}

function getPrompt(depth?: string): string {
  // B 方案：brief 用精简 prompt（2KB，同 JSON 结构）；detail 用完整版（6.7KB）
  const file = depth === 'detail' ? 'comprehensive-analysis.txt' : 'brief-analysis.txt';
  return fs.readFileSync(path.join(__dirname, '..', 'prompts', file), 'utf-8');
}


/** 六节完整性：短可以，漏一面不行（用户 2026-10-23 口径） */
const EXPECT_ASPECTS = ['天赋', '财', '感情', '事业', '健康', '未来'];
function readingSections(result: any): Array<{ title: string; body: string }> {
  const raw = Array.isArray(result?.sections) ? result.sections : [];
  return raw.map((s: any) => ({ title: String(s?.title || ''), body: String(s?.body || s?.text || '') }));
}
function incompleteAspects(result: any): string[] {
  const secs = readingSections(result);
  if (!secs.length) return ['没有 sections（不是六段结构）'];
  const miss: string[] = [];
  if (secs.length < EXPECT_ASPECTS.length) miss.push(`只有 ${secs.length} 节`);
  const text = secs.map(s => s.title + s.body).join('\n');
  const absent = EXPECT_ASPECTS.filter(k => !text.includes(k));
  if (absent.length) miss.push('缺方面：' + absent.join('、'));
  const short = secs.filter(s => s.body.length < 50);
  if (short.length) miss.push(`${short.length} 节正文过短`);
  return miss;
}

function buildChartSummary(chart: ChartResult): Record<string, unknown> {
  const bz = chart.bazi as any;
  const zw = chart.ziwei as any;
  const en = bz.enrichment || {};

  return {
    birthInfo: {
      solar: bz.birthInfo.year + '-' + String(bz.birthInfo.month).padStart(2,'0') + '-' + String(bz.birthInfo.day).padStart(2,'0') + ' ' + String(bz.birthInfo.hour).padStart(2,'0') + ':' + String(bz.birthInfo.minute).padStart(2,'0'),
      gender: bz.birthInfo.gender === 'male' ? '男' : '女',
      lunarDate: zw.lunarDate ? (zw.lunarDate.year + '年' + zw.lunarDate.monthCn + '月' + zw.lunarDate.dayCn) : ''
    },
    bazi: {
      siZhu: {
        year: bz.siZhu.year.gan + bz.siZhu.year.zhi,
        month: bz.siZhu.month.gan + bz.siZhu.month.zhi,
        day: bz.siZhu.day.gan + bz.siZhu.day.zhi,
        hour: bz.siZhu.hour.gan + bz.siZhu.hour.zhi
      },
      dayMaster: bz.dayMaster,
      dayunStart: bz.dayunStart,
      shiShen: bz.shiShen || {},
      cangGan: bz.cangGan || {},
      naYin: bz.naYin || {},
      zhangSheng: bz.zhangSheng || {},
      enrichment: {
        geju: en.格局 || {},
        wangshuai: en.旺衰 || {},
        tiaohou: en.调候用神 || [],
        wuxing: en.五行统计 || {},
        yueling: en.月令 || {}
      },
      dayun: (bz.dayun || []).slice(0, 5).map((d: any) => ({
        ganZhi: d.ganZhi.gan + d.ganZhi.zhi,
        ageRange: d.startAge + '-' + d.endAge + '岁',
        yearRange: d.startYear + '-' + d.endYear,
        shiShen: d.ganShiShen || d.zhiShiShen || ''
      }))
    },
    ziwei: {
      mingGong: zw.gongs?.[0] ? {
        gong: zw.gongs[0].gong,
        ganZhi: (zw.gongs[0].tiangan||'') + (zw.gongs[0].dizhi||''),
        mainStars: zw.gongs[0].mainStars || [],
        auxStars: zw.gongs[0].auxStars || [],
        sihua: zw.gongs[0].sihua || []
      } : null,
      shenGong: zw.gongs?.[zw.shenGongIndex] ? {
        gong: zw.gongs[zw.shenGongIndex].gong,
        ganZhi: (zw.gongs[zw.shenGongIndex].tiangan||'') + (zw.gongs[zw.shenGongIndex].dizhi||''),
        mainStars: zw.gongs[zw.shenGongIndex].mainStars || []
      } : null,
      wuxingJu: zw.wuXingJu?.name || '',
      yinYang: zw.yinYang || '',
      mingZhu: '',
      shenZhu: '',
      allGongs: (zw.gongs || []).map((g: any) => ({
        gong: g.gong,
        ganZhi: (g.tiangan||'') + (g.dizhi||''),
        mainStars: g.mainStars || [],
        auxStars: g.auxStars || [],
        sihua: g.sihua || [],
        daXian: g.daXian ? (g.daXian.startAge + '-' + g.daXian.endAge + '岁') : ''
      }))
    }
  };
}

/**
 * 给命盘解读的每个章节补齐 sourceIds。
 *
 * 2026-10-24 契约：前端把「没有 sourceIds」的章节标成「本站自研」。
 * 因此这里只允许写入**已登记且确实支持该章节**的来源；当前底本尚不足以做章节级匹配，
 * 一律返回空数组（空 = 本站自研），绝不把模型自报的来源或整份报告的来源挂到章节上。
 * 后续接入底本匹配时，只在这个函数里填；AI 返回值中的 sourceIds 一律不信。
 */
export function attachVerifiedSourceIds(result: Record<string, unknown>): Record<string, unknown> {
  const sections = Array.isArray(result.sections) ? result.sections : null;
  if (!sections) return result;
  return {
    ...result,
    sections: sections.map((section) => {
      if (!section || typeof section !== 'object') return section;
      const raw = section as Record<string, unknown>;
      return { ...raw, sourceIds: [] };
    }),
  };
}

export async function generateAIAnalysis(chart: ChartResult, persona?: string, depth?: string): Promise<Record<string, unknown>> {
  const chartSummary = buildChartSummary(chart);

  const isDetail = depth === 'detail';
  const prompt = getPrompt(isDetail ? 'detail' : 'brief');

  console.log('Calling DeepSeek for comprehensive analysis...');
  const startTime = Date.now();

    // Inject persona and depth instructions
  let styleInstruction = '';
  if (persona === 'casual') {
    styleInstruction += '\n\n【风格要求：随性风趣】请用口语化、幽默的方式表达，像老朋友聊天一样，可以用比喻、俗语，但专业内容不能出错。避免学术化用语。';
  } else {
    styleInstruction += '\n\n【风格要求：客观专业】请用严谨、克制、引经据典的方式表达，像博士生导师一样，逻辑严密。引用古籍原文时注明出处。';
  }
  if (depth === 'detail') {
    styleInstruction += '\n【深度要求：详批】请逐柱逐宫详细分析，每个论断都要有古籍依据。输出3000字以上。';
  } else {
    // 2026-10-23 用户口径：可以短，但六个方面不能漏
    styleInstruction += '\n【深度要求：速读版】总字数 600–1600 字即可，宁可短；但六节必须都在，每节至少 3 句，'
      + '某一面信息不足就明写「这一方面信息不足，先不乱断」，不许省略该节。';
  }

  const provider = await pickProvider();
  const req = {
    chartData: chartSummary,
    type: 'comprehensive' as const,
    promptOverride: prompt + styleInstruction + '\n\n请基于以下命盘数据生成分析 JSON：',
    // C 方案：brief 收紧输出上限（4k），detail 才给 16k
    maxTokens: isDetail ? 16384 : 4096,
  };
  let response;
  try {
    response = await provider.generateAnalysis(req);
  } catch (e) {
    if (provider !== deepseekProvider) {
      console.warn('[AI] 免费模型失败，回落 DeepSeek:', e instanceof Error ? e.message : e);
      response = await deepseekProvider.generateAnalysis(req);
    } else {
      throw e;
    }
  }

  const elapsed = Date.now() - startTime;
  console.log('DeepSeek analysis completed in ' + elapsed + 'ms, tokens: ' + (response.tokensUsed || '?'));

  // 2026-10-23：速读版必须六方面齐全；不齐就带着缺项重试一次（只重试一次，避免拖长等待）。
  if (isDetail) return attachVerifiedSourceIds(response.result as Record<string, unknown>);
  const missing = incompleteAspects(response.result);
  if (!missing.length) return attachVerifiedSourceIds(response.result as Record<string, unknown>);
  console.warn('[AI] 解读不完整，重试一次：' + missing.join('；'));
  try {
    const retry = await provider.generateAnalysis({
      ...req,
      promptOverride: req.promptOverride
        + '\n\n上一版不完整：' + missing.join('；')
        + '。请重新输出完整 JSON：六节都必须有，每节至少 3 句；某方面信息不足也要保留该节并写明。',
    });
    const retryMissing = incompleteAspects(retry.result);
    if (!retryMissing.length) return attachVerifiedSourceIds(retry.result as Record<string, unknown>);
    console.warn('[AI] 重试后仍不完整：' + retryMissing.join('；'));
    const better = readingSections(retry.result).length >= readingSections(response.result).length
      ? retry.result : response.result;
    return attachVerifiedSourceIds(better as Record<string, unknown>);
  } catch (e) {
    console.warn('[AI] 重试失败，返回第一版：' + (e instanceof Error ? e.message : e));
    return attachVerifiedSourceIds(response.result as Record<string, unknown>);
  }
}

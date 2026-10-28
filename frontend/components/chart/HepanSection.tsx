'use client';

// 合盘（两人对照）—— 嵌在命盘结果页里的一节，不新增路由、不新增入口。
//
// 无条件挂载（结果页 164-165 那条约定）：没有对方数据时这一节自己走降级分支，
// 给一个能当场填的表单，而不是整节消失 —— 用户分不清"这站没这功能"和"我的盘没算出来"。
//
// 对方那张盘在本机现排：createChart + buildTrueSolarWiring 走的是和我自己排盘同一条路，
// 两边同口径才可比。整个过程零请求，对方生辰不进 API。

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createChart } from '@/app/lib/core/yiqi-core';
import type { BirthInfo } from '@/app/lib/core/yiqi-core';
import { enrichBazi } from '@/app/lib/core/bazi-enrich/enrich';
import { buildTrueSolarWiring } from '@/app/lib/true-solar/birth-wiring';
import { lookupChinaGeo } from '@/app/lib/api';
import type { ChinaGeoLookup } from '@/app/lib/api';
import { toCivilInput, leapMonthOfYear, lunarDayCount } from '@/app/lib/core/yiqi-core/lunar-input';
import { provinces as regionProvinces } from '@/app/lib/region-data';
import { analyzeHepan } from '@/lib/hepan/engine';
import type { HepanReport } from '@/lib/hepan/types';
import { clearPartner, isPersisted, loadPartner, savePartner } from '@/lib/hepan/local-store';
import type { PartnerDraft } from '@/lib/hepan/local-store';
import ToolInterpretation from '@/components/ai/ToolInterpretation';

const MIN_OPTIONS = ['00', '15', '30', '45'];

/** 从一张盘的英文键四柱现算五行统计。
 *  不读 chart.bazi.enrichment：那是服务端挂上去的，本机现排的盘（对方盘、降级分支里
 *  的 chart_preview）根本没有这个字段；而且两边各自读各自来源，"同口径才可比"这句话
 *  就不成立了。这里两边都走同一个本机函数。 */
function wuxingOf(chart: any): Record<string, number> | undefined {
  const s = chart?.bazi?.siZhu;
  if (!s?.year || !s?.month || !s?.day || !s?.hour) return undefined;
  try {
    const 统 = enrichBazi({ '年': s.year, '月': s.month, '日': s.day, '时': s.hour } as never).五行统计;
    return 统 as unknown as Record<string, number>;
  } catch { return undefined; }
}

interface Props { chartData: any }

export default function HepanSection({ chartData }: Props) {
  const [draft, setDraft] = useState<PartnerDraft | null>(null);
  const [同意, set同意] = useState(false);
  const [留存, set留存] = useState(false);
  const [已存, set已存] = useState(false);
  const [存成, set存成] = useState(false);
  const [提示, set提示] = useState<string | null>(null);
  const [partnerGeo, setPartnerGeo] = useState<ChinaGeoLookup | null>(null);

  useEffect(() => {
    const p = loadPartner();
    if (p) { setDraft(p); set留存(isPersisted()); }
  }, []);

  // 我这一侧的五行统计：后端权威盘带 bazi.enrichment，但结果页的降级分支吃的是本机
  // chart_preview（fallbackToSession），那份没有 enrichment。两边都走同一条本机
  // enrichBazi 现算，"五行数量并排"才不会只在其中一条路上静默不出。
  const 我 = useMemo(() => {
    // gender / 原始输入都在 bazi.birthInfo 上（引擎把入参原样留在盘里），
    // 不在 bazi 顶层 —— 读错一层的后果是每位女命都被当成男命排十神，而且不报错。
    const bi = chartData?.bazi?.birthInfo;
    const pad = (v: unknown) => String(v ?? '').padStart(2, '0');
    return {
      chart: chartData,
      meta: {
        称呼: '我', 性别: (bi?.gender === 'female' ? '女' : '男') as '男' | '女',
        原始输入: bi?.year
          ? `${bi.isLunar ? '农历' : '公历'}${bi.isLeapMonth ? '（闰月）' : ''} ${bi.year}-${pad(bi.month)}-${pad(bi.day)} ${pad(bi.hour)}:${pad(bi.minute)}`
          : '本盘（盘上没带回来时的原始输入）',
      },
      五行统计: wuxingOf(chartData),
    };
  }, [chartData]);

  // 闰月按「派生」方式使用：月或年一变，stale 的 isLeapMonth 立刻判 false，
  // 永远凑不出"month ≠ 该年闰月"这种换算层会直接抛错的组合（与建盘页同一手法）。
  // 提到组件作用域，是因为下方那个开关的显隐要用同一个值，两处各推一份迟早会分叉。
  useEffect(() => {
    if (!draft?.省份) { setPartnerGeo(null); return; }
    let alive = true;
    lookupChinaGeo(draft.省份, draft.城市 || undefined, draft.区县 || undefined)
      .then(g => { if (alive) setPartnerGeo(g); });
    return () => { alive = false; };
  }, [draft?.省份, draft?.城市, draft?.区县]);

  const 闰 = draft?.isLunar && Number(draft.year) > 0 ? leapMonthOfYear(Number(draft.year)) : 0;
  const 闰月开 = !!(闰 > 0 && draft?.isLeapMonth && Number(draft?.month) === 闰);

  const 对方盘 = useMemo(() => {
    if (!draft) return null;
    const y = Number(draft.year), m = Number(draft.month), d = Number(draft.day);
    const h = Number(draft.hour), mi = Number(draft.minute);
    if (!(y > 0 && m > 0 && d > 0)) return { err: '对方年/月/日没填全，排不出盘。' };
    if (m > 12 || d > 31 || h > 23) return { err: `对方的月/日/时超出可排的范围（月≤12、日≤31、时 0–23），这一条先不排盘。` };
    // 日期是自由输入，没有下拉可依赖：农历模式下"腊月三十"这类日子得按当月真实天数判。
    if (draft.isLunar) {
      const n = lunarDayCount(y, m, 闰月开);
      if (n <= 0) return { err: `对方那个农历年没有闰${m}月，这一条先不排盘。` };
      if (d > n) return { err: `对方那个农历月只有 ${n} 天，填的是 ${d}，请重填日期。` };
    }
    try {
      // 农历必须先换算成公历：历史夏令时与真太阳时校正都活在公历轴上，把农历数字
      // 直接喂给 buildTrueSolarWiring 会按错误的日期取到错误的时区（建盘页 121-123
      // 写明了这条）。换算只用于这两步，BirthInfo 仍报用户原始输入。
      const civil = toCivilInput({ year: y, month: m, day: d, hour: h, minute: mi, isLunar: draft.isLunar, isLeapMonth: 闰月开 });
      const wiring = buildTrueSolarWiring(
        { province: draft.省份 || '北京', city: draft.城市 || '北京', district: draft.区县 || '' },
        { year: civil.year, month: civil.month, day: civil.day, hour: civil.hour, minute: civil.minute },
        partnerGeo ? { geoOverride: partnerGeo } : {},
      );
      const info: BirthInfo = {
        year: y, month: m, day: d, hour: h, minute: mi,
        isLunar: draft.isLunar, isLeapMonth: 闰月开,
        gender: draft.性别 === '男' ? 'male' : 'female',
        timeZone: wiring.timeZone, longitude: wiring.longitude, dstOffset: wiring.dstOffset,
        enableTrueSolarTime: true,
      };
      const chart = createChart(info);
      return {
        party: {
          chart,
          五行统计: wuxingOf(chart),
          meta: {
            称呼: draft.称呼 || '对方', 性别: draft.性别,
            原始输入: `${draft.isLunar ? '农历' : '公历'}${闰月开 ? `（闰${闰}月）` : ''} ${draft.year}-${draft.month}-${draft.day} ${draft.hour}:${draft.minute}`
              + ` · ${draft.省份 || '北京'}${draft.城市 || ''}${draft.区县 || ''}`
              + `${wiring.warning ? `（${wiring.warning}）` : ''}`,
          },
        },
      };
    } catch (e) {
      return { err: `对方盘排不出来：${(e as Error)?.message || e}` };
    }
  }, [draft, partnerGeo]);

  // 出错也走返回值，不在 memo 里 setState：memo 在 render 阶段跑，那时候改状态
  // 会触发 React 的"render 期间更新别的组件"告警，严重时会循环渲染。
  const 对照 = useMemo((): { report: HepanReport | null; err: string | null } => {
    if (!对方盘) return { report: null, err: null };
    if ('err' in 对方盘) return { report: null, err: null };
    try { return { report: analyzeHepan({ 我, 对方: 对方盘.party }), err: null }; }
    catch (e) { return { report: null, err: `对照算崩了：${(e as Error)?.message || e}` }; }
  }, [我, 对方盘]);
  const report = 对照.report;

  const patch = (p: Partial<PartnerDraft>) => setDraft(d => (d ? { ...d, ...p } : d));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (!同意) { set提示('没勾「已获得对方同意」，不存。'); return; }
    savePartner(draft, 留存);
    set已存(true);
    // 提示按存进去没有说，不按用户勾了什么说：无痕模式 / 存储被禁时 setItem 会抛，
    // 那一层已经吞掉了错误（不能让这一节崩），但页面不能因此宣称"已留在设备上"。
    const 真存 = isPersisted();
    set存成(真存);
    set提示(留存 && 真存
      ? '已选择在这台设备保留，到期后失效；你也可以随时清除。'
      : 留存 && !真存
        ? '当前浏览器不支持保留，这份资料只在本次打开期间使用。'
        : '这份资料只在本次打开期间使用，关闭页面后即清除。');
  }

  return (
    <section className="qn-card" id="hepan" data-hepan="1">
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <p className="qn-cap" style={{ margin: 0 }}>合盘 · 两人对照</p>
      </div>

      <p className="qn-meta" style={{ marginTop: 6 }}>本站自研 · 合盘结构对照</p>
      <p className="qn-note" style={{ marginTop: 8 }}>
        这一节并列两张盘中可核对的结构，<strong>不出评分、不出匹配度，也不替双方判断是否合适</strong>。
        结果供双方了解盘面差异与相似处。
      </p>

      {!draft && (
        <div style={{ marginTop: 12 }}>
          <p className="qn-body" style={{ margin: 0 }}>
            还没有对方的生辰。填了就在本机排一张盘出来对照 ——
            <strong>对方生辰需要本人同意才能填</strong>，这是这一节的前提，不是提示语。
          </p>
          <p className="qn-meta" style={{ marginTop: 6 }}>
            对方资料只用于本次对照，不会加入你的命盘报告。默认在关闭页面后清除。
          </p>
          {/* 句中那个 17px 的「建盘」链接是 D1 那一类：它把一整句话变成命中区，四个角都点不中。
              要留入口就做成真控件 —— 单起一行、44×44、与正文不重叠。 */}
          <div className="qn-linkrow">
            <Link href="/create" className="qn-link">进入 · 建盘页（双人合盘）</Link>
          </div>
          <button type="button" id="hp-open" className="qn-btn qn-btn--ghost" style={{ marginTop: 10, minHeight: 44 }}
            onClick={() => { setDraft({ 称呼: '', 性别: '女', year: '', month: '', day: '', hour: '12', minute: '00', isLunar: false, isLeapMonth: false, 省份: '北京', 城市: '北京', 区县: '', savedAt: 0 }); }}>
            填写对方生辰
          </button>
        </div>
      )}

      {draft && (
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="qn-label" style={{ display: 'grid', gap: 4 }}>称呼
              <input className="qn-input" style={{ minHeight: 44, width: 120 }} value={draft.称呼}
                onChange={e => patch({ 称呼: e.target.value.slice(0, 12) })} placeholder="如：阿明" maxLength={12} />
            </label>
            {(['男', '女'] as const).map(g => (
              <button key={g} type="button" className={`qn-chip${draft.性别 === g ? ' qn-chip--on' : ''}`}
                style={{ minHeight: 44, minWidth: 44 }} onClick={() => patch({ 性别: g })}>{g}</button>
            ))}
            {(['公历', '农历'] as const).map(c => (
              <button key={c} type="button" className={`qn-chip${(!draft.isLunar) === (c === '公历') ? ' qn-chip--on' : ''}`}
                style={{ minHeight: 44, minWidth: 44 }} onClick={() => patch({ isLunar: c === '农历', isLeapMonth: false })}>{c}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {([['year', '年', 88], ['month', '月', 64], ['day', '日', 64], ['hour', '时', 64]] as const).map(([k, ph, w]) => (
              <input key={k} className="qn-input" style={{ minHeight: 44, width: w }} inputMode="numeric"
                value={draft[k] as string} placeholder={ph} aria-label={`对方${ph}`}
                onChange={e => patch({ [k]: e.target.value.replace(/\D/g, '').slice(0, 4) } as Partial<PartnerDraft>)} />
            ))}
            <select className="qn-select" style={{ minHeight: 44, width: 72 }} value={draft.minute}
              aria-label="对方分" onChange={e => patch({ minute: e.target.value })}>
              {MIN_OPTIONS.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            <select className="qn-select" style={{ minHeight: 44, width: 110 }} value={draft.省份 ?? '北京'}
              aria-label="对方出生省" onChange={e => patch({ 省份: e.target.value, 城市: '', 区县: '' })}>
              {regionProvinces.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            <select className="qn-select" style={{ minHeight: 44, width: 120 }} value={draft.城市 ?? ''}
              aria-label="对方出生市" onChange={e => patch({ 城市: e.target.value, 区县: '' })}>
              {(regionProvinces.find(p => p.name === (draft.省份 || '北京'))?.cities.map(c => c.name) || ['北京'])
                .map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="qn-select" style={{ minHeight: 44, width: 120 }} value={draft.区县 ?? ''}
              aria-label="对方出生区县" onChange={e => patch({ 区县: e.target.value })}>
              <option value="">区县</option>
              {(regionProvinces.find(p => p.name === (draft.省份 || '北京'))?.cities
                .find(c => c.name === (draft.城市 || '北京'))?.districts.map(d => d.name) || [])
                .map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {partnerGeo && (
            <p className="qn-note" style={{ margin: 0 }}>
              对方坐标精度：{partnerGeo.precision === 'district' ? '区县命中' : partnerGeo.precision === 'city' ? '城市级（区县未命中）' : '省级（更精确可填城市或区县）'}
              {partnerGeo.districtMatched ? '，已用于真太阳时。' : '，已按可用坐标计算真太阳时。'}
            </p>
          )}
          {/* 与建盘页同一条规则：开关只在该年确实闰这个月时才出现，常显会让人以为任何月都能闰。 */}
          {draft.isLunar && 闰 > 0 && Number(draft.month || '0') === 闰 && (
            <div style={{ display: 'flex' }}>
              <button type="button" aria-pressed={闰月开} className={`qn-chip${闰月开 ? ' qn-chip--on' : ''}`}
                style={{ minHeight: 44, minWidth: 44 }} onClick={() => patch({ isLeapMonth: !闰月开 })}>闰{闰}月</button>
            </div>
          )}
          <label className="qn-note" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input id="hp-consent" type="checkbox" style={{ width: 44, height: 44, flex: '0 0 auto', margin: 0, display: 'grid', placeItems: 'center' }}
              checked={同意} onChange={e => set同意(e.target.checked)} />
            <span>我已获得对方同意提供其生辰。
              <span className="qn-note" style={{ display: 'block', marginTop: 2 }}>
                这一条不勾就不算：对方生辰是别人的个人信息，不是我可以替别人填的字段。
              </span>
            </span>
          </label>
          <label className="qn-note" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 44, height: 44, flex: '0 0 auto', margin: 0, display: 'grid', placeItems: 'center' }}
              checked={留存} onChange={e => set留存(e.target.checked)} />
            <span>在这台设备保留 7 天。关闭选项时，资料只在本次打开期间使用。</span>
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="submit" className="qn-btn qn-btn--solid" style={{ minHeight: 44 }} disabled={!同意}>
              并排对照
            </button>
            <button type="button" className="qn-btn qn-btn--quiet" style={{ minHeight: 44 }}
              onClick={() => { clearPartner(); setDraft(null); set已存(false); set提示('已清除已保留的资料。'); }}>清除</button>
          </div>
          {!同意 && <p className="qn-meta">请先确认已获得对方同意，再保存这份资料。</p>}
          {已存 && <p className="qn-meta">{存成 ? '已在这台设备保留，7 天后失效。' : '当前只在本次打开期间使用。'}</p>}
        </form>
      )}

      {draft && 对方盘 && 'err' in 对方盘 && <p className="qn-alert" style={{ marginTop: 10 }}>{对方盘.err}</p>}
      {对照.err && <p className="qn-alert" style={{ marginTop: 10 }}>{对照.err}</p>}

      {report && (
        <div style={{ marginTop: 14 }}>
          <ul className="qn-meta" style={{ margin: 0, paddingLeft: '1.1em' }}>
            {report.输入摘要.map(x => <li key={x}>{x}</li>)}
          </ul>
          {report.项目.length === 0 && <p className="qn-body" style={{ marginTop: 10 }}>这一组输入没有推出任何对照。</p>}
          {report.项目.map((n, i) => (
            <div key={`${n.立项}-${i}`} data-hepan-item={n.立项} style={{ marginTop: 12, borderTop: 'var(--qn-hairline)', paddingTop: 10 }}>
              <p className="qn-title" style={{ margin: 0, fontSize: 'var(--qn-fs-title)' }}>{n.立项}</p>
              <p className="qn-body" style={{ marginTop: 4 }}>{n.观察}</p>
              <p className="qn-meta" style={{ marginTop: 4 }}>依据：{n.依据.join('；')}</p>
              <p className="qn-note" style={{ marginTop: 2 }}>说不准的：{n.不确定项.join('；')}</p>
            </div>
          ))}
          {report.未出.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p className="qn-axis">没做的部分</p>
              <ul className="qn-meta" style={{ margin: '6px 0 0', paddingLeft: '1.1em' }}>
                {report.未出.map(x => <li key={x}>{x}</li>)}
              </ul>
            </div>
          )}
          <ToolInterpretation
            tool="hepan"
            title="八字合盘 · 混沌自研 AI 解读"
            payload={{
              basis: report.口径戳,
              observations: report.项目.map(item => ({
                title: item.立项,
                observation: item.观察,
                facts: item.依据,
                limits: item.不确定项,
              })),
            }}
          />
        </div>
      )}

      {/* 提示放在 report 之外：没勾同意时根本没有报告，那句「不存」恰恰是这一刻要说的话，
          蹲在报告分支里就永远显示不出来。 */}
      {提示 && <p className="qn-alert" role="status" style={{ marginTop: 10 }}>{提示}</p>}
    </section>
  );
}

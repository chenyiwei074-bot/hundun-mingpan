"use client";

import { useState } from "react";
import { BaziChart } from "@/components/bazi/BaziChart";
import ZiweiGongs from "@/components/ziwei/ZiweiGongs";
import type { BaziChartData } from "@/components/bazi/types";

// ═══════════════════════════════════════════════
// 示例数据 — 后续替换为后端 API 真实数据
// ═══════════════════════════════════════════════

const SAMPLE_BAZI: BaziChartData = {
  basic: {
    name: "张三", gender: "男",
    solarDate: "1990年5月20日 14:30",
    lunarDate: "庚午年四月廿六 未时",
    birthPlace: "北京", currentAge: "35",
  },
  pillars: {
    year:  { stem:"庚",branch:"午",tenGodStem:"比肩",tenGodBranch:"正官",hiddenStems:["丁","己"],naYin:"路旁土",zhangSheng:"帝旺",kongWang:"戌亥" },
    month: { stem:"辛",branch:"巳",tenGodStem:"劫财",tenGodBranch:"偏印",hiddenStems:["丙","戊","庚"],naYin:"白蜡金",zhangSheng:"临官",kongWang:"午未" },
    day:   { stem:"丙",branch:"申",tenGodStem:"日主",tenGodBranch:"偏财",hiddenStems:["庚","壬","戊"],naYin:"山下火",zhangSheng:"病",kongWang:"寅卯" },
    hour:  { stem:"乙",branch:"未",tenGodStem:"正印",tenGodBranch:"伤官",hiddenStems:["己","丁","乙"],naYin:"沙中金",zhangSheng:"养",kongWang:"子丑" },
  },
  elements: { wood: 2, fire: 3, earth: 2, metal: 4, water: 1 },
  luckCycles: {
    startAge: "8", direction: "顺排",
    cycles: [
      { ageRange:"8-17", startYear:"1998",endYear:"2007",heavenStem:"壬",earthBranch:"午",tenGod:"七杀" },
      { ageRange:"18-27",startYear:"2008",endYear:"2017",heavenStem:"癸",earthBranch:"未",tenGod:"正官" },
      { ageRange:"28-37",startYear:"2018",endYear:"2027",heavenStem:"甲",earthBranch:"申",tenGod:"偏印" },
      { ageRange:"38-47",startYear:"2028",endYear:"2037",heavenStem:"乙",earthBranch:"酉",tenGod:"正印" },
      { ageRange:"48-57",startYear:"2038",endYear:"2047",heavenStem:"丙",earthBranch:"戌",tenGod:"比肩" },
      { ageRange:"58-67",startYear:"2048",endYear:"2057",heavenStem:"丁",earthBranch:"亥",tenGod:"劫财" },
      { ageRange:"68-77",startYear:"2058",endYear:"2067",heavenStem:"戊",earthBranch:"子",tenGod:"食神" },
      { ageRange:"78-87",startYear:"2068",endYear:"2077",heavenStem:"己",earthBranch:"丑",tenGod:"伤官" },
    ],
  },
  years: [
    { year:"2023",age:"34",ganZhi:"癸卯",tenGod:"正官" },
    { year:"2024",age:"35",ganZhi:"甲辰",tenGod:"偏印" },
    { year:"2025",age:"36",ganZhi:"乙巳",tenGod:"正印" },
    { year:"2026",age:"37",ganZhi:"丙午",tenGod:"比肩" },
    { year:"2027",age:"38",ganZhi:"丁未",tenGod:"劫财" },
  ],
  analysis: { dayMaster:"丙",strength:"身强",useGod:"水木",summary:"日主丙火生于巳月得令，地支午巳申未火土金相生，天干庚辛金透出。" },
  enrichment: {
    "格局": { primary:"七杀格",confidence:"高",basis:"月支巳中藏庚金透干，时干透乙木" },
    "旺衰": { verdict:"身强",score:"68" },
    "调候用神": ["壬水","甲木"],
    "天干关系": [
      { type:"合", gan:["丙","辛"], result:"合化水", pillars:["日","月"] },
      { type:"克", gan:["庚","乙"], result:"金克木", pillars:["年","时"] },
    ],
    "地支关系": [
      { type:"六合", zhi:["巳","申"], detail:"火金相制", pillars:["月","日"] },
      { type:"半会", zhi:["巳","午","未"], detail:"火局", pillars:["月","年","时"] },
    ],
  },
};

const SAMPLE_ZIWEI = {
  gongs: [
    { gong:"命宫",tiangan:"丙",dizhi:"午",mainStars:["紫微"],auxStars:["左辅","天魁","禄存"],sihua:[],daXian:{startAge:35,endAge:44,isCurrent:true}},
    { gong:"兄弟宫",tiangan:"丁",dizhi:"未",mainStars:["天机"],auxStars:["文曲"],sihua:[{star:"天机",hua:"化科"}]},
    { gong:"夫妻宫",tiangan:"戊",dizhi:"申",mainStars:[],auxStars:["擎羊","陀罗"],sihua:[]},
    { gong:"子女宫",tiangan:"己",dizhi:"酉",mainStars:["太阳","天梁"],auxStars:["火星"],sihua:[{star:"太阳",hua:"化权"}]},
    { gong:"财帛宫",tiangan:"庚",dizhi:"戌",mainStars:["武曲","七杀"],auxStars:["铃星"],sihua:[{star:"武曲",hua:"化禄"}]},
    { gong:"疾厄宫",tiangan:"辛",dizhi:"亥",mainStars:["天同"],auxStars:["天马"],sihua:[]},
    { gong:"迁移宫",tiangan:"壬",dizhi:"子",mainStars:["廉贞","天府"],auxStars:["右弼","天钺"],sihua:[{star:"廉贞",hua:"化忌"}]},
    { gong:"交友宫",tiangan:"癸",dizhi:"丑",mainStars:[],auxStars:["地空"],sihua:[]},
    { gong:"官禄宫",tiangan:"甲",dizhi:"寅",mainStars:["贪狼"],auxStars:["地劫"],sihua:[]},
    { gong:"田宅宫",tiangan:"乙",dizhi:"卯",mainStars:["巨门"],auxStars:[],sihua:[]},
    { gong:"福德宫",tiangan:"丙",dizhi:"辰",mainStars:["天相"],auxStars:["天喜"],sihua:[]},
    { gong:"父母宫",tiangan:"丁",dizhi:"巳",mainStars:["太阴"],auxStars:[],sihua:[]},
  ],
};

export default function BaziChartDemoPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name:"", gender:"男", year:"", month:"", day:"", hour:"12", birthplace:"" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!submitted) {
    return (
      <main className="qn-shell qn-shell--wide bazi-demo">
        <header className="qn-rise" style={{ textAlign: "center", marginBottom: 24 }}>
          <p className="qn-eyebrow" style={{ margin: 0 }}>东方 · 八字与紫微</p>
          <h1 className="qn-hero" style={{ margin: "12px 0 6px" }}>输入你的出生信息</h1>
          <p className="qn-meta">混沌将为你排出八字命盘与紫微斗数</p>
        </header>

        <form onSubmit={handleSubmit} className="qn-card qn-stack qn-rise qn-rise--2">
          <div>
            <label className="qn-label" htmlFor="demo-name">姓名</label>
            <input id="demo-name" type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required
              placeholder="请输入姓名" className="qn-input" />
          </div>

          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="qn-label">性别</legend>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              {["男","女"].map(g=>(
                <button key={g} type="button" onClick={()=>setForm({...form,gender:g})}
                  aria-pressed={form.gender===g}
                  className={`qn-chip${form.gender===g ? " qn-chip--on" : ""}`}
                  style={{ flex: "1 1 0", minHeight: 44 }}>{g}</button>
              ))}
            </div>
          </fieldset>

          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="qn-label">出生日期（阳历）</legend>
            <div className="grid grid-cols-3 gap-3" style={{ marginTop: 8 }}>
              <label className="sr-only" htmlFor="demo-year">出生年份</label>
              <input id="demo-year" type="text" inputMode="numeric" value={form.year} onChange={e=>setForm({...form,year:e.target.value})} required
                placeholder="1990" maxLength={4} aria-label="出生年份" className="qn-input" style={{ textAlign: "center" }} />
              <label className="sr-only" htmlFor="demo-month">出生月份</label>
              <input id="demo-month" type="text" inputMode="numeric" value={form.month} onChange={e=>setForm({...form,month:e.target.value})} required
                placeholder="05" maxLength={2} aria-label="出生月份" className="qn-input" style={{ textAlign: "center" }} />
              <label className="sr-only" htmlFor="demo-day">出生日期</label>
              <input id="demo-day" type="text" inputMode="numeric" value={form.day} onChange={e=>setForm({...form,day:e.target.value})} required
                placeholder="20" maxLength={2} aria-label="出生日期" className="qn-input" style={{ textAlign: "center" }} />
            </div>
          </fieldset>

          <div>
            <label className="qn-label" htmlFor="demo-hour">出生时辰</label>
            <select id="demo-hour" value={form.hour} onChange={e=>setForm({...form,hour:e.target.value})} className="qn-select">
              {["00","01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23"].map(h=>(
                <option key={h} value={h}>{h}:00</option>
              ))}
            </select>
          </div>

          <div>
            <label className="qn-label" htmlFor="demo-birthplace">出生地</label>
            <input id="demo-birthplace" type="text" value={form.birthplace} onChange={e=>setForm({...form,birthplace:e.target.value})}
              placeholder="例如：北京" className="qn-input" />
          </div>

          <button type="submit" className="qn-btn qn-btn--solid qn-btn--block" style={{ marginTop: 4 }}>
            开始排盘
          </button>
        </form>
      </main>
    );
  }

  // ════════════ RESULT VIEW ════════════
  return (
    <main className="qn-shell qn-shell--wide bazi-demo">
      <header className="qn-card qn-rise" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p className="qn-eyebrow" style={{ margin: 0 }}>东方 · 命盘示例</p>
          <h1 className="qn-title" style={{ margin: "8px 0 4px" }}>八字与紫微合参</h1>
          <p className="qn-meta">当前展示的是固定样例盘，表单仅用于体验页面交互</p>
        </div>
        <button type="button" onClick={() => setSubmitted(false)} className="qn-btn qn-btn--ghost">重新输入</button>
      </header>

      <BaziChart data={SAMPLE_BAZI} />

      <section aria-labelledby="demo-ziwei-title" style={{ marginTop: 18 }}>
        <div className="qn-axis" style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 12px" }}>
          <span aria-hidden="true" style={{ height: 1, flex: 1, background: "var(--color-hairline)" }} />
          <h2 id="demo-ziwei-title" className="qn-title" style={{ margin: 0 }}>紫微斗数</h2>
          <span aria-hidden="true" style={{ height: 1, flex: 1, background: "var(--color-hairline)" }} />
        </div>
        <div className="qn-card" style={{ padding: 8 }}>
          <ZiweiGongs gongs={SAMPLE_ZIWEI.gongs} mingGongIndex={0} shenGongIndex={6} />
        </div>
      </section>
    </main>
  );
}

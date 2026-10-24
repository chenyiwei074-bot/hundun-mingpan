'use client';

interface Props { chartData: any; }

type ComparisonRow = {
  title: string;
  bazi: string[];
  ziwei: string[];
};

function text(value: unknown): string {
  if (value == null || value === '') return '未提供';
  if (Array.isArray(value)) return value.length ? value.map(text).join('、') : '无';
  return String(value);
}

function pillar(value: any): string {
  return value?.gan && value?.zhi ? String(value.gan) + String(value.zhi) : '未提供';
}

function findPalace(gongs: any[], name: string) {
  return (gongs || []).find((item: any) => item?.gong === name)
    || (gongs || []).find((item: any) => item?.gong === name + '宫');
}

function palaceStars(gongs: any[], name: string): string {
  const palace = findPalace(gongs, name);
  if (!palace) return '未提供';
  return (palace.mainStars || []).length ? palace.mainStars.join('、') : '无主星';
}

export default function DoubleVerify({ chartData }: Props) {
  const bazi = chartData?.bazi || {};
  const ziwei = chartData?.ziwei || {};
  const enrichment = bazi?.enrichment || {};
  const gongs = ziwei?.gongs || [];
  const pillars = bazi?.siZhu || {};
  const tenGods = bazi?.shiShen || {};
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const shenBranch = branches[ziwei.shenGongIndex];
  const shenPalace = shenBranch ? gongs.find((item: any) => item?.dizhi === shenBranch) : null;
  const fourPillars = ['year', 'month', 'day', 'hour']
    .map(key => pillar(pillars[key]))
    .join(' · ');
  const fourGods = ['year', 'month', 'day', 'hour']
    .map(key => text(tenGods[key]))
    .join(' · ');

  const rows: ComparisonRow[] = [
    {
      title: '命盘核心',
      bazi: ['四柱：' + fourPillars, '日主：' + text(bazi.dayMaster)],
      ziwei: ['命宫：' + palaceStars(gongs, '命'), '身宫：' + text(shenPalace?.gong)],
    },
    {
      title: '事业相关位置',
      bazi: [
        '格局：' + text(enrichment['格局']?.primary || enrichment['格局']?.name),
        '旺衰：' + text(enrichment['旺衰']?.verdict || enrichment['旺衰']?.level),
      ],
      ziwei: ['官禄宫：' + palaceStars(gongs, '官禄'), '命宫：' + palaceStars(gongs, '命')],
    },
    {
      title: '财帛相关位置',
      bazi: ['四柱十神：' + fourGods, '日主：' + text(bazi.dayMaster)],
      ziwei: ['财帛宫：' + palaceStars(gongs, '财帛'), '福德宫：' + palaceStars(gongs, '福德')],
    },
    {
      title: '关系相关位置',
      bazi: ['日柱：' + pillar(pillars.day), '四柱：' + fourPillars],
      ziwei: ['夫妻宫：' + palaceStars(gongs, '夫妻'), '命宫：' + palaceStars(gongs, '命')],
    },
  ];

  return (
    <section className="w-full" aria-labelledby="double-chart-title">
      <header style={{ marginBottom: 20 }}>
        <p className="qn-eyebrow" style={{ marginBottom: 6 }}>八字 × 紫微</p>
        <h2 id="double-chart-title" className="qn-title" style={{ marginBottom: 8 }}>双盘结构对照</h2>
        <p className="qn-meta" style={{ maxWidth: '70ch' }}>
          按主题并列两张盘中对应的位置，方便回看盘面。这里展示已排出的字段，不将字段直接写成职业、财富或婚恋结论。
        </p>
      </header>

      <div style={{ display: 'grid', gap: 12 }}>
        {rows.map(row => (
          <article key={row.title} className="qn-card" style={{ padding: 18 }}>
            <h3 className="qn-body" style={{ margin: '0 0 12px', fontWeight: 600 }}>{row.title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 10 }}>
              <div style={{ minWidth: 0, padding: 12, borderRadius: 10, background: 'rgba(178,149,93,0.07)' }}>
                <p className="qn-cap" style={{ margin: '0 0 7px', color: 'var(--color-accent-gold-text)' }}>八字</p>
                {row.bazi.map(item => (
                  <p key={item} className="qn-meta" style={{ margin: '4px 0 0', overflowWrap: 'anywhere' }}>{item}</p>
                ))}
              </div>
              <div style={{ minWidth: 0, padding: 12, borderRadius: 10, background: 'rgba(0,0,0,0.025)' }}>
                <p className="qn-cap" style={{ margin: '0 0 7px' }}>紫微斗数</p>
                {row.ziwei.map(item => (
                  <p key={item} className="qn-meta" style={{ margin: '4px 0 0', overflowWrap: 'anywhere' }}>{item}</p>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className="qn-note" style={{ marginTop: 12 }}>
        盘面字段是解读依据的一部分。涉及传统断语时，应同时展示对应典籍、篇章和原文；本节不以字段对照代替出处。
      </p>
    </section>
  );
}

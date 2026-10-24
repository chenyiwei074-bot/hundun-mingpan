'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSharedChart } from '@/app/lib/api';
import BaziPillars from '@/components/bazi/BaziPillars';
import ZiweiGongs from '@/components/ziwei/ZiweiGongs';
import AiReading from '@/components/chart/AiReading';

type SharedChart = {
  chartData: any;
  analysisData?: unknown;
  aiAnalysis?: unknown;
  expiresAt: string;
};

function formatExpiry(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function SharedChartPage() {
  const params = useParams();
  const rawToken = params?.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken || '';
  const [shared, setShared] = useState<SharedChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = '命盘分享 | 混沌';
    const setMeta = (name: string, content: string) => {
      const existing = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      const meta = existing || document.createElement('meta');
      const previous = existing?.content;
      if (!existing) {
        meta.name = name;
        document.head.appendChild(meta);
      }
      meta.content = content;
      return () => {
        if (existing) meta.content = previous || '';
        else meta.remove();
      };
    };
    const restoreReferrer = setMeta('referrer', 'no-referrer');
    const restoreRobots = setMeta('robots', 'noindex,nofollow,noarchive');
    return () => {
      restoreReferrer();
      restoreRobots();
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setUnavailable(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const response: any = await getSharedChart(token);
        if (cancelled) return;
        const payload = response?.data && typeof response.data === 'object' ? response.data : response;
        if (response?.httpStatus >= 400 || response?.success === false || !payload?.chartData) {
          setUnavailable(true);
        } else {
          setShared(payload as SharedChart);
        }
      } catch {
        if (!cancelled) setUnavailable(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <main className="qn-shell qn-shell--wide" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
        <section className="qn-card" role="status" aria-live="polite" style={{ width: 'min(100%, 520px)', textAlign: 'center', padding: '36px 24px' }}>
          <div aria-hidden="true" style={{ width: 34, height: 34, margin: '0 auto 18px', borderRadius: '50%', border: '2px solid rgba(178,149,93,.2)', borderTopColor: 'var(--color-accent-gold)', animation: 'qn-spin .9s linear infinite' }} />
          <p className="qn-meta" style={{ margin: 0 }}>正在打开命盘分享…</p>
        </section>
      </main>
    );
  }

  if (unavailable || !shared) {
    return (
      <main className="qn-shell qn-shell--wide" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
        <section className="qn-card qn-rise" style={{ width: 'min(100%, 560px)', textAlign: 'center', padding: '40px 28px' }}>
          <p className="qn-eyebrow">限时分享</p>
          <h1 className="qn-title">这份命盘暂时无法查看</h1>
          <p className="qn-meta" style={{ maxWidth: 420, margin: '12px auto 24px' }}>
            分享链接可能已过期、被撤回，或命盘已经清理。请联系分享者重新生成链接。
          </p>
          <a href="/" className="qn-btn qn-btn--ghost">返回首页</a>
        </section>
      </main>
    );
  }

  const bazi = shared.chartData?.bazi;
  const ziwei = shared.chartData?.ziwei;
  const gongs = Array.isArray(ziwei?.gongs) ? ziwei.gongs : [];

  return (
    <main className="qn-shell qn-shell--wide">
      <header className="qn-ink qn-rise" style={{ padding: '34px 28px', marginBottom: 24 }}>
        <p className="qn-eyebrow" style={{ margin: 0 }}>混 沌 阁 · 限 时 分 享</p>
        <h1 className="qn-hero" style={{ margin: '12px 0 0' }}>命盘分享</h1>
        <p className="qn-meta" style={{ margin: '12px 0 0' }}>
          只读查看 · 有效至 {formatExpiry(shared.expiresAt)}
        </p>
        <p className="qn-note" style={{ margin: '6px 0 0' }}>
          页面仅展示盘面与解读，不显示分享者的姓名、出生资料或地点。
        </p>
      </header>

      <div style={{ display: 'grid', gap: 24 }}>
        <section className="qn-card qn-rise" aria-labelledby="shared-bazi-title">
          <header style={{ marginBottom: 16 }}>
            <p className="qn-eyebrow" style={{ marginBottom: 6 }}>命盘结构</p>
            <h2 id="shared-bazi-title" className="qn-title">八字四柱</h2>
          </header>
          {bazi?.siZhu ? (
            <BaziPillars
              siZhu={bazi.siZhu}
              dayMaster={bazi.dayMaster || ''}
              dayunStart={bazi.dayunStart}
              cangGan={bazi.cangGan}
              naYin={bazi.naYin}
              zhangSheng={bazi.zhangSheng}
              shiShen={bazi.shiShen}
              enrichment={bazi.enrichment}
            />
          ) : <p className="qn-meta">这份分享暂未包含八字四柱。</p>}
        </section>

        <section className="qn-card qn-rise qn-rise--2" aria-labelledby="shared-ziwei-title">
          <header style={{ marginBottom: 16 }}>
            <p className="qn-eyebrow" style={{ marginBottom: 6 }}>命盘结构</p>
            <h2 id="shared-ziwei-title" className="qn-title">紫微十二宫</h2>
          </header>
          {gongs.length > 0
            ? <ZiweiGongs gongs={gongs} mingGongIndex={0} shenGongIndex={ziwei?.shenGongIndex} />
            : <p className="qn-meta">这份分享暂未包含紫微十二宫。</p>}
        </section>

        <section className="qn-card qn-rise qn-rise--3" aria-labelledby="shared-reading-title">
          <header style={{ marginBottom: 16 }}>
            <p className="qn-eyebrow" style={{ marginBottom: 6 }}>传统象义参考</p>
            <h2 id="shared-reading-title" className="qn-title">命盘解读</h2>
          </header>
          {shared.aiAnalysis
            ? <AiReading aiAnalysis={shared.aiAnalysis} />
            : <p className="qn-meta">这份分享暂未包含文字解读。</p>}
        </section>
      </div>

      <p className="qn-cap" style={{ margin: '22px 0 0', lineHeight: 1.8 }}>
        传统文化研究与个人参考 · 分享链接到期后将无法继续查看。
      </p>
    </main>
  );
}

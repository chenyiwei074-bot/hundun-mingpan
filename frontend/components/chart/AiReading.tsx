'use client';

import { useMemo } from 'react';
import { aiReadingSections } from '@/lib/chart/aiReading';
import { RichText } from '@/lib/ui/richText';
import ClassicalReferences from '@/components/chart/ClassicalReferences';
import PlainLanguageView from '@/components/ai/PlainLanguageView';

/**
 * AI 解读卡的内容区。
 * 只负责排版：章节标题 + 正文。所有"这个字段叫什么"的知识都在 aiReading.ts，
 * 组件里不许再出现 JSON.stringify / 键名直出。
 */
export default function AiReading({ aiAnalysis }: { aiAnalysis: unknown }) {
  const sections = useMemo(() => aiReadingSections(aiAnalysis), [aiAnalysis]);
  const missingSources = sections.filter(section => !section.sourceIds?.length).map(section => section.title);
  if (!sections.length) {
    return <p className="qn-meta">这一次没有可展示的解读文本（可能生成失败或内容为空）。</p>;
  }
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <PlainLanguageView context="chart" parts={sections.map((section, index) => ({
        id: `section-${index}`, text: section.body,
      }))}>{textById => <>
      {sections.map((s, i) => (
        <section key={i}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
            <h3
              className="qn-body"
              style={{
                margin: 0,
                fontWeight: 600,
                letterSpacing: '0.06em',
                color: 'var(--color-accent-gold-text)',
              }}
            >
              {s.title}
            </h3>
            {s.sourceIds?.length ? null : (
              <span
                className="qn-cap"
                aria-label={s.title + '：本站自研，无可核验古籍出处'}
                style={{
                  border: '1px solid var(--color-hairline)',
                  borderRadius: 999,
                  padding: '2px 8px',
                  lineHeight: 1.4,
                  color: 'var(--color-text-secondary)',
                }}
              >
                本站自研
              </span>
            )}
          </div>
          {s.body ? <RichText text={textById[`section-${i}`]} /> : null}
          {s.sourceIds?.length ? <ClassicalReferences sourceIds={s.sourceIds} /> : null}
        </section>
      ))}
      </>}</PlainLanguageView>
      {missingSources.length > 0 && (
        <p className="qn-note" role="note" style={{ margin: 0 }}>
          标注“本站自研”的部分未关联可核验的古籍出处。
        </p>
      )}
      <p className="qn-cap" style={{ margin: '4px 0 0', lineHeight: 1.8 }}>
        盘面数据以页面上方的四柱与星盘为准。已核验的古籍出处列在对应章节下；标注“本站自研”的部分没有可核验的古籍出处。
      </p>
    </div>
  );
}

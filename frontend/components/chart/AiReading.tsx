'use client';

import { useMemo } from 'react';
import { aiReadingSections } from '@/lib/chart/aiReading';
import { RichText } from '@/lib/ui/richText';
import ClassicalReferences from '@/components/chart/ClassicalReferences';

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
      {sections.map((s, i) => (
        <section key={i}>
          <h3
            className="qn-body"
            style={{
              margin: '0 0 6px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: 'var(--color-accent-gold-text)',
            }}
          >
            {s.title}
          </h3>
          {s.body ? <RichText text={s.body} /> : null}
          {s.sourceIds?.length ? <ClassicalReferences sourceIds={s.sourceIds} /> : null}
        </section>
      ))}
      {missingSources.length > 0 && (
        <p className="qn-note" role="note" style={{ margin: 0 }}>
          以下部分尚未关联可核验的文献出处：{missingSources.join('、')}。
        </p>
      )}
      <p className="qn-cap" style={{ margin: '4px 0 0', lineHeight: 1.8 }}>
        盘面数据以页面上方的四柱与星盘为准。传统解释应结合对应文献出处阅读，不同流派说法也可能不同。
      </p>
    </div>
  );
}

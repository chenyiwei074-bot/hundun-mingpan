'use client';

import { useEffect, useRef, useState } from 'react';
import ToolInterpretation from '@/components/ai/ToolInterpretation';

type Kind = 'face' | 'palm';
type CandidateFeature = { id: string; label: string; candidate: string; confidence: number; region?: [number, number, number, number] };
type FeatureDraft = CandidateFeature & { value: string; confirmed: boolean };
type RecognitionResponse = { ok?: boolean; code?: string; message?: string; features?: CandidateFeature[]; notes?: string[] };

const COPY = {
  face: {
    eyebrow: '东方 · 面部可见特征', title: '面相观察', lead: '上传一张清晰正面照，先核对照片中实际可见的形态，再决定是否生成传统文化参考解读。',
    tips: ['仅一人正面照，光线均匀、面部无遮挡', '不推断身份、年龄、性别、族裔、情绪或健康', '照片识别结果只是候选，需你逐项确认'],
  },
  palm: {
    eyebrow: '东方 · 手掌可见特征', title: '手相观察', lead: '上传一张掌心朝向镜头的手掌照，核对掌面与可见纹线描述后，再选择是否生成传统文化参考解读。',
    tips: ['画面只留一只手，掌心朝向镜头、掌纹清晰', '拍摄前选择左手或右手；系统不猜测手别', '不识别身份或指纹，不推断健康或寿命'],
  },
} as const;

export default function PhysiognomyFlow({ kind }: { kind: Kind }) {
  const copy = COPY[kind];
  const inputRef = useRef<HTMLInputElement>(null);
  const generationRef = useRef(0);
  const recognitionAbortRef = useRef<AbortController | null>(null);
  const [consent, setConsent] = useState(false);
  const [hand, setHand] = useState<'left' | 'right' | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [features, setFeatures] = useState<FeatureDraft[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'recognizing' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => () => {
    generationRef.current += 1;
    recognitionAbortRef.current?.abort();
  }, []);

  const invalidatePending = () => {
    generationRef.current += 1;
    recognitionAbortRef.current?.abort();
    recognitionAbortRef.current = null;
    return generationRef.current;
  };

  const clearRecognition = () => {
    setFeatures([]);
    setNotes([]);
    setMessage('');
    setStatus('idle');
  };
  const clearPhoto = () => {
    invalidatePending();
    setFile(null);
    setPreviewUrl(null);
    setImageDataUrl(null);
    clearRecognition();
    if (inputRef.current) inputRef.current.value = '';
  };
  const onConsentChange = (checked: boolean) => {
    setConsent(checked);
    if (!checked) clearPhoto();
  };
  const onHandChange = (side: 'left' | 'right') => {
    if (side === hand) return;
    const needsRecognition = status === 'recognizing' || status === 'ready';
    invalidatePending();
    clearRecognition();
    setHand(side);
    if (needsRecognition) setMessage(`已切换为${side === 'left' ? '左手' : '右手'}，请重新识别当前照片。`);
  };
  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0];
    if (!next) return;
    const generation = invalidatePending();
    setFile(null);
    setPreviewUrl(null);
    setImageDataUrl(null);
    clearRecognition();
    if (!consent) {
      setMessage('请先阅读并确认照片使用说明。');
      event.target.value = '';
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) {
      setMessage('只接受 JPG、PNG 或 WebP 图片。');
      event.target.value = '';
      return;
    }
    if (next.size > 5 * 1024 * 1024) {
      setMessage('单张图片不能超过 5 MB。');
      event.target.value = '';
      return;
    }
    setMessage('');
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('无法读取图片'));
        reader.onerror = () => reject(new Error('无法读取图片，请重新选择。'));
        reader.readAsDataURL(next);
      });
      if (generation !== generationRef.current) return;
      setImageDataUrl(dataUrl);
    } catch (error) {
      if (generation !== generationRef.current) return;
      setMessage(error instanceof Error ? error.message : '无法读取图片，请重新选择。');
      clearPhoto();
    }
  };
  const recognize = async () => {
    if (!consent || !imageDataUrl || (kind === 'palm' && !hand)) return;
    recognitionAbortRef.current?.abort();
    const generation = ++generationRef.current;
    const controller = new AbortController();
    recognitionAbortRef.current = controller;
    clearRecognition();
    setStatus('recognizing');
    try {
      const response = await fetch('/api/physiognomy/recognize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        signal: controller.signal,
        body: JSON.stringify({ kind, consent: true, ...(kind === 'palm' ? { hand } : {}), imageBase64: imageDataUrl }),
      });
      const result = await response.json().catch(() => null) as RecognitionResponse | null;
      if (generation !== generationRef.current) return;
      if (!response.ok || !result?.ok || !Array.isArray(result.features)) throw new Error(result?.message || '图片识别暂时不可用，请稍后重试。');
      setFeatures(result.features.map(item => ({ ...item, value: item.candidate, confirmed: false })));
      setNotes(Array.isArray(result.notes) ? result.notes : []);
      setStatus('ready');
    } catch (error) {
      if (generation !== generationRef.current || (error instanceof Error && error.name === 'AbortError')) return;
      setStatus('error');
      setMessage(error instanceof Error ? error.message : '图片识别暂时不可用，请稍后重试。');
    } finally {
      if (recognitionAbortRef.current === controller) recognitionAbortRef.current = null;
    }
  };

  const confirmedFeatures = features.filter(item => item.confirmed && item.value.trim()).map(({ id, value }) => ({ id, value: value.trim() }));
  const interpretationPayload = kind === 'palm' ? { hand, confirmedFeatures } : { confirmedFeatures };
  const canRecognize = consent && !!imageDataUrl && status !== 'recognizing' && (kind === 'face' || !!hand);

  return (
    <main className="qn-shell" data-physiognomy={kind} style={{ maxWidth: 920, marginInline: 'auto' }}>
      <header className="qn-card" style={{ marginBottom: 16 }}>
        <p className="qn-cap" style={{ margin: 0 }}>{copy.eyebrow}</p>
        <h1 className="qn-hero" style={{ margin: '6px 0 8px' }}>{copy.title}</h1>
        <p className="qn-body" style={{ margin: 0 }}>{copy.lead}</p>
        <ul className="qn-meta" style={{ margin: '12px 0 0', paddingLeft: 20 }}>{copy.tips.map(tip => <li key={tip}>{tip}</li>)}</ul>
      </header>

      <section className="qn-card" aria-labelledby={`${kind}-consent-title`}>
        <h2 id={`${kind}-consent-title`} className="qn-title" style={{ marginTop: 0 }}>照片使用与本人确认</h2>
        <p className="qn-note">照片只在你点击“开始识别”后传给图像识别服务处理。本站不会把原图写入持久存储、数据库或报告。处理服务的规则可能不同于本站；请勿上传你无权使用的照片。</p>
        <label className="qn-row" style={{ alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginTop: 14 }}>
          <input type="checkbox" checked={consent} onChange={event => onConsentChange(event.target.checked)} style={{ width: 44, height: 44, flex: '0 0 44px', marginTop: 2, accentColor: 'var(--color-accent-gold-text)' }} />
          <span className="qn-body">我确认这是本人照片，或已取得照片中当事人的明确同意；我已阅读照片处理说明，并同意为本次特征识别上传图片。</span>
        </label>
        {kind === 'palm' && <fieldset style={{ border: 0, padding: 0, margin: '16px 0 0' }} disabled={!consent}>
          <legend className="qn-meta" style={{ marginBottom: 8 }}>请选择照片中的手</legend>
          <div className="qn-row" style={{ gap: 10, flexWrap: 'wrap' }}>
            {(['left', 'right'] as const).map(side => <label key={side} className="qn-btn qn-btn--ghost" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: consent ? 'pointer' : 'not-allowed' }}>
              <input type="radio" name="hand-side" value={side} checked={hand === side} onChange={() => onHandChange(side)} style={{ width: 44, height: 44, flex: '0 0 44px', accentColor: 'var(--color-accent-gold-text)' }} />{side === 'left' ? '左手' : '右手'}
            </label>)}
          </div>
        </fieldset>}
        <label className="qn-cap" style={{ display: 'block', margin: '18px 0 6px' }} htmlFor={`${kind}-photo`}>选择一张照片（JPG / PNG / WebP，最多 5 MB）</label>
        <input ref={inputRef} id={`${kind}-photo`} type="file" accept="image/jpeg,image/png,image/webp" disabled={!consent || status === 'recognizing'} onChange={onFileChange} aria-describedby={`${kind}-photo-hint`} style={{ width: '100%', minHeight: 44 }} />
        <p id={`${kind}-photo-hint`} className="qn-note" style={{ marginTop: 6 }}>选图时只在本机生成预览，不会自动上传。刷新页面后照片和本次结果不会恢复。</p>
        {file && previewUrl && <div className="qn-card" style={{ marginTop: 14, padding: 12 }}>
          <img src={previewUrl} alt={`${kind === 'face' ? '面部' : '手掌'}照片本地预览`} style={{ display: 'block', maxWidth: '100%', maxHeight: 420, marginInline: 'auto', objectFit: 'contain', borderRadius: 12 }} />
          <p className="qn-meta" style={{ textAlign: 'center', margin: '8px 0 0', overflowWrap: 'anywhere' }}>{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB（仅本地预览）</p>
        </div>}
        <div className="qn-row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <button className="qn-btn qn-btn--solid" type="button" onClick={recognize} disabled={!canRecognize} style={{ minHeight: 44, opacity: 1 }}>{status === 'recognizing' ? '识别中…' : '开始识别照片'}</button>
          {file && <button className="qn-btn qn-btn--ghost" type="button" onClick={clearPhoto} style={{ minHeight: 44 }}>清除照片与本次结果</button>}
        </div>
        {message && <p className={status === 'error' ? 'qn-alert' : 'qn-note'} role={status === 'error' ? 'alert' : 'status'} style={{ marginTop: 12 }}>{message}</p>}
      </section>

      {status === 'ready' && <section className="qn-card" aria-labelledby={`${kind}-features-title`} style={{ marginTop: 16 }}>
        <h2 id={`${kind}-features-title`} className="qn-title" style={{ marginTop: 0 }}>请逐项检查识别候选</h2>
        <p className="qn-note">每项都需要你亲自确认后才会用于解读。识别把握提示不是统计准确率；不准确时可直接修改或不勾选。</p>
        {notes.map((note, index) => <p key={`${note}-${index}`} className="qn-meta">{note}</p>)}
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {features.map((feature, index) => <article key={`${feature.id}-${index}`} className="qn-card" style={{ padding: 14 }}>
            <div className="qn-row" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><h3 className="qn-axis" style={{ margin: 0 }}>{feature.label}</h3><span className="qn-meta">模型识别把握提示 {Math.round(feature.confidence * 100)}% · 非准确率承诺</span></div>
            <label className="qn-cap" htmlFor={`${kind}-feature-${index}`} style={{ display: 'block', marginTop: 8 }}>识别描述（可修改）</label>
            <textarea id={`${kind}-feature-${index}`} value={feature.value} maxLength={120} rows={2} onChange={event => setFeatures(current => current.map((item, i) => i === index ? { ...item, value: event.target.value, confirmed: false } : item))} style={{ width: '100%', minHeight: 72, marginTop: 4, padding: 10, borderRadius: 10, border: '1px solid var(--line, #d9d4c9)', font: 'inherit', resize: 'vertical' }} />
            <label className="qn-row" style={{ alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}><input type="checkbox" checked={feature.confirmed} disabled={!feature.value.trim()} onChange={event => setFeatures(current => current.map((item, i) => i === index ? { ...item, confirmed: event.target.checked } : item))} style={{ width: 44, height: 44, flex: '0 0 44px', accentColor: 'var(--color-accent-gold-text)' }} /><span className="qn-body">我确认这项描述准确</span></label>
          </article>)}
        </div>
      </section>}

      {confirmedFeatures.length > 0 && status === 'ready' && <ToolInterpretation key={`${kind}-${JSON.stringify(interpretationPayload)}`} tool={kind === 'face' ? 'face-reading' : 'palm-reading'} title={`${copy.title} · 混沌自研 AI 辅助解读`} payload={interpretationPayload} />}
      <p className="qn-note" style={{ margin: '16px 2px 28px' }}>面相与手相内容仅作传统文化参考，不具有科学预测能力，不用于身份识别、健康诊断或对他人的评价。</p>
    </main>
  );
}

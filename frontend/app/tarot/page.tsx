'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { drawSpread, TAROT_SPREADS } from '@/lib/tarot/deck';
import type { TarotCard, TarotDraw, TarotOrientation, TarotPosition, TarotSpreadId } from '@/lib/tarot/deck';
import { TarotIllustration } from '@/components/tarot/TarotIllustration';
import { TAROT_MEANINGS } from '@/lib/tarot/meanings';
import { createTarotReading, getClassicSources, saveTarotReading, type TarotReadingResponse, type TarotSavedReading, type ClassicSource } from '@/app/lib/api';
import { getVisitorId } from '@/lib/auth/visitor';
import { getDeckTilt } from '@/lib/tarot/interaction';
import { getMarseilleCardReference, TAROT_TRADITION_SOURCES } from '@/lib/tarot/traditions';
import { getMarseilleReading } from '@/lib/tarot/marseille-readings';
import PlainLanguageView from '@/components/ai/PlainLanguageView';

type DrawState = 'idle' | 'shuffled' | 'drawing' | 'revealed' | 'reading';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SPREAD_GUIDES: Record<TarotSpreadId, string> = {
  single: '先聚焦一件事，用一张牌整理当下的提醒。',
  'three-card': '把过去、现在与未来放在同一条时间线上。',
  'five-card': '沿着时间、建议与结果，展开一件事的脉络。',
  'celtic-cross': '从现状和挑战出发，连看内在、环境与结果。',
};

function toHex(bytes: ArrayLike<number>) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function CardBack() {
  return (
    <div className="tarot-card__back" aria-hidden="true">
      <span className="tarot-card__back-frame" />
      <span className="tarot-card__rosette"><i /><i /><i /><i /></span>
      <span className="tarot-card__back-orbit" />
    </div>
  );
}

function CardFront({ card, orientation }: { card: TarotCard; orientation: TarotOrientation }) {
  return (
    <div className="tarot-card__front">
      <span className="tarot-card__front-frame" />
      <div className="tarot-card__front-content">
        <span className="tarot-card__number">{card.numeral ?? card.rank}</span>
        <TarotIllustration card={card} />
        <span className="tarot-card__name">{card.nameZh}</span>
        <span className="tarot-card__english" data-proper-name>{card.nameEn}</span>
        <span className="tarot-card__meaning">Waite · 1910</span>
      </div>
      <span className={`tarot-card__orientation${orientation === '逆位' ? ' is-reversed' : ''}`}>{orientation}</span>
    </div>
  );
}

function TarotSlot({
  position, drawn, visible, selected, index, onSelect, stageElementRef,
}: {
  position: TarotPosition;
  drawn?: TarotDraw;
  visible: boolean;
  selected: boolean;
  index: number;
  onSelect: () => void;
  stageElementRef?: (node: HTMLDivElement | null) => void;
}) {
  return (
    <article className="tarot-slot" data-position={position} aria-label={`${position}牌位${visible && drawn ? `：${drawn.card.nameZh}` : '，尚未揭示'}`}>
      <h2 className="tarot-slot__position">{position}</h2>
      <div className="tarot-slot__stage" ref={stageElementRef}>
        {visible && drawn ? (
          <button
            type="button"
            className={`tarot-card-trigger${selected ? ' is-selected' : ''}`}
            style={{ '--tarot-card-index': index } as CSSProperties}
            onClick={onSelect}
            onPointerMove={event => {
              if (event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const tilt = getDeckTilt(((event.clientX - rect.left) / rect.width) * 2 - 1, ((event.clientY - rect.top) / rect.height) * 2 - 1);
              const cardElement = event.currentTarget.querySelector<HTMLElement>('.tarot-card');
              cardElement?.style.setProperty('--card-tilt-x', `${tilt.x}deg`);
              cardElement?.style.setProperty('--card-tilt-y', `${tilt.y}deg`);
            }}
            onPointerLeave={event => {
              const cardElement = event.currentTarget.querySelector<HTMLElement>('.tarot-card');
              cardElement?.style.setProperty('--card-tilt-x', '0deg');
              cardElement?.style.setProperty('--card-tilt-y', '0deg');
            }}
            aria-label={`${position}：${drawn.card.nameZh}，${drawn.orientation}，点击查看牌义`}
            aria-pressed={selected}
          >
            <div className={`tarot-card is-revealed${drawn.orientation === '逆位' ? ' tarot-card--reversed' : ''}`} data-card-id={drawn.card.id} data-orientation={drawn.orientation}>
            <div className="tarot-card__inner">
              <CardBack />
              <CardFront card={drawn.card} orientation={drawn.orientation} />
            </div>
            </div>
          </button>
        ) : (
          <div className="tarot-empty" aria-hidden="true">
            <span className="tarot-empty__mark">＋</span>
            <span>牌位留空</span>
          </div>
        )}
      </div>
    </article>
  );
}

function TarotCardFace({ card, orientation }: { card: TarotCard; orientation: TarotOrientation }) {
  return (
    <div className="tarot-card__inner">
      <CardBack />
      <CardFront card={card} orientation={orientation} />
    </div>
  );
}

export default function TarotPage() {
  const [spreadId, setSpreadId] = useState<TarotSpreadId>('three-card');
  const [drawState, setDrawState] = useState<DrawState>('idle');
  const [seedHex, setSeedHex] = useState('');
  const [seedHash, setSeedHash] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [question, setQuestion] = useState('');
  const [drawQuestion, setDrawQuestion] = useState('');
  const [drawnCards, setDrawnCards] = useState<TarotDraw[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [flight, setFlight] = useState<{
    card: TarotCard;
    orientation: TarotOrientation;
    index: number;
    fromX: number;
    fromY: number;
    fromScale: number;
    targetX: number;
    targetY: number;
    targetWidth: number;
    targetHeight: number;
    revealed: boolean;
  } | null>(null);
  const [notice, setNotice] = useState('洗牌后生成抽牌校验码；牌面只在本机抽取。');
  const [announcement, setAnnouncement] = useState('牌位已准备好。');
  const [aiReading, setAiReading] = useState<TarotReadingResponse | null>(null);
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [aiError, setAiError] = useState('');
  const [sourceRefs, setSourceRefs] = useState<Record<string, ClassicSource>>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedId, setSavedId] = useState('');
  const [saveError, setSaveError] = useState('');
  const timers = useRef<number[]>([]);
  const stageRef = useRef<HTMLElement>(null);
  const deckRef = useRef<HTMLButtonElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const roundRef = useRef(0);
  const currentSpreadRef = useRef(spreadId);
  const currentCardsRef = useRef('');
  currentSpreadRef.current = spreadId;
  currentCardsRef.current = drawnCards.map(item => `${item.card.id}:${item.orientation}`).join('|');
  const spread = TAROT_SPREADS[spreadId];

  useEffect(() => {
    const ids = [...new Set((aiReading?.cards || []).flatMap(c => c.sourceIds))];
    if (!ids.length) return;
    let alive = true;
    getClassicSources(ids).then(list => {
      if (!alive) return;
      setSourceRefs(Object.fromEntries(list.map(s => [s.sourceId, s])));
    }).catch(() => { if (alive) setSourceRefs({}); });
    return () => { alive = false; };
  }, [aiReading]);

  useEffect(() => () => timers.current.forEach(timer => window.clearTimeout(timer)), []);

  const copyHash = async () => {
    if (!seedHash) return;
    try {
      await navigator.clipboard.writeText(seedHash);
      setCopyStatus('校验码已复制');
    } catch {
      setCopyStatus('复制失败，请长按校验码选择复制。');
    }
  };

  const shuffle = async () => {
    roundRef.current += 1;
    if (!window.crypto?.getRandomValues || !window.crypto.subtle) {
      setNotice('当前浏览器无法提供安全随机数与摘要计算，请在安全连接中重试。');
      return;
    }
    try {
      const bytes = window.crypto.getRandomValues(new Uint8Array(32));
      const seed = toHex(bytes);
      const digest = await window.crypto.subtle.digest('SHA-256', bytes);
      setSeedHex(seed);
      setSeedHash(toHex(new Uint8Array(digest)));
      setCopyStatus('');
      setDrawnCards([]);
      setSelectedIndex(null);
      setVisibleCount(0);
      setFlight(null);
      setAiReading(null);
      setAiState('idle');
      setAiError('');
      setSaveState('idle');
      setSavedId('');
      setSaveError('');
      setDrawState('shuffled');
      setNotice('抽牌校验码已生成并固定；全部牌面揭晓后会公开用于复核的随机值。');
      setAnnouncement(`洗牌完成，抽牌校验码已公布。现在可以抽出${spread.count}张牌。`);
    } catch {
      setNotice('无法生成抽牌校验码，请重新洗牌。');
    }
  };

  const reveal = async () => {
    if (!seedHex || drawState !== 'shuffled') return;
    roundRef.current += 1;
    if (!question.trim()) {
      setNotice(`先写下这次想聚焦的问题，再抽出${spread.count}张牌。`);
      return;
    }
    const result = drawSpread(seedHex, spreadId);
    setDrawQuestion(question.trim());
    const stageRect = stageRef.current?.getBoundingClientRect();
    const deckRect = deckRef.current?.querySelector('.tarot-deck')?.getBoundingClientRect();
    if (!stageRect || !deckRect) {
      setNotice('未能定位牌堆与牌位，请重新洗牌后再试。');
      return;
    }
    setDrawnCards(result);
    setSelectedIndex(null);
    setVisibleCount(0);
    setDrawState('drawing');
    setNotice(`正在依次揭晓${spread.positions.join('、')}牌位。`);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisibleCount(spread.positions.length);
      setDrawState('revealed');
      setNotice(`${spread.count}张牌已揭晓。可打开抽牌记录查看各牌位的传统牌义与出处。`);
      setAnnouncement(`${spread.count}张牌已揭晓：${spread.positions.join('、')}。`);
      return;
    }

    for (let index = 0; index < spread.positions.length; index += 1) {
      const slotRect = slotRefs.current[index]?.getBoundingClientRect();
      if (!slotRect) continue;
      setFlight({
        card: result[index].card,
        orientation: result[index].orientation,
        index,
        fromX: deckRect.left + deckRect.width / 2 - slotRect.left - slotRect.width / 2,
        fromY: deckRect.top + deckRect.height / 2 - slotRect.top - slotRect.height / 2,
        fromScale: Math.min(1, deckRect.width / slotRect.width, deckRect.height / slotRect.height),
        targetX: slotRect.left - stageRect.left,
        targetY: slotRect.top - stageRect.top,
        targetWidth: slotRect.width,
        targetHeight: slotRect.height,
        revealed: false,
      });
      await new Promise<void>(resolve => {
        const timer = window.setTimeout(resolve, 540);
        timers.current.push(timer);
      });
      setFlight(current => current ? { ...current, revealed: true } : current);
      await new Promise<void>(resolve => {
        const timer = window.setTimeout(resolve, 480);
        timers.current.push(timer);
      });
      setVisibleCount(index + 1);
      setFlight(null);
      setAnnouncement(`${spread.positions[index]}牌已揭晓：${result[index].card.nameZh}。`);
    }
    timers.current = [];
    setDrawState('revealed');
    setNotice(`${spread.count}张牌已揭晓。可打开抽牌记录查看各牌位的传统牌义与出处。`);
    setAnnouncement(`${spread.count}张牌已揭晓：${spread.positions.join('、')}。`);
  };

  const reset = () => {
    roundRef.current += 1;
    timers.current.forEach(timer => window.clearTimeout(timer));
    timers.current = [];
    setDrawState('idle');
    setSeedHex('');
    setSeedHash('');
    setCopyStatus('');
    setQuestion('');
    setDrawQuestion('');
    setDrawnCards([]);
    setSelectedIndex(null);
    setVisibleCount(0);
    setFlight(null);
    setAiReading(null);
    setAiState('idle');
    setAiError('');
    setSaveState('idle');
    setSavedId('');
    setSaveError('');
    setNotice('洗牌后生成抽牌校验码；抽牌过程在本机完成。');
    setAnnouncement(`已重置。${spread.count}个牌位已准备好。`);
  };

  const selectSpread = (next: TarotSpreadId) => {
    if (next === spreadId || drawState === 'drawing') return;
    timers.current.forEach(timer => window.clearTimeout(timer));
    timers.current = [];
    roundRef.current += 1;
    const nextSpread = TAROT_SPREADS[next];
    setSpreadId(next);
    setDrawState('idle');
    setSeedHex('');
    setSeedHash('');
    setCopyStatus('');
    setDrawQuestion('');
    setDrawnCards([]);
    setSelectedIndex(null);
    setVisibleCount(0);
    setFlight(null);
    setAiReading(null);
    setAiState('idle');
    setAiError('');
    setSaveState('idle');
    setSavedId('');
    setSaveError('');
    setNotice(`${nextSpread.label}已选。洗牌后即可开始抽牌。`);
    setAnnouncement(`已切换到${nextSpread.label}，共${nextSpread.count}张。`);
  };

  const persistReading = async () => {
    if (drawnCards.length !== spread.positions.length || saveState === 'saving' || savedId) return;
    const saveRound = roundRef.current;
    const saveCards = currentCardsRef.current;
    setSaveState('saving');
    setSaveError('');
    try {
      const visitorId = getVisitorId();
      const reading: TarotSavedReading = {
        spread: spreadId,
        spreadLabel: spread.label,
        mode: aiReading?.mode ?? 'rules-only',
        aiReady: aiReading?.aiReady ?? false,
        cards: drawnCards.map(({ card, position, orientation }) => {
          const localMeaning = TAROT_MEANINGS[card.id];
          const interpreted = aiReading?.cards.find(item => item.cardId === card.id);
          return {
            cardId: card.id,
            nameZh: card.nameZh,
            position,
            orientation,
            text: interpreted?.text ?? localMeaning?.[orientation === '正位' ? 'upright' : 'reversed'] ?? '此牌义暂缺，后续补充来源校核。',
            source: interpreted?.source ?? localMeaning?.source ?? '待校核',
            sourceIds: interpreted?.sourceIds ?? [],
          };
        }),
        summary: aiReading?.summary ?? drawnCards.map(({ card, position, orientation }) => {
          const meaning = TAROT_MEANINGS[card.id];
          return `${position}「${card.nameZh}」（${orientation}）：${meaning?.[orientation === '正位' ? 'upright' : 'reversed'] ?? '牌义待补'}`;
        }).join('；'),
        notes: aiReading?.notes ?? ['本次保存包含本站生成的牌阵、牌面方向与逐牌牌义；未生成 AI 综合解读。'],
      };
      const saved = await saveTarotReading(visitorId, drawQuestion, reading);
      if (saveRound !== roundRef.current || saveCards !== currentCardsRef.current) return;
      setSavedId(saved.id);
      setSaveState('saved');
      setNotice('已保存到我的报告；记录保留 7 天。');
    } catch (error) {
      setSaveState('error');
      setSaveError(error instanceof Error ? error.message : '保存失败，请稍后重试');
    }
  };

  const generateAiReading = async () => {
    if (drawnCards.length !== spread.positions.length || aiState === 'loading') return;
    const requestRound = roundRef.current;
    const requestSpread = currentSpreadRef.current;
    const requestCards = currentCardsRef.current;
    setAiState('loading');
    setAiError('');
    try {
      const next = await createTarotReading({
        question: drawQuestion || undefined,
        spread: spreadId,
        cards: drawnCards.map(({ card, position, orientation }) => ({ cardId: card.id, position, orientation })),
      });
      if (requestRound !== roundRef.current || requestSpread !== currentSpreadRef.current
        || requestCards !== currentCardsRef.current) return;
      setAiReading(next);
      setSavedId('');
      setSaveState('idle');
      setAiState('idle');
      setAnnouncement(next.aiReady ? '混沌自研 AI 综合解读已生成。' : '综合 AI 暂不可用，已回退逐牌牌义。');
    } catch {
      if (requestRound !== roundRef.current || requestSpread !== currentSpreadRef.current
        || requestCards !== currentCardsRef.current) return;
      setAiState('error');
      setAiError('综合 AI 解读暂时不可用，请稍后再试；逐牌牌义仍可查看。');
    }
  };

  const primaryAction = async () => {
    if (drawState === 'idle') await shuffle();
    else if (drawState === 'shuffled') await reveal();
    else if (drawState === 'revealed') {
      setDrawState('reading');
      setNotice('抽牌记录已展开，包含逐张牌义、历史底本和牌面出处。');
      setAnnouncement('本次抽牌记录已展开，包含问题、牌位、牌名、花色、方向与传统牌义。');
    } else if (drawState === 'reading') reset();
  };

  const buttonLabel = {
    idle: '洗牌并生成校验码',
    shuffled: `抽出${spread.count}张`,
    drawing: '正在逐张揭晓',
    revealed: '查看抽牌记录',
    reading: '重新洗牌',
  }[drawState];
  const canAct = drawState !== 'drawing';
  const showReset = drawState !== 'idle' && drawState !== 'drawing';
  const selectedDraw = selectedIndex === null ? null : drawnCards[selectedIndex];
  const selectedMeaning = selectedDraw ? TAROT_MEANINGS[selectedDraw.card.id] : undefined;

  return (
    <main className="qn-shell qn-shell--wide tarot-page" data-mode="western" data-tarot-state={drawState} data-tarot-spread={spreadId}>
      <header className="tarot-header qn-rise">
        <Link href="/western" className="domain-back">← 返回西方目录</Link>
        <p className="qn-eyebrow">西方神秘学 · 塔罗</p>
        <h1 className="qn-hero">{spread.label}</h1>
        <p className="qn-meta">{SPREAD_GUIDES[spreadId]}先完成抽牌，再逐张查看牌位。</p>
        <p className="tarot-scope-note">韦特—史密斯体系牌面 · 支持正位与逆位 · 参考 Waite 1910 Part III 原文译述（78 张来源已核验）；马赛牌系另列本站自研象征读法</p>
      </header>

      <section className="tarot-spread-picker" aria-labelledby="tarot-spread-title">
        <div className="tarot-spread-picker__heading">
          <div>
            <p className="qn-eyebrow">选择展开方式</p>
            <h2 className="qn-title" id="tarot-spread-title">你想用哪种牌阵？</h2>
          </div>
          <span className="qn-cap">共 {spread.count} 张</span>
        </div>
        <div className="tarot-spread-options" role="group" aria-label="塔罗牌阵">
          {(Object.keys(TAROT_SPREADS) as TarotSpreadId[]).map(id => {
            const option = TAROT_SPREADS[id];
            return (
              <button
                key={id}
                type="button"
                className={`tarot-spread-option${spreadId === id ? ' is-selected' : ''}`}
                data-spread-option={id}
                aria-pressed={spreadId === id}
                disabled={drawState === 'drawing'}
                onClick={() => selectSpread(id)}
              >
                <span className="tarot-spread-option__count">{option.count}<small>张</small></span>
                <span className="tarot-spread-option__copy">
                  <strong>{option.label}</strong>
                  <span>{option.positions.slice(0, 3).join(' · ')}{option.positions.length > 3 ? ' · …' : ''}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="tarot-question qn-rise" aria-labelledby="tarot-question-label">
        <div className="tarot-question__heading">
          <label id="tarot-question-label" htmlFor="tarot-question-input">这次想聚焦什么问题？</label>
          <span>{question.length} / 200</span>
        </div>
        <textarea
          id="tarot-question-input"
          data-tarot-question
          className="qn-textarea"
          value={question}
          maxLength={200}
          rows={2}
          placeholder="尽量问一件具体的事，例如：我接下来该怎样推进这次合作？"
          onChange={event => setQuestion(event.target.value)}
          aria-describedby="tarot-question-note"
        />
        <p className="tarot-question__note" id="tarot-question-note">抽牌在本机完成。生成 AI 综合解读时，问题会随本次请求处理；点击保存后，问题与牌面记录会存入“我的报告”，保留 7 天。</p>
      </section>

      <section ref={stageRef} className="tarot-stage qn-rise" aria-label="塔罗抽牌区">
        <div className="tarot-stage__heading">
          <div>
            <p className="tarot-stage__eyebrow">当前牌阵 · {spread.label}</p>
            <h2 className="tarot-stage__title">静心洗牌</h2>
          </div>
          <span className="tarot-stage__count">{visibleCount} / {spread.count} 已揭晓</span>
        </div>

        <button
          ref={deckRef}
          type="button"
          className={`tarot-deck-button${drawState === 'shuffled' ? ' is-shuffled' : ''}`}
          onPointerMove={event => {
            if (event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const tilt = getDeckTilt(((event.clientX - rect.left) / rect.width) * 2 - 1, ((event.clientY - rect.top) / rect.height) * 2 - 1);
            const deck = event.currentTarget.querySelector<HTMLElement>('.tarot-deck');
            deck?.style.setProperty('--deck-tilt-x', `${tilt.x}deg`);
            deck?.style.setProperty('--deck-tilt-y', `${tilt.y}deg`);
          }}
          onPointerLeave={event => {
            const deck = event.currentTarget.querySelector<HTMLElement>('.tarot-deck');
            deck?.style.setProperty('--deck-tilt-x', '0deg');
            deck?.style.setProperty('--deck-tilt-y', '0deg');
          }}
          onClick={primaryAction}
          disabled={!canAct || drawState === 'revealed' || drawState === 'reading'}
          aria-label={drawState === 'idle' ? '洗牌并生成校验码' : `从牌堆抽出${spread.count}张牌`}
        >
          <span className="tarot-deck" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <span
                key={index}
                className="tarot-deck__card"
                style={{
                  '--stack-x': `${index * 2}px`,
                  '--stack-y': `${-index * 2}px`,
                  '--stack-z': `${index * 2}px`,
                } as CSSProperties}
              >
                <span className="tarot-deck__rosette" />
              </span>
            ))}
          </span>
          <span className="tarot-deck__caption">{drawState === 'idle' ? '点击洗牌' : drawState === 'shuffled' ? `点击抽出${spread.count}张` : drawState === 'drawing' ? '牌面揭晓中' : '牌堆已完成'}</span>
        </button>

        {flight && (
          <div
            key={`${flight.card.id}-${flight.index}`}
            className={`tarot-card tarot-card--flying${flight.revealed ? ' is-revealed' : ''}${flight.orientation === '逆位' ? ' tarot-card--reversed' : ''}`}
            aria-hidden="true"
            style={{
              left: `${flight.targetX}px`,
              top: `${flight.targetY}px`,
              width: `${flight.targetWidth}px`,
              height: `${flight.targetHeight}px`,
              '--flight-from-x': `${flight.fromX}px`,
              '--flight-from-y': `${flight.fromY}px`,
              '--flight-from-scale': flight.fromScale,
            } as CSSProperties}
          >
            <TarotCardFace card={flight.card} orientation={flight.orientation} />
          </div>
        )}

        <div className="tarot-slots" data-spread={spreadId} aria-label={`${spread.label}牌位`}>
          {spread.positions.map((position, index) => (
            <TarotSlot
              key={position}
              position={position}
              drawn={drawnCards[index]}
              visible={index < visibleCount}
              selected={selectedIndex === index}
              index={index}
              onSelect={() => setSelectedIndex(current => current === index ? null : index)}
              stageElementRef={(node: HTMLDivElement | null) => { slotRefs.current[index] = node; }}
            />
          ))}
        </div>

        {selectedDraw && (
          <section className="tarot-insight" key={`${selectedDraw.card.id}-${selectedDraw.orientation}`} aria-labelledby="tarot-insight-title">
            <div>
              <p className="tarot-insight__eyebrow">{selectedDraw.position}牌 · {selectedDraw.orientation}</p>
              <h3 id="tarot-insight-title">{selectedDraw.card.nameZh} <span data-proper-name>{selectedDraw.card.nameEn}</span></h3>
              <p>{selectedMeaning?.[selectedDraw.orientation === '正位' ? 'upright' : 'reversed'] ?? '此牌义暂缺，后续补充来源校核。'}</p>
              <small>牌义参照：Waite 1910 · Part III（韦特牌系）；点击其他牌可切换查看。</small>
              <details className="tarot-tradition" data-tarot-tradition-card={selectedDraw.card.id}>
                <summary>跨传统对读 · 韦特—史密斯与马赛牌系</summary>
                {(() => {
                  const marseille = getMarseilleCardReference(selectedDraw.card);
                  const marseilleReading = getMarseilleReading(selectedDraw.card);
                  const orientationKey = selectedDraw.orientation === '正位' ? 'upright' : 'reversed';
                  return (
                    <>
                      <div className="tarot-tradition__grid">
                        <div className="tarot-tradition__column">
                          <strong>本次牌义 · 韦特—史密斯</strong>
                          <p>{selectedDraw.card.nameZh} · {selectedDraw.card.arcana === 'major' ? `${selectedDraw.card.numeral} 号` : `${selectedDraw.card.rank} · ${selectedDraw.card.suit}`}</p>
                          <p>{selectedDraw.orientation}：{selectedMeaning?.[selectedDraw.orientation === '正位' ? 'upright' : 'reversed'] ?? '此牌义暂缺。'}</p>
                        </div>
                        <div className="tarot-tradition__column">
                          <strong>马赛牌系 · 本站自研象征读法</strong>
                          <p>{marseille.title} · {marseille.number}</p>
                          <p>{marseille.structure}</p>
                          <p>{selectedDraw.orientation}：{marseilleReading?.[orientationKey] ?? '本牌结构暂缺，暂不推测。'}</p>
                          {marseille.note && <p>{marseille.note}</p>}
                        </div>
                      </div>
                      <p className="tarot-tradition__scope">
                        韦特牌义依据 Waite 1910 年文本译述；马赛一栏把牌名、数字与花色作为结构线索，属于本站自研读法，不冒称历史定本或学界统一解释。
                      </p>
                      <div className="tarot-tradition__sources" aria-label="跨传统对读资料">
                        <a href={TAROT_TRADITION_SOURCES.waite} target="_blank" rel="noreferrer">Waite 1910 · Part III 原文</a>
                        <a href={TAROT_TRADITION_SOURCES.dodal} target="_blank" rel="noreferrer">大英博物馆 · Dodal 78 张牌组馆藏记录</a>
                      </div>
                    </>
                  );
                })()}
              </details>
            </div>
            <button type="button" className="tarot-insight__close" onClick={() => setSelectedIndex(null)} aria-label="收起牌义">收起</button>
          </section>
        )}

        <div className="tarot-action-row">
          <button type="button" className="qn-btn qn-btn--solid tarot-action" onClick={primaryAction} disabled={!canAct}>
            {buttonLabel}
          </button>
          <button
            type="button"
            className="qn-btn qn-btn--ghost tarot-action"
            onClick={reset}
            disabled={!showReset}
            aria-hidden={!showReset}
            tabIndex={showReset ? 0 : -1}
            style={{ visibility: showReset ? 'visible' : 'hidden' }}
          >重新开始</button>
          <p className="tarot-keyboard-note">牌堆与按钮均可键盘聚焦，按回车或空格执行。</p>
        </div>
        {drawState === 'shuffled' && !question.trim() && (
          <p className="qn-note" role="status" data-tarot-need-question style={{ textAlign: 'center', margin: '8px 0 0' }}>
            先写下这次想聚焦的问题，再抽出牌面；问题只用于本次解读，不会自动发送。
          </p>
        )}
      </section>

      <p className="tarot-notice" role="status" aria-live="polite">{notice}</p>

      <section className="tarot-reading" aria-live="polite" aria-label="牌位说明">
        {drawState === 'reading' ? (
          <>
            <p className="qn-eyebrow">本次抽牌记录</p>
            <h2 className="qn-title">{spread.label} · 逐牌记录</h2>
            {drawQuestion && <blockquote className="tarot-reading__question">「{drawQuestion}」</blockquote>}
            <p className="qn-meta">韦特栏为 Waite 1910 年 Part III 中文译述；每张牌同时列出马赛牌系的本站自研正逆位象征读法。马赛读法不冒称历史定本或统一牌义。</p>
            <ol className="tarot-record-list">
              {drawnCards.map(({ card, position, orientation }, index) => {
                const meaning = TAROT_MEANINGS[card.id];
                const marseilleMeaning = getMarseilleReading(card);
                const orientationKey = orientation === '正位' ? 'upright' : 'reversed';
                return (
                <li key={position} style={{ '--tarot-record-index': index } as CSSProperties}>
                  <span className="tarot-record-list__position">{position}</span>
                  <strong>{card.nameZh}</strong>
                  <span className="tarot-record-list__facts">{card.arcana === 'major' ? `大阿卡那 · ${card.numeral} 号` : `小阿卡那 · ${card.rank} · ${card.suit}`}</span>
                  <span className="tarot-record-list__orientation">{orientation}</span>
                  <span className="tarot-record-list__meaning">{meaning ? meaning[orientation === '正位' ? 'upright' : 'reversed'] : '此牌义暂缺，后续补充来源校核。'}</span>
                  <span className="tarot-record-list__source">出处：{meaning?.source ?? '待校核'}</span>
                  <span className="tarot-record-list__source">马赛 · 本站自研：{marseilleMeaning?.[orientationKey] ?? '本牌结构暂缺，暂不推测。'}</span>
                </li>
                );
              })}
            </ol>

            <div className="tarot-ai-reading" data-tarot-ai-mode={aiReading?.mode ?? 'none'} data-ai-ready={aiReading?.aiReady ? 'true' : 'false'}>
              <button type="button" className="qn-btn qn-btn--solid" style={{ minHeight: 44 }}
                onClick={() => void generateAiReading()} disabled={aiState === 'loading'}
                aria-describedby="tarot-ai-boundary">
                {aiState === 'loading' ? 'AI 综合解读生成中…' : aiReading ? '重新生成 AI 综合解读' : '生成 AI 综合解读'}
              </button>
              {aiError && <p className="qn-alert" role="alert">{aiError}</p>}
              {aiReading && (
                <section aria-labelledby="tarot-ai-title" style={{ marginTop: 12 }}>
                  <p className="qn-cap" style={{ margin: 0 }}>
                    {aiReading.mode === 'ai' && aiReading.aiReady ? '混沌自研 AI 综合解读' : '规则回退 · AI 未接入'}
                  </p>
                  {aiReading.mode === 'ai' && aiReading.aiReady ? (
                    <PlainLanguageView context="tarot" parts={[
                      { id: 'summary', text: aiReading.summary },
                      ...aiReading.cards.map((card, index) => ({ id: `card-${index}`, text: card.text })),
                    ]}>{textById => <>
                      <p id="tarot-ai-title" className="qn-note" style={{ margin: '8px 0 0' }}>{textById.summary}</p>
                      <ul className="qn-meta" style={{ margin: '10px 0 0', paddingLeft: '1.2em' }}>
                        {aiReading.cards.map((c, index) => (
                          <li key={c.cardId} style={{ marginTop: 8 }}>
                            <strong>{c.position}「{c.nameZh}」{c.orientation}</strong>：{textById[`card-${index}`]}
                            <span className="qn-cap" style={{ display: 'block', marginTop: 2 }}>
                              牌义出处：{c.source}；AI 文本不等于牌面事实。
                            </span>
                            {c.sourceIds.length > 0 && (
                              <span className="qn-cap" style={{ display: 'block', marginTop: 2 }} data-tarot-sources={c.sourceIds.join(',')}>
                                已登记出处：{c.sourceIds.map(id => {
                                  const s = sourceRefs[id];
                                  return s ? `${s.book} · ${s.chapter}` : id;
                                }).join('；')}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>}</PlainLanguageView>
                  ) : (
                    <p id="tarot-ai-title" className="qn-note" style={{ margin: '8px 0 0' }}>
                      {aiReading.notes[0] || 'AI 未参与本轮解读，当前仅显示已登记牌义。'}
                    </p>
                  )}
                  <p id="tarot-ai-boundary" className="qn-cap" style={{ margin: '8px 0 0' }}>
                    {aiReading.notes.join(' ')}
                  </p>
                </section>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="qn-eyebrow">解读状态</p>
            <h2 className="qn-title">{drawState === 'revealed' ? '查看逐牌参照' : '牌位已预留'}</h2>
            <p className="qn-meta">{drawState === 'revealed' ? '展开抽牌记录，即可查看每张牌对应正位或逆位的历史译述与章节出处。' : '抽牌后会按所选牌阵展示每张牌的牌名、方向与传统释义出处。'}</p>
          </>
        )}
      </section>

      {(drawState === 'revealed' || drawState === 'reading') && (
        <section className="tarot-save" aria-label="保存塔罗记录">
          <div>
            <p className="qn-cap">保存到本机访问者标识对应的“我的报告”，7 天后自动清理。</p>
            {saveError && <p className="qn-alert" role="alert">{saveError}</p>}
            {saveState === 'saved' && <p className="qn-meta" role="status">记录已保存，可前往我的报告查看或删除。</p>}
          </div>
          <button
            type="button"
            className="qn-btn qn-btn--ghost tarot-save__button"
            data-tarot-save
            onClick={() => void persistReading()}
            disabled={saveState === 'saving' || saveState === 'saved'}
          >
            {saveState === 'saving' ? '正在保存…' : saveState === 'saved' ? '已保存' : '保存到我的记录'}
          </button>
          {saveState === 'saved' && <Link href="/dashboard" className="tarot-save__link">查看我的报告 →</Link>}
        </section>
      )}

      <section className="tarot-integrity" aria-labelledby="tarot-integrity-title">
        <div className="tarot-integrity__heading">
          <div>
            <p className="qn-eyebrow">本机抽牌记录</p>
            <h2 className="qn-title" id="tarot-integrity-title">抽牌校验记录</h2>
          </div>
          <span className="tarot-integrity__state">{drawState === 'idle' ? '待生成' : drawState === 'shuffled' || drawState === 'drawing' ? '已锁定' : '已揭晓'}</span>
        </div>
        <div className="tarot-integrity__row">
          <span>抽牌校验码</span>
          <code data-tarot-commit-hash>{seedHash || '洗牌后生成，抽牌前固定'}</code>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minHeight: 44, marginTop: 8 }}>
          <button type="button" className="qn-btn qn-btn--ghost" style={{ minHeight: 44 }} disabled={!seedHash} onClick={() => void copyHash()}>
            复制抽牌校验码
          </button>
          {copyStatus && <span className="qn-meta" role="status">{copyStatus}</span>}
        </div>
        <div className="tarot-integrity__row">
          <span>校验用随机值</span>
          <code>{drawState === 'revealed' || drawState === 'reading' ? seedHex : `${spread.count}张牌揭晓后公开`}</code>
        </div>
        <p className="tarot-integrity__note">
          校验码在抽牌前固定，揭晓后公开随机值，供事后复算牌序。未点击保存时，抽牌记录只留在当前页面；保存后会归入本机访问者标识下的“我的报告”，7 天后自动清理。当前不是区块链存证。
        </p>
        <details style={{ marginTop: 8 }}>
          <summary className="qn-meta" style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>校验方式说明</summary>
          <p className="qn-meta" style={{ marginTop: 6 }}>
            抽牌前根据随机值生成校验码；结果揭晓后，可按相同规则重新生成牌序并对照本次记录。当前没有提交公开台账，因此不能证明校验码曾被外部记录。
          </p>
        </details>
      </section>

      <p className="sr-only" aria-live="polite">{announcement}</p>
      <p className="tarot-footnote">牌名与牌序参考韦特—史密斯体系，牌面为本站原创符号插画。所列牌义是指定历史文本的中文译述，不代表统一标准、学术共识或科学预测。</p>
      <details className="tarot-sources">
        <summary>牌组历史与资料依据</summary>
        <p>牌面构图保留易识别的传统象征线索，以原创矢量绘制；牌义摘要按牌位方向对应原文段落意译，并保留 Waite 原书中相互矛盾或另有异说的部分。引文仅作历史文化参照，不将占卜结论当作科学证据。</p>
        <ul>
          <li><a href="https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_3" target="_blank" rel="noreferrer" className="qn-link" style={{ display: 'flex', alignItems: 'center', minHeight: 44, maxWidth: '100%', lineHeight: 1.5, overflowWrap: 'anywhere' }}>A. E. Waite，《The Pictorial Key to the Tarot》（1910），Part III：Divinatory Meanings</a></li>
          <li><a href="https://www.vam.ac.uk/articles/tarot-cards" target="_blank" rel="noreferrer" className="qn-link" style={{ display: 'flex', alignItems: 'center', minHeight: 44, maxWidth: '100%', lineHeight: 1.5, overflowWrap: 'anywhere' }}>Victoria and Albert Museum：A history of tarot cards</a></li>
        </ul>
      </details>
    </main>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { drawThree, THREE_CARD_POSITIONS } from '@/lib/tarot/deck';
import type { TarotCard, TarotDraw, TarotOrientation, TarotPosition } from '@/lib/tarot/deck';
import { TarotIllustration } from '@/components/tarot/TarotIllustration';
import { TAROT_MEANINGS } from '@/lib/tarot/meanings';

type DrawState = 'idle' | 'shuffled' | 'drawing' | 'revealed' | 'reading';

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
  position, drawn, visible, stageElementRef,
}: {
  position: TarotPosition;
  drawn?: TarotDraw;
  visible: boolean;
  stageElementRef?: (node: HTMLDivElement | null) => void;
}) {
  return (
    <article className="tarot-slot" aria-label={`${position}牌位${visible && drawn ? `：${drawn.card.nameZh}` : '，尚未揭示'}`}>
      <h2 className="tarot-slot__position">{position}</h2>
      <div className="tarot-slot__stage" ref={stageElementRef}>
        {visible && drawn ? (
            <div className={`tarot-card is-revealed${drawn.orientation === '逆位' ? ' tarot-card--reversed' : ''}`} data-card-id={drawn.card.id} data-orientation={drawn.orientation} aria-label={`${drawn.card.nameZh}${drawn.orientation}`}>
            <div className="tarot-card__inner">
              <CardBack />
                <CardFront card={drawn.card} orientation={drawn.orientation} />
            </div>
          </div>
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
  const [drawState, setDrawState] = useState<DrawState>('idle');
  const [seedHex, setSeedHex] = useState('');
  const [seedHash, setSeedHash] = useState('');
  const [question, setQuestion] = useState('');
  const [drawQuestion, setDrawQuestion] = useState('');
  const [drawnCards, setDrawnCards] = useState<TarotDraw[]>([]);
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
  const [notice, setNotice] = useState('洗牌后先公布承诺摘要；三张牌只在本机抽取。');
  const [announcement, setAnnouncement] = useState('三张牌位已准备好。');
  const timers = useRef<number[]>([]);
  const stageRef = useRef<HTMLElement>(null);
  const deckRef = useRef<HTMLButtonElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => () => timers.current.forEach(timer => window.clearTimeout(timer)), []);

  const shuffle = async () => {
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
      setDrawnCards([]);
      setVisibleCount(0);
      setFlight(null);
      setDrawState('shuffled');
      setNotice('承诺摘要已生成。抽牌前保持不变；三张牌揭晓后再公开随机种子。');
      setAnnouncement('洗牌完成，承诺摘要已公布。现在可以抽出三张牌。');
    } catch {
      setNotice('本次未能生成可复算的抽牌承诺，请重新洗牌。');
    }
  };

  const reveal = async () => {
    if (!seedHex || drawState !== 'shuffled') return;
    if (!question.trim()) {
      setNotice('先写下这次想聚焦的问题，再抽出三张牌。');
      return;
    }
    const result = drawThree(seedHex);
    setDrawQuestion(question.trim());
    const stageRect = stageRef.current?.getBoundingClientRect();
    const deckRect = deckRef.current?.querySelector('.tarot-deck')?.getBoundingClientRect();
    if (!stageRect || !deckRect) {
      setNotice('未能定位牌堆与牌位，请重新洗牌后再试。');
      return;
    }
    setDrawnCards(result);
    setVisibleCount(0);
    setDrawState('drawing');
    setNotice('正在依次揭晓过去、现在与未来牌位。');

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisibleCount(THREE_CARD_POSITIONS.length);
      setDrawState('revealed');
      setNotice('三张牌已揭晓。可打开抽牌记录查看方向对应的传统牌义与出处。');
      setAnnouncement('三张牌已揭晓：过去、现在、未来。');
      return;
    }

    for (let index = 0; index < THREE_CARD_POSITIONS.length; index += 1) {
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
      setAnnouncement(`${THREE_CARD_POSITIONS[index]}牌已揭晓：${result[index].card.nameZh}。`);
    }
    timers.current = [];
    setDrawState('revealed');
    setNotice('三张牌已揭晓。可打开抽牌记录查看方向对应的传统牌义与出处。');
    setAnnouncement('三张牌已揭晓：过去、现在、未来。');
  };

  const reset = () => {
    timers.current.forEach(timer => window.clearTimeout(timer));
    timers.current = [];
    setDrawState('idle');
    setSeedHex('');
    setSeedHash('');
    setQuestion('');
    setDrawQuestion('');
    setDrawnCards([]);
    setVisibleCount(0);
    setFlight(null);
    setNotice('洗牌后先公布承诺摘要；三张牌只在本机抽取。');
    setAnnouncement('已重置。三张牌位已准备好。');
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
    idle: '洗牌并公布承诺摘要',
    shuffled: '抽出三张',
    drawing: '正在逐张揭晓',
    revealed: '查看抽牌记录',
    reading: '重新洗牌',
  }[drawState];
  const canAct = drawState !== 'drawing';
  const showReset = drawState !== 'idle' && drawState !== 'drawing';

  return (
    <main className="qn-shell qn-shell--wide tarot-page" data-mode="western" data-tarot-state={drawState}>
      <header className="tarot-header qn-rise">
        <Link href="/western" className="domain-back">← 返回西方目录</Link>
        <p className="qn-eyebrow">西方玄学 · 塔罗</p>
        <h1 className="qn-hero">三张牌阵</h1>
        <p className="qn-meta">把过去、现在与未来放在同一条时间线上，先完成抽牌，再查看牌位。</p>
        <p className="tarot-scope-note">韦特—史密斯体系原创绘制 · 正位与逆位 · 参考 Waite 1910 牌义译述（近代文献 · 非古籍；底本待校核）</p>
      </header>

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
        <p className="tarot-question__note" id="tarot-question-note">问题只留在当前页面，不发送到服务器；抽牌后会与牌位记录一起显示。</p>
      </section>

      <section ref={stageRef} className="tarot-stage qn-rise" aria-label="塔罗抽牌区">
        <div className="tarot-stage__heading">
          <div>
            <p className="tarot-stage__eyebrow">三张 · 过去 / 现在 / 未来</p>
            <h2 className="tarot-stage__title">静心洗牌</h2>
          </div>
          <span className="tarot-stage__count">{visibleCount} / 3 已揭晓</span>
        </div>

        <button
          ref={deckRef}
          type="button"
          className={`tarot-deck-button${drawState === 'shuffled' ? ' is-shuffled' : ''}`}
          onClick={primaryAction}
          disabled={!canAct || drawState === 'revealed' || drawState === 'reading' || (drawState === 'shuffled' && !question.trim())}
          aria-label={drawState === 'idle' ? '洗牌并公布承诺摘要' : '从牌堆抽出三张牌'}
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
          <span className="tarot-deck__caption">{drawState === 'idle' ? '点击洗牌' : drawState === 'shuffled' ? '点击抽出三张' : drawState === 'drawing' ? '牌面揭晓中' : '牌堆已完成'}</span>
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

        <div className="tarot-slots" aria-label="过去、现在、未来三个固定牌位">
          {THREE_CARD_POSITIONS.map((position, index) => (
            <TarotSlot
              key={position}
              position={position}
              drawn={drawnCards[index]}
              visible={index < visibleCount}
              stageElementRef={(node: HTMLDivElement | null) => { slotRefs.current[index] = node; }}
            />
          ))}
        </div>

        <div className="tarot-action-row">
          <button type="button" className="qn-btn qn-btn--solid tarot-action" onClick={primaryAction} disabled={!canAct || (drawState === 'shuffled' && !question.trim())}>
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
      </section>

      <p className="tarot-notice" role="status" aria-live="polite">{notice}</p>

      <section className="tarot-integrity" aria-labelledby="tarot-integrity-title">
        <div className="tarot-integrity__heading">
          <div>
            <p className="qn-eyebrow">本地抽牌记录</p>
            <h2 className="qn-title" id="tarot-integrity-title">可复算的随机承诺</h2>
          </div>
          <span className="tarot-integrity__state">{drawState === 'idle' ? '待生成' : drawState === 'shuffled' || drawState === 'drawing' ? '已承诺' : '已揭晓'}</span>
        </div>
        <div className="tarot-integrity__row">
          <span>承诺摘要（<span data-proper-name>SHA-256</span>）</span>
          <code>{seedHash || '洗牌时生成，抽牌前固定'}</code>
        </div>
        <div className="tarot-integrity__row">
          <span>随机种子</span>
          <code>{drawState === 'revealed' || drawState === 'reading' ? seedHex : '三张牌揭晓后公开'}</code>
        </div>
        <p className="tarot-integrity__note">摘要与种子仅保存在当前页面状态中，不发送到服务器；这不是区块链存证，也不代表外部审计。</p>
      </section>

      <section className="tarot-reading" aria-live="polite" aria-label="牌位说明">
        {drawState === 'reading' ? (
          <>
            <p className="qn-eyebrow">本次抽牌记录</p>
            <h2 className="qn-title">过去、现在与未来</h2>
            {drawQuestion && <blockquote className="tarot-reading__question">「{drawQuestion}」</blockquote>}
            <p className="qn-meta">下列含义参考 Waite 1910 年文本作中文译述（章节对应待校核），仅代表这一历史底本；不同传统与组合语境会有差异。</p>
            <ol className="tarot-record-list">
              {drawnCards.map(({ card, position, orientation }) => {
                const meaning = TAROT_MEANINGS[card.id];
                return (
                <li key={position}>
                  <span className="tarot-record-list__position">{position}</span>
                  <strong>{card.nameZh}</strong>
                  <span className="tarot-record-list__facts">{card.arcana === 'major' ? `大阿卡那 · ${card.numeral} 号` : `小阿卡那 · ${card.rank} · ${card.suit}`}</span>
                  <span className="tarot-record-list__orientation">{orientation}</span>
                  <span className="tarot-record-list__meaning">{meaning ? meaning[orientation === '正位' ? 'upright' : 'reversed'] : '此牌义暂缺，后续补充来源校核。'}</span>
                  <span className="tarot-record-list__source">出处：{meaning?.source ?? '待校核'}</span>
                </li>
                );
              })}
            </ol>
          </>
        ) : (
          <>
            <p className="qn-eyebrow">解读状态</p>
            <h2 className="qn-title">{drawState === 'revealed' ? '查看逐牌参照' : '牌位已预留'}</h2>
            <p className="qn-meta">{drawState === 'revealed' ? '展开抽牌记录，即可查看每张牌对应正位或逆位的历史译述与章节出处。' : '抽牌后可按过去、现在与未来查看牌名、牌面方向和传统释义出处。'}</p>
          </>
        )}
      </section>

      <p className="sr-only" aria-live="polite">{announcement}</p>
      <p className="tarot-footnote">牌名与牌序参考韦特—史密斯体系，牌面为本站原创符号插画。所列牌义是指定历史文本的中文译述，不代表统一标准、学术共识或科学预测。</p>
      <details className="tarot-sources">
        <summary>牌组历史与资料依据</summary>
        <p>牌面构图保留易识别的传统象征线索，以原创矢量绘制；牌义摘要按牌位方向对应原文段落意译，并保留 Waite 原书中相互矛盾或另有异说的部分。引文仅作历史文化参照，不将占卜结论当作科学证据。</p>
        <ul>
          <li><a href="https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_3" target="_blank" rel="noreferrer">A. E. Waite，《The Pictorial Key to the Tarot》（1910），Part III：Divinatory Meanings</a></li>
          <li><a href="https://www.vam.ac.uk/articles/tarot-cards" target="_blank" rel="noreferrer">Victoria and Albert Museum：A history of tarot cards</a></li>
        </ul>
      </details>
    </main>
  );
}

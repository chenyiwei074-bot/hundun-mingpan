'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { drawThree, TAROT_SUITS, THREE_CARD_POSITIONS } from '@/lib/tarot/deck';
import type { TarotCard, TarotDraw, TarotPosition } from '@/lib/tarot/deck';

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

function CardFront({ card }: { card: TarotCard }) {
  const suit = TAROT_SUITS.find(item => item.zh === card.suit);
  return (
    <div className="tarot-card__front">
      <span className="tarot-card__front-frame" />
      <span className="tarot-card__number">{card.numeral ?? card.rank}</span>
      <span className="tarot-card__symbol" aria-hidden="true">{suit?.mark ?? '✧'}</span>
      <span className="tarot-card__name">{card.nameZh}</span>
      <span className="tarot-card__english" data-proper-name>{card.nameEn}</span>
      <span className="tarot-card__meaning">牌义待接入</span>
    </div>
  );
}

function TarotSlot({
  position, drawn, visible, index,
}: {
  position: TarotPosition;
  drawn?: TarotDraw;
  visible: boolean;
  index: number;
}) {
  return (
    <article className="tarot-slot" aria-label={`${position}牌位${visible && drawn ? `：${drawn.card.nameZh}` : '，尚未揭示'}`}>
      <h2 className="tarot-slot__position">{position}</h2>
      <div className="tarot-slot__stage">
        {visible && drawn ? (
          <div className="tarot-card tarot-card--arriving is-revealed" data-card-id={drawn.card.id} style={{ '--deal-order': index } as CSSProperties}>
            <div className="tarot-card__inner">
              <CardBack />
              <CardFront card={drawn.card} />
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

export default function TarotPage() {
  const [drawState, setDrawState] = useState<DrawState>('idle');
  const [seedHex, setSeedHex] = useState('');
  const [seedHash, setSeedHash] = useState('');
  const [drawnCards, setDrawnCards] = useState<TarotDraw[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [notice, setNotice] = useState('洗牌后先公布承诺摘要；三张牌只在本机抽取。');
  const [announcement, setAnnouncement] = useState('三张牌位已准备好。');
  const timers = useRef<number[]>([]);

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
      setDrawState('shuffled');
      setNotice('承诺摘要已生成。抽牌前保持不变；三张牌揭晓后再公开随机种子。');
      setAnnouncement('洗牌完成，承诺摘要已公布。现在可以抽出三张牌。');
    } catch {
      setNotice('本次未能生成可复算的抽牌承诺，请重新洗牌。');
    }
  };

  const reveal = async () => {
    if (!seedHex || drawState !== 'shuffled') return;
    const result = drawThree(seedHex);
    setDrawnCards(result);
    setVisibleCount(0);
    setDrawState('drawing');
    setNotice('正在依次揭晓过去、现在与未来牌位。');

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisibleCount(THREE_CARD_POSITIONS.length);
      setDrawState('revealed');
      setNotice('三张牌已揭晓。牌义内容尚未接入，页面只展示牌名与牌位。');
      setAnnouncement('三张牌已揭晓：过去、现在、未来。牌义待接入。');
      return;
    }

    for (let index = 0; index < THREE_CARD_POSITIONS.length; index += 1) {
      await new Promise<void>(resolve => {
        const timer = window.setTimeout(resolve, 560);
        timers.current.push(timer);
      });
      setVisibleCount(index + 1);
      setAnnouncement(`${THREE_CARD_POSITIONS[index]}牌已揭晓：${result[index].card.nameZh}。`);
    }
    timers.current = [];
    setDrawState('revealed');
    setNotice('三张牌已揭晓。牌义内容尚未接入，页面只展示牌名与牌位。');
    setAnnouncement('三张牌已揭晓：过去、现在、未来。牌义待接入。');
  };

  const reset = () => {
    timers.current.forEach(timer => window.clearTimeout(timer));
    timers.current = [];
    setDrawState('idle');
    setSeedHex('');
    setSeedHash('');
    setDrawnCards([]);
    setVisibleCount(0);
    setNotice('洗牌后先公布承诺摘要；三张牌只在本机抽取。');
    setAnnouncement('已重置。三张牌位已准备好。');
  };

  const primaryAction = async () => {
    if (drawState === 'idle') await shuffle();
    else if (drawState === 'shuffled') await reveal();
    else if (drawState === 'revealed') {
      setDrawState('reading');
      setNotice('当前只展示抽牌结果；牌义待接入，没有生成解释。');
      setAnnouncement('进入牌位查看。三张牌的牌义仍待接入。');
    } else if (drawState === 'reading') reset();
  };

  const buttonLabel = {
    idle: '洗牌并公布承诺摘要',
    shuffled: '抽出三张',
    drawing: '正在逐张揭晓',
    revealed: '开始解读',
    reading: '重新洗牌',
  }[drawState];
  const canAct = drawState !== 'drawing';
  const showReset = drawState !== 'idle' && drawState !== 'drawing';

  return (
    <main className="qn-shell qn-shell--wide tarot-page" data-mode="western" data-tarot-state={drawState}>
      <header className="tarot-header qn-rise">
        <p className="qn-eyebrow">西方玄学 · 塔罗</p>
        <h1 className="qn-hero">三张牌阵</h1>
        <p className="qn-meta">把过去、现在与未来放在同一条时间线上，先完成抽牌，再查看牌位。</p>
        <p className="tarot-scope-note">本站简化玩法 · 无古籍出处 · 仅正位 · 逆位未做</p>
      </header>

      <section className="tarot-stage qn-rise" aria-label="塔罗抽牌区">
        <div className="tarot-stage__heading">
          <div>
            <p className="tarot-stage__eyebrow">三张 · 过去 / 现在 / 未来</p>
            <h2 className="tarot-stage__title">静心洗牌</h2>
          </div>
          <span className="tarot-stage__count">{visibleCount} / 3 已揭晓</span>
        </div>

        <button
          type="button"
          className={`tarot-deck-button${drawState === 'shuffled' ? ' is-shuffled' : ''}`}
          onClick={primaryAction}
          disabled={!canAct || drawState === 'revealed' || drawState === 'reading'}
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

        <div className="tarot-slots" aria-label="过去、现在、未来三个固定牌位">
          {THREE_CARD_POSITIONS.map((position, index) => (
            <TarotSlot
              key={position}
              position={position}
              drawn={drawnCards[index]}
              visible={index < visibleCount}
              index={index}
            />
          ))}
        </div>

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
            <p className="qn-eyebrow">牌位查看</p>
            <h2 className="qn-title">牌义待接入</h2>
            <p className="qn-meta">当前只提供三张牌的名称与位置。牌义资料尚未接入，因此本站不会在这里生成含义或综合结论。</p>
          </>
        ) : (
          <>
            <p className="qn-eyebrow">解读状态</p>
            <h2 className="qn-title">{drawState === 'revealed' ? '牌义待接入' : '牌位已预留'}</h2>
            <p className="qn-meta">{drawState === 'revealed' ? '三张牌已显示；牌义资料尚未接入。' : '三张牌揭晓后，这里会按过去、现在与未来列出牌面。牌义待接入。'}</p>
          </>
        )}
      </section>

      <p className="sr-only" aria-live="polite">{announcement}</p>
      <p className="tarot-footnote">此页面为本站简化抽牌玩法，暂无古籍出处。仅使用正位；逆位系统与牌义资料尚未接入。</p>
    </main>
  );
}

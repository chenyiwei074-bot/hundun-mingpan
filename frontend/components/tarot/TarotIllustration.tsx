import type { TarotCard } from '@/lib/tarot/deck';

const MAJOR_SIGILS = ['☼', '∞', '☾', '♀', '♔', '♧', '☉', '✦', '♌', '⚚', '◉', '⚖', '⟲', '☠', '⚗', '♄', 'ϟ', '✧', '☽', '☀', '♆', '✥'];
const MAJOR_SCENES = ['山径', '双柱', '帷幕', '丰穗', '王座', '圣坛', '双星', '战车', '狮与心', '孤灯', '命轮', '天秤', '悬枝', '白马', '双杯', '锁链', '高塔', '星泉', '双犬', '日轮', '号角', '花环'];
const SUIT_SIGILS: Record<string, string> = { 权杖: '♧', 圣杯: '♙', 宝剑: '⚔', 星币: '✧' };

function PipPattern({ count, mark }: { count: number; mark: string }) {
  const rows = Math.ceil(count / 2);
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / 2);
    const left = index % 2 === 0;
    const x = left ? 82 : 138;
    const y = 42 + row * (rows > 5 ? 34 : 41);
    return <text key={index} x={x} y={y} textAnchor="middle" className="tarot-art__pip">{mark}</text>;
  });
}

export function TarotIllustration({ card }: { card: TarotCard }) {
  const majorIndex = card.arcana === 'major' ? Number.parseInt(card.id.slice(-2), 10) : -1;
  const isCourt = ['P', 'N', 'Q', 'K'].includes(card.rank ?? '');
  const rankCount = Number(card.rank) || 1;
  const mark = SUIT_SIGILS[card.suit ?? ''] ?? '✧';
  const sigil = majorIndex >= 0 ? MAJOR_SIGILS[majorIndex] : mark;

  return (
    <svg className="tarot-art" viewBox="0 0 220 245" role="img" aria-label={`${card.nameZh}象征插画`}>
      <defs>
        <linearGradient id={`tarot-sky-${card.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#302347" />
          <stop offset="1" stopColor="#171622" />
        </linearGradient>
        <pattern id={`tarot-grain-${card.id}`} width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="2" r=".55" fill="#ead7a6" opacity=".16" />
          <circle cx="7" cy="6" r=".4" fill="#ead7a6" opacity=".1" />
        </pattern>
      </defs>
      <rect x="7" y="7" width="206" height="231" rx="5" fill={`url(#tarot-sky-${card.id})`} />
      <rect x="7" y="7" width="206" height="231" rx="5" fill={`url(#tarot-grain-${card.id})`} />
      <path d="M14 186 Q55 157 88 181 T151 178 T206 177 V231 H14Z" fill="#171925" stroke="#b99b5c" strokeOpacity=".72" />
      <path d="M17 200 Q54 187 90 199 T160 195 T203 198" fill="none" stroke="#dfc990" strokeOpacity=".42" />
      <circle cx="110" cy="89" r="43" fill="none" stroke="#d5bd7e" strokeOpacity=".48" />
      <circle cx="110" cy="89" r="34" fill="none" stroke="#d5bd7e" strokeOpacity=".24" strokeDasharray="1 4" />
      <path d="M110 25V34 M110 144V153 M46 89H55 M165 89H174 M65 44L72 51 M148 127L155 134 M155 44L148 51 M72 127L65 134" stroke="#e8d8af" strokeOpacity=".6" />
      {card.arcana === 'major' ? (
        <>
          <path d="M76 163 Q83 143 110 139 Q137 143 144 163" fill="#312b35" stroke="#d8c18a" strokeWidth="1.3" />
          <circle cx="110" cy="112" r="13" fill="#22202b" stroke="#e7d6a8" strokeWidth="1.4" />
          <path d="M100 163L91 180 M120 163L129 180 M110 139V167" stroke="#e7d6a8" strokeWidth="1.5" />
          <text x="110" y="104" textAnchor="middle" className="tarot-art__hero">{sigil}</text>
          <text x="110" y="220" textAnchor="middle" className="tarot-art__scene">{MAJOR_SCENES[majorIndex] ?? '秘仪'}</text>
          {majorIndex === 0 && <><path d="M157 174l13-23 12 23M161 164h18" fill="none" stroke="#d8c18a" strokeWidth="1.5"/><path d="M40 186l15-17 9 18" fill="none" stroke="#d8c18a" strokeWidth="1.2"/></>}
          {majorIndex === 1 && <><path d="M75 143h70l-8 8H82zM85 151v12M135 151v12M109 52q9-8 18 0t18 0" fill="none" stroke="#e8d8af" strokeWidth="1.8"/></>}
          {majorIndex === 2 && <><path d="M64 150V69h12v81M144 150V69h12v81M64 75h12M144 75h12M90 153q20 12 40 0" fill="none" stroke="#d8c18a" strokeWidth="2"/><path d="M110 42a12 12 0 1 0 12 17 10 10 0 1 1-12-17" fill="#e8d8af"/></>}
          {majorIndex === 3 && <><path d="M75 167q35-13 70 0M77 170l-9 17M143 170l9 17M69 188q41-11 82 0M86 176l-9 30M105 174l-4 34M125 175l8 30" fill="none" stroke="#d8c18a" strokeWidth="1.6"/><circle cx="110" cy="73" r="3" fill="#f2dc9e"/></>}
          {majorIndex === 4 && <><path d="M73 168V99h74v69M68 99l13-17 13 17M126 99l13-17 13 17M90 84l20-15 20 15" fill="none" stroke="#d8c18a" strokeWidth="2"/><path d="M82 175h56" stroke="#d8c18a" strokeWidth="2"/></>}
          {majorIndex === 5 && <><path d="M78 161v-34h64v34M78 132h64M110 133v-25M103 116l7 7 7-7M88 176l12-14M132 176l-12-14" fill="none" stroke="#e8d8af" strokeWidth="1.7"/><path d="M98 182l12-8 12 8-12 6z" fill="none" stroke="#d8c18a"/></>}
          {majorIndex === 6 && <><path d="M76 62q34-26 68 0M110 45v20M86 101q-12 12 0 23t24 0M134 101q12 12 0 23t-24 0M110 124v12" fill="none" stroke="#e8d8af" strokeWidth="1.8"/><circle cx="110" cy="49" r="5" fill="#e8d8af"/></>}
          {majorIndex === 7 && <><path d="M75 153h70l-10 12H85zM82 165v9M138 165v9M83 178h54M87 146l23-18 23 18" fill="none" stroke="#e8d8af" strokeWidth="1.7"/><path d="M65 175q12-9 20 0M135 175q12-9 20 0" fill="none" stroke="#d8c18a" strokeWidth="2"/></>}
          {majorIndex === 8 && <><path d="M72 143q20-28 39 0t38 0M80 154q28 10 58 0M110 64q15-16 30 0M102 57q9-14 18 0" fill="none" stroke="#e8d8af" strokeWidth="1.8"/><path d="M110 47c9-11 18-2 0 7-18-9-9-18 0-7z" fill="none" stroke="#e8d8af"/></>}
          {majorIndex === 9 && <><path d="M70 162l39-55 5 7-34 52M108 102l12-5 4 14-14 4zM142 154v-27a12 12 0 0 1 24 0v27M151 127h7" fill="none" stroke="#e8d8af" strokeWidth="1.8"/><circle cx="154" cy="127" r="18" fill="#e8d8af" opacity=".12"/></>}
          {majorIndex === 11 && <><path d="M75 151h70M110 100v61M84 101h52M93 102l-13 26h26zM127 102l-13 26h26zM90 168h40" fill="none" stroke="#e8d8af" strokeWidth="1.7"/><path d="M110 81v18" stroke="#e8d8af" strokeWidth="2"/></>}
          {majorIndex === 12 && <><path d="M76 70l67 4M91 74l-6 50M133 74l7 50M80 124h62M110 124l-4 24 15 13-15 8-12-9 12-12M106 148l-11 10M110 150l12 9" fill="none" stroke="#e8d8af" strokeWidth="1.8"/></>}
          {majorIndex === 13 && <><path d="M70 153q40-18 80 0l-8 14H78zM86 167l-5 15M134 167l8 15M95 151v-22h30v22M101 129l9-13 9 13M103 120v-9M117 120v-9" fill="none" stroke="#e8d8af" strokeWidth="1.7"/><path d="M102 143h16M110 130v13" stroke="#d8c18a"/></>}
          {majorIndex === 14 && <><path d="M85 83q-14 4-10 22t19 10q12-11-9-32zM134 83q14 4 10 22t-19 10q-12-11 9-32zM110 109v43M93 153h34" fill="none" stroke="#e8d8af" strokeWidth="1.8"/><path d="M86 84l24 34 24-34M109 121q-18 16-35 0M111 121q18 16 35 0" fill="none" stroke="#d8c18a"/></>}
          {majorIndex === 15 && <><path d="M81 89l9-25 20 13 20-13 9 25M92 110q18-20 36 0v23q-18 19-36 0zM110 133v22M110 155l-22 18M110 155l22 18M79 176h62" fill="none" stroke="#e8d8af" strokeWidth="1.8"/><path d="M82 164q-18 0-18 14t18 0M138 164q18 0 18 14t-18 0" fill="none" stroke="#d8c18a"/></>}
          {majorIndex === 18 && <><path d="M73 77q37-30 74 0M110 65q-24 22 0 44 24-22 0-44zM67 145l17-12 18 12M118 145l18-12 18 12M100 166l10-10 10 10" fill="none" stroke="#e8d8af" strokeWidth="1.7"/><circle cx="77" cy="143" r="4" fill="#e8d8af"/><circle cx="143" cy="143" r="4" fill="#e8d8af"/></>}
          {majorIndex === 19 && <><circle cx="110" cy="68" r="18" fill="none" stroke="#e8d8af" strokeWidth="2"/><path d="M110 38v-9M110 107v-9M80 68h-9M149 68h-9M89 47l-7-7M138 96l-7-7M131 47l7-7M82 96l7-7M102 170q8-17 16 0M110 151v28" stroke="#e8d8af" strokeWidth="1.7"/><circle cx="110" cy="151" r="6" fill="none" stroke="#e8d8af"/></>}
          {majorIndex === 20 && <><path d="M110 49v30M98 79q12-13 24 0M90 83h40M80 117q30-16 60 0M85 117v18M110 117v22M135 117v-18" fill="none" stroke="#e8d8af" strokeWidth="1.7"/><path d="M106 57h8M110 45v11" stroke="#d8c18a" strokeWidth="2"/><circle cx="85" cy="137" r="6" fill="none" stroke="#e8d8af"/><circle cx="110" cy="144" r="6" fill="none" stroke="#e8d8af"/><circle cx="135" cy="137" r="6" fill="none" stroke="#e8d8af"/></>}
          {majorIndex === 21 && <><ellipse cx="110" cy="110" rx="30" ry="49" fill="none" stroke="#e8d8af" strokeWidth="2"/><path d="M110 68v84M89 91l-15-14M131 91l15-14M89 129l-15 14M131 129l15 14" stroke="#d8c18a" strokeWidth="1.7"/><circle cx="110" cy="82" r="5" fill="none" stroke="#e8d8af"/></>}
          {majorIndex === 10 && <><circle cx="110" cy="89" r="51" fill="none" stroke="#e8d8af" strokeOpacity=".7"/><path d="M110 38v102M59 89h102M74 53l72 72M146 53l-72 72" stroke="#e8d8af" strokeOpacity=".54"/></>}
          {majorIndex === 16 && <><path d="M82 166V80h56v86M96 80V60h28v20M108 60l-9-16 14-12-3-15" fill="none" stroke="#e4c873" strokeWidth="2"/></>}
          {majorIndex === 17 && <><path d="M158 145q16 8 4 22t-18 4 M170 150l18-8M176 161l16 2M166 172l7 16" fill="none" stroke="#d8c18a" strokeWidth="1.5"/><circle cx="51" cy="65" r="2" fill="#f1e2b8"/><circle cx="169" cy="54" r="2" fill="#f1e2b8"/></>}
        </>
      ) : isCourt ? (
        <>
          <path d="M79 165l7-34 24-12 24 12 7 34-31 15z" fill="#292630" stroke="#e2d1a4" strokeWidth="1.5" />
          <circle cx="110" cy="99" r="16" fill="#201e28" stroke="#e2d1a4" strokeWidth="1.5" />
          <path d="M94 91l7-14 8 9 8-11 10 16" fill="none" stroke="#d9bc73" strokeWidth="2" />
          <path d="M110 126v42M90 142l-18 16M130 142l18 16" fill="none" stroke="#e2d1a4" strokeWidth="1.6" />
          <text x="110" y="66" textAnchor="middle" className="tarot-art__hero">{mark}</text>
          <text x="110" y="220" textAnchor="middle" className="tarot-art__scene">{card.rank === 'P' ? '信使' : card.rank === 'N' ? '行者' : card.rank === 'Q' ? '守望者' : '执掌者'}</text>
        </>
      ) : (
        <>
          <path d="M53 167 Q75 148 94 163 T134 162 T168 165" fill="none" stroke="#d8c18a" strokeOpacity=".65" />
          <PipPattern count={Math.min(rankCount, 10)} mark={mark} />
          <text x="110" y="220" textAnchor="middle" className="tarot-art__scene">{card.suit}</text>
        </>
      )}
      <path d="M22 18h17M22 18v17M198 18h-17M198 18v17M22 227h17M22 227v-17M198 227h-17M198 227v-17" fill="none" stroke="#dfc990" strokeOpacity=".65" />
      <text x="110" y="29" textAnchor="middle" className="tarot-art__stars">✦　·　✧　·　✦</text>
    </svg>
  );
}

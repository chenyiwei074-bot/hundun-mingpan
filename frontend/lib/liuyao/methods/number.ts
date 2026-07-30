import { getGua, getNaJia, getShiYing, getPalaceGong, getYearGanZhi, getMonthGanZhi, getDayGanZhi, getHourGanZhi, getXunKong, getLiuShen, WX, GUA_MAP, S64 } from '../core';
import type { LiuyaoResult, YaoRecord, CoinFace, QuestionType, NaJiaYao } from '@/types/liuyao';

export function buildNumberResult(params: {
  question: string;
  questionType: QuestionType;
  nums: number[];
  now?: Date;
}): LiuyaoResult {
  const now = params.now || new Date();
  const [n1,n2,n3] = params.nums;
  
  // 第一数取上卦, 第二数取下卦, 第三数取动爻
  const shangIdx = ((n1-1)%8+8)%8;
  const xiaIdx = ((n2-1)%8+8)%8;
  const dongIdx = ((n3-1)%6+6)%6;
  
  const trigrams = ['乾','兑','离','震','巽','坎','艮','坤'];
  const shang = trigrams[shangIdx];
  const xia = trigrams[xiaIdx];
  const benName = S64[shang+xia] || shang+xia;
  
  // Generate values: base on trigram bits, with one moving yao
  const shangBits = shangIdx.toString(2).padStart(3,'0');
  const xiaBits = xiaIdx.toString(2).padStart(3,'0');
  const allBits = (shangBits + xiaBits).split('').map(b=>b==='1');
  
  const vals: number[] = [];
  const recs: YaoRecord[] = [];
  for (let i=0; i<6; i++) {
    const isYang = allBits[5-i]; // 上爻=index 5, 初爻=index 0
    const isDong = (i === dongIdx);
    const v = isYang ? (isDong ? 9 : 7) : (isDong ? 6 : 8);
    vals.push(v);
    const hua = v===7?1:v===8?2:v===6?0:3;
    const fakes: CoinFace[]=[];
    for(let j=0;j<3;j++)fakes.push(j<hua?'花':'字' as CoinFace);
    recs.push({position:i+1,coins:fakes,value:v,label:v===7?'少阳':v===8?'少阴':v===6?'老阴':'老阳',isDong});
  }
  
  const gua = getGua(vals);
  const { gong } = getPalaceGong(benName);
  const shiYing = getShiYing(benName);
  const dayGZ = getDayGanZhi(now);
  const naJia = getNaJia(benName, shang, xia, vals);
  
  let bianNaJia: NaJiaYao[] = [];
  let bianInfo = { name:null as string|null, gong:null as string|null, wuxing:null as string|null };
  if (gua.bian) {
    const bv = recs.map(r => r.isDong ? (r.value===6?7:8) : r.value);
    const bsBits = bv.slice(3).map(v=>v===7||v===9?'1':'0').join('');
    const bxBits = bv.slice(0,3).map(v=>v===7||v===9?'1':'0').join('');
    const bs = GUA_MAP[bsBits]||'?', bx = GUA_MAP[bxBits]||'?';
    bianNaJia = getNaJia(gua.bian!, bs, bx, bv);
    const bianGong = getPalaceGong(gua.bian!);
    bianInfo = { name: gua.bian, gong: bianGong.gong, wuxing: WX[bianGong.gong] };
  }
  
  return {
    id: 'num_'+Date.now().toString(36),
    method: 'number',
    question: params.question,
    questionType: params.questionType,
    date: { year:now.getFullYear(), month:now.getMonth()+1, day:now.getDate(), hour:now.getHours(), minute:now.getMinutes() },
    ganZhi: {
      year: getYearGanZhi(now.getFullYear()),
      month: getMonthGanZhi(now.getFullYear(), now.getMonth()+1),
      day: dayGZ.gan+dayGZ.zhi,
      hour: getHourGanZhi(dayGZ.ganIdx, now.getHours()),
    },
    dayGZ,
    monthZhi: getMonthGanZhi(now.getFullYear(), now.getMonth()+1).slice(-1),
    xunKong: getXunKong(dayGZ.ganIdx, dayGZ.zhiIdx),
    benGua: { name: benName, gong, wuxing: WX[gong], shangGua: shang, xiaGua: xia },
    bianGua: bianInfo,
    yaoRecords: recs,
    naJia,
    bianNaJia,
    dongYao: gua.dong,
    shiYing,
    liuShen: getLiuShen(dayGZ.ganIdx),
  };
}

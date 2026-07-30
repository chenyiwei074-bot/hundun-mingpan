import { WX, NA_GAN, NA_ZHI, PALACE, SHI_POS } from './constants';
import type { NaJiaYao } from '@/types/liuyao';

export function getPalaceGong(guaName: string): { gong: string; idx: number } {
  for (const [g,gs] of Object.entries(PALACE)) {
    const idx = gs.indexOf(guaName);
    if (idx >= 0) return { gong: g, idx };
  }
  return { gong: '乾', idx: 0 };
}

export function getShiYing(guaName: string): { shi: number; ying: number } {
  const { idx } = getPalaceGong(guaName);
  const shi = SHI_POS[idx];
  const ying = shi < 3 ? shi + 3 : shi - 3;
  return { shi, ying };
}

export function getNaJia(guaName: string, shangGua: string, xiaGua: string, values: number[]): NaJiaYao[] {
  const { gong } = getPalaceGong(guaName);
  const gongWx = WX[gong];
  const naGan = { shang: NA_GAN[shangGua][1], xia: NA_GAN[xiaGua][0] };
  const naZhi = { shang: NA_ZHI[shangGua], xia: NA_ZHI[xiaGua] };
  const { shi } = getShiYing(guaName);
  const result: NaJiaYao[] = [];
  for (let i = 0; i < 6; i++) {
    const gan = i < 3 ? naGan.xia : naGan.shang;
    const zi = i < 3 ? naZhi.xia[i] : naZhi.shang[i-3];
    const ganZhi = gan + zi;
    const yaoWx = WX[zi];
    let liuQin = '';
    const o = ['木','火','土','金','水'];
    const gi = o.indexOf(gongWx), yi = o.indexOf(yaoWx);
    const diff = (yi - gi + 5) % 5;
    if (diff === 0) liuQin = '兄弟';
    else if (diff === 1) liuQin = '子孙';
    else if (diff === 2) liuQin = '妻财';
    else if (diff === 3) liuQin = '官鬼';
    else liuQin = '父母';
    const shiYing = i === shi ? '世' : (i === (shi < 3 ? shi + 3 : shi - 3) ? '应' : '');
    result.push({
      position: i + 1, value: values[i],
      label: values[i] === 7 ? '少阳' : values[i] === 8 ? '少阴' : values[i] === 9 ? '老阳' : '老阴',
      isDong: values[i] === 6 || values[i] === 9,
      naGan: gan, naZhi: zi, ganZhi,
      liuQin, shiYing, xunKong: false,
    });
  }
  return result;
}

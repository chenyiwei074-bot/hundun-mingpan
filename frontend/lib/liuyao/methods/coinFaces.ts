// 掷钱口径单独一层：bit → 三枚面值 → 爻值。这一层不 import 排盘内核。
//
// 为什么要拆出来：回执验真必须用**同一份**口径把 seed 重放到盘上爻值，如果它去 import
// methods/coin.ts，就会把整个内核拖进 /verify 的包（那一页只做哈希，跟目录页同一个道理）。
// 而重放与生产用两份实现，正是这个仓库反复踩过的坑 —— 所以拆文件，不复制函数。

import { bitsFromSeedHex } from '@/lib/crypto/random';
import type { CoinFace } from '@/types/liuyao';

/** 一整卦要几个 bit：六轮 × 每轮三枚。派生与承诺两处都用这一个数，写两遍就会各自漂移。 */
export const COIN_COMMIT_BITS = 6 * 3;

/** 18 个 bit → 六轮 × 三枚（1 = 花，0 = 字）。位序即时间序：第 r 轮用第 3(r-1)..3r-1 个 bit。 */
export function coinRoundsFromBits(bits: number[]): CoinFace[][] {
  if (bits.length < COIN_COMMIT_BITS) throw new Error(`六轮掷钱要 ${COIN_COMMIT_BITS} 个 bit，只给了 ${bits.length} 个`);
  const rounds: CoinFace[][] = [];
  for (let r = 0; r < 6; r++) {
    rounds.push(bits.slice(r * 3, r * 3 + 3).map(b => (b ? '花' : '字') as CoinFace));
  }
  return rounds;
}

/** seed → 整卦六轮的面值。摇卦唯一的取数路径：先承诺 seedHash，再按这份顺序揭晓，
 *  于是「盘上这六个爻值」与「seed」之间是可重放的，不是各说各话。 */
export function tossesFromSeed(seedHex: string): CoinFace[][] {
  return coinRoundsFromBits(bitsFromSeedHex(seedHex, COIN_COMMIT_BITS));
}

/** 花数 → 爻值（0 花老阴动、1 少阳、2 少阴、3 花老阳动）。站里只此一份。 */
export function calcYao(coins: CoinFace[]): { value: number; label: string; isDong: boolean } {
  const hua = coins.filter(c => c === '花').length;
  if (hua === 0) return { value: 6, label: '老阴', isDong: true };
  if (hua === 1) return { value: 7, label: '少阳', isDong: false };
  if (hua === 2) return { value: 8, label: '少阴', isDong: false };
  return { value: 9, label: '老阳', isDong: true };
}

// 站里唯一的随机源。掷钱要的是无偏 1 bit，身份标识要的是不可猜的 token ——
// 这两件事以前各自用 Math.random（既弱又是两份实现），现在都走 crypto.getRandomValues。
// 摇卦的 bit 不再从这里逐轮现取，而是从一次性铸出的 seed 里派生（commit-reveal）：
// 随机源仍然是这一层，只是"取哪 18 个 bit"变成可以先承诺、后揭晓的形式。
//
// Math.random 不是密码学安全的：输出可由少量连续观测反推（V8 的 xorshift128+ 状态只有
// 128 bit，且一次赋值就能预测后续全部结果）。摇卦的爻值与游客身份都经不起这种预测。

/** 一字节一 bit：一次公平硬币就是一个字节，不取模、不折叠，所以没有偏差。
 *  掷钱与 seed 派生共用这一处口径 —— 两处各写一遍 & 1 就会各自漂移。 */
export const bitFromByte = (b: number): number => b & 1;

/** seed 固定 32 字节（256 bit）。整卦只铸一次，先公布哈希再掷钱。 */
export const SEED_BYTES = 32;

/** 32 字节 CSPRNG → 64 位十六进制。用 hex 不用 base36：验真方要能用 shasum 直接复算。 */
export function newSeedHex(): string {
  const b = new Uint8Array(SEED_BYTES);
  crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

/** hex → 字节。只收小写：seedHash 是对这串字符取摘要，大小写一改摘要就换，
 *  与其容错地接受两种写法，不如规定一种。 */
export function seedHexToBytes(seedHex: string): Uint8Array {
  if (!/^([0-9a-f]{2})*$/.test(seedHex)) throw new Error('seed 不是合法的小写十六进制串（长度须为偶数、字符 0-9a-f）');
  const out = new Uint8Array(seedHex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(seedHex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** seed → 前 count 个 bit。seed 本身 256 bit 均匀随机，前 18 bit 与其余部分统计独立，
 *  所以直取即可，不必上 HKDF/DRBG —— 少一层依赖，也多一分能用手算复核的确定性。
 *  长度必须是 SEED_BYTES：派生口径是按 32 字节定的，收 33 字节的"seed"等于私下改口径。 */
export function bitsFromSeedHex(seedHex: string, count: number): number[] {
  const bytes = seedHexToBytes(seedHex);
  if (bytes.length !== SEED_BYTES) throw new Error(`seed 必须是 ${SEED_BYTES} 字节（${SEED_BYTES * 2} 个十六进制字符），实得 ${bytes.length} 字节`);
  if (bytes.length < count) throw new Error(`seed 只有 ${bytes.length} 字节，取不出 ${count} 个 bit`);
  return Array.from(bytes.slice(0, count), bitFromByte);
}

const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';

/** base36 token。256 % 36 有偏，所以丢掉 ≥252 的字节（拒绝采样），不做带偏的取模。 */
export function randomToken(len: number): string {
  const out: string[] = [];
  while (out.length < len) {
    const buf = new Uint8Array((len - out.length) * 4 + 16);
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b >= 252) continue;
      out.push(B36[b % 36]);
      if (out.length === len) break;
    }
  }
  return out.join('');
}

/** [0,1) 均匀浮点：CSPRNG 取 4 字节 / 2^32。只用于视觉抖动等非安全用途，但同样不走 Math.random ——
 *  站内规则是活文件零 Math.random（tools/random-acceptance 扫全仓），视觉代码也不例外。 */
export function randomFloat(): number {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return b[0] / 4294967296;
}

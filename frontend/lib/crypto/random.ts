// 站里唯一的随机源。掷钱要的是无偏 1 bit，身份标识要的是不可猜的 token ——
// 这两件事以前各自用 Math.random（既弱又是两份实现），现在都走 crypto.getRandomValues。
//
// Math.random 不是密码学安全的：输出可由少量连续观测反推（V8 的 xorshift128+ 状态只有
// 128 bit，且一次赋值就能预测后续全部结果）。摇卦的爻值与游客身份都经不起这种预测。

/** 每次取一字节再 & 1：一 bit 就是一次公平硬币，没有取模偏差。 */
export function randomBits(count: number): number[] {
  const out: number[] = [];
  while (out.length < count) {
    const buf = new Uint8Array(count - out.length);
    crypto.getRandomValues(buf);
    for (const b of buf) out.push(b & 1);
  }
  return out.slice(0, count);
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

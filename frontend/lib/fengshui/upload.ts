// 户型图上传的客户端校验。
//
// 为什么单独成文件而不是写在组件里：这两个函数是纯的、要能在 node 里直接跑验收。
// 写在组件里，套件就只能把源码抠出来 eval —— 而抠出来的 TypeScript 带着类型标注，
// 普通 JS 解析不了，这条路一开始就是错的。

export const ACCEPT_MIME = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_BYTES = 5 * 1024 * 1024;
export type ImageKind = 'jpg' | 'png' | 'webp';

export type Validation = { ok: true; kind: ImageKind } | { ok: false; error: string };

/** 只看文件头几个字节。MIME 与扩展名都是客户端自报的，伪造它不需要任何技术。 */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  const h = Array.from(bytes.subarray(0, 12));
  if (h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff) return 'jpg';
  if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47) return 'png';
  if (h.slice(0, 4).join() === '82,73,70,70' && h.slice(8, 12).join() === '87,69,66,80') return 'webp';
  return null;
}

/** 第一道闸：只看声明与体积。真正的类型判定在 sniffImage，所以这里不返回 kind。 */
export function checkFloorplanFile(file: { name: string; type: string; size: number }): { ok: true } | { ok: false; error: string } {
  if (file.size > MAX_BYTES) return { ok: false, error: `文件 ${(file.size / 1048576).toFixed(1)}MB，上限 5MB` };
  if (!ACCEPT_MIME.includes(file.type)) return { ok: false, error: `浏览器声明的类型是 ${file.type || '未知'}，只收 jpg / png / webp` };
  return { ok: true };
}

/** 第二道闸：读头 12 个字节定类型。两道都过才允许进入"送给模型"这一步。 */
export async function validateFloorplanFile(file: File): Promise<Validation> {
  const shape = checkFloorplanFile(file);
  if (!shape.ok) return shape;
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const kind = sniffImage(head);
  return kind ? { ok: true, kind }
    : { ok: false, error: '文件头不是 jpg / png / webp（扩展名和 MIME 都不算证据，只有字节算）。' };
}

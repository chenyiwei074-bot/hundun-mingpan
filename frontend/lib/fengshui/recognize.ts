// 户型图识别（POST /api/fengshui/recognize）的客户端适配层。
//
// 为什么单独成文件：这层是纯函数，要能在 node 里被 tools/fengshui-acceptance 直接跑。
// 写在组件里就只能抠源码 eval —— 抠出来的 TypeScript 带类型标注，普通 JS 解析不了。
//
// 契约以 server/src/services/vision.service.ts 的 RecognizedPlan 与 zod schema 为准
// （那两份在仓库里，这一层照着对；改契约必须同时改这里，否则套件会红）。
// 四条边界，前三条是裁定定的：
//  1. 一次请求完成校验 + 落盘 + 识别，没有独立上传端点；imageId 只用于以后取图（7 天、仅本人）。
//  2. 5xx 一律按「识别失败」降级，**不自动重试** —— 上游是模型 + 落盘，重试风暴等于
//     把一次失败的开销乘上几遍，还会让用户看到页面反复转圈。
//  3. 认不全的响应体一律整条失败，不画"半张图"。缺一面墙就多一个假房间，
//     而判定层分不清"这真是你家没有的那面墙"和"模型没认出来"。
//  4. 归一化坐标只给了相对图片的位置，没给幅面：长边按 RECOGNIZE_SPAN_M 换算，
//     并按图片宽高比拆开 x/y 两个尺度。等比把 x、y 乘同一个数，会把 2:1 的厅画成正的，
//     而宫位归属与动线读的都是米 —— 画错比例等于算错判定。

import type { FloorGeometry, Opening, Pt, RoomShape, Wall } from './geometry';
import { MAX_BYTES, type ImageKind } from './upload';
import type { RoomKind } from './types';

export const RECOGNIZE_URL = '/api/fengshui/recognize';
/** 模型常省略 confidence，服务端 zod 按 0.5 补（`.optional().default(0.5)`）——
 *  所以 0.5 这一档分不清"模型真判了 0.5"还是"没给"，UI 不许把它当精确值展示。 */
export const DEFAULT_CONFIDENCE = 0.5;
/** 归一化坐标没有幅面信息，长边按这个米数换算，与三套合成样例同一量级（约 9 米见方）。
 *  这不是测量值，是画布约定：UI 必须把它说出来，并且用户能在 2D 里拖点改。 */
export const RECOGNIZE_SPAN_M = 9;
/** 服务端 VISITOR_RE 的同一条规则。在本地先判一次，是为了把"没有本机访客 id"
 *  说成人话，而不是让用户看一个 400 bad_visitor。 */
const VISITOR_RE = /^[A-Za-z0-9_-]{8,64}$/;

export type RecognizeFail = {
  ok: false;
  /** network = 请求根本没发出去；upstream = 5xx；client = 4xx；shape = 响应体认不全。 */
  kind: 'network' | 'upstream' | 'client' | 'shape';
  status?: number;
  /** 服务端返回的结构化 code（bad_visitor / too_large / not_floorplan / timeout / …）。
   *  没有它就只能说"失败了"，有了它才能说"是哪一种失败"。 */
  code?: string;
  reason: string;
};
export type RecognizeResult = {
  ok: true;
  geom: FloorGeometry;
  门数: number;
  窗数: number;
  /** 认出来了但挂不到任何墙上的开口数 —— 不丢，报出来，让用户补。 */
  未挂上数: number;
  /** 名字落在关键词表之外（含模型自己写的"房间N"占位名）的房间数：用途暂记为储物，
   *  但这一类不参与"厨卫相邻""私密区"那几条判据的可靠性 —— UI 要报出来让用户改。 */
  未命名房间数: number;
  /** 归一化→米的换算基准（长边），UI 要原样说出来。 */
  跨度米: number;
  /** 服务端带回来的图 id：7 天后自动删，只用于本人取回，本站页面目前不取。 */
  imageId: string | null;
};

// ---------------------------------------------------------------- 请求侧

/** 自己写 base64，不用 btoa/Buffer：btoa 在 SSR 下不存在，Buffer 会让 Next 往浏览器里塞 polyfill。
 *  而且这个函数要能在 node 里逐字节对着标准库验。 */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function toBase64(bytes: Uint8Array): string {
  let out = '';
  // 每 0x18000 字节（=196608，3 的倍数）一组：一次 String 拼接到底，
  // 又不至于让单次循环产出的字符串超过引擎的实现上限。
  for (let i = 0; i < bytes.length; i += 0x18000) {
    const chunk = bytes.subarray(i, i + 0x18000);
    let s = '';
    for (let j = 0; j < chunk.length; j += 3) {
      const b0 = chunk[j], b1 = chunk[j + 1], b2 = chunk[j + 2];
      s += B64[b0 >> 2];
      s += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
      s += b1 === undefined ? '' : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
      s += b2 === undefined ? '' : B64[b2 & 63];
    }
    out += s;
  }
  const pad = bytes.length % 3 === 0 ? '' : '='.repeat(3 - (bytes.length % 3));
  return out + pad;
}

const MIME_OF: Record<ImageKind, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** dataURL 而不是裸 base64：服务端两条都收，带 mime 前缀省得它在解码之后再去猜类型。 */
export function bytesToDataUrl(bytes: Uint8Array, kind: ImageKind): string {
  return `data:${MIME_OF[kind]};base64,${toBase64(bytes)}`;
}

/** 成功分支也带判别字段：没有 `ok: true` 的话这就不是一个可判别联合，
 *  调用方写 `if (!req.ok)` 会在类型层直接塌掉（TS 不认"这个属性不存在的那个成员"）。 */
export function buildRecognizeRequest(
  visitorId: string, bytes: Uint8Array, kind: ImageKind,
): { ok: true; url: string; init: RequestInit } | RecognizeFail {
  if (!visitorId) return { ok: false, kind: 'client', code: 'no_visitor', reason: '这台设备还没有访客 id，服务端会按访客不合法拒掉。' };
  if (!VISITOR_RE.test(visitorId)) {
    return { ok: false, kind: 'client', code: 'bad_visitor', reason: `本机访客 id 形态不对（要 8–64 位字母、数字、下划线或短横），这条请求发出去也只会是 400。` };
  }
  if (bytes.length > MAX_BYTES) {
    return { ok: false, kind: 'client', code: 'too_large', reason: `解码后 ${(bytes.length / 1048576).toFixed(1)}MB，服务端上限 5MB。` };
  }
  const body = JSON.stringify({ visitorId, imageBase64: bytesToDataUrl(bytes, kind) });
  return {
    ok: true,
    url: RECOGNIZE_URL,
    init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
  };
}

/** 状态码分类。5xx 与网络失败都归"可再试一次，但要用户按"，绝不自己循环。 */
export function classifyStatus(status: number): 'ok' | 'client' | 'upstream' {
  if (status >= 200 && status < 300) return 'ok';
  if (status >= 500) return 'upstream';
  return 'client';
}

/** 服务端每条失败都带 code + 中文 message。这里只补两件服务端没说的事：
 *  5xx 要说"可以再按一次但不会自动重试"，422/503 要说"这张图它没认出来"。 */
const CODE_HINT: Record<string, string> = {
  bad_visitor: '这台设备的访客标识服务端不认（正常不该走到这里，适配层已经先判过一次）。',
  bad_image: '图片没读进去。换一张重新选一次。',
  too_large: '服务端按解码后的字节数拒了（上限 5MB）。',
  bad_type: '文件头不是 jpg / png / webp —— 服务端也按头判，不信扩展名。',
  not_floorplan: '模型认为这不是一张户型图，没有编造几何。',
  timeout: '视觉模型超时（服务端已把后备供应商的时间也花完了）。',
  provider_error: '所有视觉供应商都没成。',
  bad_json: '模型回了不是几何 JSON 的东西。',
  no_provider: '服务端还没配置视觉模型。',
  internal: '识别服务内部错误。',
};
export function failReason(status: number, body: unknown): string {
  const code = isObj(body) && typeof body.code === 'string' ? body.code : undefined;
  const serverMsg = isObj(body) && typeof body.message === 'string' ? body.message : '';
  const hint = code ? CODE_HINT[code] || '' : '';
  const head = `${classifyStatus(status) === 'upstream' ? '识别服务不可用' : '识别被拒'}（HTTP ${status}${code ? ' · ' + code : ''}）`;
  const parts = [`${head}：${serverMsg || hint || '服务端没给出原因'}`];
  if (classifyStatus(status) === 'upstream') parts.push('可以再按一次，但这一页不会自动重试。');
  return parts.join(' ');
}

// ---------------------------------------------------------------- 响应侧

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const firstOf = (o: Raw, keys: string[]): unknown => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};

/** 一个点：契约里是 `[x, y]` 元组，但 `{x,y}` 也照收（模型侧两种都常见）。
 *  越界不夹逼 —— 交回上层整条判失败。 */
function readPoint(v: unknown): { p: Pt; bad: false } | { p: null; bad: true } {
  if (Array.isArray(v) && v.length >= 2 && typeof v[0] === 'number' && typeof v[1] === 'number'
    && Number.isFinite(v[0]) && Number.isFinite(v[1])) {
    return inRange(v[0], v[1]) ? { p: { x: v[0], y: v[1] }, bad: false } : { p: null, bad: true };
  }
  if (isObj(v)) {
    const x = v.x, y = v.y;
    if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) {
      return inRange(x, y) ? { p: { x, y }, bad: false } : { p: null, bad: true };
    }
  }
  return { p: null, bad: true };
}
/** 契约：0..1 归一化。±ε 之内算作边界，超过就是响应体不符合契约。 */
const inRange = (x: number, y: number) => x >= -1e-6 && x <= 1 + 1e-6 && y >= -1e-6 && y <= 1 + 1e-6;

/** 一条折线 / 一个多边形：直接是点数组，或对象里带 polygon|points|ring|外环|折线。
 *  这里不递归 —— 元组 `[x,y]` 既是一个点，递归下去会把点当折线读。 */
function readRing(v: unknown): Pt[] | null {
  const raw = Array.isArray(v) ? v : isObj(v) ? arr(firstOf(v as Raw, ['polygon', 'points', 'ring', '外环', '折线'])) : null;
  if (!raw) return null;
  const out: Pt[] = [];
  for (const item of raw) {
    const p = readPoint(item);
    if (p.bad || !p.p) return null;
    out.push(p.p);
  }
  return out;
}

/** 用途关键词表。表里没有的一律落到 储物 并在名称里保留原词 —— UI 会把"没认出来"说出来，
 *  而不是悄悄挑一个会影响判定的类别。
 *  刻意不收 'room' 这种通用词：模型看不清名字时按提示词会写 "Room1"/"房间1"，
 *  把它认成卧室等于给一个未知房间挂上私密区判据。 */
const KIND_KEYWORDS: Array<[RoomKind, string[]]> = [
  ['卧室', ['卧', 'bed']],
  ['客厅', ['客厅', 'living', '大厅', '起居室']],
  ['厨房', ['厨', 'kitchen']],
  ['卫生间', ['卫', '浴', '厕', 'bath', 'toilet', 'wc']],
  ['书房', ['书', 'study', '办公']],
  ['餐厅', ['餐', 'dining']],
  ['阳台', ['阳台', 'balcony', '露台']],
  ['玄关', ['玄关', '门厅', 'entry', 'foyer']],
  ['储物', ['储', '藏', 'storage', '杂物']],
];
/** 模型自己承认"看不清名字"时用的占位名（提示词里写死了 `房间1`）。 */
const PLACEHOLDER_NAME = /^(房间|room)\s*\d*$/i;
export function roomKindOf(名称: string): { 用途: RoomKind; 认出了: boolean } {
  const n = (名称 || '').trim();
  if (!n || PLACEHOLDER_NAME.test(n)) return { 用途: '储物', 认出了: false };
  const lower = n.toLowerCase();
  for (const [kind, keys] of KIND_KEYWORDS) if (keys.some(k => lower.includes(k.toLowerCase()))) return { 用途: kind, 认出了: true };
  return { 用途: '储物', 认出了: false };
}

/** 把"中心点 + 宽"挂到最近的墙段上，算出 (墙, 段, 位)。这就是契约里让我做的那步投影。 */
function projectToWalls(center: Pt, widthM: number, walls: Wall[]): { 墙: string; 段: number; 位: number } | null {
  let best: { 墙: string; 段: number; 位: number; d: number } | null = null;
  for (const w of walls) {
    const line = w.折线;
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i], b = line[i + 1];
      const vx = b.x - a.x, vy = b.y - a.y;
      const len2 = vx * vx + vy * vy;
      if (len2 <= 0) continue;
      let t = ((center.x - a.x) * vx + (center.y - a.y) * vy) / len2;
      t = Math.min(1, Math.max(0, t));
      const px = a.x + vx * t, py = a.y + vy * t;
      const d = Math.hypot(center.x - px, center.y - py);
      if (!best || d < best.d) best = { 墙: w.id, 段: i, 位: Math.round(t * 1000) / 1000, d };
    }
    // 闭合墙的末段→首段那一跨也要算，否则外框的四角附近会被投影到别的墙上。
    if (w.闭合 && line.length > 2) {
      const a = line[line.length - 1], b = line[0];
      const vx = b.x - a.x, vy = b.y - a.y, len2 = vx * vx + vy * vy;
      if (len2 > 0) {
        let t = ((center.x - a.x) * vx + (center.y - a.y) * vy) / len2;
        t = Math.min(1, Math.max(0, t));
        const d = Math.hypot(center.x - (a.x + vx * t), center.y - (a.y + vy * t));
        if (!best || d < best.d) best = { 墙: w.id, 段: line.length - 1, 位: Math.round(t * 1000) / 1000, d };
      }
    }
  }
  if (!best) return null;
  // 离最近墙超过这个距离，说明这个中心点根本不在墙上（模型给的是房间中心而不是洞口中心）。
  // 与其把它按到一面不相干的墙上，不如报"没挂上"让用户补。
  if (best.d > widthM) return null;
  return { 墙: best.墙, 段: best.段, 位: best.位 };
}

function readConfidence(v: unknown): number | null {
  if (typeof v !== 'number' || Number.isNaN(v)) return null;
  return Math.min(1, Math.max(0, v));
}

/** 置信度怎么上屏。0.5 既可能是模型的真的判断、也可能是它省略了这个字段时的缺省值 ——
 *  两者不可区分，所以 0.5 这一档只说"没给数值"，不给百分比。
 *  措辞里不留空格：这几行字要被 harness 逐字钉，中英混排时多一个空格就是假红。 */
export function confidenceText(c: number | null): { 文本: string; 是缺省: boolean } {
  if (c === null) return { 文本: '模型把握：未给出', 是缺省: true };
  if (c === DEFAULT_CONFIDENCE) return { 文本: '模型把握：未给出（0.5 是占位值，不是精确读数）', 是缺省: true };
  return { 文本: `模型把握：${c > 0.75 ? '偏高' : c > 0.5 ? '居中' : '偏低'}`, 是缺省: false };
}

/** 归一化响应体 → 本站几何。字段名以服务端 RecognizedPlan 为准，别名（模型侧 camel /
 *  本站中文）也照收，但结构认不全就整条失败 —— 见文件头第 3 条。 */
export function parseRecognize(json: unknown, opt: { spanM?: number; aspect?: number } = {}): RecognizeResult | RecognizeFail {
  if (!isObj(json)) return { ok: false, kind: 'shape', reason: '响应体不是 JSON 对象。' };
  const wrapped = isObj(json.plan) ? json.plan : isObj(json.候选) ? json.候选 : isObj(json.data) ? json.data : isObj(json.result) ? json.result : json;
  const body = wrapped as Raw;

  // 长边 = spanM，另一边按图片宽高比缩。aspect 传 0 或不传时按正方处理（保持旧行为）。
  const spanM = opt.spanM ?? RECOGNIZE_SPAN_M;
  const aspect = opt.aspect && Number.isFinite(opt.aspect) && opt.aspect > 0 ? opt.aspect : 1;
  const xSpan = spanM * (aspect >= 1 ? 1 : aspect);
  const ySpan = spanM * (aspect >= 1 ? 1 / aspect : 1);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const toM = (p: Pt): Pt => ({ x: r2(p.x * xSpan), y: r2(p.y * ySpan) });

  // 墙
  const rawWalls = arr(firstOf(body, ['walls', '墙体']));
  const walls: Wall[] = [];
  for (let i = 0; i < rawWalls.length; i++) {
    const ring = readRing(rawWalls[i]);
    if (!ring || ring.length < 2) {
      return { ok: false, kind: 'shape', reason: `第 ${i + 1} 道墙读不出至少两个点，整条识别按失败处理。` };
    }
    const named = isObj(rawWalls[i]) ? (firstOf(rawWalls[i] as Raw, ['id', '编号']) as string | undefined) : undefined;
    walls.push({ id: String(named ?? `墙${i + 1}`), 折线: ring.map(toM), 闭合: closedRing(ring) });
  }

  // 房间
  const rawRooms = arr(firstOf(body, ['rooms', '房间']));
  const rooms: RoomShape[] = [];
  let 未命名房间数 = 0;
  for (let i = 0; i < rawRooms.length; i++) {
    const item = rawRooms[i];
    const ring = readRing(item);
    if (!ring || ring.length < 3) {
      return { ok: false, kind: 'shape', reason: `第 ${i + 1} 个房间读不出至少三个点，整条识别按失败处理。` };
    }
    const 名称 = String((isObj(item) ? firstOf(item as Raw, ['name', '名称', 'label']) : undefined) ?? `房间${i + 1}`);
    const 用途 = roomKindOf(名称);
    if (!用途.认出了) 未命名房间数++;
    rooms.push({ id: String((isObj(item) ? firstOf(item as Raw, ['id']) : undefined) ?? `r${i + 1}`), 名称, 用途: 用途.用途, 外环: ring.map(toM) });
  }

  if (!walls.length && !rooms.length) {
    return { ok: false, kind: 'shape', reason: '响应里既没有墙也没有房间 —— 这张图什么都没认出来，不算成功。' };
  }

  // 门窗：契约只给"中心点 + 宽"（没有沿墙比例 t），投影到最近墙段这一步归本站做。
  // 点可能就写在对象上（{x,y,width}），也可能包在 center 里，两种都要读得出。
  //
  // 两种"这条门窗不能用"必须分开：中心点不在 0..1 里 = 响应体违反契约，整条判失败
  // （单位错了的话每一条都是错的，报 0 个门窗会把"模型给了像素坐标"说成"这房子没门窗"）；
  // 点在范围内但落不到任何墙上 = 一个真实候选挂了，丢掉并计数，让用户补。
  const openings: Opening[] = [];
  let 未挂上数 = 0;
  let 序号 = 0;
  for (const [类型, key] of [['门', 'doors'], ['窗', 'windows']] as const) {
    const raw = arr(firstOf(body, [key, 类型]));
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      const centerRaw = isObj(item) ? (firstOf(item as Raw, ['center', '中心']) ?? item) : item;
      const 中心 = readPoint(centerRaw);
      if (中心.bad || !中心.p) {
        return { ok: false, kind: 'shape', reason: `第 ${i + 1} 个${类型}的中心点不在 0..1 归一化范围内，整条识别按失败处理：单位不对时每一条都不对，不能报成"这张图没有${类型}"。` };
      }
      const wNorm = isObj(item) ? firstOf(item as Raw, ['width', '宽']) : undefined;
      // 宽度按契约是"相对图片宽度"的归一化值，所以只能乘 x 方向那个尺度。
      const 宽 = typeof wNorm === 'number' && wNorm > 0 ? r2(wNorm * xSpan) : (类型 === '门' ? 0.9 : 1.4);
      const p = projectToWalls(toM(中心.p), 宽, walls);
      if (!p) { 未挂上数++; continue; }
      序号++;
      openings.push({
        id: `o${序号}`, 类型, 墙: p.墙, 段: p.段, 位: p.位, 宽,
        // null 在这个类型里的意思是"手工标注"（见 geometry.ts 的 置信度 注释）。
        // 适配层造出来的每一条都是候选，所以缺 confidence 时要落成 0.5 占位而不是 null，
        // 否则一条模型猜的门窗会在 UI 上自称手工标注。服务端 zod 也是这么补的。
        置信度: readConfidence(isObj(item) ? firstOf(item as Raw, ['confidence', '置信度']) : undefined) ?? DEFAULT_CONFIDENCE,
        已确认: false,
      });
    }
  }

  return {
    ok: true,
    geom: { 墙体: walls, 房间: rooms, 开口: openings },
    门数: openings.filter(o => o.类型 === '门').length,
    窗数: openings.filter(o => o.类型 === '窗').length,
    未挂上数,
    未命名房间数,
    跨度米: spanM,
    imageId: typeof json.imageId === 'string' ? json.imageId : null,
  };
}

/** 首尾点重合，或点数构成闭合形状 —— 两种都给闭合标记，读不出来的交给上层。 */
function closedRing(ring: Pt[]): boolean {
  if (ring.length < 3) return false;
  const a = ring[0], b = ring[ring.length - 1];
  return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
}

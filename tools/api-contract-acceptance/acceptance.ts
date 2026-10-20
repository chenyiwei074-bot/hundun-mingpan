// 前端 ↔ 后端取值契约验收（D6：前端不许发后端不接受的取值）。
//
// 这一层为什么值得单独一套：这类错**不报错**。四柱直批那一条提交时，后端 zod 拒收，
// 前端落进 else 分支换了个 local_ 的 id 继续跳转 —— 页面正常、盘也排出来了，
// 只有"这条没存进服务器、刷新就没了"这件事没人说。用户看到的是一个成功的结果。
//
// 三条纪律：
//  1. 枚举与 regex 的**真值住在后端**（server/src/utils/types.ts）。前端那份是副本，
//     所以这里逐字比对两边；后端改了而这条没红 = 同步漏了。
//  2. 扫服务端源码之前必须先剥注释。这条已经踩过三次：注释里的字会咬自己的断言。
//  3. 判"没有违规"之前先证明违规**曾经可能** —— 所以留了 gate/unsupported-value-was-reachable
//     这一条：界面的第三个 tab 真的能选出 '四柱'，否则上面那些闸门是空转。
//
// 用法（与其余验收同一条命令形状）：
//   cd <repo root> && NODE_PATH="$PWD/frontend/node_modules" \
//     node server/node_modules/tsx/dist/cli.mjs --tsconfig=frontend/tsconfig.json \
//     tools/api-contract-acceptance/acceptance.ts --out=.contract.txt
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describeQuota, fetchQuota } from '../../frontend/lib/api/quota';
import {
  SERVER_BIRTHDAY_RE, SERVER_CALENDAR, SERVER_GENDER, canPersist, validateCreateChart,
} from '../../frontend/lib/api/contract';
import type { CreateChartPayload } from '../../frontend/lib/api/contract';

const arg = (name: string) => {
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
};
const OUT = arg('out') || '.contract.txt';
const ROOT = join(__dirname, '../..');
const lines: string[] = [];
let pass = 0; let fail = 0;
const say = (s: string) => lines.push(s);
const ok = (id: string, cond: boolean, detail: string) => {
  if (cond) pass++; else fail++;
  say(`${cond ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
};

/** 注释里的字不算证据：先看代码，再看注释。 */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const serverSrc = strip(readFileSync(join(ROOT, 'server', 'src', 'utils', 'types.ts'), 'utf8'));
const pageSrc = strip(readFileSync(join(ROOT, 'frontend', 'app', 'create', 'page.tsx'), 'utf8'));
const apiSrc = strip(readFileSync(join(ROOT, 'frontend', 'app', 'lib', 'api.ts'), 'utf8'));

/** 从 `z.enum(['a','b'])` 里把字面量抠出来。抠不到就返回 null —— 那说明服务端换了写法，
 *  此时判红比"看不见就算过"诚实。 */
function serverEnum(field: string): string[] | null {
  const m = new RegExp(`${field}:\\s*z\\.enum\\(\\[([^\\]]*)\\]`).exec(serverSrc);
  if (!m) return null;
  return m[1].split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}
function serverRegexSource(field: string): string | null {
  const m = new RegExp(field + ':\\s*z\\.string\\(\\)\\.regex\\(/(.+?)/\\)').exec(serverSrc);
  return m ? m[1] : null;
}

const good: CreateChartPayload = {
  visitor_id: 'v_abcdefghij012345', name: '陈一为', gender: '男', calendar: '公历',
  birthday: '1990-05-20 14:30', birthPlace: '上海', currentPlace: '上海',
};

// ── 1. 契约同步：两边逐字相同 ──
{
  const sg = serverEnum('gender'), sc = serverEnum('calendar'), sr = serverRegexSource('birthday');
  ok('sync/gender-enum', !!sg && sg.join('|') === SERVER_GENDER.join('|'),
    `gender 枚举两边逐字相同：服务端 ${JSON.stringify(sg)} / 前端常量 ${JSON.stringify(SERVER_GENDER)}`);
  ok('sync/calendar-enum', !!sc && sc.join('|') === SERVER_CALENDAR.join('|'),
    `calendar 枚举两边逐字相同：服务端 ${JSON.stringify(sc)} / 前端常量 ${JSON.stringify(SERVER_CALENDAR)}（后端加一档而这里没红 = 同步漏了）`);
  ok('sync/birthday-regex', !!sr && sr === SERVER_BIRTHDAY_RE.source,
    `birthday 的 regex 源码相同：${sr} vs ${SERVER_BIRTHDAY_RE.source}`);
  ok('sync/schema-shape-parsable', sg !== null && sc !== null && sr !== null,
    '三条都从服务端源码里真的抠出来了（抠不到就该判红，而不是"看不见就算过"）');
}

// ── 2. 校验器本身：每个字段都要能单独拦住 ──
{
  const cases: Array<[string, Partial<CreateChartPayload>, string]> = [
    ['空 visitor_id 拦得住', { visitor_id: '  ' }, 'visitor_id'],
    ['空 name 拦得住', { name: '' }, 'name'],
    ['gender 换成英文拦得住', { gender: 'male' }, 'gender'],
    ['calendar 换成"阳历"拦得住', { calendar: '阳历' }, 'calendar'],
    ['calendar 发"四柱"拦得住', { calendar: '四柱' }, 'calendar'],
    ['birthday 少了补零拦得住', { birthday: '1990-5-20 14:30' }, 'birthday'],
    ['birthday 是四柱串拦得住', { birthday: '四柱:甲子,乙丑,丙寅,丁卯' }, 'birthday'],
    ['birthday 带秒拦得住', { birthday: '1990-05-20 14:30:00' }, 'birthday'],
    ['isLeapMonth 发字符串拦得住', { isLeapMonth: 'true' as unknown as boolean }, 'isLeapMonth'],
  ];
  const bad = cases.filter(([label, patch, field]) => {
    const r = validateCreateChart({ ...good, ...patch });
    if (r.ok) return true;
    return r.field !== field || !label;
  });
  ok('unit/validate-rejects-each-field', bad.length === 0,
    `${cases.length} 个坏值逐个被拦且报对字段${bad.length ? ' — 这些没拦住：' + bad.map(b => b[0]).join('、') : ''}`);

  const okLunar = validateCreateChart({ ...good, calendar: '农历', isLeapMonth: true });
  const okFemale = validateCreateChart({ ...good, gender: '女' });
  const noLeap = validateCreateChart({ ...good, birthday: '1990-01-01 00:00' });
  ok('unit/validate-accepts-legal', okLunar.ok === true && okFemale.ok === true && noLeap.ok === true,
    '两个历法 + 闰月位 + 不传 isLeapMonth 三条合法路径都放行（校验器不能只会拒）');
  ok('unit/can-persist-matches-enum', SERVER_CALENDAR.every(c => canPersist(c).能) && canPersist('四柱').能 === false
    && canPersist('四柱').原因.includes('不会存进'),
    'canPersist 与枚举一致，且四柱那条说得出"存不进去"这件事');
}

// ── 3. 页面侧：先过契约再发请求，且拦下来时不许静默继续 ──
{
  ok('gate/unsupported-value-was-reachable', /'公历','农历','四柱'/.test(pageSrc),
    '界面的历法切换里真的有第三个值「四柱」：这条不成立的话，下面那些闸门全是空转');
  ok('gate/validate-before-send', pageSrc.includes('canPersist(form.calendar)')
    && pageSrc.includes('validateCreateChart(')
    && pageSrc.indexOf('validateCreateChart(') < pageSrc.indexOf('await apiCreateChart('),
    '提交路径上先过 canPersist 再过 validateCreateChart，两者都在真正发请求之前');
  // 分支边界不能拿"到下一个 } 为止"来切：那一段里有模板字符串的 } —— 第一次就是这么切短的，
  // 于是 return; 落在切块之外，闸门红了而代码其实是对的。改成按行首缩进找真正的收尾。
  const from = pageSrc.indexOf('if (!v.ok) {');
  const until = pageSrc.indexOf('\n        }', from);
  const invalidBranch = from >= 0 && until > from ? pageSrc.slice(from, until) : '';
  ok('gate/invalid-stops-no-silent-fallback', /setError\(/.test(invalidBranch) && /return;/.test(invalidBranch)
    && !/router\.push/.test(invalidBranch),
    `校验不过的那一支（截到 ${invalidBranch.length} 字符）：写错误、return，且**不跳转** —— `
    + '原来这里正是"换个 local_ id 继续走"把失败洗成了成功');
  ok('gate/disclosure-before-submit', /id="create-persist-note"/.test(pageSrc)
    && /form\.calendar === '四柱'/.test(pageSrc),
    '选了四柱就在提交键之前把"这条不会存进服务器"写在页面上，而不是等用户事后猜');
  // 冻结的是**发出去的那份值**的语义，不是页面里不许出现 '公历' 这个字面量（默认 tab 就是它）。
  const call = /apiCreateChart\(\{[\s\S]*?\}\)/.exec(pageSrc)?.[0] || '';
  ok('frozen/value-semantics-unchanged', call.length > 0 && /calendar:\s*form\.calendar/.test(call)
    && !/calendar:\s*'公历'/.test(call) && /birthday,\s*$/.test(call) === false
    && /birthday,/.test(call) && /isLeapMonth:\s*isLeapOn/.test(call),
    `发给后端的那份 body 里 calendar 仍是 form.calendar、birthday 仍是原始串、闰月走 additive 字段（实得 ${call.replace(/\s+/g, ' ').slice(0, 120)}…）`);
}

// ── 4. 传输层类型：不许再是裸 string ──
{
  ok('api/param-is-the-contract-type', /createChart\(data: CreateChartPayload\)/.test(apiSrc)
    && !/gender:\s*string/.test(apiSrc),
    'api.createChart 的参数是契约类型，不再是 gender/calendar 写成裸 string 的内联形状');
  ok('api/no-debug-print', !/console\.(log|info|debug)/.test(apiSrc),
    'app/lib/api.ts 里没有调试打印（这一批顺手删掉了 getChartResult 里那条 [DEBUG]）');
}

// ── 5. D1 配额：额度只能来自服务端，读不到不许退化成"免费"或一个数字 ──
{
  const free = describeQuota({ used: 0, remaining: null, limit: null, unlimited: true });
  const unknown = describeQuota(null);
  const empty = describeQuota({});
  const has = describeQuota({ used: 3, remaining: 2, limit: 5 });
  const spent = describeQuota({ used: 5, remaining: 0, limit: 5 });
  ok('quota/only-server-says-free', free.kind === '内测免费' && /不限次数/.test(free.文本),
    `服务端明说 unlimited 才写"不限次数"：${free.文本}`);
  ok('quota/unreadable-is-not-free', unknown.kind === '未知' && empty.kind === '未知'
    && !/\d/.test(unknown.文本) && !/免费|不限/.test(unknown.文本),
    '读不到 / 字段缺 → 走"未知"，既不退化成"免费"也不凭空出一个数（那正是原来 999 的毛病）');
  ok('quota/numbers-come-from-the-response', has.kind === '有额度' && has.剩余 === 2 && has.上限 === 5
    && spent.kind === '有额度' && spent.已用完 === true && /本机排盘照常/.test(spent.文本),
    `有额度时数字只能来自响应（2/5），用满那一档说"本机排盘照常"而不是拦人`);

  // 服务端字面形状 ↔ 前端 ↔ harness 桩，三方对齐。
  const ctrlSrc = strip(readFileSync(join(ROOT, 'server', 'src', 'controllers', 'chart.controller.ts'), 'utf8'));
  const getQuota = /export async function getQuota[\s\S]*?data:\s*\{([^}]*)\}/.exec(ctrlSrc)?.[1] || '';
  const censusSrc = readFileSync(join(ROOT, 'tools', 'visual-harness', 'census.mjs'), 'utf8');
  const stubQuota = /\/api\/chart\/quota'\)\)\s*return J\(\{ success: true, data: (\{[^}]*\})/.exec(censusSrc)?.[1] || '';
  ok('quota/server-shape-is-unlimited', /unlimited:\s*true/.test(getQuota) && /remaining:\s*null/.test(getQuota),
    `服务端 getQuota 现在明说不限次（实得 data:{${getQuota.trim()}}）—— 这一条变了就说明 D1 的前提没了，前端的措辞要跟着改`);
  ok('quota/stub-mirrors-the-server', /unlimited:\s*true/.test(stubQuota) && /remaining:\s*null/.test(stubQuota),
    `harness 桩给的是同一份形状（实得 ${stubQuota || '没找到'}）—— 桩以前给 {remaining:3,limit:3}，`
    + '于是同一行 UI 在桩下显示"还可排 3 次"、线上显示"内测免费"，harness 就再也证不了额度的判据');

  // 这条自己踩了一次坑：quota.ts 的注释里写着"历史上是硬编码 999"，
  // 拿原文去扫 999 就会扫到那句解释。扫之前必须先剥注释 —— 同一个坑这个仓库已经踩过第四次了。
  const quotaBody = strip(readFileSync(join(ROOT, 'frontend', 'lib', 'api', 'quota.ts'), 'utf8'));
  ok('quota/no-invented-constant', !/\b999\b/.test(quotaBody) && !/(remaining|limit)\s*[:=]\s*\d/.test(quotaBody),
    'quota.ts 的**代码**里没有任何兜底额度常量（注释里那句"历史上是硬编码 999"不算）');
  ok('quota/line-is-disclosure-not-gate', /id="create-quota"/.test(pageSrc) && /data-quota-kind=\{quota\.kind\}/.test(pageSrc)
    && !/disabled=\{[^}]*quota/.test(pageSrc),
    '额度那一行有可见落点且带 data-quota-kind；提交键的 disabled 不引用 quota —— 读不到额度不能拦人排盘');
}

// tsx 把这些 .ts 编成 CJS，**顶层 await 用不了**（会抛 TransformError）。
// 需要 await 的那几条放进这个收尾函数里，摘要也必须在它里面打印 ——
// 否则 pass/fail 会在断言跑完之前就被算出去。
async function finish() {
  const fake = (fn: () => Promise<Response>) => fn as unknown as typeof fetch;
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFail = await fetchQuota('v_abcdefghij012345', fake(async () => { throw new Error('offline'); }));
  const fetch404 = await fetchQuota('v_abcdefghij012345', fake(async () => new Response('nope', { status: 404 })));
  const fetchEnvelopeFalse = await fetchQuota('v_abcdefghij012345',
    fake(async () => json({ success: false, error: 'nope' })));
  const fetchOk = await fetchQuota('v_abcdefghij012345',
    fake(async () => json({ success: true, data: { used: 0, remaining: null, limit: null, unlimited: true } })));
  const fetchNoId = await fetchQuota('', fake(async () => { throw new Error('should not be called'); }));
  ok('quota/fetch-degrades-to-unknown', fetchFail.kind === '未知' && fetch404.kind === '未知'
    && fetchEnvelopeFalse.kind === '未知' && fetchOk.kind === '内测免费' && fetchNoId.kind === '未知',
    `网络失败 / 404 / 封套 success:false / 没有访客 id 四种读法全落"未知"，只有服务端真说 unlimited 才落"内测免费"`);

  const summary = `api-contract acceptance: enum=${SERVER_CALENDAR.join('/')} pass=${pass} fail=${fail}`;
  try { writeFileSync(OUT, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
  console.log(summary);
  const fails = lines.filter(l => l.startsWith('FAIL'));
  if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
  console.log('0 failures — see ' + OUT);
}

void finish();

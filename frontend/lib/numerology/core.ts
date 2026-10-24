export const NUMEROLOGY_BASIS = 'latin-nine-grid-v1' as const;

export const LETTER_ROW = [
  'A J S', 'B K T', 'C L U', 'D M V', 'E N W',
  'F O X', 'G P Y', 'H Q Z', 'I R',
] as const;

export interface ReducedNumber { initial: number; steps: number[]; value: number }
export interface LifePathResult {
  date: string;
  month: ReducedNumber;
  day: ReducedNumber;
  year: ReducedNumber;
  total: ReducedNumber;
}
export interface NameNumberResult {
  letters: { letter: string; value: number }[];
  total: ReducedNumber;
}

const MASTER_NUMBERS = new Set([11, 22, 33]);
const digitSum = (value: number) => String(value).split('').reduce((sum, digit) => sum + Number(digit), 0);

/** 固定口径：月、日、年分别化简；11/22/33 在任何一步保留。 */
export function reduceNumber(initial: number): ReducedNumber {
  if (!Number.isSafeInteger(initial) || initial < 1) throw new Error('需要正整数');
  const steps = [initial];
  while (steps[steps.length - 1] > 9 && !MASTER_NUMBERS.has(steps[steps.length - 1])) {
    steps.push(digitSum(steps[steps.length - 1]));
  }
  return { initial, steps, value: steps[steps.length - 1] };
}

export function calculateLifePath(date: string): LifePathResult | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Date.UTC(0..99, ...) 会自动把年份移到 1900..1999，需显式设置完整年份。
  const actual = new Date(0);
  actual.setUTCFullYear(year, month - 1, day);
  if (year < 1 || actual.getUTCFullYear() !== year || actual.getUTCMonth() !== month - 1 || actual.getUTCDate() !== day) return null;
  const pieces = { month: reduceNumber(month), day: reduceNumber(day), year: reduceNumber(year) };
  return { date, ...pieces,
    total: reduceNumber(pieces.month.value + pieces.day.value + pieces.year.value) };
}

/** 姓名数只接受用户自行确认的拉丁拼写；绝不自动把汉字猜成拼音。 */
export function calculateNameNumber(raw: string): NameNumberResult | null {
  const normalized = raw.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (!normalized || /[^A-Z\s'-]/.test(normalized)) return null;
  const letters = [...normalized].filter(letter => /[A-Z]/.test(letter))
    .map(letter => ({ letter, value: ((letter.charCodeAt(0) - 65) % 9) + 1 }));
  if (!letters.length) return null;
  return { letters, total: reduceNumber(letters.reduce((sum, item) => sum + item.value, 0)) };
}

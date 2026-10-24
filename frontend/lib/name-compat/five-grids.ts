export const FIVE_GRIDS_BASIS = 'five-grids-manual-strokes-v1' as const;
export type Element = '木' | '火' | '土' | '金' | '水';
export type GridName = '天格' | '人格' | '地格' | '外格' | '总格';

export const GRID_NAMES: GridName[] = ['天格', '人格', '地格', '外格', '总格'];
const ELEMENTS: Element[] = ['水', '木', '木', '火', '火', '土', '土', '金', '金', '水'];
const GENERATING: Element[] = ['木', '火', '土', '金', '水'];
const CONTROLLING: Element[] = ['木', '土', '水', '火', '金'];

export interface FiveGrids {
  basis: typeof FIVE_GRIDS_BASIS;
  surname: number[];
  given: number[];
  values: Record<GridName, { value: number; element: Element; formula: string }>;
}

export function parseStrokes(raw: string): number[] | null {
  const parts = raw.trim().split(/[\s,，、]+/).filter(Boolean);
  if (parts.length < 1 || parts.length > 2) return null;
  const values = parts.map(Number);
  return values.every(n => Number.isSafeInteger(n) && n > 0 && n <= 100) ? values : null;
}

const grid = (value: number, formula: string) => ({ value, element: ELEMENTS[value % 10], formula });

/** 用户先核对每字笔画；单字姓/名的虚数 1 仅参与对应格，不进入总格。 */
export function calculateFiveGrids(surname: number[], given: number[]): FiveGrids | null {
  if (![surname, given].every(part => part.length >= 1 && part.length <= 2
    && part.every(n => Number.isSafeInteger(n) && n > 0 && n <= 100))) return null;
  const surnameSum = surname.reduce((a, b) => a + b, 0);
  const givenSum = given.reduce((a, b) => a + b, 0);
  const familyVirtual = surname.length === 1 ? 1 : 0;
  const givenVirtual = given.length === 1 ? 1 : 0;
  const person = surname[surname.length - 1] + given[0];
  const total = surnameSum + givenSum;
  const outer = total - person + familyVirtual + givenVirtual;
  return {
    basis: FIVE_GRIDS_BASIS, surname: [...surname], given: [...given],
    values: {
      天格: grid(surnameSum + familyVirtual, `${surname.join(' + ')}${familyVirtual ? ' + 1（单姓虚数）' : ''}`),
      人格: grid(person, `${surname[surname.length - 1]}（姓末） + ${given[0]}（名首）`),
      地格: grid(givenSum + givenVirtual, `${given.join(' + ')}${givenVirtual ? ' + 1（单名虚数）' : ''}`),
      外格: grid(outer, `${total}（总格） − ${person}（人格）${familyVirtual ? ' + 1（单姓虚数）' : ''}${givenVirtual ? ' + 1（单名虚数）' : ''}`),
      总格: grid(total, `${surname.join(' + ')} + ${given.join(' + ')}`),
    },
  };
}

export function elementRelation(first: Element, second: Element): string {
  if (first === second) return '同五行';
  if (GENERATING[(GENERATING.indexOf(first) + 1) % 5] === second) return '甲生乙';
  if (GENERATING[(GENERATING.indexOf(second) + 1) % 5] === first) return '乙生甲';
  if (CONTROLLING[(CONTROLLING.indexOf(first) + 1) % 5] === second) return '甲克乙';
  return '乙克甲';
}

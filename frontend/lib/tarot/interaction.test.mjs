import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const source = await readFile(resolve(here, 'interaction.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { getDeckTilt } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

assert.deepEqual(getDeckTilt(0, 0), { x: 0, y: 0 }, 'a centered pointer leaves the deck level');
assert.deepEqual(getDeckTilt(1, 1), { x: -6, y: 8 }, 'the lower-right corner tilts toward the pointer');
assert.deepEqual(getDeckTilt(-2, 2), { x: -6, y: -8 }, 'pointer tilt is clamped at the edge of the deck');
console.log('PASS tarot interaction: deck tilt follows the pointer and stays within a gentle range');

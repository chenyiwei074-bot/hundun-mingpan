import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const source = await readFile(resolve(here, 'motion.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { getRevealDelay } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

assert.equal(getRevealDelay(0), '0ms', 'the first block has no artificial wait');
assert.equal(getRevealDelay(2), '90ms', 'early blocks get a small visual stagger');
assert.equal(getRevealDelay(20), '180ms', 'long pages cap the accumulated reveal delay');
assert.equal(getRevealDelay(-3), '0ms', 'invalid negative positions do not delay the page');
console.log('PASS site motion: scroll reveals use a short, bounded stagger');

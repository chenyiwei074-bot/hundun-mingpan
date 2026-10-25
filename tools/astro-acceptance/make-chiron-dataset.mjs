import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const RAW = join(ROOT, 'tools/astro-acceptance/horizons');
const OUTPUT_DIR = join(ROOT, 'frontend/public/ephemeris');
const OUTPUT = join(OUTPUT_DIR, 'chiron-jpl-1900-2100-v1.bin');
const METADATA = join(OUTPUT_DIR, 'chiron-jpl-1900-2100-v1.json');
const START = Date.UTC(1900, 0, 1);
const END = Date.UTC(2100, 0, 1);
const DAY = 86_400_000;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parse(file) {
  const text = readFileSync(file, 'utf8');
  const checks = [
    [/Target body name:\s*2060 Chiron/, 'JPL target 2060 Chiron'],
    [/Center body name:\s*Earth \(399\).*source:\s*DE441/s, 'geocentric Earth / DE441'],
    [/Small-body perts:\s*Yes/, 'JPL small-body perturbations'],
    [/ObsEcLon\s*,?\s*ObsEcLat/, 'observer ecliptic longitude and latitude'],
    [/\$\$SOE[\s\S]*\$\$EOE/, 'Horizons ephemeris data block'],
  ];
  for (const [pattern, description] of checks) {
    if (!pattern.test(text)) throw new Error(`${file.split(/[\\/]/).pop()} is missing ${description}.`);
  }
  const start = text.indexOf('$$SOE') + '$$SOE'.length;
  const end = text.indexOf('$$EOE', start);
  const rows = [];
  for (const line of text.slice(start, end).split(/\r?\n/)) {
    const match = /^\s*(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}):(\d{2}),\s*,\s*,\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),?\s*$/.exec(line);
    if (!match) continue;
    const month = MON.indexOf(match[2]);
    if (month < 0) throw new Error(`Unrecognized month in ${line}`);
    const utcMs = Date.UTC(+match[1], month, +match[3], +match[4], +match[5]);
    rows.push({ utcMs, lon: +match[6], lat: +match[7] });
  }
  if (!rows.length) throw new Error(`${file.split(/[\\/]/).pop()} contains no parseable ephemeris rows.`);
  return rows;
}

const byDay = new Map();
for (const file of readdirSync(RAW).filter(name => /^chiron-\d{4}-\d{4}\.txt$/.test(name)).sort()) {
  for (const row of parse(join(RAW, file))) {
    if (row.utcMs < START || row.utcMs > END) continue;
    const prior = byDay.get(row.utcMs);
    if (prior && (Math.abs(prior.lon - row.lon) > 0.001 || Math.abs(prior.lat - row.lat) > 0.001)) {
      throw new Error(`Overlapping Horizons chunks disagree at ${new Date(row.utcMs).toISOString()}.`);
    }
    byDay.set(row.utcMs, row);
  }
}

const count = Math.round((END - START) / DAY) + 1;
if (byDay.size !== count) {
  const missing = [];
  for (let i = 0; i < count; i += 1) if (!byDay.has(START + i * DAY)) missing.push(new Date(START + i * DAY).toISOString());
  throw new Error(`Expected ${count} daily samples, got ${byDay.size}; first missing: ${missing.slice(0, 5).join(', ')}`);
}

const headerBytes = 16;
const bytes = Buffer.alloc(headerBytes + count * 8);
bytes.write('CHRN', 0, 4, 'ascii');
bytes.writeUInt32LE(1, 4);
bytes.writeUInt32LE(count, 8);
bytes.writeUInt32LE(2, 12);
for (let index = 0; index < count; index += 1) {
  const row = byDay.get(START + index * DAY);
  bytes.writeFloatLE(((row.lon % 360) + 360) % 360, headerBytes + index * 8);
  bytes.writeFloatLE(row.lat, headerBytes + index * 8 + 4);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT, bytes);
writeFileSync(METADATA, `${JSON.stringify({
  version: 1,
  body: '2060 Chiron',
  authority: 'NASA/JPL Horizons API',
  ephemeris: 'DE441 + SB441-N16 small-body perturbations',
  observer: 'geocentric Earth (399)',
  coordinates: 'apparent ecliptic of date, ObsEcLon / ObsEcLat, daily UTC samples',
  interpolation: 'linear between daily samples; longitude follows the shortest arc',
  from: '1900-01-01T00:00:00Z',
  through: '2100-01-01T00:00:00Z',
  sampleCount: count,
  record: 'little-endian float32 longitude degrees, float32 latitude degrees',
  binary: 'chiron-jpl-1900-2100-v1.bin',
  sourceFiles: readdirSync(RAW).filter(name => /^chiron-\d{4}-\d{4}\.txt$/.test(name)).sort(),
}, null, 2)}\n`, 'utf8');
console.log(`Wrote ${OUTPUT} (${bytes.byteLength} bytes, ${count} daily samples).`);

/**
 * Generates the sample folder and its ground truth. Run with `pnpm samples`; the Arabic minutes need Microsoft Edge.
 * Writes samples/riyadh-tower/ (the demo documents), samples/empty-folder/ and samples/expected.json at the repo root.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExpected } from './expected';
import { EMPTY_FOLDER } from './expectedEdge';
import { SAMPLE_FOLDER } from './project';
import { buildSampleSet, sampleFiles } from './sampleSet';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const folder = join(root, SAMPLE_FOLDER);

const set = await buildSampleSet();
const files = await sampleFiles(set);

await rm(folder, { recursive: true, force: true });
await mkdir(folder, { recursive: true });
for (const [name, bytes] of files) {
  await writeFile(join(folder, name), bytes);
  console.log(`wrote ${SAMPLE_FOLDER}/${name} (${bytes.length.toLocaleString('en-US')} bytes)`);
}

await mkdir(join(root, EMPTY_FOLDER), { recursive: true });
await writeFile(join(root, EMPTY_FOLDER, '.gitkeep'), '');
console.log(`wrote ${EMPTY_FOLDER}/.gitkeep`);

const expected = buildExpected(set);
await writeFile(join(root, 'samples', 'expected.json'), `${JSON.stringify(expected, null, 2)}\n`);
console.log(
  `wrote samples/expected.json: ${Object.keys(expected.filesStatus).length} files, ` +
    `${expected.itemsAboveSar1mAcrossBoqs.items.length} BOQ items above SAR 1M across ` +
    `${Object.keys(expected.itemsAboveSar1mAcrossBoqs.countByFile).length} BOQ files, ` +
    `${expected.arithmeticErrors.length} arithmetic errors, ${expected.wrongSubtotals.length} wrong sub-totals, ` +
    `${expected.costLedger.dataRows.toLocaleString('en-US')} ledger rows (${expected.costLedger.rowsAboveSar1m.count} above SAR 1M), ` +
    `${expected.specification.facts.length} specification facts`,
);

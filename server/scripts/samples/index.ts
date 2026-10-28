/**
 * Generates the sample folder and its ground truth. Run with `pnpm samples`.
 * Writes samples/riyadh-tower/ (the demo documents) and samples/expected.json at the repo root.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boqPhase1Rev0 } from './boqPhase1Rev0';
import { boqPhase1Rev1 } from './boqPhase1Rev1';
import { buildContractMainWorks } from './contractMainWorks';
import { buildExpected } from './expected';
import { layoutBoq } from './lib/boqLayout';
import { writeBoqWorkbook } from './lib/boqWorkbook';
import { SAMPLE_FOLDER } from './project';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const folder = join(root, SAMPLE_FOLDER);

const contract = await buildContractMainWorks();
const boqRev0 = layoutBoq(boqPhase1Rev0);
const boqRev1 = layoutBoq(boqPhase1Rev1);
const files: [string, Uint8Array][] = [
  [contract.fileName, contract.bytes],
  [boqRev0.revision.fileName, await writeBoqWorkbook(boqRev0)],
  [boqRev1.revision.fileName, await writeBoqWorkbook(boqRev1)],
];

await rm(folder, { recursive: true, force: true });
await mkdir(folder, { recursive: true });
for (const [name, bytes] of files) {
  await writeFile(join(folder, name), bytes);
  console.log(`wrote ${SAMPLE_FOLDER}/${name} (${bytes.length.toLocaleString('en-US')} bytes)`);
}

const expected = buildExpected({ contract, boqRev0, boqRev1 });
await writeFile(join(root, 'samples', 'expected.json'), `${JSON.stringify(expected, null, 2)}\n`);
console.log(
  `wrote samples/expected.json: ${expected.rowsAboveSar1m.length} rows above SAR 1M, ` +
    `${expected.arithmeticErrors.length} arithmetic errors, ${expected.wrongSubtotals.length} wrong sub-totals`,
);

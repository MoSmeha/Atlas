import { boqPhase1Rev0 } from './boqPhase1Rev0';
import { boqPhase1Rev1 } from './boqPhase1Rev1';
import { buildBoqPhase2Facade } from './boqPhase2Facade';
import { buildContractMainWorks, type GeneratedPdf } from './contractMainWorks';
import { layoutLedger, writeCostLedger, type LedgerLayout } from './costLedger';
import { layoutEquipment, writeEquipmentImports, type EquipmentLayout } from './equipmentImports';
import { layoutBoq, type BoqLayout } from './lib/boqLayout';
import { writeBoqWorkbook } from './lib/boqWorkbook';
import type { GeneratedPdfBoq } from './lib/pdfBoqWriter';
import { layoutProgramme, writeProgrammeMilestones, type ProgrammeLayout } from './programmeMilestones';
import { layoutProvisionalSums, writeProvisionalSums, type ProvisionalSumsLayout } from './provisionalSums';

/** Every sample document, built in memory: PDFs as bytes, workbooks as layouts that expected.json reads. */
export interface SampleSet {
  contract: GeneratedPdf;
  boqRev0: BoqLayout;
  boqRev1: BoqLayout;
  boqPhase2: GeneratedPdfBoq;
  equipment: EquipmentLayout;
  programme: ProgrammeLayout;
  provisionalSums: ProvisionalSumsLayout;
  ledger: LedgerLayout;
}

export async function buildSampleSet(): Promise<SampleSet> {
  return {
    contract: await buildContractMainWorks(),
    boqRev0: layoutBoq(boqPhase1Rev0),
    boqRev1: layoutBoq(boqPhase1Rev1),
    boqPhase2: await buildBoqPhase2Facade(),
    equipment: layoutEquipment(),
    programme: layoutProgramme(),
    provisionalSums: layoutProvisionalSums(),
    ledger: layoutLedger(),
  };
}

/** File name and bytes of every document in the sample folder. */
export async function sampleFiles(set: SampleSet): Promise<[string, Uint8Array][]> {
  return [
    [set.contract.fileName, set.contract.bytes],
    [set.boqRev0.revision.fileName, await writeBoqWorkbook(set.boqRev0)],
    [set.boqRev1.revision.fileName, await writeBoqWorkbook(set.boqRev1)],
    [set.boqPhase2.fileName, set.boqPhase2.bytes],
    [set.equipment.fileName, await writeEquipmentImports(set.equipment)],
    [set.programme.fileName, await writeProgrammeMilestones(set.programme)],
    [set.provisionalSums.fileName, await writeProvisionalSums(set.provisionalSums)],
    [set.ledger.fileName, await writeCostLedger(set.ledger)],
  ];
}

import { day, longDate } from '../samples/lib/dates';
import { PdfWriter, type WrittenPdf } from '../samples/lib/PdfWriter';
import { Random } from '../samples/lib/random';
import { fillerClauses, GROUP_TITLES } from '../samples/lib/specClauses';
import { contract, parties, project } from './project';

export interface SpecSectionDef {
  code: string;
  title: string;
  /** The noun phrase the filler clauses talk about. */
  topic: string;
}

export interface SpecPartDef {
  title: string;
  sections: SpecSectionDef[];
}

/** Technical Specification - Vol 1 Civil.pdf: sixty sections of filler clauses, about 450 pages, with planted facts and decoys. */
export const specification = {
  fileName: 'Technical Specification - Vol 1 Civil.pdf',
  title: 'Technical Specification - Volume 1',
  subtitle: 'Civil, Structural, Roads, Drainage and External Works',
  revision: 'Revision B - Issued for Construction',
  issueDate: '2026-02-20',
  /** Clauses per clause group, drawn at random between these. */
  clausesPerGroup: [7, 10] as const,
};

const s = (code: string, title: string, topic: string): SpecSectionDef => ({ code, title, topic });

export const specParts: SpecPartDef[] = [
  {
    title: 'Part 1  General',
    sections: [
      s('01', 'General Requirements', 'temporary works'),
      s('02', 'Quality Control and Testing', 'site testing facilities'),
      s('03', 'Submittals and Samples', 'sample panels'),
      s('04', 'Survey and Setting Out', 'survey control stations'),
    ],
  },
  {
    title: 'Part 2  Earthworks and Ground Improvement',
    sections: [
      s('05', 'Site Clearance', 'site clearance works'),
      s('06', 'Excavation and Cut', 'bulk excavation'),
      s('07', 'Engineered Fill', 'engineered fill'),
      s('08', 'Dynamic Compaction', 'dynamic compaction'),
      s('09', 'Ground Improvement Verification', 'verification testing'),
      s('10', 'Dewatering', 'dewatering systems'),
      s('11', 'Sub-base Under Floor Slabs', 'sub-base layers'),
      s('12', 'Geotextiles and Separation Layers', 'geotextile layers'),
    ],
  },
  {
    title: 'Part 3  Concrete',
    sections: [
      s('13', 'Concrete Materials', 'concrete materials'),
      s('14', 'Concrete Mix Design', 'concrete mixes'),
      s('15', 'Reinforcement', 'steel reinforcement'),
      s('16', 'Formwork', 'formwork'),
      s('17', 'Foundations and Tie Beams', 'pad foundations'),
      s('18', 'Warehouse Floor Slabs', 'ground-bearing floor slabs'),
      s('19', 'Office Pod Floor Slabs', 'office pod floor slabs'),
      s('20', 'Joints and Sealants', 'floor joints'),
      s('21', 'Hot Weather Concreting', 'hot weather concreting'),
      s('22', 'Curing and Protection', 'curing'),
    ],
  },
  {
    title: 'Part 4  Structural Steel and Cladding',
    sections: [
      s('23', 'Structural Steel Materials', 'structural steel sections'),
      s('24', 'Fabrication', 'steel fabrication'),
      s('25', 'Protective Coatings', 'protective coatings'),
      s('26', 'Erection', 'steel erection'),
      s('27', 'Purlins and Side Rails', 'purlins and side rails'),
      s('28', 'Roof Cladding', 'roof cladding'),
      s('29', 'Wall Cladding', 'wall cladding'),
      s('30', 'Roof Lights and Smoke Vents', 'roof lights'),
    ],
  },
  {
    title: 'Part 5  Roads and Paving',
    sections: [
      s('31', 'Road Sub-base', 'road sub-base'),
      s('32', 'Asphalt Base Course', 'asphalt base course'),
      s('33', 'Asphalt Wearing Course', 'asphalt wearing course'),
      s('34', 'Concrete Hardstandings', 'concrete hardstandings'),
      s('35', 'Kerbs and Edgings', 'kerbs'),
      s('36', 'Block Paving', 'block paving'),
      s('37', 'Road Markings and Signs', 'road markings'),
      s('38', 'Pavement Design Life', 'pavement layers'),
    ],
  },
  {
    title: 'Part 6  Drainage and Utilities',
    sections: [
      s('39', 'Storm Water Pipes', 'storm water pipes'),
      s('40', 'Manholes and Chambers', 'manholes'),
      s('41', 'Oil Interceptors', 'oil interceptors'),
      s('42', 'Foul Drainage', 'foul drainage'),
      s('43', 'Lifting Stations', 'lifting stations'),
      s('44', 'Potable Water', 'potable water mains'),
      s('45', 'Fire Water Mains', 'fire water mains'),
      s('46', 'Ducts and Draw Pits', 'cable ducts'),
      s('47', 'Irrigation Mains', 'irrigation mains'),
      s('48', 'Testing of Pipelines', 'pipeline testing'),
    ],
  },
  {
    title: 'Part 7  External Works',
    sections: [
      s('49', 'Fencing and Gates', 'perimeter fencing'),
      s('50', 'Gatehouse', 'the gatehouse'),
      s('51', 'Topsoil and Planting', 'planting'),
      s('52', 'Irrigation Systems', 'irrigation systems'),
      s('53', 'Site Furniture and Signage', 'site furniture'),
      s('54', 'External Lighting Columns', 'lighting columns'),
    ],
  },
  {
    title: 'Part 8  Design Life, Testing and Handover',
    sections: [
      s('55', 'Design Life and Durability', 'durability measures'),
      s('56', 'Inspection and Test Plans', 'inspection and test plans'),
      s('57', 'Commissioning', 'commissioning'),
      s('58', 'As-built Records', 'as-built records'),
      s('59', 'Operation and Maintenance Manuals', 'maintenance manuals'),
      s('60', 'Training and Handover', 'handover'),
    ],
  },
];

export interface PlantedClause {
  key: string;
  /** Section code and index into GROUP_TITLES of the group the clause opens. */
  section: string;
  group: number;
  text: string;
  /** The words that carry the fact: the expected quote. */
  quote: string;
}

export interface SpecFact extends PlantedClause {
  question: string;
  answer: string;
}

/** Facts a question should find, each the first clause of its group. Similar values for other elements sit in the decoys. */
export const specFacts: SpecFact[] = [
  {
    key: 'floorSlab',
    section: '18',
    group: 4,
    text: 'Ground-bearing floor slabs to Warehouses W1 to W4 shall be 200 mm thick in concrete grade C35/45, with 25 kg/m3 of steel fibres, laid on the 300 mm compacted sub-base over a 1000 gauge polythene slip membrane.',
    quote: '200 mm thick in concrete grade C35/45',
    question: 'What concrete grade and slab thickness does the specification require for the warehouse floor slabs?',
    answer: 'C35/45, 200 mm thick',
  },
  {
    key: 'designLife',
    section: '55',
    group: 0,
    text: 'The warehouse structures, their foundations and their floor slabs shall be designed and built for a design life of 50 years without major repair.',
    quote: 'design life of 50 years',
    question: 'What design life does the specification require for the warehouse structures?',
    answer: '50 years',
  },
  {
    key: 'fillCompaction',
    section: '07',
    group: 7,
    text: 'Engineered fill shall be placed in layers not exceeding 300 mm loose and compacted to not less than 95% of the maximum dry density (modified Proctor), tested every 500 m3.',
    quote: '95% of the maximum dry density',
    question: 'To what density must the engineered fill be compacted?',
    answer: '95% of the maximum dry density (modified Proctor)',
  },
  {
    key: 'galvanising',
    section: '25',
    group: 4,
    text: 'Purlins, side rails and sag rods shall be hot-dip galvanised to a minimum coating thickness of 85 microns, with cut ends repaired with zinc-rich paint.',
    quote: 'minimum coating thickness of 85 microns',
    question: 'What galvanised coating thickness does the specification require on the purlins?',
    answer: '85 microns',
  },
  {
    key: 'wearingCourse',
    section: '33',
    group: 7,
    text: 'The asphalt wearing course shall be laid 50 mm thick after compaction, in one layer, on the tack-coated base course within the same working day.',
    quote: '50 mm thick after compaction',
    question: 'How thick is the asphalt wearing course in the specification?',
    answer: '50 mm',
  },
];

/** Clauses with similar values for other elements, so the right page matters. */
export const specDecoys: PlantedClause[] = [
  {
    key: 'officeSlab',
    section: '19',
    group: 4,
    text: 'Office pod floor slabs shall be 150 mm thick in concrete grade C32/40 with A393 mesh reinforcement, on a 150 mm sub-base.',
    quote: '150 mm thick in concrete grade C32/40',
  },
  {
    key: 'hardstanding',
    section: '34',
    group: 4,
    text: 'Concrete hardstandings to the truck courts shall be 250 mm thick in concrete grade C40/50, air entrained, with dowelled joints at 5 m centres.',
    quote: '250 mm thick in concrete grade C40/50',
  },
  {
    key: 'roadSubbase',
    section: '31',
    group: 7,
    text: 'Road sub-base shall be compacted to not less than 98% of the maximum dry density (modified Proctor) and proof rolled before the base course is laid.',
    quote: '98% of the maximum dry density',
  },
  {
    key: 'pavementLife',
    section: '38',
    group: 0,
    text: 'Roads, truck courts and hardstandings shall be designed for a design life of 20 years before structural maintenance.',
    quote: 'design life of 20 years',
  },
  {
    key: 'claddingWarranty',
    section: '29',
    group: 12,
    text: "The wall cladding coating shall carry the manufacturer's 25-year warranty against peeling, chalking and colour change.",
    quote: '25-year warranty',
  },
  {
    key: 'irrigationLife',
    section: '52',
    group: 0,
    text: 'Irrigation systems shall be designed for a service life of 15 years with every component replaceable from the surface.',
    quote: 'service life of 15 years',
  },
];

/** Marks: one per planted clause, by key. */
export async function buildSpecification(): Promise<WrittenPdf> {
  const issued = day(specification.issueDate);
  const pdf = await PdfWriter.create({
    title: `${project.name} - ${specification.title}`,
    subject: specification.subtitle,
    runningHeader: `${project.name}  |  ${specification.title}  |  ${specification.revision}`,
    issued,
  });
  pdf.moveTo(200);
  pdf.paragraph(project.name, { size: 18, bold: true, align: 'center', gapAfter: 10 });
  pdf.paragraph(specification.title, { size: 15, bold: true, align: 'center', gapAfter: 6 });
  pdf.paragraph(specification.subtitle, { size: 11.5, align: 'center', gapAfter: 24 });
  pdf.labelled([
    ['Contract No.', contract.number],
    ['Revision', specification.revision],
    ['Issued', longDate(issued)],
    ['Prepared by', parties.engineer.name],
    ['For', parties.employer.name],
  ]);

  pdf.newPage();
  pdf.heading('Contents');
  for (const part of specParts) {
    pdf.paragraph(part.title, { bold: true, gapAfter: 2 });
    for (const section of part.sections) pdf.paragraph(`Section ${section.code}  ${section.title}`, { indent: 16, size: 9.5, gapAfter: 1 });
    pdf.space(4);
  }

  const random = new Random(2026);
  const planted = [...specFacts, ...specDecoys];
  const [min, max] = specification.clausesPerGroup;
  for (const part of specParts) {
    pdf.newPage();
    pdf.paragraph(part.title, { size: 14, bold: true, gapAfter: 14 });
    for (const section of part.sections) {
      pdf.heading(`Section ${section.code}  ${section.title}`);
      GROUP_TITLES.forEach((group, groupIndex) => {
        pdf.subheading(`${section.code}.${groupIndex + 1}  ${group}`);
        const here = planted.filter((clause) => clause.section === section.code && clause.group === groupIndex);
        const filler = fillerClauses(random, section.topic, random.int(min, max));
        const clauses = [...here.map((clause) => ({ text: clause.text, mark: clause })), ...filler.map((text) => ({ text, mark: null }))];
        clauses.forEach((clause, index) => {
          const text = `${section.code}.${groupIndex + 1}.${index + 1}  ${clause.text}`;
          pdf.paragraph(text, { size: 9.5, gapAfter: 4 }, clause.mark === null ? {} : { [clause.mark.key]: clause.mark.quote });
        });
      });
    }
  }
  const written = await pdf.finish();
  for (const clause of planted) if (written.pages[clause.key] === undefined) throw new Error(`Planted clause ${clause.key} was not written`);
  return written;
}

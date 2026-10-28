import type { Random } from './random';

/** Clause group titles, in the order a specification section usually runs. */
export const GROUP_TITLES = [
  'Scope',
  'Related Work',
  'Submittals',
  'Quality Assurance',
  'Materials',
  'Delivery, Storage and Handling',
  'Preparation',
  'Installation',
  'Tolerances',
  'Inspection and Testing',
  'Protection',
  'Cleaning',
  'Records and Handover',
  'Coordination',
] as const;

type Template = (topic: string) => string;

/**
 * Plain specification sentences about a topic. None of them states a grade, a rating, a U-value or an amount,
 * so the planted facts stay the only place those appear.
 */
const TEMPLATES: Template[] = [
  (t) => `Provide ${t} complete with all fixings, accessories and preparation needed for a finished installation, whether or not each item is shown on the Drawings.`,
  (t) => `Submit product data, shop drawings and a method statement for ${t} to the Engineer for review before ordering any materials.`,
  (t) => `Store materials for ${t} off the ground, under cover and away from direct sun, dust and moisture, in the original packaging until use.`,
  (t) => `Inspect each completed area of ${t} jointly with the Engineer and record the result on an inspection request form signed by both parties.`,
  (t) => `Remove and replace any work on ${t} that does not meet this Section, at no cost to the Employer and without extension of the Time for Completion.`,
  (t) => `Coordinate ${t} with the mechanical, electrical and plumbing services shown on the approved combined services drawings before work starts.`,
  (t) => `Keep a daily record of work on ${t}, including weather, labour, plant and quantities installed, and make it available to the Engineer on request.`,
  (t) => `Use only installers who have completed at least three projects of similar size and complexity with ${t}, and name them in the submittal.`,
  (t) => `Protect finished ${t} from damage by following trades until the Taking-Over Certificate is issued; repair any damage before handover.`,
  (t) => `Clean ${t} on completion with methods recommended by the manufacturer, and remove all packaging, offcuts and debris from the Site.`,
  (t) => `Where the manufacturer's instructions for ${t} differ from this Section, notify the Engineer in writing and follow the Engineer's direction.`,
  (t) => `Set out ${t} from the approved gridlines and datum levels, and check the setting out with the Engineer before fixing.`,
  (t) => `Hand over warranties, test certificates and operation and maintenance information for ${t} with the as-built documents.`,
  (t) => `Do not start ${t} in any area until the preceding work has been inspected and accepted by the Engineer.`,
  (t) => `Prepare a sample of ${t} for the Engineer's approval; the approved sample sets the standard for the rest of the Works.`,
  (t) => `Materials for ${t} shall be new, of one manufacturer for each product type, and delivered with the manufacturer's labels intact.`,
  (t) => `Report any defect found in ${t} to the Engineer within two working days, together with the proposed remedy.`,
  (t) => `Allow access for the Engineer to witness the testing of ${t}, giving at least two working days' notice of each test.`,
  (t) => `Fixings and accessories for ${t} shall be compatible with the adjoining materials and shall not cause staining or corrosion.`,
  (t) => `Work on ${t} during the summer months shall follow the hot weather procedures in the approved method statement.`,
  (t) => `Include ${t} in the monthly progress report, with the areas completed, the areas inspected and any open non-conformance reports.`,
  (t) => `Make good all surfaces disturbed by ${t} to match the adjoining finishes, to the Engineer's satisfaction.`,
  (t) => `Label each delivery for ${t} with the product name, batch number and date of manufacture, and keep the delivery notes on Site.`,
  (t) => `Interfaces between ${t} and the work of other Sections shall be shown on the shop drawings and agreed before installation.`,
];

/** `count` different clause sentences about `topic`, drawn from the templates with `random`. */
export function fillerClauses(random: Random, topic: string, count: number): string[] {
  if (count > TEMPLATES.length) throw new Error(`Only ${TEMPLATES.length} different filler clauses exist`);
  const used = new Set<number>();
  const clauses: string[] = [];
  while (clauses.length < count) {
    const index = random.int(0, TEMPLATES.length - 1);
    if (used.has(index)) continue;
    used.add(index);
    clauses.push(TEMPLATES[index]!(topic));
  }
  return clauses;
}

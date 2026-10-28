import { type Script, type ScriptContext, listStep, toolInput, unreadable } from './script';

const contract = '01 Contract/Contract_Agreement_RUH-NKT.pdf';
const spec = '03 Specifications/Technical_Specification_Div03_Concrete.pdf';

function searchStep(query: string, found: string) {
  return { name: 'search_documents', inputSummary: toolInput({ query, document: null, limit: null }), resultSummary: found, durationMs: 340 };
}

function readStep(path: string, page: number) {
  return {
    name: 'read_pages',
    inputSummary: toolInput({ document: path, from: page, to: page }),
    resultSummary: `Read page ${page} of ${path}`,
    durationMs: 65,
  };
}

const textTokens = { input: 14_820, cached: 9_216, output: 610, reasoning: 256 };

export function retentionAnswer(): Script {
  return {
    steps: [searchStep('retention percentage', '8 passages from 2 documents'), readStep(contract, 37)],
    draft: null,
    chunkMs: 40,
    tokens: textTokens,
    outcome: {
      type: 'answer',
      table: null,
      answer: {
        kind: 'answer',
        language: 'en',
        markdown:
          'The Employer keeps **10%** of each interim payment as retention, until the total held reaches **5%** of the Contract Price.\n\n' +
          'Half of the retention is released when the Taking-Over Certificate is issued, and the rest at the end of the Defects Notification Period (Clause 14.3).',
        sources: [
          {
            kind: 'pdf',
            document: contract,
            page: 37,
            quote: 'The Employer shall retain ten percent (10%) of each interim payment until the total retention reaches five percent (5%) of the Contract Price.',
          },
        ],
        unreadableFiles: [],
        warnings: [],
      },
    },
  };
}

export function delayDamagesAnswer(language: 'en' | 'ar'): Script {
  const markdown =
    language === 'ar'
      ? 'غرامة التأخير هي **SAR 95,000** عن كل يوم تأخير، ولا يتجاوز مجموعها **10%** من قيمة العقد (البند 8.7 في Contract_Agreement_RUH-NKT.pdf).'
      : 'Delay damages are **SAR 95,000** for every day of delay, and the total is capped at **10%** of the Contract Price (Clause 8.7).';
  return {
    steps: [searchStep(language === 'ar' ? 'غرامة التأخير' : 'delay damages per day', '5 passages from 1 document'), readStep(contract, 41)],
    draft: null,
    chunkMs: 45,
    tokens: textTokens,
    outcome: {
      type: 'answer',
      table: null,
      answer: {
        kind: 'answer',
        language,
        markdown,
        sources: [
          {
            kind: 'pdf',
            document: contract,
            page: 41,
            quote: 'Contractor shall pay delay damages of SAR 95,000 for every day of delay.',
          },
        ],
        unreadableFiles: [],
        warnings: [],
      },
    },
  };
}

export function concreteCoverAnswer(): Script {
  return {
    steps: [searchStep('concrete cover to reinforcement', '6 passages from 1 document'), readStep(spec, 118)],
    draft: null,
    chunkMs: 40,
    tokens: { ...textTokens, input: 21_400 },
    outcome: {
      type: 'answer',
      table: null,
      answer: {
        kind: 'answer',
        language: 'en',
        markdown:
          'Section 3.4 of the concrete specification sets the nominal cover:\n\n' +
          '- **75 mm** to foundations cast against ground\n- **50 mm** to basement walls\n- **40 mm** to columns and beams\n- **30 mm** to suspended slabs',
        sources: [{ kind: 'pdf', document: spec, page: 118, quote: 'Nominal cover: 75 mm to foundations cast against ground, 50 mm to basement walls,' }],
        unreadableFiles: [],
        warnings: [],
      },
    },
  };
}

/** A long answer streamed slowly, for trying the Stop button. */
export function slowAnswer(context: ScriptContext): Script {
  const paragraph =
    'The Al Nakheel Mixed-Use Tower is a 38-storey building in Riyadh, built by Rawabi Contracting Co. Ltd. for Al Nakheel Real Estate Development Co. ';
  return {
    steps: [listStep(context.documents), searchStep('project overview', '12 passages from 4 documents'), readStep(contract, 1)],
    draft: null,
    chunkMs: 260,
    tokens: { input: 30_100, cached: 12_288, output: 1_420, reasoning: 640 },
    outcome: {
      type: 'answer',
      table: null,
      answer: {
        kind: 'answer',
        language: 'en',
        markdown: `${paragraph.repeat(3)}\n\nThe Contract Price is **SAR 186,450,000**, with 30 months for completion from 1 February 2026.`,
        sources: [{ kind: 'pdf', document: contract, page: 1, quote: 'Contract Price: SAR 186,450,000.00' }],
        unreadableFiles: [],
        warnings: [],
      },
    },
  };
}

export function notFoundAnswer(context: ScriptContext): Script {
  const missing = unreadable(context.documents);
  return {
    steps: [listStep(context.documents), searchStep(context.question.slice(0, 60), 'No relevant passages')],
    draft: null,
    chunkMs: 40,
    tokens: { input: 9_960, cached: 4_096, output: 280, reasoning: 128 },
    outcome: {
      type: 'answer',
      table: null,
      answer: {
        kind: 'not_found',
        language: 'en',
        markdown:
          'I could not find this in the loaded documents.' +
          (missing.length > 0 ? ` ${missing.length} files could not be searched, so the answer may be in one of them.` : ''),
        sources: [],
        unreadableFiles: missing,
        warnings: [],
      },
    },
  };
}

export function rateLimitedError(context: ScriptContext): Script {
  return {
    steps: [listStep(context.documents)],
    draft: null,
    chunkMs: 40,
    tokens: { input: 0, cached: 0, output: 0, reasoning: 0 },
    outcome: {
      type: 'error',
      error: { code: 'rate_limited', message: 'The OpenAI rate limit was reached. Try again in 20 seconds.', retryAfterSeconds: 20 },
    },
  };
}

import { speechKeywords } from '../../domain/speechKeywords';
import { AppError, errors } from '../errors';
import type { RunLogger } from '../ports/RunLogger';
import type { Transcriber } from '../ports/Transcriber';
import type { SessionStore } from '../session/SessionStore';
import type { Workspace } from '../workspace/Workspace';

/** File extensions the transcription service recognises, by the base type a browser records in. */
const EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

/** Languages a question may be spoken in. */
const LANGUAGES = ['ar', 'en'] as const;

const PROMPT = [
  'A question about project documents of an architecture and engineering firm in Saudi Arabia: contracts, bills of',
  'quantities (BOQs), specifications, schedules and minutes. The speaker may use English or Arabic, in Gulf,',
  'Levantine, Egyptian or North African dialect, and may name files, sheets, item codes and amounts in SAR.',
].join(' ');

export interface TranscribeSpeechDeps {
  /** Null while OPENAI_API_KEY is unset; dictation then fails with missing_api_key. */
  transcriber: Transcriber | null;
  workspace: Workspace;
  sessions: SessionStore;
  logger: RunLogger;
  /** US dollars per minute of audio. */
  pricePerMinute: number;
}

export interface TranscribeInput {
  sessionId: string;
  audio: Uint8Array;
  /** As the browser labelled the recording, such as audio/webm;codecs=opus. */
  mimeType: string;
  /** How long the browser recorded, used for the cost when the service does not say. */
  recordedMs: number | null;
  signal?: AbortSignal;
}

export interface TranscribeOutput {
  text: string;
  durationMs: number;
  costUsd: number;
}

/**
 * Turns a dictated question into text for the question box, with the loaded folder's names as hints. The cost is
 * added to the chat's spend.
 */
export class TranscribeSpeech {
  private readonly deps: TranscribeSpeechDeps;

  constructor(deps: TranscribeSpeechDeps) {
    this.deps = deps;
  }

  async execute(input: TranscribeInput): Promise<TranscribeOutput> {
    const { deps } = this;
    if (deps.transcriber === null) throw errors.missingApiKey();
    const mimeType = input.mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
    const extension = EXTENSIONS[mimeType];
    if (extension === undefined) throw errors.invalidRequest(`Atlas cannot read a recording of type "${input.mimeType}".`);
    if (input.audio.byteLength === 0) throw errors.invalidRequest('The recording is empty. Hold the microphone button a little longer.');

    const log = (seconds: number, costUsd: number, error: string | null) =>
      deps.logger.voice({ event: 'dictation', sessionId: input.sessionId, callId: null, voice: null, seconds, costUsd, error, diagnosis: null });
    try {
      const transcript = await deps.transcriber.transcribe({
        audio: input.audio,
        fileName: `speech.${extension}`,
        mimeType,
        keywords: speechKeywords(deps.workspace.status().documents),
        languages: LANGUAGES,
        prompt: PROMPT,
        signal: input.signal,
      });
      const seconds = transcript.seconds ?? Math.max(0, input.recordedMs ?? 0) / 1000;
      const costUsd = (seconds / 60) * deps.pricePerMinute;
      deps.sessions.get(input.sessionId).addSpend(costUsd);
      log(seconds, costUsd, null);
      return { text: transcript.text.trim(), durationMs: Math.round(seconds * 1000), costUsd };
    } catch (error) {
      log(0, 0, error instanceof AppError ? `${error.code}: ${error.message}` : String(error));
      throw error;
    }
  }
}

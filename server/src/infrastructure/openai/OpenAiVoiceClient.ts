import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type OpenAI from 'openai';
import { NotFoundError } from 'openai';
import type { InitialItem } from 'openai/resources/live/live';
import { z } from 'zod';
import type { CallMessage, CallRequest, CallVoice, StartedCall, VoiceClient } from '../../application/ports/VoiceClient';
import { mapOpenAiError } from './mapOpenAiError';

/** Designed voices this account already has: catalog voice id, the voice's id, and the design it was made from. */
const SavedVoices = z.record(z.string(), z.object({ id: z.string().min(1), fingerprint: z.string() }));
type SavedVoices = z.infer<typeof SavedVoices>;
type DesignedVoice = Extract<CallVoice, { kind: 'designed' }>;

/** Creating a session bills 15 seconds of voice time, so it is never retried on its own. */
const CALL_OPTIONS = { maxRetries: 0, timeout: 30_000 } as const;
/** A retried design could leave a second copy of the voice, so designs are not retried either. */
const DESIGN_OPTIONS = { maxRetries: 0, timeout: 60_000 } as const;
const HANG_UP_OPTIONS = { maxRetries: 0, timeout: 5_000 } as const;

/**
 * VoiceClient on GPT-Live over WebRTC with client delegation: the server exchanges the browser's offer for an answer,
 * and every question the voice hands off goes back to the browser. Designed voices are created the first time a call
 * needs them and kept in `voicesFile`; a changed description makes a new voice and deletes the old one.
 */
export class OpenAiVoiceClient implements VoiceClient {
  private readonly client: OpenAI;
  private readonly voicesFile: string;
  private saved: SavedVoices | null = null;
  /** Designs in progress, so two calls that start together create a voice once. */
  private readonly designing = new Map<string, Promise<string>>();

  constructor(client: OpenAI, voicesFile: string) {
    this.client = client;
    this.voicesFile = voicesFile;
  }

  async startCall(request: CallRequest): Promise<StartedCall> {
    try {
      return await this.create(request);
    } catch (error) {
      if (request.voice.kind !== 'designed' || !isMissingVoice(error)) throw mapOpenAiError(error);
      // The saved voice was deleted, or was made with another account's key: design it again, once.
      this.forget(request.voice.key);
      try {
        return await this.create(request);
      } catch (retryError) {
        throw mapOpenAiError(retryError);
      }
    }
  }

  async hangUp(callId: string): Promise<void> {
    try {
      await this.client.live.sessions.hangup(callId, HANG_UP_OPTIONS);
    } catch (error) {
      if (error instanceof NotFoundError) return;
      throw mapOpenAiError(error);
    }
  }

  isReady(voice: CallVoice): boolean {
    return voice.kind === 'builtIn' || this.load()[voice.key]?.fingerprint === fingerprintOf(voice);
  }

  async prepare(voice: CallVoice): Promise<void> {
    if (voice.kind === 'builtIn') return;
    try {
      await this.voiceId(voice);
    } catch (error) {
      throw mapOpenAiError(error);
    }
  }

  private async create(request: CallRequest): Promise<StartedCall> {
    const voice = request.voice.kind === 'builtIn' ? request.voice.name : { id: await this.voiceId(request.voice) };
    const result = await this.client.live.create(
      {
        session: {
          model: request.model,
          instructions: request.instructions,
          audio: { output: { voice } },
          delegation: { type: 'client' },
          input: request.history.map(toInitialItem),
          client: { data_channel: { allowed_client_events: [...request.browserEvents] } },
        },
        transport: { type: 'webrtc', sdp: request.offerSdp },
      },
      CALL_OPTIONS,
    );
    return { callId: result.session.id, answerSdp: result.transport.sdp };
  }

  private async voiceId(voice: DesignedVoice): Promise<string> {
    const fingerprint = fingerprintOf(voice);
    const saved = this.load()[voice.key];
    if (saved?.fingerprint === fingerprint) return saved.id;
    const running = this.designing.get(voice.key);
    if (running !== undefined) return running;
    const design = this.design(voice, fingerprint, saved?.id ?? null).finally(() => this.designing.delete(voice.key));
    this.designing.set(voice.key, design);
    return design;
  }

  private async design(voice: DesignedVoice, fingerprint: string, replaced: string | null): Promise<string> {
    const created = await this.client.audio.voices.create(
      { type: 'prompt', name: voice.name, prompt: voice.prompt, script_hint: voice.script },
      DESIGN_OPTIONS,
    );
    this.store({ ...this.load(), [voice.key]: { id: created.id, fingerprint } });
    if (replaced !== null) await this.client.audio.voices.delete(replaced, HANG_UP_OPTIONS).catch(() => undefined);
    return created.id;
  }

  private forget(key: string): void {
    const { [key]: _forgotten, ...rest } = this.load();
    this.store(rest);
  }

  private load(): SavedVoices {
    if (this.saved !== null) return this.saved;
    let saved: SavedVoices = {};
    try {
      if (existsSync(this.voicesFile)) saved = SavedVoices.parse(JSON.parse(readFileSync(this.voicesFile, 'utf8')));
    } catch (error) {
      console.warn(`Ignoring the unreadable voice list ${this.voicesFile}:`, error);
    }
    this.saved = saved;
    return saved;
  }

  private store(saved: SavedVoices): void {
    this.saved = saved;
    try {
      mkdirSync(dirname(this.voicesFile), { recursive: true });
      writeFileSync(this.voicesFile, `${JSON.stringify(saved, null, 2)}\n`);
    } catch (error) {
      console.warn(`Could not save the voice list ${this.voicesFile}:`, error);
    }
  }
}

function toInitialItem(message: CallMessage): InitialItem {
  if (message.role === 'assistant') {
    return { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: message.text }] };
  }
  return { type: 'message', role: message.role, content: [{ type: 'input_text', text: message.text }] };
}

/** Changes whenever the description or the sample script does, so an edited design gets a new voice. */
function fingerprintOf(voice: DesignedVoice): string {
  return createHash('sha256').update(`${voice.prompt}\n${voice.script}`).digest('hex').slice(0, 16);
}

/** A 404 that names the voice: the saved voice no longer exists for this key. */
function isMissingVoice(error: unknown): boolean {
  return error instanceof NotFoundError && /voice/i.test(`${error.param ?? ''} ${error.message}`);
}

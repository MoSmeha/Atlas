import { AppError, errors } from '../errors';
import type { RunLogger } from '../ports/RunLogger';
import type { CallVoice, VoiceClient } from '../ports/VoiceClient';
import type { SessionStore } from '../session/SessionStore';
import type { Workspace } from '../workspace/Workspace';
import { buildCallInstructions, callHistory, greetingInstruction } from './callInstructions';
import { type CatalogVoice, type DialectStyle, findVoice, type VoiceCatalog } from './VoiceCatalog';

/**
 * The event types the browser may send on a call's channel: results and quiet context for the voice, muting, and
 * closing. Anything else, such as new instructions, the service refuses.
 */
export const BROWSER_EVENTS = [
  'session.commentary.append',
  'session.thinking.append',
  'session.input_audio.mute',
  'session.input_audio.unmute',
  'session.close',
] as const;

export interface VoiceCallsDeps {
  /** Null while OPENAI_API_KEY is unset; calls then fail with missing_api_key. */
  voiceClient: VoiceClient | null;
  /** False when the account cannot see the call model. */
  available: boolean;
  catalog: VoiceCatalog;
  workspace: Workspace;
  sessions: SessionStore;
  logger: RunLogger;
}

export interface StartCallInput {
  sessionId: string;
  voiceId: string;
  /** The browser's WebRTC offer. */
  sdp: string;
}

export interface StartCallOutput {
  callId: string;
  sdp: string;
  greeting: string;
}

export interface EndCallInput {
  sessionId: string;
  callId: string;
  /** How long the call lasted, as the voice service last reported it to the browser. */
  seconds: number;
  /** The browser could not close the call itself, so the server hangs it up. */
  hangUp: boolean;
}

interface OpenCall {
  sessionId: string;
  voice: string;
}

/**
 * Voice calls about the loaded folder. A call starts with the chat's recent turns and the folder's file names; each
 * question in it is asked through the chat like a typed one. Ending a call adds its length and cost to the chat.
 */
export class VoiceCalls {
  private readonly deps: VoiceCallsDeps;
  private readonly open = new Map<string, OpenCall>();

  constructor(deps: VoiceCallsDeps) {
    this.deps = deps;
  }

  async start(input: StartCallInput): Promise<StartCallOutput> {
    const { deps } = this;
    if (deps.voiceClient === null) throw errors.missingApiKey();
    if (!deps.available) throw errors.voiceUnavailable(deps.catalog.call.model);
    const voice = findVoice(deps.catalog, input.voiceId);
    const { folder, index } = deps.workspace.require();
    const dialect = deps.catalog.dialects[voice.dialect];
    const greeting = greetingInstruction(dialect);
    try {
      const call = await deps.voiceClient.startCall({
        model: deps.catalog.call.model,
        offerSdp: input.sdp,
        instructions: buildCallInstructions({
          dialect,
          voiceDescription: voice.sound.kind === 'designed' ? voice.sound.description : null,
          folder,
          documents: index.documents(),
        }),
        voice: callVoice(voice, dialect),
        history: callHistory(deps.sessions.get(input.sessionId).turns, greeting),
        browserEvents: BROWSER_EVENTS,
      });
      this.open.set(call.callId, { sessionId: input.sessionId, voice: voice.id });
      this.log({ event: 'call_start', sessionId: input.sessionId, callId: call.callId, voice: voice.id, seconds: 0, error: null });
      return { callId: call.callId, sdp: call.answerSdp, greeting };
    } catch (error) {
      this.log({ event: 'call_start', sessionId: input.sessionId, callId: null, voice: voice.id, seconds: 0, error: errorText(error) });
      throw error;
    }
  }

  /**
   * Adds a call's length and cost to its chat and, when asked, hangs it up. A call this server did not start, or one
   * already ended, is left alone, so a repeated report is harmless.
   */
  async end(input: EndCallInput): Promise<void> {
    const call = this.open.get(input.callId);
    if (call === undefined || call.sessionId !== input.sessionId) return;
    this.open.delete(input.callId);
    this.deps.sessions.find(input.sessionId)?.recordCall(input.callId, input.seconds, this.deps.catalog.call.pricePerMinute);
    const error = input.hangUp ? await this.hangUp(input.callId) : null;
    this.log({ event: 'call_end', sessionId: input.sessionId, callId: input.callId, voice: call.voice, seconds: input.seconds, error });
  }

  /** Hangs up every call still open, for example when the server stops. */
  async hangUpAll(): Promise<void> {
    const calls = [...this.open.keys()];
    this.open.clear();
    await Promise.all(calls.map((callId) => this.hangUp(callId)));
  }

  /** Hangs up one call; returns why it failed, or null. */
  private async hangUp(callId: string): Promise<string | null> {
    if (this.deps.voiceClient === null) return null;
    try {
      await this.deps.voiceClient.hangUp(callId);
      return null;
    } catch (error) {
      return errorText(error);
    }
  }

  private log(entry: { event: 'call_start' | 'call_end'; sessionId: string; callId: string | null; voice: string; seconds: number; error: string | null }): void {
    const costUsd = (entry.seconds / 60) * this.deps.catalog.call.pricePerMinute;
    this.deps.logger.voice({ ...entry, costUsd });
  }
}

function callVoice(voice: CatalogVoice, dialect: DialectStyle): CallVoice {
  if (voice.sound.kind === 'builtIn') return { kind: 'builtIn', name: voice.sound.name };
  return {
    kind: 'designed',
    key: voice.id,
    name: `Atlas ${dialect.label} ${voice.gender}`,
    prompt: voice.sound.description,
    script: dialect.designScript ?? dialect.hello,
  };
}

function errorText(error: unknown): string {
  if (error instanceof AppError) return `${error.code}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

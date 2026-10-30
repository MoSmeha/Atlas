import type { CallDiagnosis } from '@atlas/shared';
import { type AudioLevels, silence } from '../../api/audioMeter';
import type { LiveConnection } from '../../api/liveCall';
import type { LiveCommand, LiveEvent } from '../../api/liveEvents';
import type { TurnEnd } from '../chat/ChatContext';
import { errorMessage } from '../errors/errorCopy';
import { spokenUpdates } from './callCopy';
import { type Fragment, joinQuestion, latestUtterance, startsNewTurn, wordsBetween } from './callTranscript';

export type CallStatus = 'connecting' | 'live' | 'ending' | 'ended';
export type CallActivity = 'listening' | 'hearing' | 'thinking' | 'speaking';
/** Why a call ended: the user hung up, silence, the length limit, a broken connection, the service, or a start that failed. */
export type EndReason = 'hung_up' | 'idle' | 'limit' | 'dropped' | 'content' | 'failed';
/**
 * Why Atlas may not be hearing the user: the microphone gives no sound at all, or it picks up speech but not one word
 * of it has reached the call.
 */
export type MicTrouble = 'silent' | 'unheard';

/** What the call card shows. */
export interface CallView {
  status: CallStatus;
  activity: CallActivity;
  muted: boolean;
  /** Whole seconds since the call started, or its final length once it ended. */
  seconds: number;
  /** The user's latest utterance and Atlas's, as the call transcribes them. */
  userCaption: string;
  atlasCaption: string;
  lastSpeaker: 'user' | 'atlas' | null;
  /** A question from this call is being answered in the chat. */
  busy: boolean;
  endReason: EndReason | null;
  micTrouble: MicTrouble | null;
}

/** The chat as a call uses it: every question it hands over is asked as a spoken turn. */
export interface CallChat {
  ask(question: string): Promise<TurnEnd>;
  stop(): void;
  noteSaid(turnId: string, text: string): void;
}

export interface CallLimits {
  /** With no speech and no running question for this long, the call ends. */
  idleMs: number;
  maxMs: number;
}

export interface CallOutcome {
  callId: string | null;
  seconds: number;
  /** The voice service confirmed the end; otherwise the server hangs the call up. */
  confirmed: boolean;
  /** What the call measured about its audio; null when it never connected. */
  diagnosis: CallDiagnosis | null;
}

const TICK_MS = 150;
/** Loudness above which a side counts as speaking, and how long that lasts after the sound drops. */
const SPEAKING_LEVEL = 0.05;
const HEARING_LEVEL = 0.07;
const LEVEL_HOLD_MS = 350;
/** After a hand-off, transcript pieces still arriving are waited for until this much quiet, or at most this long. */
const SETTLE_QUIET_MS = 350;
const SETTLE_MAX_MS = 1_200;
/** A question still running after this long gets one spoken "still checking". */
const STILL_WORKING_MS = 12_000;
const CLOSE_WAIT_MS = 8_000;
/** The microphone is checked for total silence once the call has been live this long, so its first readings are in. */
const SILENT_CHECK_MS = 6_000;
/** Speech the microphone picks up for this long in all, with no word of it reaching the call, means Atlas cannot hear. */
const UNHEARD_MS = 5_000;
/** A rejected result is sent again once, this short. */
const RETRY_CHARS = 600;

interface Asking {
  delegationId: string;
  question: string;
  /** A newer request took over; this one's outcome is not said. */
  replaced: boolean;
}

interface SentResult {
  turnId: string;
  content: string;
  retried: boolean;
}

interface Reply {
  turnId: string;
  /** Atlas's speech from here on is about this turn's answer. */
  fromMs: number;
  atlasEndMs: number;
}

/**
 * One voice call. GPT-Live listens and speaks; whenever it hands a request over, the call works out the question from
 * what the user said, asks it in the chat like a typed question, and sends back the checked answer's spoken text for
 * the voice to say. What Atlas then says is kept with that answer.
 */
export class CallSession {
  /** Settles once the call has ended, however it ended. */
  readonly ended: Promise<CallOutcome>;
  private readonly chat: CallChat;
  private readonly limits: CallLimits;
  private readonly now: () => number;
  private readonly listeners = new Set<() => void>();
  private readonly fragments: Fragment[] = [];
  private readonly results = new Map<string, SentResult>();
  private view: CallView = {
    status: 'connecting',
    activity: 'listening',
    muted: false,
    seconds: 0,
    userCaption: '',
    atlasCaption: '',
    lastSpeaker: null,
    busy: false,
    endReason: null,
    micTrouble: null,
  };
  private connection: LiveConnection | null = null;
  private resolveEnded: (outcome: CallOutcome) => void = () => undefined;
  private ending = false;
  private started = false;
  private greeted = false;
  private startedAt: number | null = null;
  private billedSeconds = 0;
  private lastActivityAt: number;
  private lastUserPieceAt = Number.NEGATIVE_INFINITY;
  private heardVoiceAt = Number.NEGATIVE_INFINITY;
  private heardMicAt = Number.NEGATIVE_INFINITY;
  /** Some of the user's words have reached the call, so their audio gets through. */
  private heardUser = false;
  /** How long the microphone has picked up speech while none of the user's words reached the call. */
  private unheardMs = 0;
  /** The user's words before this point on the call's timeline were part of an earlier question. */
  private consumedMs = 0;
  private asking: Asking | null = null;
  private reply: Reply | null = null;
  private nextEventId = 0;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(chat: CallChat, limits: CallLimits, now: () => number = () => performance.now()) {
    this.chat = chat;
    this.limits = limits;
    this.now = now;
    this.lastActivityAt = now();
    this.ended = new Promise((resolve) => {
      this.resolveEnded = resolve;
    });
  }

  /** The connection the call runs on, once it is open. */
  attach(connection: LiveConnection): void {
    this.connection = connection;
    if (this.ending) return connection.dispose();
    if (this.started) this.greet();
  }

  snapshot(): CallView {
    return this.view;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  levels(): AudioLevels {
    return this.view.status === 'live' ? (this.connection?.levels() ?? silence) : silence;
  }

  handle(event: LiveEvent): void {
    if (this.view.status === 'ended') return;
    switch (event.type) {
      case 'session.started':
        return this.begin();
      case 'session.input_transcript.delta':
        return this.heard({ speaker: 'user', text: event.delta, startMs: event.start_ms, endMs: event.end_ms });
      case 'session.output_transcript.delta':
        return this.heard({ speaker: 'atlas', text: event.delta, startMs: event.start_ms, endMs: event.end_ms });
      case 'session.delegation.created':
        if (event.delegation.target === 'client') void this.handOver(event.delegation.id, event.offset_ms);
        return;
      case 'session.commentary.appended':
        return this.resultReached(event.client_event_id, event.start_ms);
      case 'session.usage.updated':
        this.billedSeconds = event.usage.seconds;
        return;
      case 'session.closed':
        return this.closedByService(event.reason, event.usage.seconds);
      case 'error':
        return this.refused(event.error.client_event_id, event.error.message);
    }
  }

  /** The connection broke before the call ended. */
  dropped(): void {
    this.closedByService('connection_lost', null);
  }

  setMuted(muted: boolean): void {
    if (this.connection === null || this.view.status !== 'live' || this.view.muted === muted) return;
    this.connection.setMicEnabled(!muted);
    this.send({ type: muted ? 'session.input_audio.mute' : 'session.input_audio.unmute', event_id: this.eventId('mute') });
    this.update({ muted });
  }

  /** Stops the question the call is answering; the call itself goes on. */
  stopQuestion(): void {
    if (this.asking !== null) this.chat.stop();
  }

  /** Ends the call and waits for its final length. Calling it again, or after the service ended it, changes nothing. */
  end(reason: EndReason): Promise<CallOutcome> {
    if (this.ending) return this.ended;
    this.ending = true;
    this.update({ status: 'ending', endReason: reason });
    const connection = this.connection;
    if (connection === null) this.finish(null);
    else void connection.close(CLOSE_WAIT_MS).then((seconds) => this.finish(seconds));
    return this.ended;
  }

  private begin(): void {
    if (this.started) return;
    this.started = true;
    this.startedAt = this.now();
    this.lastActivityAt = this.startedAt;
    this.update({ status: 'live' });
    this.timer = setInterval(() => this.tick(), TICK_MS);
    if (this.connection !== null) this.greet();
  }

  private greet(): void {
    if (this.greeted || this.connection === null) return;
    this.greeted = true;
    this.say(null, this.connection.greeting);
  }

  private heard(piece: Fragment): void {
    this.fragments.push(piece);
    this.lastActivityAt = this.now();
    const reply = this.reply;
    if (piece.speaker === 'user') {
      this.lastUserPieceAt = this.now();
      this.heardUser = true;
      if (this.view.micTrouble === 'unheard') this.update({ micTrouble: null });
      if (reply !== null && startsNewTurn(piece, reply.atlasEndMs)) this.reply = null;
    } else if (reply !== null && piece.startMs >= reply.fromMs) {
      this.chat.noteSaid(reply.turnId, piece.text);
      reply.atlasEndMs = Math.max(reply.atlasEndMs, piece.endMs);
    }
    this.update({
      userCaption: latestUtterance(this.fragments, 'user'),
      atlasCaption: latestUtterance(this.fragments, 'atlas'),
      lastSpeaker: piece.speaker,
    });
  }

  /** GPT-Live handed a request over: ask it in the chat, then send back what to say. */
  private async handOver(delegationId: string, offsetMs: number): Promise<void> {
    this.lastActivityAt = this.now();
    this.reply = null;
    await this.settle();
    if (this.ending) return;
    let words = wordsBetween(this.fragments, 'user', this.consumedMs, offsetMs);
    // The transcript can lag behind the hand-off; then the newest words are the request.
    if (words === '') words = wordsBetween(this.fragments, 'user', this.consumedMs);
    this.consumedMs = Math.max(this.consumedMs, offsetMs);

    const earlier = this.asking;
    if (earlier !== null) {
      // A correction or an addition while the answer is still coming: one new question replaces the old one.
      earlier.replaced = true;
      this.chat.stop();
    }
    const question = joinQuestion(earlier?.question ?? null, words);
    if (question === '') {
      this.say(delegationId, spokenUpdates.didNotCatch);
      return;
    }

    const asking: Asking = { delegationId, question, replaced: false };
    this.asking = asking;
    this.update({ busy: true });
    const slow = setTimeout(() => {
      if (!asking.replaced && !this.ending) this.say(delegationId, spokenUpdates.stillWorking);
    }, STILL_WORKING_MS);
    const end = await this.chat.ask(question);
    clearTimeout(slow);
    if (asking.replaced) return;
    this.asking = null;
    this.update({ busy: false });
    if (this.ending) return;
    switch (end.status) {
      case 'done':
        return this.sayResult(delegationId, end.turnId, end.speech ?? end.answer.markdown);
      case 'error':
        return void this.say(delegationId, spokenUpdates.failed(errorMessage(end.error)));
      case 'stopped':
        return this.think(delegationId, spokenUpdates.stopped);
      case 'busy':
        return void this.say(delegationId, spokenUpdates.busy);
    }
  }

  /** Waits until the user's transcript has been quiet for a moment, so the last words of the request are in. */
  private async settle(): Promise<void> {
    const start = this.now();
    while (this.now() - start < SETTLE_MAX_MS && this.now() - this.lastUserPieceAt < SETTLE_QUIET_MS) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  private sayResult(delegationId: string, turnId: string, content: string): void {
    const eventId = this.say(delegationId, content);
    this.results.set(eventId, { turnId, content, retried: false });
  }

  /** A result reached the voice: what Atlas says from `startMs` on belongs to that turn, including speech already in. */
  private resultReached(eventId: string | undefined, startMs: number): void {
    const result = eventId === undefined ? undefined : this.results.get(eventId);
    if (result === undefined) return;
    this.results.delete(eventId ?? '');
    // Joined as sent, spaces and all, since the pieces that follow are added to it.
    const said = this.fragments
      .filter((piece) => piece.speaker === 'atlas' && piece.startMs >= startMs)
      .map((piece) => piece.text)
      .join('');
    if (said.trim() !== '') this.chat.noteSaid(result.turnId, said);
    const lastAtlas = this.fragments.filter((piece) => piece.speaker === 'atlas').at(-1);
    this.reply = { turnId: result.turnId, fromMs: startMs, atlasEndMs: Math.max(startMs, lastAtlas?.endMs ?? 0) };
  }

  /** A command was refused. A refused result is sent once more, shorter and as general context. */
  private refused(eventId: string | undefined, message: string): void {
    console.warn('The voice call refused a command', eventId, message);
    const result = eventId === undefined ? undefined : this.results.get(eventId);
    if (result === undefined || result.retried) return;
    this.results.delete(eventId ?? '');
    const content = result.content.length > RETRY_CHARS ? `${result.content.slice(0, RETRY_CHARS - 1)}…` : result.content;
    const retryId = this.say(null, content);
    this.results.set(retryId, { turnId: result.turnId, content, retried: true });
  }

  private closedByService(reason: string, seconds: number | null): void {
    if (this.ending) return;
    this.ending = true;
    const endReason: EndReason = reason === 'expired' ? 'limit' : reason === 'content' ? 'content' : reason === 'remote_hangup' ? 'hung_up' : 'dropped';
    this.update({ status: 'ending', endReason });
    this.connection?.dispose();
    this.finish(seconds);
  }

  private finish(finalSeconds: number | null): void {
    clearInterval(this.timer);
    const seconds = finalSeconds ?? Math.max(this.billedSeconds, this.elapsedSeconds());
    this.update({ status: 'ended', seconds: Math.round(seconds), activity: 'listening' });
    this.resolveEnded({
      callId: this.connection?.callId ?? null,
      seconds,
      confirmed: finalSeconds !== null,
      diagnosis: this.connection?.diagnosis() ?? null,
    });
  }

  private tick(): void {
    if (this.view.status !== 'live') return;
    const now = this.now();
    const levels = this.levels();
    if (levels.voice > SPEAKING_LEVEL) this.heardVoiceAt = now;
    if (!this.view.muted && levels.mic > HEARING_LEVEL) this.heardMicAt = now;
    if (this.view.busy) this.lastActivityAt = now;
    const activity: CallActivity =
      now - this.heardVoiceAt < LEVEL_HOLD_MS
        ? 'speaking'
        : now - this.heardMicAt < LEVEL_HOLD_MS
          ? 'hearing'
          : this.view.busy
            ? 'thinking'
            : 'listening';
    this.update({ activity, seconds: Math.floor(this.elapsedSeconds()), micTrouble: this.micTrouble(activity) });
    if (now - this.lastActivityAt >= this.limits.idleMs) void this.end('idle');
    else if (this.elapsedSeconds() * 1000 >= this.limits.maxMs) void this.end('limit');
  }

  /**
   * Whether Atlas may not be hearing the user, worked out each tick. Speech counts only while the user is not muted and
   * Atlas is not speaking, and once any of their words has reached the call it never counts again.
   */
  private micTrouble(activity: CallActivity): MicTrouble | null {
    if (this.view.muted || this.connection === null) return this.view.micTrouble;
    if (this.elapsedSeconds() * 1000 >= SILENT_CHECK_MS && this.connection.micSilent()) return 'silent';
    if (this.heardUser) return null;
    if (activity === 'hearing') this.unheardMs += TICK_MS;
    return this.unheardMs >= UNHEARD_MS ? 'unheard' : null;
  }

  private elapsedSeconds(): number {
    return this.startedAt === null ? 0 : Math.max(0, (this.now() - this.startedAt) / 1000);
  }

  private say(delegationId: string | null, content: string): string {
    const eventId = this.eventId('say');
    this.send({ type: 'session.commentary.append', event_id: eventId, delegation_id: delegationId, content });
    return eventId;
  }

  private think(delegationId: string | null, content: string): void {
    this.send({ type: 'session.thinking.append', event_id: this.eventId('think'), delegation_id: delegationId, content });
  }

  private send(command: LiveCommand): void {
    if (this.view.status === 'live') this.connection?.send(command);
  }

  private eventId(kind: string): string {
    this.nextEventId += 1;
    return `${kind}_${this.nextEventId}`;
  }

  private update(patch: Partial<CallView>): void {
    const next = { ...this.view, ...patch };
    const keys = Object.keys(patch) as (keyof CallView)[];
    if (keys.every((key) => next[key] === this.view[key])) return;
    this.view = next;
    for (const listener of this.listeners) listener();
  }
}

import type { CallDiagnosis, CallStartup } from '@atlas/shared';

const MAX_NOTES = 10;
const NOTE_CHARS = 300;
const TYPE_CHARS = 80;

/** The parts of the peer connection a reading needs, so tests can stand in for it. */
export type StatsSource = Pick<RTCPeerConnection, 'getStats' | 'getTransceivers'>;

/** Service events that mark a step of the start the first time one arrives. */
const STARTUP_EVENTS: Partial<Record<string, keyof CallStartup>> = {
  'session.started': 'started',
  'session.output_transcript.delta': 'firstWord',
};

/**
 * What a call's connection saw, kept for the call log: each event type the service sent, its errors and notices, the
 * loudest the microphone got, how the browser sent the microphone's audio, and how long each step of the start took.
 * When Atlas cannot hear the user, it shows where the sound stopped: at the microphone, in the browser, or at the
 * service; when Atlas is slow to speak, it shows which step held it up.
 */
export class CallDiagnostics {
  private readonly events: Record<string, number> = {};
  private readonly notes: string[] = [];
  private readonly now: () => number;
  /** When Call was pressed. */
  private readonly startedAt: number;
  private readonly startup: CallStartup = { microphone: null, offer: null, answer: null, started: null, firstWord: null };
  private micPeak = 0;
  private micEnergy: number | null = null;
  private packetsSent: number | null = null;
  private direction: string | null = null;
  private answerDtx: boolean | null = null;

  /** Made as Call is pressed: each step of the start is timed from here. */
  constructor(now: () => number = () => performance.now()) {
    this.now = now;
    this.startedAt = now();
  }

  /** Marks a step of the start the first time it is reached. */
  noteStep(step: keyof CallStartup): void {
    this.startup[step] ??= Math.max(0, Math.round(this.now() - this.startedAt));
  }

  /** Whether the service's answer had asked for Opus DTX, which the call turns off. */
  noteAnswer(dtx: boolean): void {
    this.answerDtx = dtx;
  }

  /** Counts one event channel message by its type, and keeps the text of the service's errors and notices. */
  noteEvent(data: unknown): void {
    const json = readJson(data);
    const type = typeof json?.type === 'string' ? json.type.slice(0, TYPE_CHARS) : 'unreadable';
    this.events[type] = (this.events[type] ?? 0) + 1;
    const step = STARTUP_EVENTS[type];
    if (step !== undefined) this.noteStep(step);
    if ((type === 'error' || type === 'info') && this.notes.length < MAX_NOTES) {
      const detail = type === 'error' && typeof json?.error === 'object' && json.error !== null ? (json.error as Record<string, unknown>) : json;
      this.notes.push(`${type} ${String(detail?.code ?? '')}: ${String(detail?.message ?? '')}`.slice(0, NOTE_CHARS));
    }
  }

  noteMicLevel(level: number): void {
    if (level > this.micPeak) this.micPeak = Math.min(1, level);
  }

  /** Reads the agreed audio direction and the microphone's sent packets and energy from the connection. */
  async sample(peer: StatsSource): Promise<void> {
    const sender = peer.getTransceivers().find((transceiver) => transceiver.sender.track?.kind === 'audio');
    this.direction = sender?.currentDirection ?? null;
    const stats = await peer.getStats();
    stats.forEach((report: { type?: string; kind?: string; packetsSent?: number; totalAudioEnergy?: number }) => {
      if (report.kind !== 'audio') return;
      if (report.type === 'outbound-rtp' && typeof report.packetsSent === 'number') this.packetsSent = report.packetsSent;
      if (report.type === 'media-source' && typeof report.totalAudioEnergy === 'number') this.micEnergy = report.totalAudioEnergy;
    });
  }

  /** The browser has read the microphone's audio and it was pure digital silence, as from a blocked device. */
  sentSilence(): boolean {
    return this.micEnergy === 0;
  }

  report(mic: MediaStreamTrack | null): CallDiagnosis {
    return {
      micLabel: (mic?.label ?? '').slice(0, 200),
      micState: mic === null ? 'none' : mic.readyState === 'ended' ? 'ended' : mic.muted ? 'muted' : 'live',
      micPeak: Math.round(this.micPeak * 1000) / 1000,
      micEnergy: this.micEnergy,
      packetsSent: this.packetsSent,
      direction: this.direction?.slice(0, 20) ?? null,
      answerDtx: this.answerDtx,
      events: { ...this.events },
      notes: [...this.notes],
      startup: { ...this.startup },
    };
  }
}

function readJson(data: unknown): Record<string, unknown> | null {
  if (typeof data !== 'string') return null;
  try {
    const json: unknown = JSON.parse(data);
    return typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

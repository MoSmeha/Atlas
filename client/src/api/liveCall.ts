import type { CallDiagnosis } from '@atlas/shared';
import { type AudioLevels, AudioMeter } from './audioMeter';
import { CallDiagnostics } from './CallDiagnostics';
import { api } from './endpoints';
import { type LiveCommand, type LiveEvent, parseLiveEvent } from './liveEvents';
import { closeMicrophone, openMicrophone } from './microphone';

/** An open voice call: Atlas's voice plays on its own, events arrive through `onEvent`. */
export interface LiveConnection {
  readonly callId: string;
  /** What Atlas is told to say first, sent once the call has started. */
  readonly greeting: string;
  send(command: LiveCommand): void;
  /** Turns the microphone track on or off; the call keeps running. */
  setMicEnabled(enabled: boolean): void;
  levels(): AudioLevels;
  /** The microphone gives the call no sound at all: its track is muted or ended, or what it sent was pure silence. */
  micSilent(): boolean;
  /** What the call measured about its audio so far, for the call log; after dispose, as it was at that moment. */
  diagnosis(): CallDiagnosis;
  /** Ends the call and waits for its final length in seconds; null when the end was not confirmed in time. */
  close(timeoutMs: number): Promise<number | null>;
  /** Lets go of the microphone, the audio and the connection at once. */
  dispose(): void;
}

export interface OpenCallOptions {
  sessionId: string;
  voiceId: string;
  onEvent(event: LiveEvent): void;
  /** The connection broke while the call was open. */
  onDropped(): void;
}

/** The event channel's name, which GPT-Live expects. */
const CHANNEL = 'oai-events';
/** Host candidates gather in well under a second; the offer goes with what there is after this long. */
const ICE_WAIT_MS = 4_000;
/** How often the call reads how its microphone audio is being sent. */
const STATS_MS = 2_000;

/**
 * Opens the microphone and connects to GPT-Live over WebRTC: the browser makes an offer, the Atlas server exchanges it
 * for an answer with the API key, which never reaches the browser. The call has started once `session.started` arrives
 * through `onEvent`. Throws MicrophoneError when the microphone cannot be used, and ApiError when the server refuses.
 */
export async function openLiveCall(options: OpenCallOptions): Promise<LiveConnection> {
  // Created before the first await, while the click that started the call still lets audio run.
  const meter = new AudioMeter();
  const audio = new Audio();
  audio.autoplay = true;
  const diagnostics = new CallDiagnostics();
  let microphone: MediaStream | null = null;
  let peer: RTCPeerConnection | null = null;
  let channel: RTCDataChannel | null = null;
  let sampler: ReturnType<typeof setInterval> | undefined;
  let final: CallDiagnosis | null = null;
  let ending = false;
  let disposed = false;
  let onClosed: ((seconds: number) => void) | null = null;

  const micTrack = () => microphone?.getAudioTracks()[0] ?? null;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    // Read before the microphone is released, which ends its track.
    final = diagnostics.report(micTrack());
    clearInterval(sampler);
    channel?.close();
    peer?.close();
    closeMicrophone(microphone);
    audio.srcObject = null;
    meter.close();
  };
  const dropped = () => {
    if (!ending && !disposed) options.onDropped();
  };

  try {
    microphone = await openMicrophone();
    meter.listenToMic(microphone);
    peer = new RTCPeerConnection();
    peer.addEventListener('track', (event) => {
      const stream = new MediaStream([event.track]);
      audio.srcObject = stream;
      void audio.play().catch(() => undefined);
      meter.listenToVoice(stream);
    });
    peer.addEventListener('connectionstatechange', () => {
      if (peer?.connectionState === 'failed') dropped();
    });
    for (const track of microphone.getAudioTracks()) peer.addTrack(track, microphone);

    channel = peer.createDataChannel(CHANNEL);
    channel.addEventListener('message', ({ data }) => {
      diagnostics.noteEvent(data);
      const event = parseLiveEvent(data);
      if (event === null) return;
      if (event.type === 'session.closed') onClosed?.(event.usage.seconds);
      options.onEvent(event);
    });
    channel.addEventListener('close', dropped);

    await peer.setLocalDescription(await peer.createOffer());
    await iceGathered(peer, ICE_WAIT_MS);
    const offer = peer.localDescription?.sdp;
    if (offer === undefined || offer === '') throw new Error('The browser could not prepare the call.');
    const started = await api.startCall({ sessionId: options.sessionId, voiceId: options.voiceId, sdp: offer });
    await peer.setRemoteDescription({ type: 'answer', sdp: started.sdp });

    const open = channel;
    const mic = microphone;
    const connected = peer;
    sampler = setInterval(() => void diagnostics.sample(connected).catch(() => undefined), STATS_MS);
    return {
      callId: started.callId,
      greeting: started.greeting,
      send: (command) => {
        if (open.readyState === 'open') open.send(JSON.stringify(command));
      },
      setMicEnabled: (enabled) => {
        for (const track of mic.getAudioTracks()) track.enabled = enabled;
      },
      levels: () => {
        const levels = meter.levels();
        diagnostics.noteMicLevel(levels.mic);
        return levels;
      },
      micSilent: () => {
        const track = micTrack();
        return track === null || track.readyState === 'ended' || track.muted || diagnostics.sentSilence();
      },
      diagnosis: () => final ?? diagnostics.report(micTrack()),
      close: (timeoutMs) =>
        new Promise<number | null>((resolve) => {
          ending = true;
          let timer: ReturnType<typeof setTimeout> | undefined;
          const finish = (seconds: number | null) => {
            clearTimeout(timer);
            onClosed = null;
            dispose();
            resolve(seconds);
          };
          if (open.readyState !== 'open') return finish(null);
          onClosed = finish;
          timer = setTimeout(() => finish(null), timeoutMs);
          // Media and events stay up until session.closed, so work still in flight can finish.
          open.send(JSON.stringify({ type: 'session.close', event_id: 'close' } satisfies LiveCommand));
        }),
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

/** Waits until the browser has gathered its connection candidates, or `timeoutMs` passes. */
function iceGathered(peer: RTCPeerConnection, timeoutMs: number): Promise<void> {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      peer.removeEventListener('icegatheringstatechange', check);
      resolve();
    };
    const check = () => {
      if (peer.iceGatheringState === 'complete') done();
    };
    const timer = setTimeout(done, timeoutMs);
    peer.addEventListener('icegatheringstatechange', check);
  });
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AudioMeter } from './audioMeter';
import { api } from './endpoints';
import { closeMicrophone, openMicrophone } from './microphone';
import { queryKeys } from './queryKeys';

export type DictationPhase = 'idle' | 'starting' | 'recording' | 'transcribing';

export interface DictationOptions {
  sessionId: string;
  /** Recording stops and is sent on its own after this long. */
  maxSeconds: number;
  /** The words the recording turned into, ready to edit. */
  onText(text: string): void;
  onError(error: unknown): void;
}

interface Recording {
  recorder: MediaRecorder;
  stream: MediaStream;
  meter: AudioMeter;
  chunks: Blob[];
  startedAt: number;
  limit: ReturnType<typeof setTimeout> | undefined;
  /** False once cancelled: the recording is thrown away when it stops. */
  send: boolean;
}

/** Recording formats the transcription accepts, in order of preference; browsers support different ones. */
const FORMATS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
/** A click on the microphone and straight off again records nothing worth sending. */
const MIN_RECORDING_MS = 400;

/**
 * Dictation for the question box: start records from the microphone, finish sends the recording to be written down,
 * cancel throws it away. The text goes to onText; the chat's usage refreshes, since dictation is billed.
 */
export function useDictation(options: DictationOptions) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<DictationPhase>('idle');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const recording = useRef<Recording | null>(null);
  const upload = useRef<AbortController | null>(null);
  const latest = useRef(options);

  useEffect(() => {
    latest.current = options;
  });

  const deliver = useCallback(
    async (current: Recording) => {
      release(current);
      if (recording.current === current) recording.current = null;
      setStartedAt(null);
      const recordedMs = performance.now() - current.startedAt;
      const audio = new Blob(current.chunks, { type: current.recorder.mimeType || 'audio/webm' });
      if (!current.send || recordedMs < MIN_RECORDING_MS || audio.size === 0) {
        setPhase('idle');
        return;
      }
      setPhase('transcribing');
      const controller = new AbortController();
      upload.current = controller;
      const { sessionId } = latest.current;
      try {
        const result = await api.transcribe(sessionId, audio, recordedMs, controller.signal);
        if (result.text !== '') latest.current.onText(result.text);
        void queryClient.invalidateQueries({ queryKey: queryKeys.usage(sessionId) });
      } catch (error) {
        if (!controller.signal.aborted) latest.current.onError(error);
      } finally {
        if (upload.current === controller) upload.current = null;
        setPhase('idle');
      }
    },
    [queryClient],
  );

  const finish = useCallback(() => {
    const current = recording.current;
    if (current && current.recorder.state !== 'inactive') current.recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (recording.current || upload.current) return;
    setPhase('starting');
    const meter = new AudioMeter();
    let stream: MediaStream | null = null;
    try {
      stream = await openMicrophone();
      meter.listenToMic(stream);
      const mimeType = FORMATS.find((format) => MediaRecorder.isTypeSupported(format));
      const recorder = new MediaRecorder(stream, mimeType === undefined ? undefined : { mimeType });
      const current: Recording = { recorder, stream, meter, chunks: [], startedAt: performance.now(), limit: undefined, send: true };
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) current.chunks.push(event.data);
      });
      recorder.addEventListener('stop', () => void deliver(current));
      recorder.start();
      current.limit = setTimeout(finish, latest.current.maxSeconds * 1000);
      recording.current = current;
      setStartedAt(Date.now());
      setPhase('recording');
    } catch (error) {
      closeMicrophone(stream);
      meter.close();
      setPhase('idle');
      latest.current.onError(error);
    }
  }, [deliver, finish]);

  const cancel = useCallback(() => {
    upload.current?.abort();
    const current = recording.current;
    if (current === null) return;
    current.send = false;
    if (current.recorder.state !== 'inactive') current.recorder.stop();
  }, []);

  /** The microphone's loudness while recording, from 0 to 1, for the level bars. */
  const level = useCallback(() => recording.current?.meter.levels().mic ?? 0, []);

  useEffect(
    () => () => {
      upload.current?.abort();
      const current = recording.current;
      if (current === null) return;
      current.send = false;
      if (current.recorder.state !== 'inactive') current.recorder.stop();
      release(current);
    },
    [],
  );

  return { phase, startedAt, start, finish, cancel, level };
}

function release(current: Recording): void {
  clearTimeout(current.limit);
  closeMicrophone(current.stream);
  current.meter.close();
}

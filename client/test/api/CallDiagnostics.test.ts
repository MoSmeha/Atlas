import { describe, expect, it } from 'vitest';
import { CallDiagnostics, type StatsSource } from '../../src/api/CallDiagnostics';

/** A peer connection's statistics as Chromium reports them for a call sending one microphone track. */
function peerSending(stats: { packetsSent: number; totalAudioEnergy: number }, direction: RTCRtpTransceiverDirection | null): StatsSource {
  const reports = new Map<string, unknown>([
    ['OT01', { type: 'outbound-rtp', kind: 'audio', packetsSent: stats.packetsSent }],
    ['SA01', { type: 'media-source', kind: 'audio', totalAudioEnergy: stats.totalAudioEnergy }],
    ['IT01', { type: 'inbound-rtp', kind: 'audio', packetsReceived: 900 }],
  ]);
  return {
    getStats: async () => reports as unknown as RTCStatsReport,
    getTransceivers: () => [{ sender: { track: { kind: 'audio' } }, currentDirection: direction } as unknown as RTCRtpTransceiver],
  };
}

const track = (state: { muted?: boolean; ended?: boolean } = {}) =>
  ({ label: 'Microphone Array (Realtek)', muted: state.muted ?? false, readyState: state.ended ? 'ended' : 'live' }) as MediaStreamTrack;

describe('CallDiagnostics', () => {
  it("counts the service's events by type and keeps its errors and notices", () => {
    const diagnostics = new CallDiagnostics();
    diagnostics.noteEvent(JSON.stringify({ type: 'session.started' }));
    diagnostics.noteEvent(JSON.stringify({ type: 'session.output_transcript.delta', delta: 'Hi' }));
    diagnostics.noteEvent(JSON.stringify({ type: 'session.output_transcript.delta', delta: ' there' }));
    diagnostics.noteEvent(JSON.stringify({ type: 'error', error: { code: 'invalid_event', message: 'Not allowed.' } }));
    diagnostics.noteEvent(JSON.stringify({ type: 'info', code: 'input_muted', message: 'Input audio is muted.' }));
    diagnostics.noteEvent('not json');

    const report = diagnostics.report(track());

    expect(report.events).toEqual({
      'session.started': 1,
      'session.output_transcript.delta': 2,
      error: 1,
      info: 1,
      unreadable: 1,
    });
    expect(report.notes).toEqual(['error invalid_event: Not allowed.', 'info input_muted: Input audio is muted.']);
  });

  it('reads how the microphone audio was sent, and the loudest the microphone got', async () => {
    const diagnostics = new CallDiagnostics();
    diagnostics.noteAnswer(true);
    diagnostics.noteMicLevel(0.12);
    diagnostics.noteMicLevel(0.4567);
    diagnostics.noteMicLevel(0.2);

    await diagnostics.sample(peerSending({ packetsSent: 1400, totalAudioEnergy: 1.25 }, 'sendrecv'));

    expect(diagnostics.report(track())).toEqual({
      micLabel: 'Microphone Array (Realtek)',
      micState: 'live',
      micPeak: 0.457,
      micEnergy: 1.25,
      packetsSent: 1400,
      direction: 'sendrecv',
      answerDtx: true,
      events: {},
      notes: [],
    });
    expect(diagnostics.sentSilence()).toBe(false);
  });

  it('tells pure digital silence from a reading not taken yet', async () => {
    const diagnostics = new CallDiagnostics();
    expect(diagnostics.sentSilence()).toBe(false);

    await diagnostics.sample(peerSending({ packetsSent: 300, totalAudioEnergy: 0 }, 'sendrecv'));

    expect(diagnostics.sentSilence()).toBe(true);
  });

  it('names a muted, ended or missing microphone, and a direction never agreed', async () => {
    const diagnostics = new CallDiagnostics();
    await diagnostics.sample(peerSending({ packetsSent: 0, totalAudioEnergy: 0 }, null));

    expect(diagnostics.report(track({ muted: true })).micState).toBe('muted');
    expect(diagnostics.report(track({ ended: true })).micState).toBe('ended');
    expect(diagnostics.report(null)).toMatchObject({ micState: 'none', micLabel: '', direction: null, answerDtx: null });
  });
});

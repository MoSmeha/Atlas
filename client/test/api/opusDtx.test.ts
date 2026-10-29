import { describe, expect, it } from 'vitest';
import { turnOffDtx } from '../../src/api/opusDtx';

/** An answer as a WebRTC service sends it: CRLF lines, Opus and telephone events. */
const answer = (opusParams: string) =>
  [
    'v=0',
    'm=audio 9 UDP/TLS/RTP/SAVPF 111 126',
    'a=rtpmap:111 opus/48000/2',
    `a=fmtp:111 ${opusParams}`,
    'a=rtpmap:126 telephone-event/8000',
    'a=fmtp:126 0-15',
    '',
  ].join('\r\n');

describe('turnOffDtx', () => {
  it("turns off the DTX the service's answer asked for, keeping Opus's other settings", () => {
    const result = turnOffDtx(answer('minptime=10;useinbandfec=1;usedtx=1'));

    expect(result.dtx).toBe(true);
    expect(result.sdp).toBe(answer('minptime=10;useinbandfec=1;usedtx=0'));
  });

  it('says DTX off outright when the answer did not mention it', () => {
    const result = turnOffDtx(answer('minptime=10;useinbandfec=1'));

    expect(result.dtx).toBe(false);
    expect(result.sdp).toBe(answer('minptime=10;useinbandfec=1;usedtx=0'));
  });

  it('leaves other codecs alone and an answer without Opus unchanged', () => {
    expect(turnOffDtx(answer('usedtx=1')).sdp).toContain('a=fmtp:126 0-15\r\n');
    const pcmu = 'v=0\r\na=rtpmap:0 PCMU/8000\r\na=fmtp:0 usedtx=1\r\n';
    expect(turnOffDtx(pcmu)).toEqual({ sdp: pcmu, dtx: false });
  });
});

/** A call's answer as the browser applies it. */
export interface CallAnswer {
  sdp: string;
  /** The service's answer had let the browser stop sending audio in silence (Opus DTX). */
  dtx: boolean;
}

/**
 * GPT-Live's clock runs on the microphone audio it receives: while none arrives it cannot hear the user stop talking,
 * so it neither answers nor finishes their transcript. With Opus DTX the browser sends next to nothing in silence, so
 * the answer is changed to turn DTX off, and the browser sends audio all the time, silence included.
 */
export function turnOffDtx(answer: string): CallAnswer {
  const opus = new Set([...answer.matchAll(/^a=rtpmap:(\d+) opus\//gim)].map((match) => match[1]));
  let dtx = false;
  const sdp = answer.replace(/^a=fmtp:(\d+) ([^\r\n]*)/gm, (line, type: string, params: string) => {
    if (!opus.has(type)) return line;
    const kept = params.split(';').filter((param) => {
      const [name = '', value = ''] = param.split('=').map((part) => part.trim());
      if (name.toLowerCase() !== 'usedtx') return name !== '';
      if (value === '1') dtx = true;
      return false;
    });
    return `a=fmtp:${type} ${[...kept, 'usedtx=0'].join(';')}`;
  });
  return { sdp, dtx };
}

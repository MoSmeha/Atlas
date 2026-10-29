import { z } from 'zod';
import {
  EndCallRequest,
  routes,
  StartCallRequest,
  StartCallResponse,
  TranscriptionResponse,
  VoicesResponse,
} from '@atlas/shared';
import { errors } from '../../application/errors';
import type { TranscribeSpeech } from '../../application/voice/TranscribeSpeech';
import { type VoiceCatalog, voiceOptions } from '../../application/voice/VoiceCatalog';
import type { VoiceCalls } from '../../application/voice/VoiceCalls';
import type { RoutePlugin } from '../zod';

export interface VoiceDeps {
  catalog: VoiceCatalog;
  calls: VoiceCalls;
  transcribe: TranscribeSpeech;
  /** False while OPENAI_API_KEY is unset or the account cannot see the call model. */
  callsAvailable: boolean;
  /** False while OPENAI_API_KEY is unset or the account cannot see the dictation model. */
  dictationAvailable: boolean;
}

/** The largest dictation upload, far above two minutes of speech in any format a browser records. */
export const MAX_DICTATION_BYTES = 8 * 1024 * 1024;

const CallParams = z.object({ callId: z.string().min(1).max(200) });
const DictationQuery = z.object({
  sessionId: z.string().min(1).max(100),
  /** How long the browser recorded, for the cost when the service does not report it. */
  recordedMs: z.coerce.number().int().nonnegative().max(3_600_000).optional(),
});

export const voiceRoutes: RoutePlugin<{ deps: VoiceDeps }> = async (app, { deps }) => {
  app.get(routes.voices, { schema: { response: { 200: VoicesResponse } } }, async () => ({
    callsAvailable: deps.callsAvailable,
    dictationAvailable: deps.dictationAvailable,
    voices: voiceOptions(deps.catalog),
    defaultVoice: deps.catalog.defaultVoice,
    callPricePerMinute: deps.catalog.call.pricePerMinute,
    idleSeconds: deps.catalog.call.idleSeconds,
    maxCallMinutes: deps.catalog.call.maxMinutes,
    maxDictationSeconds: deps.catalog.dictation.maxSeconds,
  }));

  app.post(
    routes.voiceCalls,
    { schema: { body: StartCallRequest, response: { 201: StartCallResponse } } },
    async (request, reply) => reply.status(201).send(await deps.calls.start(request.body)),
  );

  // Also reached through navigator.sendBeacon when the page closes mid-call, so it answers 204 for any call.
  app.post(`${routes.voiceCalls}/:callId/end`, { schema: { params: CallParams, body: EndCallRequest } }, async (request, reply) => {
    await deps.calls.end({ ...request.body, callId: request.params.callId });
    return reply.status(204).send();
  });

  app.post(
    routes.transcriptions,
    { schema: { querystring: DictationQuery, response: { 200: TranscriptionResponse } } },
    async (request) => {
      if (!request.isMultipart()) throw errors.invalidRequest('Send the recording as multipart form data.');
      const part = await request.file({ limits: { fileSize: MAX_DICTATION_BYTES, files: 1 } });
      if (part === undefined) throw errors.invalidRequest('The request has no recording.');
      let audio: Buffer;
      try {
        audio = await part.toBuffer();
      } catch (error) {
        if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
          throw errors.invalidRequest(`The recording is too long. Dictate at most ${deps.catalog.dictation.maxSeconds} seconds at a time.`);
        }
        throw error;
      }
      return deps.transcribe.execute({
        sessionId: request.query.sessionId,
        audio,
        mimeType: part.mimetype,
        recordedMs: request.query.recordedMs ?? null,
      });
    },
  );
};

export interface TranscriptionRequest {
  audio: Uint8Array;
  /** With an extension the service recognises, such as speech.webm. */
  fileName: string;
  /** The base type, such as audio/webm, without codec parameters. */
  mimeType: string;
  /** Literal terms the speaker may say, such as file and sheet names. */
  keywords: readonly string[];
  /** ISO 639-1 codes of the languages the speaker may use. */
  languages: readonly string[];
  /** What the recording is about, in plain words. */
  prompt: string;
  signal?: AbortSignal;
}

export interface Transcript {
  text: string;
  /** Seconds of audio the service billed, or null when it did not say. */
  seconds: number | null;
}

/** Speech to text for dictated questions. Adapters throw AppError, never SDK errors. */
export interface Transcriber {
  transcribe(request: TranscriptionRequest): Promise<Transcript>;
}

import { useCallback, useState } from 'react';
import type { Source } from '@atlas/shared';
import type { Turn } from './chatReducer';

/** A source the user clicked, with the turn whose answer lists it. */
export interface OpenedSource {
  turnId: string;
  source: Source;
}

export interface OpenedSourceState {
  /** The source to show in the viewer; null once its answer is gone (cleared or asked again). */
  opened: OpenedSource | null;
  open(turnId: string, source: Source): void;
  close(): void;
}

/** Which answer source is open. The viewer reads it; the source rows set it. */
export function useOpenedSource(turns: Turn[]): OpenedSourceState {
  const [chosen, setChosen] = useState<OpenedSource | null>(null);
  const open = useCallback((turnId: string, source: Source) => setChosen({ turnId, source }), []);
  const close = useCallback(() => setChosen(null), []);
  const stillListed =
    chosen !== null && turns.some((turn) => turn.id === chosen.turnId && turn.answer?.sources.includes(chosen.source));
  return { opened: stillListed ? chosen : null, open, close };
}

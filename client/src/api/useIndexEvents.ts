import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IndexEvent, type IndexPhase, type IndexProgress, routes } from '@atlas/shared';
import { followStream } from './followStream';
import { queryKeys } from './queryKeys';

/** Bursts of events collapse into one refetch at most this often. */
const REFRESH_MS = 250;

export interface IndexActivity {
  phase: IndexPhase;
  /** "Reading BOQ_Phase2.xlsx, 3 of 12"; null once indexing has finished or failed. */
  progress: IndexProgress | null;
}

export interface IndexEventsState {
  /** The last phase and progress the server announced; null until the first one arrives. */
  activity: IndexActivity | null;
  /** False before the stream opens and while it is reconnecting. */
  connected: boolean;
}

/**
 * Follows GET /api/folder/events and refreshes the folder status after events. Progress events
 * refresh the status only; document, removal, ready and error events refresh every folder query.
 * Mount it once, near the root of the app.
 */
export function useIndexEvents(): IndexEventsState {
  const queryClient = useQueryClient();
  const [state, setState] = useState<IndexEventsState>({ activity: null, connected: false });

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let refreshAll = false;

    const refresh = (all: boolean) => {
      refreshAll ||= all;
      if (timer !== null) return;
      timer = setTimeout(() => {
        const queryKey = refreshAll ? queryKeys.folder.all : queryKeys.folder.status;
        timer = null;
        refreshAll = false;
        void queryClient.invalidateQueries({ queryKey });
      }, REFRESH_MS);
    };

    void followStream(routes.folderEvents, IndexEvent, controller.signal, {
      onConnected: (connected) => {
        setState((current) => ({ ...current, connected }));
        // Events may have been missed while the stream was down.
        if (connected) refresh(true);
      },
      onEvent: (event) => {
        const activity = activityAfter(event);
        if (activity) setState((current) => ({ ...current, activity }));
        refresh(event.type !== 'progress');
      },
    });

    return () => {
      controller.abort();
      if (timer !== null) clearTimeout(timer);
    };
  }, [queryClient]);

  return state;
}

function activityAfter(event: IndexEvent): IndexActivity | null {
  switch (event.type) {
    case 'progress':
      return { phase: event.phase, progress: event.progress };
    case 'ready':
      return { phase: 'ready', progress: null };
    case 'error':
      return { phase: 'error', progress: null };
    case 'unloaded':
      return { phase: 'idle', progress: null };
    default:
      return null;
  }
}

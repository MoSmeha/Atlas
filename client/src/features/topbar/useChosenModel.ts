import type { ModelOption } from '@atlas/shared';
import { useModels } from '../../api/useModels';
import { useSession } from '../../state/useSession';

/** The model the next question goes to: the one picked in this page, else the server's default, once they load. */
export function useChosenModel(): { id: string | null; option: ModelOption | undefined } {
  const { model } = useSession();
  const models = useModels();
  const id = model ?? models.data?.defaultModel ?? null;
  return { id, option: models.data?.models.find((option) => option.id === id) };
}

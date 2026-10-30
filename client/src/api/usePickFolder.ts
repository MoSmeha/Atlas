import { useMutation } from '@tanstack/react-query';
import { api } from './endpoints';

/**
 * Opens the folder window on the computer running Atlas, with the given title. Resolves with the chosen
 * folder's path, or null when the window was closed without one.
 */
export function usePickFolder() {
  return useMutation({
    mutationFn: async (title: string) => (await api.pickFolder({ title })).path,
  });
}

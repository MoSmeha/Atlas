import { useContext } from 'react';
import { ChatContext, type ChatContextValue } from './ChatContext';

/** The conversation and its controls. Call it inside ChatProvider. */
export function useChat(): ChatContextValue {
  const chat = useContext(ChatContext);
  if (!chat) throw new Error('useChat needs a ChatProvider above it.');
  return chat;
}

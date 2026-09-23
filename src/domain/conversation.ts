import type { ChatMessage, SearchResponse } from "./api";

export type ConversationEntry = ChatMessage & {
  selection?: SearchResponse;
  dateChange?: string;
};

/** Result attachments stay in the UI, never in the LLM conversation context. */
export function conversationContext(
  messages: ConversationEntry[],
): ChatMessage[] {
  return messages.slice(-4).map(({ role, content }) => ({ role, content }));
}

export function selectionTitle(count: number): string {
  return count === 1 ? "Найден 1 вариант" : `Найдено ${count} варианта`;
}

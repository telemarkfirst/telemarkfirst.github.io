export interface StoredMessage {
  role: 'you' | 'ai';
  text: string;
}

export interface StoredChat {
  id: string;
  /** The lesson the conversation happened on, for finding it again. */
  title: string;
  path: string;
  updatedAt: number;
  messages: StoredMessage[];
}

const KEY = 'telemark:chats';
/**
 * Enough to find last week's conversation, few enough that the list stays
 * readable and localStorage stays small. Oldest are dropped first.
 */
const MAX_CHATS = 20;
const MAX_MESSAGES = 40;

/**
 * Conversations live in the browser, not on a server.
 *
 * The worker deliberately stores nothing, so persisting here keeps that true:
 * a student's questions stay on their own machine. The cost is that history is
 * per device, which is the right trade for a study tool and worth stating
 * rather than implying sync that does not exist.
 */
function read(): StoredChat[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as StoredChat[]) : [];
  } catch {
    return [];
  }
}

function write(chats: StoredChat[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(chats.slice(0, MAX_CHATS)));
  } catch {
    // A full quota is not worth breaking the panel over; the chat still works
    // for this session, it just will not be there tomorrow.
  }
}

export function listChats(): StoredChat[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadChat(id: string): StoredChat | null {
  return read().find((chat) => chat.id === id) ?? null;
}

/** Saves a conversation, replacing any earlier version of the same one. */
export function saveChat(chat: StoredChat): void {
  if (chat.messages.length === 0) return;
  const rest = read().filter((existing) => existing.id !== chat.id);
  write(
    [{...chat, messages: chat.messages.slice(-MAX_MESSAGES)}, ...rest].sort(
      (a, b) => b.updatedAt - a.updatedAt,
    ),
  );
}

export function deleteChat(id: string): void {
  write(read().filter((chat) => chat.id !== id));
}

/** A readable label for a saved conversation: its opening question. */
export function chatLabel(chat: StoredChat): string {
  const first = chat.messages.find((message) => message.role === 'you');
  return first ? first.text : 'Empty conversation';
}

export function newChatId(): string {
  // Timestamp plus a short random tail: unique per tab without pulling in a
  // uuid dependency for something only this browser ever reads.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

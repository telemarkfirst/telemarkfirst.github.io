import type {Citation} from './askSharpAi';
import type {EvidenceClaim, TutorPlan} from './assistantContext';
export interface StoredMessage {
  role: 'you' | 'ai';
  text: string;
  beyond?: string;
  citations?: Citation[];
  evidence?: EvidenceClaim[];
  tutor?: TutorPlan;
  complete?: boolean;
  error?: string;
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
function stringField(value: unknown, max: number): string | undefined {return typeof value === 'string' ? value.slice(0, max) : undefined;}

function read(): StoredChat[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_CHATS).flatMap((chat) => {
      if (!chat || typeof chat.id !== 'string' || typeof chat.title !== 'string'
          || typeof chat.path !== 'string' || !/^\/(?![\/\\])[^\\\r\n]*$/.test(chat.path)
          || !Number.isFinite(chat.updatedAt) || !Array.isArray(chat.messages)) return [];
      const messages: StoredMessage[] = chat.messages.slice(-MAX_MESSAGES).flatMap((message: unknown) => {
        if (!message || typeof message !== 'object') return [];
        const m = message as Record<string, unknown>;
        if ((m.role !== 'you' && m.role !== 'ai') || typeof m.text !== 'string') return [];
        const citations: Citation[] = Array.isArray(m.citations) ? m.citations.slice(0, 48).flatMap((c) => {
          if (!c || typeof c.n !== 'number' || !Number.isInteger(c.n) || c.n < 1 || c.n > 48) return [];
          let url: string | undefined;
          try {const parsed = new URL(c.url); if (/^https?:$/.test(parsed.protocol) && !parsed.username && !parsed.password) url = parsed.href;} catch {}
          const canExcerpt = c.canExcerpt === true && (c.mode === 'full' || c.mode === undefined);
          return [{n: c.n, title: stringField(c.title, 300), pageTitle: stringField(c.pageTitle, 300),
            version: stringField(c.version, 200), sourceName: stringField(c.sourceName, 200), canExcerpt, mode: c.mode === 'summarize' ? 'summarize' as const : canExcerpt ? 'full' as const : 'link' as const, url}];
        }) : [];
        const evidence: EvidenceClaim[] = Array.isArray(m.evidence) ? m.evidence.slice(0, 12).flatMap((entry) => {
          if (!entry || typeof entry.claim !== 'string' || !Array.isArray(entry.sources)) return [];
          return [{claim: entry.claim.slice(0, 1500), sources: entry.sources.slice(0, 48).flatMap((source: any) => {
            if (!source || !citations.some((c) => c.n === source.n)) return [];
            const citation = citations.find((c) => c.n === source.n);
            const status = !citation?.canExcerpt ? 'restricted' : ['matched', 'weak', 'restricted', 'missing'].includes(source.status) ? source.status : 'missing';
            return [{n: source.n, status, passage: status === 'restricted' || status === 'missing' ? null : stringField(source.passage, 900) || null,
              version: stringField(source.version, 200) || null}];
          })}];
        }) : [];
        const error = stringField(m.error, 500) || (m.complete === false ? 'This answer was interrupted. Retry the question to continue.' : undefined);
        const tutor = m.tutor && typeof m.tutor === 'object' ? m.tutor as Partial<TutorPlan> : null;
        return [{role: m.role, text: m.text.slice(0, 40000), beyond: stringField(m.beyond, 20000), citations, evidence,
          complete: m.complete !== false && !error, error,
          ...(tutor && ['hint', 'explain', 'solution', 'diagnose'].includes(tutor.mode || '') && Array.isArray(tutor.followUps)
            ? {tutor: {mode: tutor.mode as TutorPlan['mode'], followUps: tutor.followUps.filter((q) => typeof q === 'string').slice(0, 4).map((q) => q.slice(0, 500))}} : {})}];
      });
      return messages.length ? [{id: chat.id.slice(0, 100), title: chat.title.slice(0, 300), path: chat.path.slice(0, 500), updatedAt: chat.updatedAt, messages}] : [];
    });
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

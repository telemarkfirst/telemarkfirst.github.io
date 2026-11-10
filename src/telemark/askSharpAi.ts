import type {LearningContext, EvidenceClaim, TutorPlan} from './assistantContext';
const ENDPOINT = 'https://sharp-ai.srivibhavp.workers.dev/api/ask';

export interface Citation {
  n: number;
  title?: string;
  pageTitle?: string;
  version?: string;
  url?: string;
  sourceName?: string;
  canExcerpt?: boolean;
  mode?: 'full' | 'summarize' | 'link';
}

export interface PageContext {
  title: string;
  section?: string;
  url: string;
}

export interface Turn {
  question: string;
  answer: string;
}

export interface AskEvents {
  onMeta?: (citations: Citation[], tutor?: TutorPlan) => void;
  onEvidence?: (claims: EvidenceClaim[]) => void;
  onToken?: (text: string) => void;
  /**
   * The assistant has finished what the sources support and is about to reason
   * past them. Telemark used to drop this event and every token after it, so a
   * student saw only the cited half of an answer and never the part that
   * actually applied it to their robot, with no sign anything was missing.
   */
  onBeyondStart?: () => void;
  onBeyond?: (text: string) => void;
  /** The daily generation ceiling was reached; sources arrive without prose. */
  onDegrade?: (answerMd: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}

/**
 * Streams an answer from Sharp AI.
 *
 * The reply arrives as server-sent events so the answer appears as it is
 * written. A question can take several seconds to retrieve and generate, and
 * a spinner for that long reads as a hang.
 *
 * The signed-in student's ID token stands in for the CAPTCHA the public site
 * uses, and it is what the daily limit is counted against.
 */
export async function askSharpAi(
  question: string,
  options: {idToken: string; page?: PageContext; history?: Turn[]; learning?: LearningContext; signal?: AbortSignal},
  events: AskEvents,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        question,
        chat: true,
        ...(options.learning ? {learning: options.learning} : {}),
        idToken: options.idToken,
        page: options.page ?? null,
        // The worker keeps the last two turns, which is what a follow-up needs
        // to resolve "it" and "that". It stores none of this; the thread lives
        // in the tab.
        history: options.history ?? [],
      }),
      signal: options.signal,
    });
  } catch (error) {
    if (options.signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
    events.onError?.('Could not reach the assistant. Check your connection and try again.');
    return;
  }

  if (!response.ok || !response.body) {
    const detail = await response.json().catch(() => null);
    events.onError?.(messageFor(response.status,
      detail && typeof detail === 'object' ? detail as ErrorDetail : {}));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;
  let terminal = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    events.onDone?.();
  };
  const dispatch = (frame: string) => {
    let event = '';
    const data: string[] = [];
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    const payload = safeParse(data.join('\n'));
    if (!payload || terminal) return;
    if (event === 'meta') events.onMeta?.((payload.citations as Citation[]) ?? [], payload.tutor as TutorPlan | undefined);
    else if (event === 'evidence') events.onEvidence?.((payload.claims as EvidenceClaim[]) ?? []);
    else if (event === 'token' && typeof payload.t === 'string') events.onToken?.(payload.t);
    else if (event === 'beyond_start') events.onBeyondStart?.();
    else if (event === 'beyond' && typeof payload.t === 'string') events.onBeyond?.(payload.t);
    else if (event === 'degrade') events.onDegrade?.(String(payload.answerMd ?? ''));
    else if (event === 'done') terminal = true;
    else if (event === 'error') {
      terminal = true;
      events.onError?.(String(payload.message ?? 'Something went wrong.'));
    }
  };

  // SSE frames are separated by a blank line and can split across reads, so
  // the tail of the buffer is kept until its terminator arrives.
  // The read is guarded because it rejects in two ordinary situations: the
  // student asked a new question, which aborts this one, and the connection
  // dropped mid-answer. Both escaped as a rejection before, so the caller's
  // cleanup never ran and the panel stayed disabled until a reload.
  try {
    while (!terminal) {
      const {done, value} = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, {stream: true});
      // Normalize complete CRLF pairs; a trailing CR stays buffered until the next read.
      buffer = buffer.replace(/\r\n/g, '\n');
      let split = buffer.indexOf('\n\n');
      while (split !== -1) {
        dispatch(buffer.slice(0, split));
        buffer = buffer.slice(split + 2);
        split = buffer.indexOf('\n\n');
      }
    }
    if (!terminal && !options.signal?.aborted) {
      events.onError?.('The answer stopped partway. Ask again to retry.');
    }
  } catch (error) {
    // An abort is the student moving on, not a failure to report to them.
    const aborted = options.signal?.aborted
      || (error instanceof DOMException && error.name === 'AbortError');
    if (!aborted) {
      events.onError?.('The answer stopped partway. Ask again to retry.');
    }
  } finally {
    if (terminal) await reader.cancel?.().catch(() => {});
    reader.releaseLock?.();
    finish();
  }
}

function safeParse(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

interface ErrorDetail {
  error?: string;
  scope?: string;
  maxChars?: number;
}

function messageFor(status: number, detail: ErrorDetail): string {
  if (status === 429) {
    return detail.scope === 'minute'
      ? 'You are asking questions too quickly. Wait a minute and try again.'
      : 'You have used your questions for today. The limit resets tomorrow.';
  }
  if (detail.error === 'auth-unavailable') {
    return 'The assistant could not verify your sign-in right now. Try again shortly.';
  }
  if (detail.error === 'turnstile-failed') {
    return 'The assistant’s sign-in connection is unavailable. Try again later.';
  }
  if (status === 403) {
    return 'Your session expired. Sign out and back in, then try again.';
  }
  if (detail.error === 'context-too-long' || detail.error === 'request-too-large') {
    return 'Attach at most 6 files and 16,000 code characters. Shorten the error or lesson text if needed.';
  }
  if (status === 413) {
    return `Keep your question under ${detail.maxChars ?? 500} characters and try again.`;
  }
  if (detail.error === 'no-answer') {
    return 'Nothing in the curriculum or the official docs covers that yet.';
  }
  return 'The assistant could not answer that. Try rewording the question.';
}

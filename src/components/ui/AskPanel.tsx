import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useLocation} from '@docusaurus/router';
import {useAuth} from '@site/src/telemark/useAuth';
import {signInWithGoogle} from '@site/src/telemark/googleAuth';
import {askSharpAi, type PageContext} from '@site/src/telemark/askSharpAi';
import {trackEvent} from '@site/src/telemark/analytics';
import {
  chatLabel, deleteChat, listChats, loadChat, newChatId, saveChat, type StoredChat,
} from '@site/src/telemark/chatStore';
import styles from './AskPanel.module.css';

interface Message {
  role: 'you' | 'ai';
  text: string;
  /** Set once the assistant moves past what the sources support. */
  beyond?: string;
}

/**
 * A tutor you talk to about the lesson in front of you.
 *
 * It is a conversation rather than a search box because the second question is
 * usually the real one: a student asks what a clearance hole is, then asks why
 * theirs binds anyway. The last turns travel with each question so a follow-up
 * that says "it" has something to point at.
 *
 * It also watches which heading is on screen and says so, because a student
 * needs to know it can see what they are looking at before they will trust it
 * with "why is this 3.2 and not 3.0".
 */
export default function AskPanel(): React.JSX.Element {
  const {user, loading} = useAuth();
  const {pathname} = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [here, setHere] = useState<PageContext | null>(null);
  const [chatId, setChatId] = useState(() => newChatId());
  const [history, setHistory] = useState<StoredChat[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const hereTitle = useRef('');
  const thread = useRef<HTMLDivElement>(null);

  // A new lesson is a new conversation. Carrying the previous thread under a
  // different heading invites reading it as being about this page.
  // Closing the dock unmounts this panel, so a conversation has to be picked
  // back up from storage rather than held in state. Resuming the newest thread
  // for this lesson means closing the panel to read a paragraph and reopening
  // it does not silently start again from nothing.
  useEffect(() => {
    const resumable = listChats().find((chat) => chat.path === pathname);
    if (resumable) {
      setMessages(resumable.messages);
      setChatId(resumable.id);
    } else {
      setMessages([]);
      setChatId(newChatId());
    }
    setShowHistory(false);
  }, [pathname]);

  // Saved after every exchange rather than on unload, which never fires
  // reliably on a phone.
  useEffect(() => {
    if (messages.length === 0) return;
    saveChat({
      id: chatId,
      title: hereTitle.current || document.title,
      path: pathname,
      updatedAt: Date.now(),
      messages,
    });
    // Deliberately not keyed on the page context: that object is rebuilt on
    // every scroll event, and depending on it wrote the whole conversation to
    // localStorage on every frame of a scroll. The title is read through a ref
    // so it stays current without driving the effect.
  }, [messages, chatId, pathname]);

  useEffect(() => {
    if (showHistory) setHistory(listChats());
  }, [showHistory]);

  // Tracked while scrolling so the panel can show what it is looking at, not
  // only use it silently when a question is sent.
  useEffect(() => {
    const update = () => {
      const next = currentPage();
      hereTitle.current = next?.title ?? '';
      setHere((previous) =>
        previous && next
          && previous.title === next.title
          && previous.section === next.section
          ? previous
          : next,
      );
    };
    update();
    window.addEventListener('scroll', update, {passive: true});
    return () => window.removeEventListener('scroll', update);
  }, [pathname]);

  useEffect(() => {
    thread.current?.scrollTo({top: thread.current.scrollHeight});
  }, [messages]);

  useEffect(() => () => abort.current?.abort(), []);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy || !user) return;

    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    // Only complete exchanges are context; the turn in flight is the question.
    const history = pairsFrom(messages);
    setMessages((prev) => [...prev, {role: 'you', text}, {role: 'ai', text: ''}]);
    setDraft('');
    setBusy(true);

    let idToken: string;
    try {
      idToken = await user.getIdToken();
    } catch {
      replaceLast(setMessages, 'Could not confirm your sign-in. Try again.');
      setBusy(false);
      return;
    }

    trackEvent('ai_question_asked', {surface: 'lesson_chat'});

    await askSharpAi(
      text,
      {idToken, page: currentPage(), history, signal: controller.signal},
      {
        onToken: (t) =>
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {role: 'ai', text: next[next.length - 1].text + t};
            return next;
          }),
        onBeyondStart: () =>
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = {...last, beyond: last.beyond ?? ''};
            return next;
          }),
        onBeyond: (t) =>
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = {...last, beyond: (last.beyond ?? '') + t};
            return next;
          }),
        // Without prose there are still sources, and saying so beats a blank.
        onDegrade: (answerMd) =>
          replaceLast(
            setMessages,
            answerMd || 'The assistant has reached its limit for today. The sources below still apply.',
          ),
        onError: (message) => replaceLast(setMessages, message),
      },
    );
    setBusy(false);
  }, [draft, busy, user, messages]);

  if (loading) return <div className={styles.panel} aria-hidden="true" />;

  if (!user) {
    return (
      <section className={styles.panel}>
        <p className={styles.title}>Ask about this lesson</p>
        <p className={styles.blurb}>
          Sign in to ask Sharp AI about the lesson and section you’re reading.
        </p>
        <button type="button" className={styles.signIn} onClick={() => signInWithGoogle()}>
          Sign in to ask
        </button>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => setShowHistory((current) => !current)}
          aria-pressed={showHistory}
        >
          {showHistory ? 'Back to chat' : 'Past chats'}
        </button>
        {messages.length > 0 && !showHistory && (
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => {
              setMessages([]);
              setChatId(newChatId());
            }}
          >
            New chat
          </button>
        )}
      </div>

      {here && !showHistory && (
        <p className={styles.here}>
          <span className={styles.hereDot} aria-hidden="true" />
          Reading {here.title}
          {here.section ? <> · {here.section}</> : null}
        </p>
      )}

      {showHistory ? (
        <div className={styles.thread}>
          {history.length === 0 && (
            <p className={styles.empty}>No earlier conversations on this device yet.</p>
          )}
          {history.map((chat) => (
            <div key={chat.id} className={styles.historyRow}>
              <button
                type="button"
                className={styles.historyOpen}
                onClick={() => {
                  const loaded = loadChat(chat.id);
                  if (!loaded) return;
                  setMessages(loaded.messages);
                  setChatId(loaded.id);
                  setShowHistory(false);
                }}
              >
                <span className={styles.historyQuestion}>{chatLabel(chat)}</span>
                <span className={styles.historyMeta}>{chat.title}</span>
              </button>
              <button
                type="button"
                className={styles.historyDelete}
                aria-label={`Delete conversation: ${chatLabel(chat)}`}
                onClick={() => {
                  deleteChat(chat.id);
                  setHistory(listChats());
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
      <div className={styles.thread} ref={thread} aria-live="polite">
        {messages.length === 0 && (
          <p className={styles.empty}>
            Ask anything about this lesson. Try &ldquo;explain this part again&rdquo; or
            &ldquo;why does that number matter&rdquo;.
          </p>
        )}
        {messages.map((message, i) => (
          <div
            key={i}
            className={message.role === 'you' ? styles.fromYou : styles.fromAi}
          >
            {message.text === '' ? (
              <span className={styles.typing} aria-label="Thinking">
                <span className={styles.typingDot} />
              </span>
            ) : (
              readable(message.text).split('\n').filter(Boolean).map((line, n) => (
                <p key={n}>{line}</p>
              ))
            )}
            {/*
              Labelled, not blended in. Everything above this line is held up by
              a cited section; everything below it is the assistant reasoning
              past them. A student deciding what to trust needs to see where one
              stops and the other starts, which is the same rule the public site
              follows.
            */}
            {message.beyond ? (
              <div className={styles.beyond}>
                <p className={styles.beyondLabel}>Beyond the curriculum: uncited reasoning</p>
                {readable(message.beyond).split('\n').filter(Boolean).map((line, n) => (
                  <p key={n}>{line}</p>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      )}

      <div className={styles.row}>
        <input
          className={styles.input}
          value={draft}
          placeholder="Ask about this lesson"
          aria-label="Ask about this lesson"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send();
          }}
        />
        <button
          type="button"
          className={styles.askBtn}
          onClick={() => void send()}
          disabled={busy || draft.trim().length === 0}
        >
          {busy ? '...' : 'Send'}
        </button>
      </div>

      <p className={styles.limit}>
        It can be wrong. Check anything you are about to cut or buy against the
        lesson. Past chats are kept on this device only.{' '}
        <a
          className={styles.limitLink}
          href="https://sharpftc.pages.dev"
          target="_blank"
          rel="noopener noreferrer"
        >
          Sharp AI
        </a>
      </p>
    </section>
  );
}

/**
 * Strips the bracket citation markers out of a reply.
 *
 * The chat shows no source list, so "[4], [8]" points at nothing and reads as
 * broken formatting. The prompt asks for them to be left out and the model
 * mostly complies, but "mostly" is not a rendering strategy.
 *
 * Two things are deliberately protected. Fenced code is left untouched, and a
 * bracket attached to an identifier is left alone, so `motors[0]` survives
 * while a citation after a full stop does not. Stripping the accumulated text
 * on render rather than each streamed delta means a marker split across two
 * tokens is still caught.
 */
function readable(text: string): string {
  return text
    .split(/(```[\s\S]*?```)/g)
    .map((part) =>
      part.startsWith('```')
        ? part
        : part
            // Both forms the model produces: [4], [8] and [2, 6].
            .replace(/(^|[^\w`\]])\s*\[\d+(?:\s*,\s*\d+)*\](?:\s*,\s*\[\d+(?:\s*,\s*\d+)*\])*/g, '$1')
            .replace(/[ \t]+([.,;:])/g, '$1')
            // A marker removed mid sentence leaves the space either side of it.
            .replace(/ {2,}/g, ' '),
    )
    .join('');
}

function replaceLast(
  set: React.Dispatch<React.SetStateAction<Message[]>>,
  text: string,
): void {
  set((prev) => {
    const next = [...prev];
    next[next.length - 1] = {role: 'ai', text};
    return next;
  });
}

/** Completed question and answer pairs, oldest first. */
function pairsFrom(messages: Message[]): {question: string; answer: string}[] {
  const pairs: {question: string; answer: string}[] = [];
  for (let i = 0; i < messages.length - 1; i += 1) {
    if (messages[i].role === 'you' && messages[i + 1].role === 'ai' && messages[i + 1].text) {
      pairs.push({question: messages[i].text, answer: messages[i + 1].text});
    }
  }
  return pairs.slice(-2);
}

/** The lesson title plus the heading nearest the top of the viewport. */
function currentPage(): PageContext | null {
  if (typeof document === 'undefined') return null;
  const title = document.querySelector('h1')?.textContent?.trim() || document.title;
  let section = '';
  for (const heading of Array.from(
    document.querySelectorAll('.theme-doc-markdown h2, .theme-doc-markdown h3'),
  )) {
    if (heading.getBoundingClientRect().top > 140) break;
    // Docusaurus appends a zero width character to every heading for its
    // anchor link, which would travel into the prompt as noise.
    section = heading.textContent?.replace(/[#\u200b]/g, '').trim() || section;
  }
  return {title, section, url: window.location.href};
}

import React, {useCallback, useEffect, useId, useRef, useState} from 'react';
import {useLocation} from '@docusaurus/router';
import {useAuth} from '@site/src/telemark/useAuth';
import {signInWithGoogle} from '@site/src/telemark/googleAuth';
import {askSharpAi, type Citation, type PageContext} from '@site/src/telemark/askSharpAi';
import {assistantHistory, captureLessonSection, captureSimulatorFiles, codeContextError, type CodeFile, type EvidenceClaim, type HelpMode, type TutorPlan} from '@site/src/telemark/assistantContext';
import {emptyWorkspace, loadAssistantWorkspace, saveAssistantWorkspace, type AssistantWorkspace} from '@site/src/telemark/assistantWorkspace';
import {trackEvent} from '@site/src/telemark/analytics';
import {chatLabel, deleteChat, listChats, loadChat, newChatId, saveChat, type StoredChat} from '@site/src/telemark/chatStore';
import styles from './AskPanel.module.css';

interface Message {
  role: 'you' | 'ai'; text: string; beyond?: string; citations?: Citation[];
  evidence?: EvidenceClaim[]; tutor?: TutorPlan; complete?: boolean; error?: string;
}

export default function AskPanel(): React.JSX.Element {
  const {user, loading} = useAuth();
  const {pathname} = useLocation();
  const id = useId();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [chatId, setChatId] = useState(newChatId);
  const [ownerPath, setOwnerPath] = useState(pathname);
  const [history, setHistory] = useState<StoredChat[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [mode, setMode] = useState<HelpMode>('explain');
  const [files, setFiles] = useState<CodeFile[]>([]);
  const [pasted, setPasted] = useState('');
  const [errorText, setErrorText] = useState('');
  const [attempt, setAttempt] = useState('');
  const [includeLesson, setIncludeLesson] = useState(true);
  const [contextNotice, setContextNotice] = useState('');
  const [contextOpen, setContextOpen] = useState(false);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [workspaceSaved, setWorkspaceSaved] = useState(true);
  const [page, setPage] = useState<PageContext | null>(null);
  const abort = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const signInScope = useRef(0);
  const thread = useRef<HTMLDivElement>(null);
  const allFiles = [...files, ...(pasted ? [{name: 'Pasted.java', source: pasted}] : [])];
  const validation = codeContextError(allFiles);

  const applyWorkspace = (workspace: AssistantWorkspace) => {
    setDraft(workspace.draft); setMode(workspace.mode); setFiles(workspace.files); setPasted(workspace.pasted);
    setErrorText(workspace.errorText); setAttempt(workspace.attempt); setIncludeLesson(workspace.includeLesson); setContextNotice('');
  };

  useEffect(() => {
    signInScope.current += 1; setSignInBusy(false); setSignInError('');
    abort.current?.abort(); abort.current = null; busyRef.current = false; setBusy(false);
    const resumable = listChats().find((chat) => chat.path === pathname);
    setMessages(resumable?.messages || []); setChatId(resumable?.id || newChatId());
    setOwnerPath(pathname); setShowHistory(false); setContextOpen(false);
    applyWorkspace(loadAssistantWorkspace(pathname)); setWorkspacePath(pathname);
    const update = () => setPage(currentPage());
    update(); window.addEventListener('scroll', update, {passive: true});
    return () => {signInScope.current += 1; window.removeEventListener('scroll', update);};
  }, [pathname]);
  useEffect(() => {
    if (workspacePath !== pathname) return;
    setWorkspaceSaved(saveAssistantWorkspace(pathname, {draft, mode, files, pasted, errorText, attempt, includeLesson}));
  }, [workspacePath, pathname, draft, mode, files, pasted, errorText, attempt, includeLesson]);
  useEffect(() => {
    if (!messages.length || ownerPath !== pathname) return;
    saveChat({id: chatId, title: page?.title || document.title, path: ownerPath, updatedAt: Date.now(), messages});
  }, [messages, chatId, pathname, ownerPath]);
  useEffect(() => {if (showHistory) setHistory(listChats());}, [showHistory]);
  useEffect(() => {thread.current?.scrollTo({top: thread.current.scrollHeight});}, [messages]);
  useEffect(() => () => abort.current?.abort(), []);

  const send = useCallback(async (override?: string, helpMode?: HelpMode, retry = false) => {
    const text = (override ?? draft).trim();
    if (!text || busyRef.current || !user || validation || ownerPath !== pathname) return;
    const controller = new AbortController();
    abort.current?.abort(); abort.current = controller;
    busyRef.current = true; setBusy(true); if (!retry) setDraft(''); setShowHistory(false); setContextOpen(false);
    const history = assistantHistory(retry ? messages.slice(0, -2) : messages);
    setMessages((prev) => retry ? [...prev.slice(0, -1), {role: 'ai', text: '', complete: false}]
      : [...prev, {role: 'you', text}, {role: 'ai', text: '', complete: false}]);
    const update = (fn: (message: Message) => Message) => {
      if (controller.signal.aborted) return;
      setMessages((prev) => prev.length ? [...prev.slice(0, -1), fn(prev[prev.length - 1])] : prev);
    };
    let failed = false;
    try {
      const idToken = await user.getIdToken();
      if (controller.signal.aborted) return;
      trackEvent('ai_question_asked', {surface: 'lesson_chat'});
      await askSharpAi(text, {idToken, page: currentPage() || undefined, history,
        learning: {mode: helpMode || mode, files: allFiles, error: errorText, attempt, lesson: includeLesson ? captureLessonSection() : ''}, signal: controller.signal}, {
        onMeta: (citations, tutor) => update((last) => ({...last, citations, tutor})),
        onEvidence: (evidence) => update((last) => ({...last, evidence})),
        onToken: (t) => update((last) => ({...last, text: last.text + t})),
        onBeyondStart: () => update((last) => ({...last, beyond: ''})),
        onBeyond: (t) => update((last) => ({...last, beyond: (last.beyond || '') + t})),
        onDegrade: (answerMd) => update((last) => ({...last, text: answerMd || 'The answer is unavailable. Check the retrieved sources.'})),
        onError: (error) => {failed = true; update((last) => ({...last, error, complete: false}));},
      });
      if (!failed) update((last) => ({...last, complete: true}));
    } catch {
      update((last) => ({...last, error: 'Could not confirm your sign-in. Try again.', complete: false}));
    } finally {
      if (abort.current === controller) {busyRef.current = false; setBusy(false);}
    }
  }, [draft, user, validation, messages, mode, files, pasted, errorText, attempt, includeLesson, ownerPath, pathname]);

  const stop = () => {
    abort.current?.abort(); abort.current = null; busyRef.current = false; setBusy(false);
    setMessages((prev) => prev.length ? [...prev.slice(0, -1), {...prev[prev.length - 1], complete: false, error: 'Response stopped. Retry the question when you are ready.'}] : prev);
  };

  const signIn = async () => {
    if (signInBusy) return;
    const scope = signInScope.current;
    setSignInBusy(true); setSignInError('');
    try {await signInWithGoogle();} catch (error) {
      if (scope !== signInScope.current) return;
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      setSignInError(code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
        ? 'Sign-in was cancelled. Try again when you are ready.'
        : code === 'auth/popup-blocked' ? 'Allow the Google sign-in popup, then try again.'
        : error instanceof Error && error.message.startsWith('Sign-in is disabled') ? error.message
        : 'Could not sign in. Check your connection and try again.');
    } finally {if (scope === signInScope.current) setSignInBusy(false);}
  };

  if (loading) return <div className={styles.panel} aria-hidden="true" />;
  if (!user) return <section className={styles.panel}><p className={styles.title}>Ask about this lesson</p>
    <p className={styles.blurb}>Sign in to access Sharp AI</p><button type="button" className={styles.signIn} disabled={signInBusy} onClick={() => void signIn()}>{signInBusy ? 'Opening Google sign-in…' : 'Sign in to ask'}</button>
    {signInError && <p className={styles.error} role="alert">{signInError}</p>}</section>;

  return <section className={styles.panel}>
    <div className={styles.toolbar}>
      <button type="button" className={styles.toolBtn} disabled={busy} onClick={() => setShowHistory((v) => !v)} aria-pressed={showHistory}>{showHistory ? 'Back to chat' : 'Past chats'}</button>
      <button type="button" className={styles.toolBtn} disabled={busy} onClick={() => {setMessages([]); setChatId(newChatId()); setOwnerPath(pathname); setShowHistory(false); applyWorkspace(emptyWorkspace());}}>New chat</button>
    </div>
    {showHistory ? <div className={styles.thread}>
      {!history.length && <p className={styles.empty}>No earlier conversations on this device yet.</p>}
      {history.map((chat) => <div className={styles.historyRow} key={chat.id}>
        <button type="button" className={styles.historyOpen} onClick={() => {const loaded = loadChat(chat.id); if (!loaded) return; setMessages(loaded.messages); setChatId(loaded.id); setOwnerPath(loaded.path); setShowHistory(false);}}><span className={styles.historyQuestion}>{chatLabel(chat)}</span><span className={styles.historyMeta}>{chat.title}</span></button>
        <button type="button" className={styles.historyDelete} aria-label={`Delete conversation: ${chatLabel(chat)}`} onClick={() => {deleteChat(chat.id); setHistory(listChats());}}>✕</button>
      </div>)}
    </div> : messages.length ? <div className={styles.thread} ref={thread} aria-busy={busy}>
      {messages.map((message, i) => <div key={i} className={message.role === 'you' ? styles.fromYou : styles.fromAi}>
        {!message.text && !message.error && message.complete === false && !message.beyond ? <span className={styles.typing} role="status" aria-label="Thinking"><span className={styles.typingDot} /></span> : <AnswerText text={message.text} />}
        {message.error && <p className={styles.error} role="alert">{message.error}</p>}
        {message.error && i === messages.length - 1 && messages[i - 1]?.role === 'you' && <div className={styles.recovery}>
          <button type="button" className={styles.toolBtn} disabled={busy || !!validation || ownerPath !== pathname} onClick={() => void send(messages[i - 1].text, undefined, true)}>Retry question</button>
          <span className={styles.empty}>Uses the code and context currently shown below.</span>
        </div>}
        {message.beyond && <div className={styles.beyond}><p className={styles.beyondLabel}>Engineering suggestion · not verified by the cited sources</p><AnswerText text={message.beyond} /></div>}
        {!!message.citations?.length && <Evidence citations={message.citations} claims={message.evidence || []} />}
        {message.complete && i === messages.length - 1 && message.tutor?.followUps && <div className={styles.followUps} aria-label="Suggested follow-up replies">
          {message.tutor.followUps.map((q) => <button type="button" className={styles.toolBtn} key={q} disabled={busy} onClick={() => void send(q)}>{q}</button>)}
        </div>}
      </div>)}
    </div> : null}
    {ownerPath !== pathname && <p className={styles.blurb}>This chat belongs to another lesson. <a href={ownerPath.startsWith('/') && !ownerPath.startsWith('//') ? ownerPath : '/'}>Open that lesson</a> or start a new chat here.</p>}
    <div className={styles.context}>
      <div className={styles.contextHead}><label htmlFor={`${id}-mode`}>Help me</label><button type="button" className={styles.toolBtn} disabled={busy} onClick={() => applyWorkspace(emptyWorkspace())}>Clear draft and context</button></div>
      <select id={`${id}-mode`} value={mode} disabled={busy} onChange={(e) => setMode(e.target.value as HelpMode)}>
        <option value="explain">Understand it</option><option value="hint">With a hint</option><option value="solution">See a worked solution</option><option value="diagnose">Troubleshoot step by step</option>
      </select>
      <details open={contextOpen} onToggle={(e) => setContextOpen(e.currentTarget.open)}><summary>Lesson and code context {allFiles.length ? `· ${allFiles.length} files` : ''}</summary>
        <label className={styles.checkLabel}><input type="checkbox" checked={includeLesson} disabled={busy} onChange={(e) => setIncludeLesson(e.target.checked)} /> Include the current lesson section · up to 3,000 characters</label>
        <p className={styles.empty}>{page?.title}{page?.section ? ` · ${page.section}` : ''}</p>
        <button type="button" className={styles.toolBtn} disabled={busy} onClick={() => {
          const next = captureSimulatorFiles();
          if (!next.length) {setContextNotice('No loaded Java simulator found on this lesson. Paste code below instead.'); return;}
          setFiles(next); setContextNotice('Simulator snapshot attached. Refresh it after editing your code.');
        }}>Attach current simulator code</button>
        {!!allFiles.length && <button type="button" className={styles.toolBtn} disabled={busy || !!validation} onClick={() => {setMode('explain'); void send('Explain my attached code, point out the important lines, and suggest one small test.', 'explain');}}>Explain this code</button>}
        {files.map((file) => <div className={styles.contextFile} key={file.name}><details><summary>{file.name} · {file.source.length.toLocaleString()} characters</summary><pre>{file.source}</pre></details><button type="button" className={styles.toolBtn} disabled={busy} aria-label={`Remove ${file.name}`} onClick={() => setFiles(files.filter((f) => f.name !== file.name))}>Remove</button></div>)}
        <label htmlFor={`${id}-code`}>Or paste code · 16,000 characters total across up to 6 files</label>
        <textarea id={`${id}-code`} value={pasted} rows={5} maxLength={16000} disabled={busy} spellCheck={false} onChange={(e) => setPasted(e.target.value)} />
        <label htmlFor={`${id}-error`}>Exact error or observed behavior</label><textarea id={`${id}-error`} value={errorText} rows={2} maxLength={2000} disabled={busy} onChange={(e) => setErrorText(e.target.value)} />
        <label htmlFor={`${id}-attempt`}>What have you tried?</label><textarea id={`${id}-attempt`} value={attempt} rows={2} maxLength={2000} disabled={busy} onChange={(e) => setAttempt(e.target.value)} />
        <p className={styles.empty}>Code is shared when you send. It stays out of Sharp AI’s server cache. Saved replies remain on this browser.</p>
        {contextNotice && <p role="status" className={styles.empty}>{contextNotice}</p>}
        {validation && <p role="alert" className={styles.error}>{validation}</p>}
      </details>
    </div>
    <p className={styles.workspaceStatus} role="status">{workspaceSaved ? 'Draft and code context are kept in this tab, separately for each lesson.' : validation ? 'Draft recovery is paused while attached code exceeds the limits.' : 'This browser could not keep your draft. Copy it before closing the panel.'}</p>
    <div className={styles.row}><textarea className={styles.input} rows={2} maxLength={500} value={draft} placeholder="Ask about this lesson" aria-label="Ask about this lesson" disabled={busy} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => {if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {e.preventDefault(); void send();}}} />
      {busy ? <button type="button" className={styles.askBtn} onClick={stop}>Stop response</button> : <button type="button" className={styles.askBtn} onClick={() => void send()} disabled={!draft.trim() || !!validation || ownerPath !== pathname}>Send</button>}</div>
    <p className={styles.limit}>Sharp AI can make mistakes. Check claims against the source passages.</p>
  </section>;
}

function AnswerText({text}: {text: string}): React.JSX.Element {
  const [copied, setCopied] = useState<number | null>(null);
  return <>{text.split(/(```[\s\S]*?(?:```|$))/g).filter(Boolean).map((part, i) => {
    if (part.startsWith('```')) {const code = part.replace(/^```[^\n]*\n?/, '').replace(/```$/, '').trimEnd();
      return <div key={i} className={styles.codeBlock}><button type="button" className={styles.toolBtn} onClick={async () => {try {await navigator.clipboard.writeText(code); setCopied(i);} catch {setCopied(null);}}}>{copied === i ? 'Copied' : 'Copy code'}</button><pre><code>{code}</code></pre></div>;}
    return part.split('\n').filter(Boolean).map((line, n) => <p key={`${i}-${n}`}>{line.replace(/\*\*([^*]+)\*\*/g, '$1').split(/(`[^`]+`)/g).map((piece, j) => piece.startsWith('`') ? <code key={j}>{piece.slice(1, -1)}</code> : piece)}</p>);
  })}</>;
}
function Evidence({citations, claims}: {citations: Citation[]; claims: EvidenceClaim[]}): React.JSX.Element {
  return <details className={styles.evidence}><summary>Check sources and claims · {citations.length}</summary>
    <p className={styles.empty}>Passages match wording; this does not prove a claim is correct. Read the complete section.</p>
    {claims.map((claim, i) => <section key={i}><p>{claim.claim}</p>{claim.sources.map((source) => <div key={source.n}><p>[{source.n}] {source.version} · {source.status === 'matched' ? 'Matching wording' : source.status === 'weak' ? 'Weak wording match : check carefully' : 'Original passage unavailable here'}</p>{source.passage && <blockquote>{source.passage}</blockquote>}</div>)}</section>)}
    {citations.map((citation) => <p key={citation.n}>[{citation.n}] {citation.url && /^https?:\/\//.test(citation.url) ? <a href={citation.url} target="_blank" rel="noopener noreferrer">{citation.pageTitle || citation.title || citation.sourceName || 'Open source'}</a> : citation.sourceName} {citation.version && `· ${citation.version}`}</p>)}
  </details>;
}
function currentPage(): PageContext | null {
  if (typeof document === 'undefined') return null;
  const title = document.querySelector('h1')?.textContent?.trim() || document.title;
  let section = '';
  for (const heading of Array.from(document.querySelectorAll('.theme-doc-markdown h2, .theme-doc-markdown h3'))) {
    if (heading.getBoundingClientRect().top > 160) break;
    section = heading.textContent?.replace(/[#\u200b]/g, '').trim() || section;
  }
  return {title, section, url: window.location.href};
}

export type HelpMode = 'hint' | 'explain' | 'solution' | 'diagnose';
export interface CodeFile {name: string; source: string}
export interface LearningContext {mode: HelpMode; files: CodeFile[]; error?: string; attempt?: string; lesson?: string}
export interface EvidenceClaim {claim: string; sources: {n: number; status: 'matched' | 'weak' | 'restricted' | 'missing'; passage: string | null; version: string | null}[]}
export interface TutorPlan {mode: HelpMode; followUps: string[]; diagnostic?: {title: string; question: string} | null}

export function codeContextError(files: CodeFile[]): string | null {
  if (files.length > 6) return 'Attach at most 6 files. Remove files before sending.';
  if (new Set(files.map((file) => file.name)).size !== files.length) return 'Attached filenames must be unique.';
  if (files.some((file) => !/^[\w .-]{1,100}$/.test(file.name))) return 'Use simple filenames, such as Main.java.';
  return files.reduce((size, file) => size + file.source.length, 0) > 16000
    ? 'Attached code exceeds 16,000 characters. Remove files or attach a smaller example.' : null;
}

/** Reads a snapshot only when the learner chooses to attach the simulator. */
export function captureSimulatorFiles(root: Document = document): CodeFile[] {
  for (const frame of Array.from(root.querySelectorAll<HTMLIFrameElement>('iframe.telemark-simulator'))) {
    try {
      const editor = frame.contentDocument?.querySelector<HTMLTextAreaElement>('#code-editor, #sim-code-editor, textarea');
      if (!editor) continue;
      const project = (editor as HTMLTextAreaElement & {__telemarkProject?: {files: () => CodeFile[]}}).__telemarkProject;
      const files = project ? project.files().map((file) => ({name: file.name, source: file.source}))
        : [{name: 'Main.java', source: editor.value}];
      if (files.some((file) => file.source.trim())) return files;
    } catch { /* Cross-origin or not-yet-loaded frames are not code sources. */ }
  }
  return [];
}

export function captureLessonSection(root: Document = document): string {
  const article = root.querySelector('.theme-doc-markdown');
  if (!article) return '';
  const headings = Array.from(article.querySelectorAll('h2, h3'));
  let heading = headings.filter((h) => h.getBoundingClientRect().top <= 160).at(-1);
  if (!heading && headings[0]) {
    const intro = root.createRange();
    intro.selectNodeContents(article);
    intro.setEndBefore(headings[0]);
    if ((intro.cloneContents().textContent || '').trim().length < 120) heading = headings[0];
  }
  const range = root.createRange();
  range.selectNodeContents(article);
  if (heading) range.setStartBefore(heading);
  const next = headings[heading ? headings.indexOf(heading) + 1 : 0];
  if (next) range.setEndBefore(next);
  const content = root.createElement('div');
  content.append(range.cloneContents());
  content.querySelectorAll('button, iframe, script, style, textarea, input, nav').forEach((node) => node.remove());
  return (content.textContent || '').replace(/[\t ]+/g, ' ').trim().slice(0, 3000);
}

export function assistantHistory(messages: {role: 'you' | 'ai'; text: string; beyond?: string; complete?: boolean; error?: string}[]): {question: string; answer: string}[] {
  const pairs = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const next = messages[i + 1];
    if (messages[i].role === 'you' && next.role === 'ai' && (next.text || next.beyond) && next.complete !== false && !next.error)
      pairs.push({question: messages[i].text, answer: [next.text, next.beyond].filter(Boolean).join('\n\n').slice(0, 1200)});
  }
  return pairs.slice(-2);
}

import type {CodeFile, HelpMode} from './assistantContext';

export interface AssistantWorkspace {
  draft: string;
  mode: HelpMode;
  files: CodeFile[];
  pasted: string;
  errorText: string;
  attempt: string;
  includeLesson: boolean;
}
const KEY = 'telemark:assistant-workspaces:v1';
const LIMIT = 10;
const modes = new Set<HelpMode>(['hint', 'explain', 'solution', 'diagnose']);
export const emptyWorkspace = (): AssistantWorkspace => ({draft: '', mode: 'explain', files: [], pasted: '', errorText: '', attempt: '', includeLesson: true});

function normalize(value: unknown): AssistantWorkspace | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<AssistantWorkspace>;
  if (typeof v.draft !== 'string' || v.draft.length > 500 || !modes.has(v.mode as HelpMode)
      || !Array.isArray(v.files) || v.files.length > 6 || typeof v.pasted !== 'string'
      || typeof v.errorText !== 'string' || v.errorText.length > 2000
      || typeof v.attempt !== 'string' || v.attempt.length > 2000) return null;
  const files: CodeFile[] = [];
  for (const file of v.files) {
    if (!file || typeof file.name !== 'string' || !/^[\w .-]{1,100}$/.test(file.name) || typeof file.source !== 'string') return null;
    files.push({name: file.name, source: file.source});
  }
  if (files.reduce((size, f) => size + f.source.length, v.pasted.length) > 16000) return null;
  return {draft: v.draft, mode: v.mode as HelpMode, files, pasted: v.pasted, errorText: v.errorText,
    attempt: v.attempt, includeLesson: v.includeLesson !== false};
}
function read(): {path: string; updatedAt: number; workspace: AssistantWorkspace}[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, LIMIT).flatMap((entry) => {
      const workspace = normalize(entry?.workspace);
      return typeof entry?.path === 'string' && entry.path.startsWith('/') && typeof entry.updatedAt === 'number' && workspace
        ? [{path: entry.path, updatedAt: entry.updatedAt, workspace}] : [];
    });
  } catch {return [];}
}
export function loadAssistantWorkspace(path: string): AssistantWorkspace {
  return read().find((entry) => entry.path === path)?.workspace || emptyWorkspace();
}
export function saveAssistantWorkspace(path: string, value: AssistantWorkspace): boolean {
  const workspace = normalize(value);
  if (!workspace) return false;
  try {
    const next = [{path, updatedAt: Date.now(), workspace}, ...read().filter((entry) => entry.path !== path)].slice(0, LIMIT);
    sessionStorage.setItem(KEY, JSON.stringify(next));
    return true;
  } catch {return false;}
}

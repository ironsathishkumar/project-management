export interface CommitRef {
  key: string;
  status?: string;
  comment?: string;
}

const DONE = 'done';
const IN_PROGRESS = 'in_progress';

const VERBS_BEFORE: Record<string, string> = {
  fix: DONE,
  fixes: DONE,
  fixed: DONE,
  close: DONE,
  closes: DONE,
  closed: DONE,
  resolve: DONE,
  resolves: DONE,
  resolved: DONE,
  complete: DONE,
  completes: DONE,
  completed: DONE,
  finish: DONE,
  finishes: DONE,
  finished: DONE,
  start: IN_PROGRESS,
  starts: IN_PROGRESS,
  started: IN_PROGRESS,
};

const WORDS_AFTER: Record<string, string> = {
  done: DONE,
  fixed: DONE,
  closed: DONE,
  resolved: DONE,
  completed: DONE,
  finished: DONE,
  wip: IN_PROGRESS,
  started: IN_PROGRESS,
};

const LIST_JOINERS = new Set(['and', '&', ',']);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Finds task references for one project in a commit message.
 * Supports "fixes PTR-4", "PTR-4 done", "PTR-4 #review", "PTR-4 #comment text"
 * and lists such as "closes PTR-1, PTR-2 and PTR-3".
 */
export function parseCommitMessage(message: string, projectKey: string): CommitRef[] {
  const keyPattern = new RegExp(`^${escapeRegExp(projectKey)}-\\d+$`, 'i');
  const refs = new Map<string, CommitRef>();

  for (const line of message.split(/\r?\n/)) {
    const tokens = line.split(/\s+/).filter(Boolean);
    let pendingVerb: string | undefined;

    for (let index = 0; index < tokens.length; index += 1) {
      const raw = tokens[index];
      const word = raw.replace(/^[(\[]+|[)\]:;,.!?]+$/g, '');
      const lower = word.toLowerCase();

      if (!keyPattern.test(word)) {
        if (VERBS_BEFORE[lower]) pendingVerb = VERBS_BEFORE[lower];
        else if (!LIST_JOINERS.has(lower) && raw !== ',') pendingVerb = undefined;
        continue;
      }

      const key = word.toUpperCase();
      const ref: CommitRef = refs.get(key) ?? { key };
      const next = tokens[index + 1];
      const nextWord = next?.replace(/[:;,.!?]+$/g, '');

      if (nextWord?.startsWith('#') && nextWord.length > 1) {
        const command = nextWord.slice(1).toLowerCase();
        if (command === 'comment') {
          const text = tokens.slice(index + 2).join(' ').trim();
          if (text) ref.comment = text;
          index = tokens.length;
        } else {
          ref.status = command;
          index += 1;
        }
      } else if (nextWord && WORDS_AFTER[nextWord.toLowerCase()]) {
        ref.status = WORDS_AFTER[nextWord.toLowerCase()];
        index += 1;
      } else if (pendingVerb) {
        ref.status = pendingVerb;
      }

      refs.set(key, ref);
      if (!raw.endsWith(',')) {
        const following = tokens[index + 1]?.toLowerCase();
        if (!following || !(LIST_JOINERS.has(following) || keyPattern.test(following.replace(/[,.;:]+$/, '')))) {
          pendingVerb = undefined;
        }
      }
    }
  }

  return [...refs.values()];
}

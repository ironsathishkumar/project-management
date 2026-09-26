import crypto from 'crypto';
import path from 'path';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { Integration, ProcessedCommit, Project } from '../models';
import { AppContext } from '../types';
import { ApiError } from '../utils/ApiError';
import { decryptSecret, encryptSecret } from '../utils/secrets';
import { appSyncService } from './appSync.service';
import { parseCommitMessage } from './commitParser';
import { documentImportService, ImportTarget } from './documentImport.service';
import { detectFormat, ParsedDocument, parseDocumentFile } from './documentParser';
import { findOwned, integrationService, presentIntegrations } from './integration.service';
import { projectService } from './project.service';

export interface IncomingCommit {
  sha: string;
  message: string;
  url?: string;
  author?: string;
  branch?: string;
}

type IntegrationRecord = InstanceType<typeof Integration>;

const MAX_COMMITS = 300;

function normalizeRepo(value: string) {
  const cleaned = value
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  if (!/^[\w.-]+\/[\w.-]+$/.test(cleaned)) {
    throw ApiError.badRequest('INVALID_REPO', 'Use the repository as owner/name, e.g. ironsathishkumar/project-management');
  }
  return cleaned;
}

function tokenOf(integration: IntegrationRecord) {
  return integration.github?.tokenEnc ? decryptSecret(integration.github.tokenEnc) : undefined;
}

async function githubFetch(route: string, token?: string, accept = 'application/vnd.github+json') {
  const response = await fetch(`https://api.github.com${route}`, {
    headers: {
      Accept: accept,
      'User-Agent': 'project-tracker',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (response.ok) return response;
  const reason =
    response.status === 404
      ? 'Repository or file not found. Private repositories need a token with read access'
      : response.status === 401
        ? 'GitHub rejected the token. Check that it is valid and not expired'
        : response.status === 403 || response.status === 429
          ? 'GitHub rate limit reached or access denied. Adding a token raises the limit'
          : `GitHub returned HTTP ${response.status}`;
  throw ApiError.badRequest('GITHUB_ERROR', reason);
}

async function githubJson<T>(route: string, token?: string): Promise<T> {
  return (await githubFetch(route, token)).json() as Promise<T>;
}

function contentsRoute(repo: string, filePath: string, ref?: string) {
  const encoded = filePath
    .replace(/^\/+/, '')
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  return `/repos/${repo}/contents/${encoded}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;
}

async function fetchFile(repo: string, filePath: string, ref: string, token?: string) {
  if (!token) {
    // raw.githubusercontent.com does not count against the 60 requests/hour anonymous API limit.
    const encodedPath = filePath.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
    const raw = await fetch(`https://raw.githubusercontent.com/${repo}/${ref}/${encodedPath}`, {
      headers: { 'User-Agent': 'project-tracker' },
    });
    if (raw.ok) return Buffer.from(await raw.arrayBuffer());
    if (raw.status === 404) {
      throw ApiError.badRequest('GITHUB_ERROR', `${filePath} was not found on ${ref}`);
    }
  }
  const response = await githubFetch(contentsRoute(repo, filePath, ref), token, 'application/vnd.github.raw+json');
  return Buffer.from(await response.arrayBuffer());
}

interface RepoInfo {
  full_name: string;
  name: string;
  private: boolean;
  default_branch: string;
  description: string | null;
}

const DOC_FILE = /\.(md|markdown|txt|docx|pdf)$/i;
const IGNORED_PATH = /(^|\/)(node_modules|vendor|dist|build|out|coverage|\.next|\.git|\.github)\//i;
const IGNORED_NAME = /^(changelog|license|licence|code_of_conduct|contributing|security)\b/i;
const wordIn = (words: string) => new RegExp(`(^|[^a-z])(${words})([^a-z]|$)`, 'i');
const PLAN_NAMES: Array<[RegExp, number]> = [
  [wordIn('implementation|checklist|todos?|tasks?'), 12],
  [wordIn('plan|planning|roadmap|milestones?|backlog'), 10],
  [wordIn('prd|requirements?'), 6],
];
const PLAN_NAME = wordIn('implementation|checklist|todos?|tasks?|plan|planning|roadmap|milestones?|backlog|prd|requirements?');
const MAX_CANDIDATES = 40;
const MAX_AUTO_PROBES = 5;

function scoreDocPath(filePath: string) {
  const name = path.posix.basename(filePath);
  let score = -(filePath.split('/').length - 1);
  score += PLAN_NAMES.find(([pattern]) => pattern.test(name))?.[1] ?? 0;
  if (/^docs?\//i.test(filePath)) score += 3;
  if (/^readme\./i.test(name)) score += 1;
  return score;
}

async function listDocCandidates(repo: string, branch: string, token?: string) {
  const tree = await githubJson<{ tree: Array<{ path: string; type: string; size?: number }> }>(
    `/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    token
  );
  return tree.tree
    .filter(
      (entry) =>
        entry.type === 'blob' &&
        DOC_FILE.test(entry.path) &&
        !IGNORED_PATH.test(entry.path) &&
        !IGNORED_NAME.test(path.posix.basename(entry.path))
    )
    .map((entry) => ({ path: entry.path, size: entry.size ?? 0, score: scoreDocPath(entry.path) }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, MAX_CANDIDATES);
}

async function readDocument(repo: string, docsPath: string, ref: string, token?: string) {
  const file = { buffer: await fetchFile(repo, docsPath, ref, token), originalname: path.posix.basename(docsPath) };
  return { file, document: await parseDocumentFile(file.buffer, file.originalname) };
}

/** Prefers a checklist document, then a plan-like file name; plain READMEs with bullet lists are never auto-picked. */
async function pickPlanDocument(repo: string, ref: string, candidates: Array<{ path: string }>, token?: string) {
  const probes = await Promise.all(
    candidates.slice(0, MAX_AUTO_PROBES).map((candidate) =>
      readDocument(repo, candidate.path, ref, token)
        .then((read) => ({ path: candidate.path, ...read }))
        .catch(() => null)
    )
  );
  const usable = probes.filter((probe): probe is NonNullable<typeof probe> => Boolean(probe?.document.itemCount));
  return (
    usable.find((probe) => probe.document.mode === 'checklist') ??
    usable.find((probe) => PLAN_NAME.test(path.posix.basename(probe.path))) ??
    null
  );
}

async function recordEvent(integrationId: string, status: 'OK' | 'ERROR', message: string, extra: Record<string, unknown> = {}) {
  await Integration.updateOne(
    { id: integrationId },
    {
      $set: {
        'github.lastEventAt': new Date(),
        'github.lastEventStatus': status,
        'github.lastEventMessage': message.slice(0, 300),
        ...extra,
      },
    }
  );
}

async function syncDocument(ctx: AppContext, docsPath: string, buffer: Buffer) {
  try {
    const result = await appSyncService.importDocument(ctx, { buffer, originalname: path.basename(docsPath) }, false);
    return { ok: true as const, counts: result.counts };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : 'Document sync failed' };
  }
}

function describe(commits: Awaited<ReturnType<typeof processCommits>>, document?: Awaited<ReturnType<typeof syncDocument>> | null) {
  const parts = [`${commits.processed} new commit${commits.processed === 1 ? '' : 's'}, ${commits.taskUpdates} task update${commits.taskUpdates === 1 ? '' : 's'}`];
  if (document) {
    parts.push(
      document.ok
        ? `document: ${document.counts.CREATE} new, ${document.counts.COMPLETE} done`
        : `document failed: ${document.error}`
    );
  }
  return parts.join(' · ');
}

export async function processCommits(ctx: AppContext, commits: IncomingCommit[], options: { branch?: string } = {}) {
  if (commits.length > MAX_COMMITS) {
    throw ApiError.badRequest('TOO_MANY_COMMITS', `Send at most ${MAX_COMMITS} commits per request`);
  }
  const project = await Project.findOne({ id: ctx.projectId });
  if (!project) {
    throw ApiError.notFound('PROJECT_NOT_FOUND', 'Project not found');
  }

  const results: Array<{
    sha: string;
    title: string;
    skipped?: string;
    refs: Array<{ key: string; action: string; status?: string | null; error?: string }>;
  }> = [];

  for (const commit of commits) {
    const sha = commit.sha?.trim();
    const message = commit.message ?? '';
    const title = message.split('\n')[0].slice(0, 200);
    if (!sha) continue;
    if (options.branch && commit.branch && commit.branch !== options.branch) {
      results.push({ sha: sha.slice(0, 7), title, skipped: `branch ${commit.branch}`, refs: [] });
      continue;
    }
    if (await ProcessedCommit.exists({ integrationId: ctx.integrationId, sha })) {
      results.push({ sha: sha.slice(0, 7), title, skipped: 'already processed', refs: [] });
      continue;
    }

    const refs = parseCommitMessage(message, project.key);
    const refResults: (typeof results)[number]['refs'] = [];
    for (const ref of refs) {
      const comment = [
        `Commit ${sha.slice(0, 7)}${commit.author ? ` by ${commit.author}` : ''}: ${title}`,
        ref.comment,
        commit.url,
      ]
        .filter(Boolean)
        .join('\n');
      try {
        const updated = await appSyncService.update(ctx, ref.key, { status: ref.status, comment });
        refResults.push({ key: ref.key, action: updated.action, status: updated.task.status?.name ?? null });
      } catch (error) {
        const code = error instanceof ApiError ? error.code : '';
        if (code === 'INVALID_STATUS') {
          await appSyncService.update(ctx, ref.key, { comment: `${comment}\n(unknown status "#${ref.status}")` });
          refResults.push({ key: ref.key, action: 'commented', error: `Unknown status "${ref.status}"` });
        } else {
          refResults.push({ key: ref.key, action: 'error', error: error instanceof Error ? error.message : 'Failed' });
        }
      }
    }

    await ProcessedCommit.create({ integrationId: ctx.integrationId, sha, refs: refs.map((ref) => ref.key) }).catch(
      () => undefined
    );
    results.push({ sha: sha.slice(0, 7), title, refs: refResults });
  }

  const processed = results.filter((result) => !result.skipped);
  return {
    processed: processed.length,
    skipped: results.length - processed.length,
    taskUpdates: processed.reduce(
      (sum, result) => sum + result.refs.filter((ref) => ref.action === 'updated' || ref.action === 'commented').length,
      0
    ),
    results,
  };
}

async function pollIntegration(integration: IntegrationRecord, options: { sinceDays?: number } = {}) {
  const github = integration.github;
  if (!github) {
    throw ApiError.badRequest('GITHUB_NOT_CONFIGURED', 'Connect a GitHub repository first');
  }
  const token = tokenOf(integration);
  const startedAt = new Date();
  const since = options.sinceDays
    ? new Date(Date.now() - options.sinceDays * 24 * 60 * 60 * 1000)
    : github.lastSyncedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const ctx = await integrationService.contextFor(integration.id as string);

    let document: Awaited<ReturnType<typeof syncDocument>> | null = null;
    let lastDocSha = github.lastDocSha;
    if (github.docsPath) {
      const docParams = new URLSearchParams({ path: github.docsPath.replace(/^\/+/, ''), per_page: '1' });
      if (github.branch) docParams.set('sha', github.branch);
      const [latest] = await githubJson<Array<{ sha: string }>>(`/repos/${github.repo}/commits?${docParams}`, token);
      if (latest && latest.sha !== github.lastDocSha) {
        document = await syncDocument(ctx, github.docsPath, await fetchFile(github.repo, github.docsPath, latest.sha, token));
        lastDocSha = latest.sha;
      }
    }

    const params = new URLSearchParams({ since: since.toISOString(), per_page: '100' });
    if (github.branch) params.set('sha', github.branch);
    const raw: Array<{ sha: string; html_url: string; commit: { message: string; author?: { name?: string } } }> = [];
    for (let page = 1; page <= 3; page += 1) {
      const batch = await githubJson<typeof raw>(`/repos/${github.repo}/commits?${params}&page=${page}`, token);
      raw.push(...batch);
      if (batch.length < 100) break;
    }
    const commits = await processCommits(
      ctx,
      raw.reverse().map((item) => ({
        sha: item.sha,
        message: item.commit.message,
        url: item.html_url,
        author: item.commit.author?.name,
      }))
    );

    const message = describe(commits, document);
    await recordEvent(integration.id as string, document && !document.ok ? 'ERROR' : 'OK', `Sync: ${message}`, {
      'github.lastSyncedAt': startedAt,
      'github.lastDocSha': lastDocSha,
    });
    return { commits, document, message };
  } catch (error) {
    await recordEvent(integration.id as string, 'ERROR', error instanceof Error ? error.message : 'Sync failed');
    throw error;
  }
}

function verifySignature(secret: string, rawBody: Buffer, signature?: string) {
  if (!signature?.startsWith('sha256=')) return false;
  const expected = Buffer.from(`sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`);
  const received = Buffer.from(signature);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

interface PushPayload {
  ref?: string;
  after?: string;
  repository?: { full_name?: string };
  commits?: Array<{
    id: string;
    message: string;
    url?: string;
    distinct?: boolean;
    author?: { name?: string };
    added?: string[];
    modified?: string[];
  }>;
}

export const githubService = {
  async discover(
    workspaceId: string,
    input: { repo: string; token?: string; branch?: string; docsPath?: string } & ImportTarget
  ) {
    const repoName = normalizeRepo(input.repo);
    const token = input.token?.trim() || undefined;
    const info = await githubJson<RepoInfo>(`/repos/${repoName}`, token);
    const branch = input.branch?.trim() || info.default_branch;
    const candidates = await listDocCandidates(info.full_name, branch, token);

    let docsPath: string | null = null;
    let file: { buffer: Buffer; originalname: string } | null = null;
    let docError: string | undefined;
    const requested = input.docsPath?.trim().replace(/^\/+/, '');
    if (requested) {
      docsPath = requested;
      try {
        file = (await readDocument(info.full_name, requested, branch, token)).file;
      } catch (error) {
        docError = `Couldn't read ${requested}: ${error instanceof Error ? error.message : 'unknown error'}`;
      }
    } else if (requested === undefined) {
      const picked = await pickPlanDocument(info.full_name, branch, candidates, token);
      docsPath = picked?.path ?? null;
      file = picked?.file ?? null;
    }

    const preview = file
      ? await documentImportService.preview(workspaceId, file, {
          projectId: input.projectId,
          projectName: input.projectName,
          projectKey: input.projectKey,
        })
      : null;

    return {
      repo: {
        fullName: info.full_name,
        name: info.name,
        private: info.private,
        defaultBranch: info.default_branch,
        description: info.description ?? '',
      },
      branch,
      candidates: candidates.map(({ path: filePath, size }) => ({ path: filePath, size })),
      docsPath,
      preview,
      docError,
    };
  },

  async setup(
    workspaceId: string,
    userId: string,
    input: {
      repo: string;
      token?: string;
      branch?: string;
      docsPath?: string;
      autoSync?: boolean;
      sinceDays?: number;
    } & ImportTarget
  ) {
    const token = input.token?.trim() || undefined;
    const info = await githubJson<RepoInfo>(`/repos/${normalizeRepo(input.repo)}`, token);
    const branch = input.branch?.trim() || '';
    const docsPath = input.docsPath?.trim().replace(/^\/+/, '') || '';

    let document: ParsedDocument | null = null;
    if (docsPath) {
      document = (await readDocument(info.full_name, docsPath, branch || info.default_branch, token)).document;
      if (!document.itemCount) {
        throw ApiError.badRequest(
          'NO_TASKS_FOUND',
          `No tasks were found in ${docsPath}. Use headings for sections and bullet or checkbox lists for tasks`
        );
      }
    }

    let projectId = input.projectId;
    if (!projectId) {
      const created = await projectService.create(workspaceId, userId, {
        name: input.projectName?.trim() || document?.title || info.name,
        key: input.projectKey,
        description: `Synced from https://github.com/${info.full_name}`,
      });
      projectId = created.id as string;
    }

    const { integration, apiKey } = await integrationService.create(workspaceId, userId, {
      name: info.full_name,
      projectId,
      description: `https://github.com/${info.full_name}`,
    });
    await githubService.configure(workspaceId, integration.id, {
      repo: info.full_name,
      branch,
      docsPath,
      token,
      autoSync: input.autoSync ?? true,
    });

    let sync: Awaited<ReturnType<typeof pollIntegration>> | null = null;
    let syncError: string | undefined;
    try {
      sync = await pollIntegration(await findOwned(workspaceId, integration.id), { sinceDays: input.sinceDays ?? 30 });
    } catch (error) {
      syncError = error instanceof Error ? error.message : 'Initial sync failed';
    }

    const [presented] = await presentIntegrations([await findOwned(workspaceId, integration.id)]);
    const project = await Project.findOne({ id: projectId }).select('id name key');
    return {
      integration: presented,
      apiKey,
      project: project ? { id: project.id as string, name: project.name, key: project.key } : null,
      sync: sync ? { message: sync.message, commits: sync.commits, document: sync.document } : null,
      syncError,
    };
  },

  async configure(
    workspaceId: string,
    integrationId: string,
    input: { repo: string; branch?: string; docsPath?: string; token?: string | null; autoSync?: boolean }
  ) {
    const integration = await findOwned(workspaceId, integrationId);
    const repo = normalizeRepo(input.repo);
    const current = integration.github;
    const tokenEnc =
      input.token === undefined ? current?.tokenEnc : input.token ? encryptSecret(input.token.trim()) : undefined;
    const repoChanged = current?.repo?.toLowerCase() !== repo.toLowerCase();
    const docsPath = (input.docsPath ?? current?.docsPath ?? '').trim().replace(/^\/+/, '');
    if (docsPath) detectFormat(docsPath);
    integration.set('github', {
      repo,
      branch: (input.branch ?? current?.branch ?? '').trim(),
      docsPath,
      tokenEnc,
      webhookSecretEnc: current?.webhookSecretEnc,
      autoSync: input.autoSync ?? current?.autoSync ?? true,
      lastSyncedAt: repoChanged ? new Date() : current?.lastSyncedAt,
      lastDocSha: repoChanged || docsPath !== current?.docsPath ? undefined : current?.lastDocSha,
      lastEventAt: current?.lastEventAt,
      lastEventStatus: current?.lastEventStatus,
      lastEventMessage: current?.lastEventMessage ?? '',
    });
    await integration.save();
    const [presented] = await presentIntegrations([integration]);
    return presented;
  },

  async disconnect(workspaceId: string, integrationId: string) {
    const integration = await findOwned(workspaceId, integrationId);
    integration.set('github', undefined);
    await integration.save();
    const [presented] = await presentIntegrations([integration]);
    return presented;
  },

  async regenerateWebhookSecret(workspaceId: string, integrationId: string) {
    const integration = await findOwned(workspaceId, integrationId);
    if (!integration.github) {
      throw ApiError.badRequest('GITHUB_NOT_CONFIGURED', 'Connect a GitHub repository first');
    }
    const secret = crypto.randomBytes(24).toString('hex');
    await Integration.updateOne({ id: integration.id }, { $set: { 'github.webhookSecretEnc': encryptSecret(secret) } });
    return { webhookUrl: `${env.apiPublicUrl}/api/v1/webhooks/github/${integration.id}`, secret };
  },

  async test(workspaceId: string, integrationId: string) {
    const integration = await findOwned(workspaceId, integrationId);
    if (!integration.github) {
      throw ApiError.badRequest('GITHUB_NOT_CONFIGURED', 'Connect a GitHub repository first');
    }
    const token = tokenOf(integration);
    const repo = await githubJson<{ full_name: string; private: boolean; default_branch: string }>(
      `/repos/${integration.github.repo}`,
      token
    );
    let docFound: boolean | null = null;
    if (integration.github.docsPath) {
      await githubFetch(contentsRoute(repo.full_name, integration.github.docsPath, integration.github.branch || undefined), token);
      docFound = true;
    }
    return { repo: repo.full_name, private: repo.private, defaultBranch: repo.default_branch, docFound };
  },

  async syncNow(workspaceId: string, integrationId: string, sinceDays?: number) {
    const integration = await findOwned(workspaceId, integrationId);
    return pollIntegration(integration, { sinceDays });
  },

  async handleWebhook(
    integrationId: string,
    input: { event?: string; signature?: string; rawBody?: Buffer; payload: PushPayload }
  ) {
    const integration = await Integration.findOne({ id: integrationId });
    const github = integration?.github;
    if (!integration || !github?.webhookSecretEnc) {
      throw ApiError.notFound('WEBHOOK_NOT_FOUND', 'Webhook is not configured for this integration');
    }
    if (!input.rawBody || !verifySignature(decryptSecret(github.webhookSecretEnc), input.rawBody, input.signature)) {
      throw ApiError.unauthorized('Invalid webhook signature');
    }

    if (input.event === 'ping') {
      await recordEvent(integrationId, 'OK', 'Webhook connected');
      return { event: 'ping', ok: true };
    }
    if (input.event !== 'push') {
      return { event: input.event ?? 'unknown', ignored: true };
    }

    const payload = input.payload;
    const branch = payload.ref?.replace(/^refs\/heads\//, '') ?? '';
    if (payload.repository?.full_name && payload.repository.full_name.toLowerCase() !== github.repo.toLowerCase()) {
      await recordEvent(integrationId, 'ERROR', `Ignored push from ${payload.repository.full_name}`);
      return { event: 'push', ignored: true, reason: 'repository mismatch' };
    }
    if (github.branch && branch !== github.branch) {
      return { event: 'push', ignored: true, reason: `branch ${branch}` };
    }

    try {
      const ctx = await integrationService.contextFor(integrationId);
      const pushed = (payload.commits ?? []).filter((commit) => commit.distinct !== false);

      let document: Awaited<ReturnType<typeof syncDocument>> | null = null;
      const docsPath = github.docsPath;
      const touched = docsPath && pushed.some((commit) => [...(commit.added ?? []), ...(commit.modified ?? [])].includes(docsPath));
      if (touched && payload.after) {
        document = await syncDocument(ctx, docsPath, await fetchFile(github.repo, docsPath, payload.after, tokenOf(integration)));
      }

      const commits = await processCommits(
        ctx,
        pushed.map((commit) => ({ sha: commit.id, message: commit.message, url: commit.url, author: commit.author?.name }))
      );

      const message = describe(commits, document);
      await recordEvent(integrationId, document && !document.ok ? 'ERROR' : 'OK', `Push to ${branch}: ${message}`, {
        ...(touched ? { 'github.lastDocSha': payload.after } : {}),
      });
      return { event: 'push', commits, document };
    } catch (error) {
      await recordEvent(integrationId, 'ERROR', error instanceof Error ? error.message : 'Webhook failed');
      throw error;
    }
  },
};

let pollerRunning = false;

export function startGithubPoller() {
  if (!(env.githubPollMinutes > 0)) return;
  const run = async () => {
    if (pollerRunning) return;
    pollerRunning = true;
    try {
      const integrations = await Integration.find({
        status: 'ACTIVE',
        'github.repo': { $exists: true },
        'github.autoSync': true,
      });
      for (const integration of integrations) {
        await pollIntegration(integration).catch((error) =>
          logger.warn('GitHub sync failed', { integrationId: integration.id, error: (error as Error).message })
        );
      }
    } finally {
      pollerRunning = false;
    }
  };
  setInterval(() => void run(), env.githubPollMinutes * 60 * 1000).unref();
}

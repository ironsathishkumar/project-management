#!/usr/bin/env node
// Push task updates from any application or CI job to Project Tracker.
// Requires Node 18+. Configure with PM_API_URL (e.g. http://localhost:4000/api/v1) and PM_API_KEY.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function repoRoot() {
  try {
    return git(['rev-parse', '--show-toplevel']);
  } catch {
    return null;
  }
}

function loadEnvFile() {
  const root = repoRoot();
  const file = root ? join(root, '.pm-sync.env') : null;
  if (!file || !existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

loadEnvFile();

const API_URL = (process.env.PM_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const API_KEY = process.env.PM_API_KEY;

const USAGE = `Usage: pm-sync <command> [args]

  me                                       Show the connected project and valid statuses
  status  <ref> <status> [-m "comment"]    Move a task (ref = task key like BANK-4, or your externalKey)
  upsert  <externalKey> "<title>" [--status s] [--section s] [--description d] [-m "comment"]
  comment <ref> "<text>"                   Add a comment to a task
  doc     <file> [--dry-run]               Sync an implementation document (.md, .docx, .pdf, .txt)
  list    [--status s] [--mine]            List tasks in the project
  commits [git log args]                   Send commits (default: the last one) so "fixes KEY-4" / "KEY-4 done"
                                           update tasks; also re-syncs PM_DOCS_PATH if those commits changed it
  install-hook                             Run "commits" automatically after every commit in this repository

Settings come from the environment or a .pm-sync.env file in the repository root:
  PM_API_URL, PM_API_KEY, PM_DOCS_PATH (optional, e.g. docs/implementation.md)`;

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-m') flags.comment = argv[++index];
    else if (arg.startsWith('--')) {
      const name = arg.slice(2);
      const next = argv[index + 1];
      flags[name] = next === undefined || next.startsWith('-') ? true : argv[++index];
    } else positional.push(arg);
  }
  return { positional, flags };
}

async function call(method, path, body) {
  const headers = { 'x-api-key': API_KEY };
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${API_URL}${path}`, { method, headers, body: payload });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    throw new Error(json?.error?.message ?? `Request failed with HTTP ${response.status}`);
  }
  return json.data;
}

function requireArgs(values, count) {
  if (values.length < count) {
    console.error(USAGE);
    process.exit(2);
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help') {
    console.log(USAGE);
    return;
  }
  if (command === 'install-hook') {
    await installHook();
    return;
  }
  if (!API_KEY) throw new Error('PM_API_KEY is not set (environment or .pm-sync.env)');
  if (command === 'commits') {
    await sendCommits(rest);
    return;
  }
  const { positional, flags } = parseArgs(rest);

  switch (command) {
    case 'me': {
      const data = await call('GET', '/app/me');
      console.log(`${data.integration.name} → ${data.project.key} · ${data.project.name}`);
      console.log(`Statuses: ${data.statuses.map((status) => status.key).join(', ')}`);
      break;
    }
    case 'status': {
      requireArgs(positional, 2);
      const [ref, status] = positional;
      const data = await call('PATCH', `/app/tasks/${encodeURIComponent(ref)}`, { status, comment: flags.comment });
      console.log(`${data.task.key} → ${data.task.status?.name} (${data.action})`);
      break;
    }
    case 'upsert': {
      requireArgs(positional, 2);
      const [externalKey, title] = positional;
      const data = await call('POST', '/app/tasks', {
        externalKey,
        title,
        status: flags.status,
        section: flags.section,
        description: flags.description,
        comment: flags.comment,
      });
      console.log(`${data.task.key} ${data.action}: ${data.task.title} [${data.task.status?.name}]`);
      break;
    }
    case 'comment': {
      requireArgs(positional, 2);
      const data = await call('POST', `/app/tasks/${encodeURIComponent(positional[0])}/comments`, {
        content: positional[1],
      });
      console.log(`Commented on ${data.key}`);
      break;
    }
    case 'doc': {
      requireArgs(positional, 1);
      const data = await syncDoc(positional[0], Boolean(flags['dry-run']));
      const { CREATE, COMPLETE, UPDATE, UNCHANGED, REMOVED } = data.counts;
      console.log(
        `${data.dryRun ? 'Dry run' : 'Synced'}: ${CREATE} new, ${COMPLETE} done, ${UPDATE} updated, ${UNCHANGED} unchanged, ${REMOVED} not in document`
      );
      break;
    }
    case 'list': {
      const params = new URLSearchParams();
      if (typeof flags.status === 'string') params.set('status', flags.status);
      if (flags.mine) params.set('source', 'mine');
      const tasks = await call('GET', `/app/tasks${params.size ? `?${params}` : ''}`);
      for (const task of tasks) {
        console.log(`${task.key}\t${task.status?.key ?? '-'}\t${task.title}${task.externalKey ? `\t(${task.externalKey})` : ''}`);
      }
      break;
    }
    default:
      console.error(`Unknown command "${command}"\n\n${USAGE}`);
      process.exit(2);
  }
}

async function syncDoc(file, dryRun) {
  const form = new FormData();
  form.append('file', new Blob([await readFile(file)]), basename(file));
  return call('POST', `/app/document${dryRun ? '?dryRun=true' : ''}`, form);
}

async function sendCommits(logArgs) {
  const root = repoRoot();
  if (!root) throw new Error('Not inside a git repository');
  const range = logArgs.length ? logArgs : ['-1'];
  const raw = git(['log', '--format=%H%x1f%an%x1f%B%x1e', ...range]);
  const commits = raw
    .split('\x1e')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [sha, author, message] = entry.split('\x1f');
      return { sha, author, message: message.trim() };
    })
    .reverse();
  if (!commits.length) {
    console.log('No commits to send');
    return;
  }
  let branch;
  try {
    branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  } catch {
    branch = undefined;
  }
  const data = await call('POST', '/app/commits', { branch, commits });
  for (const result of data.results) {
    const refs = result.refs.map((ref) => `${ref.key}${ref.status ? ` → ${ref.status}` : ''}${ref.error ? ` (${ref.error})` : ''}`);
    console.log(`${result.sha} ${result.skipped ? `skipped (${result.skipped})` : refs.length ? refs.join(', ') : 'no task references'}`);
  }

  const docsPath = process.env.PM_DOCS_PATH;
  if (docsPath) {
    const changed = git(['log', '--format=', '--name-only', ...range]).split('\n').map((line) => line.trim());
    if (changed.includes(docsPath.replace(/^\/+/, ''))) {
      const result = await syncDoc(join(root, docsPath), false);
      const { CREATE, COMPLETE, UPDATE } = result.counts;
      console.log(`Document synced: ${CREATE} new, ${COMPLETE} done, ${UPDATE} updated`);
    }
  }
}

async function installHook() {
  const root = repoRoot();
  if (!root) throw new Error('Not inside a git repository');
  const hooksDir = resolve(root, git(['rev-parse', '--git-path', 'hooks']));
  const hookPath = join(hooksDir, 'post-commit');
  const script = fileURLToPath(import.meta.url);
  const marker = '# pm-sync';
  const line = `(node "${script}" commits -1 >> "$(git rev-parse --git-dir)/pm-sync.log" 2>&1 &) ${marker}`;
  const existing = existsSync(hookPath) ? await readFile(hookPath, 'utf8') : '#!/bin/sh\n';
  if (existing.includes(marker)) {
    console.log(`Hook already installed: ${hookPath}`);
    return;
  }
  await writeFile(hookPath, `${existing.trimEnd()}\n${line}\n`);
  await chmod(hookPath, 0o755);
  if (!existsSync(join(root, '.pm-sync.env'))) {
    console.log('Create .pm-sync.env in the repository root with PM_API_URL and PM_API_KEY (keep it out of git).');
  }
  console.log(`Installed post-commit hook: ${hookPath}\nLog: ${resolve(root, git(['rev-parse', '--git-dir']), 'pm-sync.log')}`);
}

main().catch((error) => {
  console.error(`pm-sync: ${error.message}`);
  process.exit(1);
});

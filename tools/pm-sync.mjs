#!/usr/bin/env node
// Push task updates from any application or CI job to Project Tracker.
// Requires Node 18+. Configure with PM_API_URL (e.g. http://localhost:4000/api/v1) and PM_API_KEY.

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const API_URL = (process.env.PM_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const API_KEY = process.env.PM_API_KEY;

const USAGE = `Usage: pm-sync <command> [args]

  me                                       Show the connected project and valid statuses
  status  <ref> <status> [-m "comment"]    Move a task (ref = task key like BANK-4, or your externalKey)
  upsert  <externalKey> "<title>" [--status s] [--section s] [--description d] [-m "comment"]
  comment <ref> "<text>"                   Add a comment to a task
  doc     <file> [--dry-run]               Sync an implementation document (.md, .docx, .pdf, .txt)
  list    [--status s] [--mine]            List tasks in the project

Environment: PM_API_URL, PM_API_KEY`;

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
  if (!API_KEY) throw new Error('PM_API_KEY is not set');
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
      const file = positional[0];
      const form = new FormData();
      form.append('file', new Blob([await readFile(file)]), basename(file));
      const data = await call('POST', `/app/document${flags['dry-run'] ? '?dryRun=true' : ''}`, form);
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

main().catch((error) => {
  console.error(`pm-sync: ${error.message}`);
  process.exit(1);
});

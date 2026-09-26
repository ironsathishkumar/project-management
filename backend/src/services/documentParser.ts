import path from 'path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { ApiError } from '../utils/ApiError';

export type DocumentFormat = 'markdown' | 'text' | 'docx' | 'pdf';

export interface ParsedItem {
  externalKey: string;
  title: string;
  description: string;
  section: string;
  done: boolean;
}

export interface ParsedSection {
  title: string;
  items: ParsedItem[];
}

export interface ParsedDocument {
  fileName: string;
  format: DocumentFormat;
  title: string;
  mode: 'checklist' | 'list' | 'headings';
  sections: ParsedSection[];
  itemCount: number;
  doneCount: number;
}

type Block =
  | { type: 'heading'; level: number; text: string; inferred?: boolean }
  | { type: 'item'; indent: number; checked: boolean | null; text: string }
  | { type: 'text'; text: string };

const EXTENSIONS: Record<string, DocumentFormat> = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.txt': 'text',
  '.docx': 'docx',
  '.pdf': 'pdf',
};

const GENERAL_SECTION = 'General';
const MAX_TITLE = 200;

export function detectFormat(fileName: string): DocumentFormat {
  const ext = path.extname(fileName).toLowerCase();
  const format = EXTENSIONS[ext];
  if (!format) {
    if (ext === '.doc') {
      throw ApiError.badRequest('UNSUPPORTED_DOCUMENT', 'Legacy .doc files are not supported. Save the file as .docx');
    }
    throw ApiError.badRequest(
      'UNSUPPORTED_DOCUMENT',
      'Unsupported document type. Use Markdown (.md), text (.txt), Word (.docx) or PDF (.pdf)'
    );
  }
  return format;
}

export async function extractText(buffer: Buffer, format: DocumentFormat): Promise<string> {
  switch (format) {
    case 'markdown':
    case 'text':
      return buffer.toString('utf8');
    case 'docx': {
      const { value } = await mammoth.convertToHtml({ buffer });
      return htmlToMarkdown(value);
    }
    case 'pdf': {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        return result.text;
      } finally {
        await parser.destroy();
      }
    }
  }
}

export async function parseDocumentFile(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
  const format = detectFormat(fileName);
  let text: string;
  try {
    text = await extractText(buffer, format);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.badRequest('DOCUMENT_UNREADABLE', 'The document could not be read. Check that the file is not corrupted');
  }
  return parseDocumentText(text, { fileName, format });
}

export function parseDocumentText(
  text: string,
  options: { fileName: string; format: DocumentFormat }
): ParsedDocument {
  const blocks = toBlocks(text, options.format !== 'markdown');
  const hasCheckbox = blocks.some((block) => block.type === 'item' && block.checked !== null);
  const hasItems = blocks.some((block) => block.type === 'item');
  const mode: ParsedDocument['mode'] = hasCheckbox ? 'checklist' : hasItems ? 'list' : 'headings';

  const headings = blocks.filter((block): block is Extract<Block, { type: 'heading' }> => block.type === 'heading');
  const topLevel = headings.filter((heading) => heading.level === 1);
  const first = blocks[0];
  const titleHeading =
    first?.type === 'heading' && first.level === 1 ? first : topLevel.length === 1 ? topLevel[0] : undefined;
  const title = (titleHeading && cleanInline(titleHeading.text)) || humanizeFileName(options.fileName);

  const sectionLevel = pickSectionLevel(headings, titleHeading, mode);
  const sections = new Map<string, ParsedSection>();
  const usedKeys = new Map<string, number>();
  let currentSection = GENERAL_SECTION;
  let current: ParsedItem | null = null;
  let currentIndent = 0;

  const sectionFor = (name: string) => {
    let section = sections.get(name);
    if (!section) {
      section = { title: name, items: [] };
      sections.set(name, section);
    }
    return section;
  };

  const pushItem = (rawText: string, done: boolean) => {
    const { title: itemTitle, rest } = splitTitle(cleanInline(rawText));
    if (!itemTitle) return null;
    const baseKey = `${slugify(currentSection)}::${slugify(itemTitle)}`;
    const seen = usedKeys.get(baseKey) ?? 0;
    usedKeys.set(baseKey, seen + 1);
    const item: ParsedItem = {
      externalKey: seen ? `${baseKey}#${seen + 1}` : baseKey,
      title: itemTitle,
      description: rest,
      section: currentSection,
      done,
    };
    sectionFor(currentSection).items.push(item);
    return item;
  };

  const appendDescription = (line: string) => {
    if (!current) return;
    current.description = current.description ? `${current.description}\n${line}` : line;
  };

  for (const block of blocks) {
    if (block.type === 'heading') {
      if (block === titleHeading) {
        current = null;
        continue;
      }
      if (mode === 'headings' && block.level > sectionLevel) {
        current = pushItem(block.text, false);
        currentIndent = 0;
        continue;
      }
      if (block.level <= sectionLevel || mode !== 'headings') {
        currentSection = cleanInline(block.text) || GENERAL_SECTION;
        current = null;
      }
      continue;
    }

    if (block.type === 'item') {
      const isTask =
        mode === 'checklist' ? block.checked !== null : mode === 'list' ? !current || block.indent <= currentIndent : false;
      if (isTask) {
        current = pushItem(block.text, block.checked === true);
        currentIndent = block.indent;
      } else {
        appendDescription(`- ${cleanInline(block.text)}`);
      }
      continue;
    }

    if (mode === 'headings') {
      appendDescription(cleanInline(block.text));
    } else {
      current = null;
    }
  }

  const ordered = [...sections.values()].filter((section) => section.items.length > 0);
  for (const section of ordered) {
    for (const item of section.items) {
      item.description = item.description.trim();
    }
  }
  const items = ordered.flatMap((section) => section.items);

  return {
    fileName: options.fileName,
    format: options.format,
    title,
    mode,
    sections: ordered,
    itemCount: items.length,
    doneCount: items.filter((item) => item.done).length,
  };
}

function pickSectionLevel(
  headings: Array<{ level: number }>,
  titleHeading: { level: number } | undefined,
  mode: ParsedDocument['mode']
): number {
  const rest = headings.filter((heading) => heading !== titleHeading);
  if (!rest.length) return 1;
  const levels = [...new Set(rest.map((heading) => heading.level))].sort((a, b) => a - b);
  if (mode === 'headings') {
    return levels.length > 1 ? levels[0] : 0;
  }
  return levels[levels.length - 1];
}

const CHECKED_MARKS = /^[☑☒✅✔✓]\s*/;
const UNCHECKED_MARKS = /^[☐□▢]\s*/;

function toBlocks(text: string, inferHeadings: boolean): Block[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index].replace(/\t/g, '    ');
    const line = raw.trim();
    if (/^(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || !line || /^-- \d+ of \d+ --$/.test(line) || /^[-*_]{3,}$/.test(line)) {
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*?)\s*#*$/);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      continue;
    }

    const indent = raw.length - raw.trimStart().length;
    const listItem = line.match(/^(?:[-*+•◦▪‣●○]|\d+[.)])\s+(.*)$/);
    if (listItem) {
      blocks.push(toItem(indent, listItem[1]));
      continue;
    }
    if (CHECKED_MARKS.test(line) || UNCHECKED_MARKS.test(line)) {
      blocks.push(toItem(indent, line));
      continue;
    }

    const previous = blocks[blocks.length - 1];
    if (inferHeadings && previous?.type === 'item' && (indent > previous.indent || /^[a-z(]/.test(line))) {
      previous.text = `${previous.text} ${line}`;
      continue;
    }

    const isFirstLine = blocks.length === 0 && line.length <= 80 && !/[.,;:]$/.test(line);
    if (inferHeadings && (isFirstLine || looksLikeHeading(line, lines[index + 1]?.trim() ?? ''))) {
      blocks.push({ type: 'heading', level: 2, text: line.replace(/:$/, ''), inferred: true });
      continue;
    }

    blocks.push({ type: 'text', text: line });
  }

  const first = blocks[0];
  if (first?.type === 'heading' && first.inferred) {
    blocks[0] = { ...first, level: 1 };
  }
  return blocks;
}

function toItem(indent: number, body: string): Block {
  const box = body.match(/^\[( |x|X)\]\s*(.*)$/);
  if (box) {
    return { type: 'item', indent, checked: box[1].toLowerCase() === 'x', text: box[2] };
  }
  if (CHECKED_MARKS.test(body)) {
    return { type: 'item', indent, checked: true, text: body.replace(CHECKED_MARKS, '') };
  }
  if (UNCHECKED_MARKS.test(body)) {
    return { type: 'item', indent, checked: false, text: body.replace(UNCHECKED_MARKS, '') };
  }
  const trailing = body.match(/^(.*?)\s*([☑☒✅✔✓☐□▢])$/);
  if (trailing) {
    return { type: 'item', indent, checked: !/[☐□▢]/.test(trailing[2]), text: trailing[1] };
  }
  return { type: 'item', indent, checked: null, text: body };
}

function looksLikeHeading(line: string, next: string): boolean {
  if (line.length > 80 || /[.,;]$/.test(line)) return false;
  if (/:$/.test(line)) return true;
  const nextIsItem = /^(?:[-*+•◦▪‣●○☐□▢☑☒✅✔✓]|\d+[.)]\s)/.test(next);
  return nextIsItem && /^[A-Z0-9]/.test(line);
}

function htmlToMarkdown(html: string): string {
  const out: string[] = [];
  let depth = 0;
  const tokens = html.split(/(<\/?(?:h[1-6]|p|li|ul|ol)[^>]*>)/i);
  let buffer = '';
  let prefix = '';

  const flush = () => {
    const text = decodeEntities(buffer.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).trim();
    if (text) out.push(`${prefix}${text}`);
    buffer = '';
    prefix = '';
  };

  for (const token of tokens) {
    const tag = token.match(/^<(\/?)(h[1-6]|p|li|ul|ol)\b/i);
    if (!tag) {
      buffer += token;
      continue;
    }
    const closing = tag[1] === '/';
    const name = tag[2].toLowerCase();
    if (name === 'ul' || name === 'ol') {
      flush();
      depth = Math.max(0, depth + (closing ? -1 : 1));
      continue;
    }
    flush();
    if (closing) continue;
    if (name.startsWith('h')) prefix = `${'#'.repeat(Number(name[1]))} `;
    else if (name === 'li') prefix = `${'  '.repeat(Math.max(0, depth - 1))}- `;
  }
  flush();
  return out.join('\n');
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function cleanInline(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^*])\*(?!\s)([^*]+)\*/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitTitle(value: string): { title: string; rest: string } {
  if (value.length <= MAX_TITLE) return { title: value, rest: '' };
  const sentence = value.slice(0, MAX_TITLE).match(/^(.{20,}?[.!?])\s/);
  const cut = sentence ? sentence[1].length : MAX_TITLE;
  return { title: value.slice(0, cut).trim(), rest: value.slice(cut).trim() };
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_-]+/g, '-')
      .slice(0, 80) || 'item'
  );
}

function humanizeFileName(fileName: string): string {
  return path
    .basename(fileName, path.extname(fileName))
    .replace(/^\d+[-_ ]*/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim() || 'Imported project';
}

import { randomUUID } from 'crypto';

export function createPublicId(): string {
  return randomUUID();
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function keyify(value: string): string {
  return value
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

export function entityId(doc: { id?: string | null }): string {
  if (!doc.id) {
    throw new Error('Document is missing a public id');
  }
  return doc.id;
}

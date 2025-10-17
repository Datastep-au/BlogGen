import crypto from 'crypto';
import { marked } from 'marked';

const NAMESPACE_UUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // DNS namespace UUID

export function generateContentHash(data: {
  siteId: string;
  slug: string;
  title: string;
  bodyMd: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  tags?: string[];
}): string {
  const normalizedData = {
    siteId: data.siteId,
    slug: data.slug,
    title: data.title.trim(),
    bodyMd: data.bodyMd.trim(),
    metaTitle: data.metaTitle?.trim() || '',
    metaDescription: data.metaDescription?.trim() || '',
    tags: (data.tags || []).sort().join(',')
  };

  const contentString = JSON.stringify(normalizedData);
  return uuidv5(contentString, NAMESPACE_UUID);
}

function uuidv5(name: string, namespace: string): string {
  const hash = crypto
    .createHash('sha1')
    .update(Buffer.from(namespace.replace(/-/g, ''), 'hex'))
    .update(name)
    .digest();

  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;

  return [
    hash.subarray(0, 4).toString('hex'),
    hash.subarray(4, 6).toString('hex'),
    hash.subarray(6, 8).toString('hex'),
    hash.subarray(8, 10).toString('hex'),
    hash.subarray(10, 16).toString('hex'),
  ].join('-');
}

export async function renderMarkdownToHtml(markdown: string): Promise<string> {
  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  const html = await marked(markdown);
  return html;
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export function deduplicateSlug(baseSlug: string, existingSlugs: string[]): string {
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }

  let counter = 1;
  let newSlug = `${baseSlug}-${counter}`;

  while (existingSlugs.includes(newSlug)) {
    counter++;
    newSlug = `${baseSlug}-${counter}`;
  }

  return newSlug;
}

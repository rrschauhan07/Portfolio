import { getCollection, type CollectionEntry } from 'astro:content';

export type Writeup = CollectionEntry<'writeups'>;

const includeDrafts = import.meta.env.DEV;

export async function getWriteups(): Promise<Writeup[]> {
  const posts = await getCollection('writeups', ({ data }) => includeDrafts || !data.draft);
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function readingTime(body?: string): number {
  if (!body) return 1;
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_\-`{}[\]()]/g, ' ')
    .trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

export function writeupHref(post: Writeup): string {
  return `/writeups/${post.id}/`;
}

export async function getAdjacentWriteups(current: Writeup): Promise<{
  newer?: Writeup;
  older?: Writeup;
}> {
  const posts = await getWriteups();
  const index = posts.findIndex((post) => post.id === current.id);
  return {
    newer: index > 0 ? posts[index - 1] : undefined,
    older: index >= 0 && index < posts.length - 1 ? posts[index + 1] : undefined,
  };
}

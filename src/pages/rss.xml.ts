import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getWriteups, writeupHref } from '@/lib/content';
import { site } from '@/data/site';

export const GET: APIRoute = async (context) => {
  const posts = await getWriteups();
  const siteUrl = context.site ?? new URL('https://your-domain.com');

  return rss({
    title: `${site.name} — Writeups`,
    description:
      'Cybersecurity writeups, vulnerability research, technical articles, and CTF notes by Rishi Raj Singh Chauhan.',
    site: siteUrl,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: new URL(writeupHref(post), siteUrl).toString(),
      categories: [post.data.category, ...post.data.tags],
    })),
    customData: '<language>en-gb</language>',
  });
};

import { articles } from '../frontend/app/blog/articles';
import { mkdirSync, writeFileSync } from 'node:fs';

function blockText(block) {
  switch (block.type) {
    case 'p':
    case 'h2':
    case 'h3':
    case 'code':
      return block.text;
    case 'list':
      return block.items.join(' ');
    case 'callout':
      return `${block.title}. ${block.text}`;
    case 'example': {
      const media = block.example.media.map((m) => m.caption || '').join(' ');
      const input = block.example.input?.caption || '';
      return [block.example.label, block.example.prompt, block.example.note, input, media].filter(Boolean).join(' ');
    }
    default:
      return '';
  }
}

const index = articles.map((article) => ({
  slug: article.slug,
  title: article.title,
  excerpt: article.excerpt,
  category: article.category,
  date: article.date,
  text: article.blocks.map(blockText).filter(Boolean).join('\n').slice(0, 4000),
}));

mkdirSync('../frontend/public/blog', { recursive: true });
writeFileSync('../frontend/public/blog/search-index.json', JSON.stringify(index));
console.log(`blog search index: ${index.length} posts`);

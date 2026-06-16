import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:8000/graphql';
const OUTPUT_DIR = path.join(process.cwd(), 'src', 'data', 'pages');

async function fetchAPI(query) {
  const headers = { 'Content-Type': 'application/json' };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  });

  const json = await res.json();
  if (json.errors) {
    console.error(json.errors);
    throw new Error('Failed to fetch API');
  }

  return json.data;
}

async function extractPages() {
  console.log('Extraiendo páginas desde WPGraphQL...');

  const query = `
    {
      pages(first: 100) {
        nodes {
          slug
          title
          content
        }
      }
    }
  `;

  try {
    const data = await fetchAPI(query);
    const pages = data?.pages?.nodes || [];

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    let count = 0;
    for (const page of pages) {
      if (!page.slug) continue;
      
      const filePath = path.join(OUTPUT_DIR, `${page.slug}.md`);
      
      // Crear Frontmatter
      // Limpiamos los tabs/espacios al inicio de cada línea para evitar que Markdown lo tome como código (<pre>)
      const cleanContent = page.content.replace(/^\s+/gm, '');
      
      const markdownContent = `---
slug: "${page.slug}"
title: "${page.title.replace(/"/g, '\\"')}"
---

${cleanContent}
`;
      
      fs.writeFileSync(filePath, markdownContent);
      count++;
      console.log(`✓ Extraída a Markdown: ${page.slug}.md`);
    }

    console.log(`¡Extracción completada! ${count} páginas guardadas en formato Markdown en ${OUTPUT_DIR}`);
  } catch (error) {
    console.error('Error durante la extracción:', error.message);
  }
}

extractPages();

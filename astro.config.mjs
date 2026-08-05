// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://visitcholula.mx',
  server: {
    port: 4600
  },
  // El español no lleva prefijo: /donde-comer ya está indexado y no debe moverse.
  // El resto de idiomas vive bajo su prefijo: /en/where-to-eat.
  // Debe coincidir con src/i18n/config.ts.
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  image: {
    domains: ["visitcholula.mx"]
  },
  integrations: [
    react(),
    sitemap({
      // Excluir páginas internas si las hubiera.
      // `/en/` queda fuera mientras la traducción esté incompleta: indexar
      // contenido en español bajo URLs /en/ es contenido duplicado.
      // Quitar ese filtro junto con DRAFT_LOCALES en src/i18n/config.ts.
      filter: (page) => !page.includes('/api/') && !page.includes('/en/'),
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      customPages: [],
      i18n: {
        defaultLocale: 'es',
        locales: { es: 'es-MX', en: 'en-US' },
      },
    }),
  ],
});
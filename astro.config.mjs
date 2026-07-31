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
  image: {
    domains: ["visitcholula.mx"]
  },
  integrations: [
    react(),
    sitemap({
      // Excluir páginas internas si las hubiera
      filter: (page) => !page.includes('/api/'),
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      customPages: [],
      i18n: {
        defaultLocale: 'es',
        locales: { es: 'es-MX' },
      },
    }),
  ],
});
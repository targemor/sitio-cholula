const https = require('https');

const url = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://visit-cholula.vercel.app&strategy=mobile';

console.log('Fetching PageSpeed Insights mobile audit...');
https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.error) {
        console.error('API Error:', json.error.message);
        return;
      }
      const audits = json.lighthouseResult.audits;
      const categories = json.lighthouseResult.categories;
      console.log('Mobile Score:', categories.performance.score * 100);
      console.log('FCP:', audits['first-contentful-paint'].displayValue);
      console.log('LCP:', audits['largest-contentful-paint'].displayValue);
      console.log('TBT:', audits['total-blocking-time'].displayValue);
      console.log('CLS:', audits['cumulative-layout-shift'].displayValue);
      console.log('Speed Index:', audits['speed-index'].displayValue);

      console.log('\n--- TOP OPPORTUNITIES & ISSUES ---');
      for (const [key, audit] of Object.entries(audits)) {
        if (audit.score !== null && audit.score < 0.9 && (audit.details?.type === 'opportunity' || audit.details?.type === 'table')) {
          console.log(`\n[${audit.score}] ${audit.title} - ${audit.displayValue || ''}`);
          if (audit.details?.items) {
            audit.details.items.slice(0, 5).forEach(item => {
              const u = item.url || item.node?.snippet || item.source || JSON.stringify(item);
              console.log('   ->', typeof u === 'string' ? u.slice(0, 120) : u);
            });
          }
        }
      }
    } catch(e) {
      console.error('Parse error:', e.message);
    }
  });
}).on('error', err => console.error('Fetch error:', err.message));

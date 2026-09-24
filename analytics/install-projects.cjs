// Run once from the portfolio checkout to integrate the two local project sites.
const fs = require('node:fs');
const path = require('node:path');
const base = 'C:/Users/kenny/Data Science Projects';
const script = '<script src="https://kennethlow.com/analytics/posthog.js"></script>';
const privacy = '<p class="analytics-privacy"><a href="https://kennethlow.com/privacy.html">Privacy &amp; analytics preferences</a></p>';
function edit(relative, transform) {
  const file = path.join(base, relative);
  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);
  if (before !== after) { fs.writeFileSync(file, after); console.log('Updated ' + relative); }
}
for (const file of ['us-migration/website/index.html', 'quoll-intelligence/src/housing_climate_risk/page_data/web/page.html', 'quoll-intelligence/output/index.html']) {
  edit(file, text => {
    if (!text.includes('<head>')) throw Error('Missing head: ' + file);
    if (!text.includes(script)) text = text.replace('<head>', '<head>\n' + script);
    if (!text.includes('class="analytics-privacy"')) text = text.replace('</body>', privacy + '\n</body>');
    return text;
  });
}
edit('us-migration/website/app.js', text => {
  const marker = ".catch(error=>{$('#main').innerHTML=";
  if (text.includes("component: 'atlas-bootstrap'")) return text;
  if (!text.includes(marker)) throw Error('Atlas error handler changed; inspect before editing');
  return text.replace(marker, ".catch(error=>{window.portfolioTelemetry?.reportError(error, { component: 'atlas-bootstrap' });$('#main').innerHTML=");
});

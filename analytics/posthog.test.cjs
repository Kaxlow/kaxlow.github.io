const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(__dirname + '/posthog.js', 'utf8');
function boot({ path = '/', host = 'kennethlow.com', token = true, optOut = false, dnt = false, gpc = false } = {}) {
  const listeners = {}, inserted = [], storage = new Map();
  if (optOut) storage.set('portfolio-analytics-disabled', 'true');
  const window = { addEventListener: (name, fn) => { listeners[name] = fn; } };
  const context = {
    window, URL, navigator: { doNotTrack: dnt ? '1' : '0', globalPrivacyControl: gpc },
    location: { hostname: host, pathname: path, origin: 'https://' + host, href: 'https://' + host + path, hash: '', reload() {} },
    localStorage: { getItem: key => storage.get(key), setItem: (key, val) => storage.set(key, val) },
    document: { createElement: () => ({}), getElementsByTagName: () => [{ parentNode: { insertBefore: el => inserted.push(el) } }], addEventListener: (name, fn) => { listeners[name] = fn; } }
  };
  vm.runInNewContext(source.replace(/const PROJECT_TOKEN = '[^']*';/, `const PROJECT_TOKEN = '${token ? 'phc_test' : ''}';`), context);
  return { ...context, inserted, listeners, storage };
}
test('no SDK request without token, outside production, or with a privacy preference', () => {
  for (const opts of [{ token: false }, { host: 'localhost' }, { host: 'preview.example.com' }, { optOut: true }, { dnt: true }, { gpc: true }]) assert.equal(boot(opts).inserted.length, 0);
});
test('one shared project labels each site and removes query/hash from page URLs', () => {
  for (const [path, site] of [['/', 'portfolio'], ['/us-migration/', 'us-migration'], ['/climate-on-housing/index.html', 'climate-on-housing']]) {
    const ctx = boot({ path });
    assert.equal(ctx.inserted[0].src, 'https://us-assets.i.posthog.com/static/array.js');
    const options = ctx.window.posthog._i[0][1];
    const event = options.before_send({ properties: { $current_url: 'https://kennethlow.com/?q=private#private' } });
    assert.equal(event.properties.site, site);
    assert.equal(event.properties.$current_url, 'https://kennethlow.com/');
    assert.equal(options.session_recording.maskAllInputs, true);
    assert.equal(options.session_recording.recordBody, false);
    assert.equal(options.capture_exceptions.capture_console_errors, true);
  }
});
test('handled errors are queued without waiting for SDK download', () => {
  const ctx = boot(); const error = new Error('test');
  ctx.window.portfolioTelemetry.reportError(error, { component: 'atlas' });
  assert.equal(ctx.window.posthog[0][0], 'captureException');
  assert.equal(ctx.window.posthog[0][1], error);
});
test('outbound links are captured with query values removed', () => {
  const ctx = boot();
  ctx.listeners.click({ target: { closest: () => ({ href: 'https://github.com/Kaxlow?secret=value' }) } });
  assert.equal(ctx.window.posthog[0][1], 'project_link_clicked');
  assert.equal(ctx.window.posthog[0][2].destination_url, 'https://github.com/Kaxlow');
});
test('opt-out and opt-in update the same browser preference', () => {
  const ctx = boot();
  ctx.window.portfolioTelemetry.setEnabled(false);
  assert.equal(ctx.storage.get('portfolio-analytics-disabled'), 'true');
  ctx.window.portfolioTelemetry.setEnabled(true);
  assert.equal(ctx.storage.get('portfolio-analytics-disabled'), 'false');
});

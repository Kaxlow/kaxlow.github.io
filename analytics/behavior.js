/* Optional behavior extension. Migration must keep its original tracking. */
(function (root) {
  'use strict';
  const excluded = path => /^\/(?:projects\/)?us-migration(?:\/|\.html$|$)/.test(path);
  const siteForPath = path => /^\/climate-on-housing(?:\/|$)/.test(path) ? 'climate-on-housing'
    : /^\/housing-predict(?:\/|$)/.test(path) ? 'housing-predict' : 'portfolio';
  const allowed = (nav, storage) => {
    if (nav.doNotTrack === '1' || nav.globalPrivacyControl === true) return false;
    try {
      return storage.getItem('portfolio-analytics-disabled') !== 'true'
        && storage.getItem('exclude_posthog') !== 'true';
    } catch (_) { return false; } // A saved opt-out cannot be checked; fail closed.
  };

  // Clock and emission are injected so lifecycle behavior can be tested deterministically.
  class Engagement {
    constructor(now, emit, uuid) {
      this.now = now; this.emit = emit; this.uuid = uuid;
      this.last = this.activity = now(); this.visible = true;
      this.current = null; this.pending = 0;
    }
    accrue() {
      const now = this.now();
      if (this.current && this.visible) this.pending += Math.max(0, Math.min(now, this.activity + 60000) - this.last);
      this.last = now;
    }
    flush(reason, beacon = false) {
      this.accrue();
      if (this.current && this.pending > 0) {
        this.emit('section_engagement', {...this.current, active_ms: Math.round(this.pending), reason}, beacon);
        this.pending = 0;
      }
    }
    select(context) {
      this.accrue();
      const key = context && JSON.stringify(context);
      if (key === this.key) return;
      this.flush('section_change');
      this.key = key;
      this.current = context ? {...context, section_visit_id: this.uuid()} : null;
      this.viewed = false;
      if (this.current && this.visible) { this.emit('section_viewed', this.current); this.viewed = true; }
    }
    interact() { this.accrue(); this.activity = this.now(); }
    visibility(visible) {
      if (!visible) this.flush('hidden', true);
      this.visible = visible; this.last = this.now();
      if (visible) {
        this.activity = this.now();
        if (this.current && !this.viewed) { this.emit('section_viewed', this.current); this.viewed = true; }
      }
    }
    tick() { this.accrue(); if (this.pending >= 15000) this.flush('interval'); }
  }
  if (typeof module === 'object' && module.exports) module.exports = {Engagement, excluded, siteForPath, allowed};
  if (!root?.document) return;
  const {document, location, navigator} = root;
  if (excluded(location.pathname) || !['kennethlow.com', 'www.kennethlow.com'].includes(location.hostname)
      || root.portfolioBehavior) return;
  const enabled = () => {
    try { return allowed(navigator, root.localStorage) && !!root.portfolioTelemetry && !!root.posthog?.capture
      && root.posthog.has_opted_out_capturing?.() !== true; } catch (_) { return false; }
  };
  if (!enabled()) return;
  const site = siteForPath(location.pathname);
  const frameTitles = {
    title: 'Climate Playbook', intro: 'What Constitutes Climate Risk to Housing?', search: 'Choose a County',
    'history-map': 'Housing Market Performance', 'history-events': 'NRI Risk Rating',
    'history-compare': 'Performance Relative to Peers', 'history-outlook': 'County Makeup',
    'takeaway-makeup': 'County Makeup Takeaway', conclusion: 'Takeaway', questions: 'Open Questions'
  };
  const contextFor = section => {
    if (!section) return {section_id: 'page'};
    const sectionId = section.dataset.analyticsSection || section.id || 'page';
    const context = {section_id: sectionId};
    const stage = section.querySelector('.story-stage');
    if (stage?.dataset.storyState) {
      context.frame_id = stage.dataset.storyState;
      context.frame_index = Number(stage.dataset.storyIndex);
      context.frame_title = sectionId === 'playbook' ? frameTitles[context.frame_id] || context.frame_id : context.frame_id;
    }
    if (sectionId === 'playbook' && stage?.dataset.analyticsCountyFips) {
      context.county_fips = stage.dataset.analyticsCountyFips;
      context.county_name = stage.dataset.analyticsCountyName;
    }
    return context;
  };
  let tracker;
  const emit = (event, properties, beacon = false) => {
    if (!enabled()) return;
    try {
      root.posthog.capture(event, {schema_version: 1, analytics_site: site, page_path: location.pathname,
        ...properties}, {send_instantly: true, ...(beacon ? {transport: 'sendBeacon'} : {})});
    } catch (_) { /* Analytics must never interrupt the page. */ }
  };
  root.portfolioTelemetry.track = (event, properties = {}, element) => {
    const section = element?.closest?.('section, [data-analytics-section]');
    emit(event, {...(section ? contextFor(section) : tracker?.current || {section_id: 'page'}), ...properties});
  };
  root.portfolioBehavior = {contextFor};
  tracker = new Engagement(() => performance.now(), emit, () => root.crypto.randomUUID());
  tracker.visible = document.visibilityState !== 'hidden';
  for (const [selector, id] of [['.portfolio-hero', 'introduction'], ['.project-grid', 'projects'],
    ['.project-intro', 'introduction'], ['.personal-strip', 'personal']]) {
    document.querySelector(selector)?.setAttribute('data-analytics-section', id);
  }

  const refresh = () => {
    if (document.visibilityState === 'hidden') return;
    const main = document.querySelector('main') || document.body;
    const candidates = [...main.querySelectorAll('section[id], [data-analytics-section]')]
      .filter(el => !el.parentElement?.closest('section[id], [data-analytics-section]'));
    let best = null, area = 0, distance = Infinity;
    for (const el of candidates) {
      const r = el.getBoundingClientRect();
      const visible = Math.max(0, Math.min(r.bottom, root.innerHeight) - Math.max(r.top, 0))
        * Math.max(0, Math.min(r.right, root.innerWidth) - Math.max(r.left, 0));
      const center = Math.abs((r.top + r.bottom) / 2 - root.innerHeight / 2);
      if (visible > area || (visible > 0 && visible === area && center < distance)) {
        best = el; area = visible; distance = center;
      }
    }
    tracker.select(contextFor(best));
  };
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    root.requestAnimationFrame(() => { scheduled = false; refresh(); });
  };
  for (const event of ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'scroll']) {
    document.addEventListener(event, () => { tracker.interact(); schedule(); }, {passive: true, capture: true});
  }
  root.addEventListener('resize', schedule);
  document.addEventListener('visibilitychange', () => {
    tracker.visibility(document.visibilityState !== 'hidden');
    if (document.visibilityState !== 'hidden') refresh();
  });
  root.addEventListener('pagehide', () => { tracker.flush('pagehide', true); tracker.visibility(false); });
  root.addEventListener('pageshow', () => { tracker.visibility(document.visibilityState !== 'hidden'); refresh(); });
  // Marked links use capture phase so source context survives synchronous navigation/rendering.
  document.addEventListener('click', event => {
    const link = event.target.closest?.('[data-analytics-action]');
    if (!link) return;
    const properties = {action_id: link.dataset.analyticsAction};
    if (link.href) {
      const url = new URL(link.href, location.href);
      if (['https:', 'http:'].includes(url.protocol)) properties.destination_url = url.origin + url.pathname;
    }
    root.portfolioTelemetry.track('playbook_action_clicked', properties, link);
  }, true);
  new MutationObserver(schedule).observe(document.body, {subtree: true, childList: true, attributes: true,
    attributeFilter: ['data-story-state', 'data-story-index', 'data-analytics-county-fips']});
  root.setInterval(() => { refresh(); tracker.tick(); }, 1000);
  refresh();
})(typeof window === 'undefined' ? null : window);

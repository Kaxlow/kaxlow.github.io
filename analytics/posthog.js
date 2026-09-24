/* Shared by the portfolio and its project websites. Public project token only. */
(() => {
  'use strict';
  const PROJECT_TOKEN = 'phc_uNukHkLfKeNvKUtWG99SfPxHCnQcSV2Qa3LkyKXnikNb';
  const API_HOST = 'https://us.i.posthog.com';
  const allowedHosts = ['kennethlow.com', 'www.kennethlow.com'];
  if (!allowedHosts.includes(location.hostname) || window.portfolioTelemetry) return;

  const siteForPath = path => /^\/climate-on-housing(?:\/|$)/.test(path) ? 'climate-on-housing'
    : /^\/us-migration(?:\/|$)/.test(path) ? 'us-migration' : 'portfolio';
  const site = siteForPath(location.pathname);
  let disabled = navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  try { disabled ||= localStorage.getItem('portfolio-analytics-disabled') === 'true'; } catch (_) {}
  window.portfolioTelemetry = {
    reportError(error, context = {}) {
      if (!disabled && window.posthog) window.posthog.captureException(error, context);
    },
    setEnabled(enabled) {
      try { localStorage.setItem('portfolio-analytics-disabled', String(!enabled)); } catch (_) {}
      location.reload();
    }
  };
  if (!PROJECT_TOKEN || disabled) return;

  // PostHog's official asynchronous loader queues events while the SDK downloads.
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split('.');2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement('script')).type='text/javascript',p.crossOrigin='anonymous',p.async=!0,p.src=s.api_host.replace('.i.posthog.com','-assets.i.posthog.com')+'/static/array.js',(r=t.getElementsByTagName('script')[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a='posthog',u.people=u.people||[],o='init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug'.split(' '),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  const cleanUrl = value => {
    if (value === '$direct') return value;
    try { const url = new URL(value, location.href); return url.origin + url.pathname; }
    catch (_) { return ''; }
  };
  window.posthog.init(PROJECT_TOKEN, {
    api_host: API_HOST,
    defaults: '2026-05-30',
    person_profiles: 'identified_only',
    persistence: 'localStorage+cookie',
    cross_subdomain_cookie: true,
    secure_cookie: true,
    respect_dnt: true,
    autocapture: true,
    capture_pageview: 'history_change',
    capture_pageleave: true,
    capture_dead_clicks: true,
    capture_heatmaps: true,
    capture_performance: { web_vitals: true, network_timing: true },
    capture_exceptions: { capture_unhandled_errors: true, capture_unhandled_rejections: true, capture_console_errors: true },
    disable_session_recording: false,
    enable_recording_console_log: true,
    session_recording: { maskAllInputs: true, maskTextSelector: '.ph-mask', blockSelector: '.ph-no-capture', recordHeaders: false, recordBody: false },
    before_send(event) {
      if (!event) return event;
      event.properties.site = site;
      event.properties.environment = 'production';
      for (const key of ['$current_url', '$referrer', '$initial_current_url', '$initial_referrer']) {
        if (event.properties[key]) event.properties[key] = cleanUrl(event.properties[key]);
      }
      return event;
    }
  });

  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (!['https:', 'http:'].includes(url.protocol)) return;
    if (url.origin !== location.origin || siteForPath(url.pathname) !== site) {
      window.posthog.capture('project_link_clicked', { destination_url: cleanUrl(url.href), source_path: location.pathname });
    }
  });
  // Hash routing drives chapters in the migration atlas; do not send arbitrary hash contents.
  let previousChapter = location.hash.slice(1).split('/')[0] || 'introduction';
  window.addEventListener('hashchange', () => {
    const chapter = location.hash.slice(1).split('/')[0];
    if (site === 'us-migration' && chapter !== previousChapter && /^[a-z][a-z-]{0,60}$/.test(chapter)) {
      window.posthog.capture('chapter_viewed', { chapter });
      previousChapter = chapter;
    }
  });
  // Resource failures are not JavaScript exceptions (e.g. broken scripts/images).
  window.addEventListener('error', event => {
    const target = event.target;
    if (target && target !== window && (target.src || target.href)) {
      const resource = cleanUrl(target.src || target.href);
      if (!resource.includes('posthog.com')) window.posthog.capture('resource_load_failed', { resource_url: resource, element: target.tagName });
    }
  }, true);
})();

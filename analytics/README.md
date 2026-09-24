# PostHog setup and operations

US Cloud project: `627070`. Its public token is configured in the shared script. Collection requires deployment and live verification.

## Activate

1. Create one project named `kennethlow.com`. Copy its **public project token** into `PROJECT_TOKEN` in `analytics/posthog.js`. Never use a personal API key here. Set `API_HOST` to `https://eu.i.posthog.com` for an EU project, otherwise use the US default.
2. In PostHog project settings enable Session Replay. Start with 100% for this portfolio and set usage limits appropriate to your traffic. Enable Error Tracking and check its incoming exception stream.
3. Render and publish the portfolio first so `https://kennethlow.com/analytics/posthog.js` exists. Then publish the migration and climate project repositories. Both project sites load the shared script from the portfolio, including future config changes. Its absence or blocking must not prevent either site from working.
4. Open the live sites, navigate between them, use atlas chapters and chart controls, and verify `$pageview`, `$autocapture`, `project_link_clicked`, and `chapter_viewed` in Live Events. Filter by the `site` property. Verify an actual replay is available; the code alone cannot confirm server-side recording settings.
5. In a controlled browser session run `window.portfolioTelemetry.reportError(new Error('PostHog installation smoke test'), { test: true })`. Confirm it appears in Error Tracking with the associated page and session, then resolve that test issue. Never deliberately break the deployed page to test reporting.

The three sites share an origin, token, cookies and local storage, so anonymous visitor/session identity can carry across them. GitHub repository pages cannot be instrumented by this site; only outbound clicks to GitHub are captured.

## Coverage

- Page visits and exits, clicks and form interactions, scrolling, heatmaps, dead clicks, and web vitals.
- Replay with masked inputs, console logs, and network timing. Request/response bodies and headers are disabled. This is browser diagnostics, not a server log ingestion pipeline.
- Unhandled JavaScript errors, unhandled promise rejections, console errors, and failed resource events. The migration atlas explicitly reports its caught startup failures; climate's caught rendering failures already call `console.error`.
- `site` is `portfolio`, `us-migration`, or `climate-on-housing`; `environment` is `production`.
- Localhost and preview hosts are excluded. Do Not Track, Global Privacy Control, and the site's browser opt-out prevent initialization. Inputs are masked in replay; sensitive DOM regions should use `ph-no-capture` and sensitive text `ph-mask`. Top-level page/referrer and custom destination URLs omit queries/fragments; this is not comprehensive redaction of console messages, exceptions, or replay content. Do not log secrets or personal information.

## Use the data

Create a dashboard with page visitors by `site` and pathname, portfolio-to-project link conversions, project chapter engagement, web vitals, and error counts. Compare repeated patterns across sessions before changing layouts. Use heatmaps and replay to investigate abandoned interactions and dead clicks.

In Error Tracking, configure alerts for new issues and regressions. Review the stack trace and linked replay, reproduce the failing interaction, fix it in the owning repository, and verify after deployment before resolving the issue. No ongoing monitoring or automatic fixes are scheduled by this installation.

## Maintenance

`node --test analytics/posthog.test.cjs` checks initialization guards, site attribution, handled error queues, URL cleanup, and browser preferences. `quarto render` checks portfolio integration. `install-projects.cjs` is an idempotent local installer with explicit paths for the migration repository and the climate repository (locally named `quoll-intelligence`). The climate source template and publishable HTML must both retain the shared script.

# Portfolio behavior tracking

Dashboard: [Portfolio Behavior & Engagement](https://us.posthog.com/project/627070/dashboard/2217142).

`behavior.js` is an optional extension to the original, unchanged `posthog.js`.
Quarto's `include-behavior.lua` injects it on included HTML pages. The Migration
case study is excluded at build time. Both `/us-migration` and
`/projects/us-migration` (directory and `.html` forms) are also guarded at runtime.
The Migration repository, case-study source, and existing telemetry stay unchanged.

## Event contract (schema version 1)

All new events include `analytics_site` (`portfolio`, `climate-on-housing`, or
`housing-predict`), `page_path`, `section_id`, and `schema_version`. Use
`analytics_site` for the new dashboard: the original shared script retains its
existing `site` classification, including `portfolio` for Housing Prediction.
Climate story frames also include `frame_id`, `frame_title`, and `frame_index`.
The index is the actual zero-based story index; names are preferable for reports.
Selected Playbook county context is `county_fips` and `county_name`.

| Event | Additional properties / meaning |
| --- | --- |
| `tooltip_clicked` | `tooltip_id`, `tooltip_label`, `opens_tooltip`; one event per click, including closing clicks. |
| `playbook_back_to_search_clicked` | Frame and county before navigating back. |
| `playbook_county_selected` | `selection_method`: `suggested_continue`, `search`, or `map`; selected county, never typed search text. |
| `playbook_action_clicked` | `action_id`: `heres_how`, `open_questions`, `privacy_preferences`, `share_feedback`; cleaned `destination_url` for links. |
| `section_viewed` | `section_visit_id`: a fresh identifier when section/frame/county context changes; repeat visits count separately. |
| `section_engagement` | Same visit ID; `active_ms` is an increment, with `reason`: `interval`, `section_change`, `hidden`, or `pagehide`. |

Tooltip identifiers belong to a location/purpose, not the tooltip's wording,
county, or DOM position. Factors use their feature keys. Source disclosures and
chart-completeness icons use their containing element IDs. All Climate tooltip
factories supply explicit IDs. Keep these stable when revising copy.

## Active time

Active time counts foreground viewing until 60 seconds after the last pointer,
keyboard, touch, or scroll activity. Initial foreground viewing starts the clock.
Hidden tabs pause it; returning to a tab starts a new activity window. This
estimates engagement rather than proving that someone read the content.

Only one primary section receives time: largest visible viewport area, with
proximity to the viewport center breaking ties. Climate sections use their
displayed frame. Events flush every 15 accumulated active seconds (checked once
per second), on context changes, and on hiding/exiting. Each flush resets its
increment. Visibility/exit flushes request beacon transport. Abrupt termination
can lose the final unsent interval. Browser back/forward cache restoration resumes
the same visit until the content context changes.

For average time, sum engagement increments and divide by section visits; never
average the individual heartbeat durations. The dashboard's period boundary can
truncate an ongoing visit. Compare periods with enough traffic before interpreting
small differences. Historical sessions cannot acquire these new events retroactively.

## Privacy and availability

The extension checks browser opt-out, `exclude_posthog`, DNT, GPC, and SDK opt-out
before sending. Inaccessible storage disables the extension because saved choices
cannot be checked. It never initializes another SDK or changes the original SDK's
settings. A missing extension/blocked SDK leaves the website operational.

Custom events omit raw search input, location coordinates, and destination URL
queries/fragments. Existing replay and autocapture continue under their existing
configuration. The original script's storage behavior remains unchanged.

## Checks and publishing

Run `node --test analytics/posthog.test.cjs analytics/behavior.test.cjs`, then
`quarto render`. With Playwright available, run `node analytics/browser.test.cjs`.
Set `CLIMATE_REPO` if the Climate checkout is elsewhere. Browser tests fulfill
requests from local assets and block external traffic, including real telemetry.

Climate source changes live in its own repository. `update-climate-tracking.cjs`
records the explicit source migration. `rebuild-climate-assets.py CLIMATE_REPO`
calls the existing `write_page_assets` builder with the already-published datasets,
preserving analysis results and deferred county/history data. Run it in the
Climate Conda environment and run `tests/test_playbook_flow.py` there afterward.

Publish the portfolio first so the extension is available, then publish Climate's
regenerated output. Verify new events in PostHog and check that the Migration
case study has no `behavior.js` script. The interactive Migration site needs no
deployment. Preserve the original shared script's hash during this rollout.

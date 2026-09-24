# Kenneth Low — Portfolio

A Quarto website showcasing data science projects, research, and a little life away from the keyboard.

Live site: <https://kennethlow.com/>

## Local development

Install Quarto, then run from this directory:

```sh
quarto preview
```

Build the static site with `quarto render`. Generated output goes to `_site/`; it and the `.quarto/` cache are ignored by Git.

## Editing content

- `index.qmd`: homepage and introduction.
- `_project-cards.qmd`: shared project cards included on the homepage and Projects page. Card illustrations are decorative, not data charts.
- `projects/*/index.qmd`: individual case studies, including source links and limitations.
- `about.qmd` and `resume.qmd`: personal background and project experience.
- `portfolio.css`: responsive field-notebook styling.
- `_quarto.yml`: navigation, site metadata, and footer.

To add a project, create its case study under `projects/`, add a card to `_project-cards.qmd`, and render to check its links. Use the project repository as the source of truth for methods and results. Date numerical results when they describe a specific run or data snapshot.

## Analytics and error reporting

PostHog integration and activation instructions are in [analytics/README.md](analytics/README.md). The public project token must be configured before collection begins. All three sites use the shared `analytics/posthog.js` script.

## Publishing the site

Push source changes to `main`. `.github/workflows/publish.yml` renders Quarto, uploads `_site/`, and deploys through GitHub Pages. The repository Pages source must remain **GitHub Actions**. The custom domain is managed in GitHub Pages settings.

The résumé page contains verified background and project experience. Add a PDF download only when the actual résumé file is available.

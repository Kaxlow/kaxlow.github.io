// Apply explicit source edits to the separately checked-out Climate project.
// Run only with permission to write that checkout; never touches Migration.
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
if (!root) throw Error('Usage: node analytics/update-climate-tracking.cjs CLIMATE_REPOSITORY');
const file = path.join(root, 'src/housing_climate_risk/page_data/web/climate-risk-housing.js');
let source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
function replace(before, after) {
  if (source.includes(after)) return;
  if (source.split(before).length !== 2) throw Error('Expected exactly one source marker: ' + before);
  source = source.replace(before, after);
}
replace('    if (activeInfoTooltipTrigger === element) {', `    window.portfolioTelemetry?.track?.('tooltip_clicked', {
      tooltip_id: element.dataset.analyticsTooltip,
      tooltip_label: element.getAttribute('aria-label'),
      opens_tooltip: activeInfoTooltipTrigger !== element,
    }, element);
    if (activeInfoTooltipTrigger === element) {`);
replace('  button.textContent = "?";', '  button.textContent = "?";\n  button.dataset.analyticsTooltip = options.analyticsId;');
for (const [text, id] of [
  ['scatterFootnotesTooltip', 'pricing-scatter-methods'],
  ['featurePerformanceTooltip', 'features-performance-definition'],
  ['eventsNoaaTooltip', 'events-noaa-definition']
]) replace(`makeInfoButton(TEXT.${text}, {label: TEXT.informationTooltipLabel})`,
  `makeInfoButton(TEXT.${text}, {analyticsId: '${id}', label: TEXT.informationTooltipLabel})`);
replace('const info = makeInfoButton(TEXT.completeMonthlyPlotTooltip, {',
  'const info = makeInfoButton(TEXT.completeMonthlyPlotTooltip, {\n    analyticsId: `${element.id}-completeness`,');
replace('makeInfoButton(content, {html: true, label: `${TEXT.sourcesLabel}: ${TEXT.informationTooltipLabel}`})',
  'makeInfoButton(content, {analyticsId: `${source.id || source.closest("section").id}-sources`, html: true, label: `${TEXT.sourcesLabel}: ${TEXT.informationTooltipLabel}`})');
replace('makeInfoButton(tooltipText, {label: TEXT.informationTooltipLabel})',
  'makeInfoButton(tooltipText, {analyticsId: `${selector.replace(/^#/, "")}-definition`, label: TEXT.informationTooltipLabel})');
replace('{label: "About the county count"}', '{analyticsId: "events-affected-county-count", label: "About the county count"}');
replace('        html: labelText === TEXT.featureSourcesTopic,',
  '        analyticsId: labelText === TEXT.featureSourcesTopic ? "features-footnote-sources" : "features-footnote-ranking",\n        html: labelText === TEXT.featureSourcesTopic,');
replace('makeInfoButton(TEXT.featureOutcomeTooltip)', 'makeInfoButton(TEXT.featureOutcomeTooltip, {analyticsId: "features-outcome-definition"})');
replace('makeInfoButton(removeOutliers ? TEXT.featureDistributionOutlierTooltip : TEXT.featureDistributionVeryHighTooltip, {label: TEXT.informationTooltipLabel})',
  'makeInfoButton(removeOutliers ? TEXT.featureDistributionOutlierTooltip : TEXT.featureDistributionVeryHighTooltip, {analyticsId: "features-distribution-explanation", label: TEXT.informationTooltipLabel})');
replace('makeInfoButton(basis, {label: TEXT.informationTooltipLabel})',
  'makeInfoButton(basis, {analyticsId: "playbook-performance-basis", label: TEXT.informationTooltipLabel})');
replace('makeInfoButton(TEXT.playbookEventDefinition, {label: "Definition of extreme weather events"})',
  'makeInfoButton(TEXT.playbookEventDefinition, {analyticsId: "playbook-extreme-weather-definition", label: "Definition of extreme weather events"})');
replace('makeInfoButton(factor.description, {label: TEXT.informationTooltipLabel})',
  'makeInfoButton(factor.description, {analyticsId: `playbook-factor-${factor.feature}`, label: TEXT.informationTooltipLabel})');
replace('function selectPlaybookCounty(county) {\n  selectedCountyFips = county.fips;', `function selectPlaybookCounty(county, selectionMethod) {
  const stage = document.querySelector('#playbook .story-stage');
  if (selectionMethod) window.portfolioTelemetry?.track?.('playbook_county_selected', {
    selection_method: selectionMethod, county_fips: String(county.fips), county_name: countyDisplayName(county),
  }, stage);
  if (stage) {
    stage.dataset.analyticsCountyFips = String(county.fips);
    stage.dataset.analyticsCountyName = countyDisplayName(county);
  }
  selectedCountyFips = county.fips;`);
replace('selectPlaybookCounty(profile);', 'selectPlaybookCounty(profile, "map");');
replace('selectPlaybookCounty(county); goToPlaybookProfile();', 'selectPlaybookCounty(county, "suggested_continue"); goToPlaybookProfile();');
replace('selectPlaybookCounty(d);', 'selectPlaybookCounty(d, "search");');
replace('d3.select("#playbook-back-to-search").on("click", goToPlaybookSearch);', `d3.select("#playbook-back-to-search").on("click", function() {
    window.portfolioTelemetry?.track?.('playbook_back_to_search_clicked', {}, this);
    goToPlaybookSearch();
  });`);
replace('<a href="https://getquoll.com/"', '<a data-analytics-action="heres_how" href="https://getquoll.com/"');
replace('pageFeedback: \'<a href=', 'pageFeedback: \'<a data-analytics-action="share_feedback" href=');
fs.writeFileSync(file, source);
const htmlFile = path.join(path.dirname(file), 'page.html');
let html = fs.readFileSync(htmlFile, 'utf8');
const extension = '<script defer src="https://kennethlow.com/analytics/behavior.js"></script>';
if (!html.includes(extension)) html = html.replace('<head>', '<head>\n' + extension);
html = html.replace('id="playbook-open-questions" type=', 'id="playbook-open-questions" data-analytics-action="open_questions" type=');
html = html.replace('<a href="https://kennethlow.com/privacy.html">', '<a data-analytics-action="privacy_preferences" href="https://kennethlow.com/privacy.html">');
fs.writeFileSync(htmlFile, html);
console.log('Updated Climate source script and template. Regenerate output using write_page_assets.');

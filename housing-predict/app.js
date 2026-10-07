'use strict';
const $ = (selector) => document.querySelector(selector);
const money = (value) => value == null ? 'Not available' : new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
const compact = (value) => '$' + (value / 1000).toFixed(value >= 100000 ? 0 : 1) + 'k';
const escapeHTML = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const target = 'target_median_owner_occupied_home_value_2024_usd';
const names = {training_median:'Training-median baseline',hist_direct_2:'Gradient boosting',extra_trees_1:'Extra Trees',elastic_net_2:'Elastic Net',previous_value:'Previous home value',history_only:'Price history only',history_plus_characteristics:'History + characteristics'};
let counties = [], current = [], byFips = new Map(), measure = 'value', selected = null;
const valueColors = ['#e5e9ca','#c4d2a5','#92b183','#5f9271','#346b55','#163f36'];
const errorColors = ['#9b572f','#c68c5b','#e5c6a1','#dadfc9','#85a595','#356655'];

async function read(name) {
  const response = await fetch('data/' + name + '.json');
  if (!response.ok) throw new Error('Could not load ' + name);
  return response.json();
}
function barChart(selector, rows, maximum, formatter) {
  $(selector).innerHTML = rows.map(r => `<div class="bar-row"><div class="bar-label"><span>${escapeHTML(r.label)}</span><b>${formatter(r.value)}</b></div><div class="bar-track"><div class="bar-fill ${r.selected?'selected':''}" style="width:${Math.max(.8,100*r.value/maximum)}%"></div></div></div>`).join('');
}
function colorFor(row) {
  if (!row) return '#c6cabf';
  if (measure === 'value') {
    const thresholds = [100000,175000,250000,400000,650000];
    return valueColors[thresholds.filter(t => row[target] >= t).length];
  }
  const error = row.residual_usd;
  if (error == null) return '#c6cabf';
  return errorColors[[-100000,-40000,0,40000,100000].filter(t => error >= t).length];
}
function paintMap() {
  document.querySelectorAll('#county-map path').forEach(path => {
    path.setAttribute('fill', colorFor(byFips.get(path.dataset.fips)));
    path.classList.toggle('selected', path.dataset.fips === selected);
  });
  const palette = measure === 'value' ? valueColors : errorColors;
  $('#legend').innerHTML = `<div class="legend-scale">${palette.map(c=>`<i style="background:${c}"></i>`).join('')}</div><div class="legend-labels">${measure==='value'?'<span>&lt; $100k</span><span>$650k+</span>':'<span>Overprediction</span><span>Underprediction</span>'}</div>`;
}
function updateOptions() {
  const query = $('#county-search').value.toLowerCase().trim();
  const found = current.filter(r => (r.county_name + ' ' + r.state + ' ' + r.county_fips).toLowerCase().includes(query));
  const select = $('#county-select');
  select.innerHTML = found.length ? found.map(r=>`<option value="${r.county_fips}">${escapeHTML(r.county_name)}</option>`).join('') : '<option value="">No matching counties</option>';
  if(found.some(r=>r.county_fips===selected)) select.value = selected;
  if(query && found.length) showCounty(found[0].county_fips);
}
function showCounty(fips) {
  const row = byFips.get(fips);
  if(!row) return;
  selected = fips;
  if([...$('#county-select').options].some(o=>o.value===fips)) $('#county-select').value=fips;
  const plainName = row.county_name.replace(/, [^,]+$/, '');
  const predicted = row.selected_prediction;
  const error = row.residual_usd;
  const income = row.log1p__median_household_income_2024_usd == null ? NaN : Math.expm1(row.log1p__median_household_income_2024_usd);
  const pct = value => value == null ? 'N/A' : value.toFixed(1)+'%';
  const history = counties.filter(r=>r.county_fips===fips).sort((a,b)=>a.year-b.year);
  $('#county-card').innerHTML = `<h3>${escapeHTML(plainName)}</h3><div class="county-state">${escapeHTML(row.state)} · FIPS ${fips}</div><div class="county-value">${money(row[target])}</div><div class="tiny">OBSERVED MEDIAN HOME VALUE</div><div class="county-comparison"><div><span>Model estimate</span><strong>${money(predicted)}</strong></div><div><span>${error>=0?'Underpredicted by':'Overpredicted by'}</span><strong>${money(Math.abs(error))}</strong></div></div><div class="county-characteristic"><span>Household income</span><b>${Number.isFinite(income)?money(income):'N/A'}</b></div><div class="county-characteristic"><span>Bachelor’s degree or higher</span><b>${pct(row.bachelors_degree_or_higher_pct)}</b></div><div class="county-characteristic"><span>Vacant housing units</span><b>${pct(row.vacant_housing_units_pct)}</b></div><div class="mini-trend"><p>MEDIAN VALUE BY ACS PERIOD END</p><div class="trend-values">${history.map(r=>`<div>${r.year}<strong>${compact(r[target])}</strong></div>`).join('')}</div><p class="tiny" style="margin-top:10px">${row.balanced_geography?'Non-overlapping periods; constant 2024 dollars.':'Geography flagged or incomplete history. Values are not a comparable longitudinal series.'}</p></div>`;
  paintMap();
}
async function initialize() {
  try {
    const [data, paths, metrics, groups, forecast, fe] = await Promise.all(['counties','county_paths','test_metrics','feature_group_experiments','forecast_metrics','fixed_effects'].map(read));
    counties=data;
    current=data.filter(r=>r.year===2024).sort((a,b)=>a.county_name.localeCompare(b.county_name));
    byFips=new Map(current.map(r=>[r.county_fips,r]));
    const svg=$('#county-map');
    const fragment=document.createDocumentFragment();
    for(const geometry of paths){
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d',geometry.path);path.setAttribute('fill-rule','evenodd');path.dataset.fips=geometry.fips;
      const row=byFips.get(geometry.fips);
      const title=document.createElementNS('http://www.w3.org/2000/svg','title');
      title.textContent=row?`${row.county_name}: ${money(row[target])}`:`FIPS ${geometry.fips}: no eligible target`;
      path.append(title);
      path.addEventListener('click',()=>{if(row){$('#county-search').value='';updateOptions();showCounty(geometry.fips);}});
      fragment.append(path);
    }
    svg.append(fragment);
    $('#map-status').textContent='';
    updateOptions();showCounty(byFips.has('08031')?'08031':current[0].county_fips);
    $('#county-search').addEventListener('input',updateOptions);
    $('#county-select').addEventListener('change',e=>showCounty(e.target.value));
    document.querySelectorAll('[data-measure]').forEach(button=>button.addEventListener('click',()=>{
      measure=button.dataset.measure;
      document.querySelectorAll('[data-measure]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
      paintMap();
    }));
    barChart('#model-bars',metrics.map(r=>({label:names[r.model]||r.model,value:r.mae_2024_usd,selected:r.model==='hist_direct_2'})),Math.max(...metrics.map(r=>r.mae_2024_usd)),money);
    const base=groups.find(r=>r.experiment==='all_primary').rmsle;
    const labels={economic:'Economic',social:'Social & demographic',housing:'Housing structure',hazards:'Hazards'};
    const groupRows=groups.filter(r=>r.experiment.startsWith('without_')).map(r=>({label:labels[r.experiment.replace('without_','')],value:100*(r.rmsle/base-1)})).sort((a,b)=>b.value-a.value);
    barChart('#group-bars',groupRows,Math.max(...groupRows.map(r=>r.value)),v=>'+'+v.toFixed(1)+'%');
    const forecastRows=forecast.filter(r=>r.year==='all').map(r=>({label:names[r.design],value:r.mae_2024_usd,selected:r.design==='history_plus_characteristics'}));
    barChart('#forecast-bars',forecastRows,Math.max(...forecastRows.map(r=>r.value)),money);
    const feLabels=['Log household income','Bachelor’s attainment','Vacancy share','Detached homes','Commute minutes','Household size'];
    $('#fe-table').innerHTML=`<table><thead><tr><th>Predictor</th><th>Coefficient</th><th>95% interval</th></tr></thead><tbody>${fe.map((r,i)=>`<tr><td>${feLabels[i]}</td><td>${r.coefficient.toFixed(4)}</td><td>${r.ci_low.toFixed(4)} to ${r.ci_high.toFixed(4)}</td></tr>`).join('')}</tbody></table>`;
  } catch(error) {
    $('#map-status').textContent='Interactive data could not load. Please refresh, or use the downloadable research below.';
    console.error(error);
  }
}
initialize();

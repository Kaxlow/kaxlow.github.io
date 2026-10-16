// Integration checks against local build artifacts. Every request is fulfilled locally
// or blocked; PostHog, geolocation, feedback, and other external services receive no data.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const portfolio = path.resolve(__dirname, '..');
const climate = process.env.CLIMATE_REPO || 'C:/Users/kenny/Data Science Projects/quoll-intelligence';
const migration = 'C:/Users/kenny/Data Science Projects/us-migration';
const mime = {'.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml'};
const stub = `window.__events=[]; window.portfolioTelemetry={}; window.posthog={capture:(event,properties)=>window.__events.push({event,...properties}),has_opted_out_capturing:()=>false};`;
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    for (const mobile of [false,true]) {
      const context = await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000}, reducedMotion:'reduce'});
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'ipapi.co') return route.fulfill({json:{country_code:'US',longitude:-104.99,latitude:39.74}});
        if (url.hostname === 'geocoding.geo.census.gov') return route.fulfill({contentType:'application/javascript',body:`${url.searchParams.get('callback')}(${JSON.stringify({result:{geographies:{Counties:[{GEOID:'08031'}]}}})})`});
        if (url.hostname === 'd3js.org') return route.fulfill({path:path.join(migration,'website/vendor/d3.min.js'),contentType:'application/javascript'});
        if (url.hostname !== 'kennethlow.com') return route.abort();
        if (url.pathname === '/analytics/posthog.js') return route.fulfill({body:stub,contentType:'application/javascript'});
        let file;
        if (url.pathname.startsWith('/analytics/')) file = path.join(portfolio,url.pathname);
        else if (url.pathname.startsWith('/climate-on-housing/')) file = path.join(climate,'output',url.pathname.slice('/climate-on-housing/'.length));
        else file = path.join(portfolio,'_site',url.pathname);
        if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file,'index.html');
        if (!fs.existsSync(file)) return route.fulfill({status:404,body:'Test asset unavailable'});
        return route.fulfill({path:file,contentType:mime[path.extname(file)]||'application/octet-stream'});
      });
      const page = await context.newPage();
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      page.on('popup', p=>p.close());
      await page.goto('https://kennethlow.com/climate-on-housing/');
      await page.waitForFunction(()=>!!window.portfolioBehavior);
      async function frame(state) {
        await page.evaluate(({state,mobile})=>{
          const section=document.getElementById('playbook');
          const index=storyConfigForSection('playbook').findIndex(s=>s.state===state);
          section.scrollIntoView();
          if(mobile) setMobileFrame(section,index);
          else window.scrollTo({top:section.offsetTop+index*window.innerHeight+2,behavior:'instant'});
        },{state,mobile});
        await page.waitForFunction(state=>document.querySelector('#playbook .story-stage').dataset.storyState===state,state);
        await page.waitForTimeout(500); // Let existing story transitions and layout observers settle.
      }
      await frame('search');
      await page.locator('#playbook-location-continue').waitFor({state:'visible'});
      await page.locator('#playbook-location-continue').click();
      await page.waitForFunction(()=>window.__events.some(e=>e.selection_method==='suggested_continue'));
      assert.equal((await page.evaluate(()=>window.__events.find(e=>e.selection_method==='suggested_continue'))).frame_id,'search');
      await frame('history-compare');
      await page.locator('#playbook-back-to-search').click();
      assert.equal((await page.evaluate(()=>window.__events.find(e=>e.event==='playbook_back_to_search_clicked'))).frame_id,'history-compare');
      await frame('search');
      await page.locator('#county-search').fill('Denver');
      await page.locator('#county-results > div').first().click();
      await frame('search');
      // Dispatch a click to a real bound map path (tiny counties can be occluded at full extent).
      await page.locator('#county-selection-map path.county').evaluateAll(paths=>{
        const county=paths.find(el=>el.__data__.properties.fips==='06037');
        county.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      });
      await frame('history-events');
      const tip=page.locator('[data-analytics-tooltip="t-playbook-sources-sources"]');
      await tip.click(); await tip.click();
      const tips=await page.evaluate(()=>window.__events.filter(e=>e.event==='tooltip_clicked'));
      assert.deepEqual(tips.slice(-2).map(e=>e.opens_tooltip),[true,false]);
      assert.equal(tips.at(-1).tooltip_id,'t-playbook-sources-sources');
      await frame('conclusion');
      // Prevent leaving the local fixture while exercising the actual click listeners.
      await page.evaluate(()=>document.addEventListener('click',e=>{if(e.target.closest('a'))e.preventDefault();}));
      for(const action of ['heres_how','privacy_preferences','share_feedback','open_questions']) {
        await page.locator(`[data-analytics-action="${action}"]`).click();
      }
      await page.waitForFunction(()=>document.querySelector('#playbook .story-stage').dataset.storyState==='questions');
      for(const action of ['privacy_preferences','share_feedback']) await page.locator(`[data-analytics-action="${action}"]`).click();
      const events=await page.evaluate(()=>window.__events);
      assert.deepEqual(events.filter(e=>e.event==='playbook_county_selected').map(e=>e.selection_method),['suggested_continue','search','map']);
      const actions=events.filter(e=>e.event==='playbook_action_clicked');
      assert.equal(actions.length,6);
      assert.deepEqual(actions.map(e=>e.frame_id),['conclusion','conclusion','conclusion','conclusion','questions','questions']);
      assert.ok(events.filter(e=>e.event==='playbook_county_selected').every(e=>/^\d{5}$/.test(e.county_fips)&&e.county_name));
      const ids=await page.locator('.info-tooltip-trigger').evaluateAll(els=>els.map(el=>el.dataset.analyticsTooltip));
      assert.ok(ids.every(id=>id&&id!=='undefined'));
      assert.equal(ids.length,new Set(ids).size);
      await page.goto('https://kennethlow.com/housing-predict/');
      await page.waitForFunction(()=>window.__events.some(e=>e.event==='section_viewed'));
      assert.equal(await page.evaluate(()=>window.__events[0].analytics_site),'housing-predict');
      await page.locator('#research').scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>window.__events.some(e=>e.section_id==='research'));
      await page.goto('https://kennethlow.com/projects/us-migration/');
      assert.equal(await page.locator('script[src*="behavior.js"]').count(),0);
      assert.equal(await page.evaluate(()=>typeof window.portfolioBehavior),'undefined');
      assert.deepEqual(errors,[]);
      console.log(`${mobile?'Mobile':'Desktop'}: all requested Climate actions, tooltips, housing engagement, Migration exclusion passed`);
      await context.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

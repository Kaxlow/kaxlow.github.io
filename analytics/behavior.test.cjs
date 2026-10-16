const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {Engagement, excluded, siteForPath, allowed} = require('./behavior.js');

function clock() {
  let time = 0, id = 0;
  const events = [];
  const tracker = new Engagement(() => time, (event, props, beacon) => events.push({event, ...props, beacon}), () => String(++id));
  return {tracker, events, at: value => {time = value;}};
}
test('incremental time stops precisely at 60 seconds and resumes without idle time', () => {
  const {tracker:t, events:e, at} = clock();
  t.select({section_id:'intro'});
  at(15000); t.tick(); at(30000); t.tick(); at(45000); t.tick(); at(75000); t.tick();
  assert.equal(e.filter(x=>x.active_ms).reduce((n,x)=>n+x.active_ms,0),60000);
  at(120000); t.interact(); at(125000); t.flush('exit');
  assert.equal(e.at(-1).active_ms,5000);
});
test('foreground visibility, duplicate flushes and repeat visits', () => {
  const {tracker:t, events:e, at} = clock();
  t.select({section_id:'intro'}); at(5000); t.visibility(false);
  at(90000); t.tick(); t.visibility(true); at(93000); t.select({section_id:'results'});
  t.select({section_id:'results'}); at(96000); t.select({section_id:'intro'});
  t.flush('pagehide'); t.flush('hidden');
  assert.deepEqual(e.filter(x=>x.active_ms).map(x=>x.active_ms),[5000,3000,3000]);
  assert.deepEqual(e.filter(x=>x.event==='section_viewed').map(x=>x.section_visit_id),['1','2','3']);
  assert.equal(e[1].beacon,true);
});
test('frame and county changes flush old attribution before new views', () => {
  const {tracker:t, events:e, at} = clock();
  t.select({section_id:'playbook',frame_id:'search'});
  at(1000); t.select({section_id:'playbook',frame_id:'conclusion',county_fips:'08031'});
  assert.equal(e[1].frame_id,'search');
  assert.equal(e[1].active_ms,1000);
  assert.equal(e[2].county_fips,'08031');
});
test('a page opened in a hidden tab starts its view and time when shown', () => {
  const {tracker:t, events:e, at} = clock();
  t.visible=false; t.select({section_id:'intro'}); at(90000); t.tick();
  assert.equal(e.length,0);
  t.visibility(true); at(95000); t.flush('exit');
  assert.equal(e[0].event,'section_viewed');
  assert.equal(e[1].active_ms,5000);
});
test('all Migration route variants are excluded, without excluding unrelated pages', () => {
  for (const path of ['/us-migration','/us-migration/','/us-migration/index.html','/us-migration.html',
    '/projects/us-migration','/projects/us-migration/','/projects/us-migration/index.html','/projects/us-migration.html']) {
    assert.equal(excluded(path),true);
    const context = {window:{location:{pathname:path},document:{},navigator:{}}};
    vm.runInNewContext(fs.readFileSync(__dirname+'/behavior.js','utf8'),context);
    assert.equal(context.window.portfolioBehavior,undefined);
  }
  assert.equal(excluded('/projects/climate-housing/'),false);
  assert.equal(siteForPath('/housing-predict/'),'housing-predict');
});
test('privacy, owner exclusion and inaccessible storage fail closed', () => {
  const storage = value => ({getItem:key=>value[key]});
  assert.equal(allowed({},storage({})),true);
  for (const key of ['exclude_posthog','portfolio-analytics-disabled']) assert.equal(allowed({},storage({[key]:'true'})),false);
  assert.equal(allowed({doNotTrack:'1'},storage({})),false);
  assert.equal(allowed({globalPrivacyControl:true},storage({})),false);
  assert.equal(allowed({}, {getItem(){throw Error('denied');}}),false);
});
test('protected shared script and Migration case study retain original content', () => {
  const crypto = require('node:crypto');
  for (const [file, hash] of [
    ['posthog.js','f2ce3ae3c8fc9cc0186b1b9734dc9bc2063ba1af40b0aae23cd13daf5dd31a32'],
    ['../projects/us-migration/index.qmd','66475950de4397ac4b5a3aec9a46af92b92e7824f5cd5d2f4b11b662d70d0e01']
  ]) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(__dirname+'/'+file,'utf8').replace(/\r\n/g,'\n')).digest('hex'),hash);
});

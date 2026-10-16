"""Rebuild presentation assets with the existing builder and published datasets.

Avoids recalculating scientific results for an instrumentation-only change.
"""
import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(root / 'src'))
from housing_climate_risk.page_data.climate_risk_housing import write_page_assets

output = root / 'output'
html = (output / 'index.html').read_text(encoding='utf-8')
match = re.search(r'<script id="page-data" type="application/json">(.*?)</script>', html, re.S)
if not match:
    raise RuntimeError('Published initial data marker changed')
data = json.loads(match.group(1))
def bundle(name):
    text = (output / f'climate-risk-housing-{name}.js').read_text(encoding='utf-8')
    return json.loads(text.split('=', 1)[1].rstrip().removesuffix(';'))
data['features'] = bundle('features')
data['eventWindows'] = bundle('events')
data.update(bundle('geography'))
write_page_assets(data, output)
print('Rebuilt Climate assets from source using unchanged published datasets')

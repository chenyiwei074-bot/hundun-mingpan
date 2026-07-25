#!/bin/bash
ID=$(curl -s -X POST http://localhost:3000/api/chart/create -H "Content-Type: application/json" -d '{"visitor_id":"diag_final","name":"??","gender":"?","calendar":"??","birthday":"1998-06-15 12:30","birthPlace":"??? ???","currentPlace":"??? ???"}' | python3 -c "import json,sys;print(json.load(sys.stdin)['data']['id'])")
echo "ID=$ID"
sleep 8
curl -s "http://localhost:3000/api/chart/result/$ID" | python3 -c "
import json,sys
d=json.load(sys.stdin)['data']
h=d.get('posterHtml','')
# Check for empty/blank areas
import re
# Count empty info-cards
empty_cards = re.findall(r'<div class=\"info-card\"><h4>[^<]+</h4></div>', h)
print('Empty info-cards:', len(empty_cards))
# Check for - placeholders
dashes = h.count('>-<')
print('Dash placeholders:', dashes)
# Check blur CSS
print('display:none count:', h.count('display: none'))
print('display:flex count:', h.count('display: flex'))
print('filter:none:', h.count('filter: none'))
print('filter:blur:', h.count('filter: blur'))
open('/tmp/final_poster.html','w').write(h)
print('Saved to /tmp/final_poster.html')
"

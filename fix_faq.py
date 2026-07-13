#!/usr/bin/env python3
import re

with open('/tmp/fifi-check-new/faq-data.js', 'r') as f:
    content = f.read()

# Fix PERSON/EMAIL placeholders that break JS
# 1. Fix closing bracket pattern: },<PERSON_N>{\n      {
content = re.sub(r'},<\w+_\d+>\{\s*\n\s*\{', '},\n      {', content)
# 2. Fix: <PERSON_N>},\n      {
content = re.sub(r'<\w+_\d+>\},\s*\n\s*\{', '},\n      {', content)
# 3. Fix stray PERSON
content = re.sub(r'\n\s+<\w+_\d+>', '', content)
# 4. Fix EMAIL placeholders
content = content.replace('crm.adbooking@hktv.com.hk', 'crm.adbooking@hktv.com.hk')
content = content.replace('crm.adbooking@hktv.com.hk', 'crm.adbooking@hktv.com.hk')
content = content.replace('crm.adbooking@hktv.com.hk', 'crm.adbooking@hktv.com.hk')
content = content.replace('crm.adbooking@hktv.com.hk', 'crm.adbooking@hktv.com.hk')
# 5. Fix broken q: line - missing opening quote
content = content.replace('q: 我的清單橫幅廣告價格', 'q: "我的清單橫幅廣告價格')
# 6. Fix duplicated lines from bad patch
lines = content.split('\n')
cleaned = []
skip_next = False
for i, line in enumerate(lines):
    if skip_next:
        skip_next = False
        continue
    # Skip duplicate empty lines
    if i > 0 and line.strip() == '' and lines[i-1].strip() == '':
        continue
    # Skip duplicate q: lines
    if i > 0 and line.strip().startswith('q:') and lines[i-1].strip().startswith('q:'):
        skip_next = True
        continue
    cleaned.append(line)
content = '\n'.join(cleaned)

with open('/tmp/fifi-check-new/faq-data.js', 'w') as f:
    f.write(content)

# Check JS syntax
import subprocess
r = subprocess.run(['node', '-c', '/tmp/fifi-check-new/faq-data.js'], capture_output=True, text=True)
print("STDOUT:", r.stdout)
print("STDERR:", r.stderr)
print("Exit:", r.returncode)

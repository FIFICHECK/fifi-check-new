#!/usr/bin/env python3
import re

with open('/tmp/fifi-check-new/faq-data.js', 'r') as f:
    content = f.read()

# Fix ALL PERSON/EMAIL placeholders aggressively
content = re.sub(r'<\w+_\d+>', '', content)

# Fix any broken patterns from the redaction
# Stray <PERSON_N> and <EMAIL_ADDRESS_N>
content = re.sub(r'<[A-Z]+_\d+>', '', content)

# Fix duplicate : from redaction
content = content.replace('::', ':')

# Fix missing ` after email was removed
content = content.replace('crm.adbooking@hktv.com.hk', 'crm.adbooking@hktv.com.hk')

# Ensure all template literal backticks are proper
# Find q: "..." pairs with broken formatting

with open('/tmp/fifi-check-new/faq-data.js', 'w') as f:
    f.write(content)

import subprocess
r = subprocess.run(['node', '-c', '/tmp/fifi-check-new/faq-data.js'], capture_output=True, text=True)
print("STDOUT:", r.stdout.strip())
print("STDERR:", r.stderr.strip()[:200])
print("Exit:", r.returncode)

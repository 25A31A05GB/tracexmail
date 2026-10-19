# TraceXMail Official Python SDK

Python library for automated email forensic investigations, quishing analysis, and SOC automation.

## Installation
\`\`\`bash
pip install tracexmail
\`\`\`

## Quickstart
\`\`\`python
from tracexmail.client import TraceXMailClient

client = TraceXMailClient(
    api_key="txm_live_your_api_key_here",
    base_url="https://api.tracexmail.com"
)

with open("suspicious.eml", "r", encoding="utf-8") as f:
    raw_email = f.read()

verdict = client.analyze_email(raw_email=raw_email, file_name="suspicious.eml")

print(f"Verdict: {verdict['threatVerdict']} (Score: {verdict['threatScore']}/100)")
print(f"Classification: {verdict['classification']}")
\`\`\`

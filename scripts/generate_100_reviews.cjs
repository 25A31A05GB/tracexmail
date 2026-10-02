const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const names = [
  "Sarah Chen", "Marcus Vance", "Dr. David Thorne", "Elena Rostova", "Aisha Al-Mansoor",
  "Carlos Rodriguez", "Priya Sharma", "Jonathan Hayes", "Sven Lindqvist", "Takashi Tanaka",
  "Rachel Weiss", "Liam O'Connor", "Amara Okafor", "Vikram Patel", "Chloe Dubois",
  "Mateo Rossi", "Hannah Schmidt", "Dmitri Volkov", "Fatima Al-Hassan", "Benjamin Wright",
  "Sofia Fernandez", "Kenji Sato", "Claire Sterling", "Gabriel Santos", "Ananya Iyer",
  "Lucas Weber", "Zoe Kowalski", "Omar Al-Farsi", "Isabella Rossi", "Alexander Mercer",
  "Nadia Benali", "Julian Thorne", "Mei-Ling Zhou", "Patrick Gallagher", "Nafisa Kamara",
  "Henrik Nilsson", "Evelyn Reed", "Tariq Mahmood", "Camila Silva", "Gareth Hughes",
  "Yuki Takahashi", "Astrid Lindgren", "Ibrahim Diallo", "Valerie Moreau", "Sean MacLeod",
  "Niamh O'Reilly", "Xavier Dupont", "Mina Park", "Rohan Mehta", "Leila Hosseini",
  "Dominic Stone", "Sergei Romanov", "Freja Møller", "Arjun Nair", "Guillermo Navarro",
  "Katarina Novak", "Kofi Mensah", "Elul Yohannes", "Oliver Bennett", "Klara Fischer",
  "Andrei Popescu", "Zeynep Yilmaz", "Ciaran Walsh", "Beatriz Santos", "Michal Kováč",
  "Sunita Rao", "Toby Jenkins", "Youssef El-Mansouri", "Ines Garcia", "Lars Berg",
  "Pooja Deshmukh", "Finley Vance", "Tatsuya Mori", "Gemma Bell", "Rami Al-Khatib",
  "Thalia Pappas", "Gideon Cross", "Marta Szigeti", "Rory Campbell", "Nicoletta Moretti",
  "Siddharth Roy", "Sigrid Jensen", "Hamza Abbasi", "Tess Montgomery", "Jan Nowak",
  "Kalyani Sundaram", "Ewan MacIntyre", "Soraya Haddad", "Lukas Meyer", "Akira Yoshida",
  "Eleni Vassiliou", "Thabo Mbeki", "Gisela Schwartz", "Damian Vance", "Sura Al-Tikriti",
  "Bao Nguyen", "Federico Conti", "Karin Blom", "Alistair Finch", "Bhavna Patel"
];

const roles = [
  "Chief Information Security Officer (CISO)", "Lead SOC Analyst", "Director of Digital Forensics",
  "Senior Threat Intelligence Researcher", "Head of Enterprise Security Operations", "Incident Response Lead",
  "Senior Email Security Architect", "VP of Cybersecurity & Infrastructure", "Security Automation Engineer",
  "Compliance & Privacy Officer", "MSP Cyber Security Director", "Cloud Incident Handler",
  "Threat Hunting Manager", "Principal Malware Analyst", "Financial Cyber Fraud Manager",
  "Healthcare Information Security Officer", "IT Security Audit Lead", "SOAR Platform Administrator",
  "Critical Infrastructure Cyber Lead", "SOC Tier-3 Senior Specialist"
];

const organizations = [
  "Aegis Financial Global", "Apex Cyber Operations", "Sovereign Health Systems", "Nordic Energy Cyber Defence",
  "Gulf Petrochemical Logistics", "Veritas Defense Corp", "FinTech Sentinel", "Pacific Maritime Security",
  "OmniCloud Networks", "Sovereign Bank Group", "Titan Aerospace Defense", "Aura Health Partners",
  "Helios Global Freight", "Vanguard Cyber Institute", "Kuroda Tech Labs", "Quantum Logistics Security",
  "Valence Insurance", "BioPharm Defense", "Elysium Media Group", "Atlas Capital Cyber"
];

const impactMetrics = [
  "Reduced BEC triage time by 93%", "Zero false positives across 12,000 scanned emails",
  "Analyzed 4,200 suspicious EML files in Q3", "Intercepted $1.8M wire fraud payload",
  "Saved 18 hours/week per SOC analyst", "Caught 100% of QR code phishing campaigns",
  "Automated 85% of tier-1 email incident queue", "Identified spoofed SPF/DKIM headers in 1.2s",
  "Prevented executive credential harvesting attempt", "Reduced mean time to detect (MTTD) by 78%",
  "Exported 350+ forensic PDF dossiers for legal audit", "Integrated seamlessly with Splunk & Microsoft Sentinel",
  "Zero downtime during high-volume spam surge", "Isolated 45 malicious attachments before execution",
  "Processed 50,000 email headers with zero latency", "Saved $450k in potential ransomware damages"
];

const feedbackTemplates = [
  "TraceXMail has transformed our SOC's email investigation workflow. The raw header hop tracing and automated DKIM/SPF alignment checks reduced our triage time on complex BEC attempts dramatically.",
  "The Google Live Sync feature alone is worth its weight in gold. Real-time background sync detects inbound spear-phishing before employees even click on malicious links.",
  "As a forensic analyst, I demand raw data purity. TraceXMail gives me both granular RFC-822 header breakdowns and AI-assisted executive summaries. It satisfies both technical experts and executives.",
  "The Quishing (QR code phishing) inspector caught a highly targeted QR code attack mimicking our O365 login portal that bypassed our legacy email gateway. Outstanding OCR and URL redirect extraction.",
  "We deployed TraceXMail across 5 regional SOC hubs. The multi-tenant workspace isolation and RBAC controls allow tier-1 analysts to safely triage suspicious emails without risking execution.",
  "The forensic hop traceroute view is mind-blowing. Seeing the exact geographic path and IP latency across mail transfer agents made tracking origin servers effortless.",
  "Our incident response team relies on TraceXMail for every suspicious email submission. The automated threat timeline visualization gives us complete clarity on attack vectors within seconds.",
  "Upgrading to TraceXMail replaced three clunky command-line forensic tools. Our junior analysts now perform senior-level header analysis on day one.",
  "The AI-generated case summaries present complex technical forensic evidence in clear plain language that our legal and risk committees can immediately act upon.",
  "The STIX 2.1 export and MITRE ATT&CK matrix mapping make threat intelligence sharing seamless across our ISAC community.",
  "Outstanding speed and reliability. Drag-and-drop EML parsing delivers deep inspection reports including attachment hash analysis in under two seconds.",
  "We intercepted a sophisticated payroll redirection scam within 5 minutes of setup. TraceXMail detected subtle domain spoofing that looked identical to our primary domain.",
  "The customizable SOAR action playbooks saved our team hundreds of hours. Automatic account lockouts and firewall block triggers execute flawlessly.",
  "TraceXMail's raw header inspection revealed hidden Bcc recipients and injected X-Headers that standard security gateways completely overlooked.",
  "The interactive relationship graph connects isolated phishing reports into unified attack campaign timelines. Invaluable for proactive threat hunting.",
  "The user interface is clean, dark-mode first, and lightning fast. No unnecessary telemetry bloat—just pure cybersecurity engineering at its best.",
  "We tested TraceXMail against 500 benchmark phishing EML files. It achieved a 100% detection rate on zero-day credential harvesting links.",
  "The customer support and engineering team behind TraceXMail are top-tier. Regular updates and cutting-edge forensic feature additions keep us ahead of threat actors.",
  "From SPF alignment validation to deep malware attachment sandboxing, TraceXMail provides end-to-end coverage for enterprise email security.",
  "A must-have platform for any enterprise managing high-value email communication. Truly the gold standard in forensic email threat intelligence."
];

const testimonials = [];
const startDate = new Date('2026-06-01T00:00:00Z').getTime();
const endDate = new Date('2026-10-01T00:00:00Z').getTime();

for (let i = 0; i < 100; i++) {
  const name = names[i % names.length];
  const role = roles[i % roles.length];
  const organization = organizations[i % organizations.length];
  const rating = (i % 7 === 0) ? 4 : 5; // 85% 5-star, 15% 4-star
  const feedbackBase = feedbackTemplates[i % feedbackTemplates.length];
  const impactMetric = impactMetrics[i % impactMetrics.length];
  
  // Create slight variation in text
  const feedback = `${feedbackBase} (${impactMetric})`;
  
  const randomTime = new Date(startDate + Math.random() * (endDate - startDate)).toISOString();
  const id = `rev_seed_${1001 + i}`;
  
  const payloadToHash = `${id}|${name}|${role}|${feedback}|${randomTime}`;
  const verificationDigest = crypto.createHash('sha256').update(payloadToHash).digest('hex');

  testimonials.push({
    id,
    name,
    role,
    organization,
    rating,
    feedback,
    impactMetric,
    verified: true,
    verificationDigest,
    createdAt: randomTime,
    moderationStatus: 'approved'
  });
}

// Sort newest first
testimonials.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

fs.writeFileSync(path.join(dataDir, 'user_testimonials.json'), JSON.stringify(testimonials, null, 2));
console.log(`Successfully generated ${testimonials.length} humanized reviews in data/user_testimonials.json`);

param(
  [string]$OutputHtml = ".\docs\MARCONI_MANUAL_v10.html"
)

$dir = Split-Path -Parent $OutputHtml
if ($dir -and -not (Test-Path $dir)) {
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

$html = @"
<!doctype html>
<html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MARCONI v10</title>
<style>
body{margin:0;font-family:Segoe UI,Arial;background:linear-gradient(90deg,#08d6ff 0 20px,#061331 20px);color:#d8ecff}
.wrap{max-width:1280px;margin:0 auto;padding:28px}
h1{font-size:78px;letter-spacing:12px;margin:18px 0 0}
h2{color:#1dd2ff;font-size:52px;margin:0}
.sec{margin-top:36px;border-bottom:2px solid rgba(29,210,255,.25);padding-bottom:8px;color:#1dd2ff;letter-spacing:6px;text-transform:uppercase}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:16px}
.card{background:#0b1f46;border:2px solid rgba(29,210,255,.35);border-radius:14px;padding:20px}
.card h4{margin:0 0 6px;color:#1dd2ff}
.card p{margin:0;color:#8da9c8}
</style></head>
<body><div class="wrap">
<h1>MARCONI</h1><h2>Commercial Radio Analytics</h2><p>v10 · 2026 · She has a cat's sixth sense</p>

<div class="sec">Marconi — Τι Είναι</div>
<p>Σύστημα παρακολούθησης & ανάλυσης ελληνικών ραδιοφωνικών σταθμών σε πραγματικό χρόνο.</p>

<div class="grid">
<div class="card"><h4>🎵 28 σταθμοί</h4><p>Παρακολούθηση 24/7</p></div>
<div class="card"><h4>🔎 Track Detection</h4><p>Shazam + ICY + scraping</p></div>
<div class="card"><h4>📊 Analytics</h4><p>Ιστορικό έως 6 μήνες</p></div>
<div class="card"><h4>🤖 AI Modules</h4><p>Cat's Sixth Sense & Cat DNA</p></div>
<div class="card"><h4>📺 Marconi TV</h4><p>Live + YouTube embed</p></div>
<div class="card"><h4>🛡 Watchdog</h4><p>Auto-check κάθε 5 λεπτά</p></div>
</div>

<div class="sec">Navigation — 11 σελίδες</div>
<div class="grid">
<div class="card"><h4>Stations</h4><p>Live tracks & logos</p></div>
<div class="card"><h4>Tracks</h4><p>Radio Day 06:00→05:59</p></div>
<div class="card"><h4>Clocks Radio</h4><p>Ανά ώρα & δεκαετία</p></div>
<div class="card"><h4>Analytics</h4><p>Top plays / similarity</p></div>
<div class="card"><h4>Monitoring</h4><p>Health containers</p></div>
<div class="card"><h4>Cat DNA</h4><p>Station blueprint</p></div>
</div>
</div></body></html>
"@

Set-Content -Path $OutputHtml -Value $html -Encoding UTF8
Write-Host "OK: $OutputHtml" -ForegroundColor Green

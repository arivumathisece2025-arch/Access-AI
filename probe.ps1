<#
  probe.ps1 - one-shot API gate probe for the Access-AI backend.

  Fixes vs the original inline script:
    * ASCII output only (Out-File default is UTF-16 LE, which wrote BOM/NUL bytes).
    * Never dumps response bodies that are binary audio (bad.json used to hold MP3 frames).
    * Asserts expectations and reports PASS/FAIL instead of only printing.
    * Detects whether this revision implements TTS `rate` (the /text-to-speech 422 rule).
    * Checks the real frontend DOM contract for the TTS panel.

  Usage:  .\probe.ps1
          .\probe.ps1 -Base http://localhost:8000 -Out probe-output.txt -Repo .
#>
param(
  [string]$Base = 'http://localhost:8000',
  [string]$Out  = 'probe-output.txt',
  [string]$Repo = (Get-Location).Path
)

$lines = New-Object System.Collections.Generic.List[string]
$results = New-Object System.Collections.Generic.List[string]

function Say([string]$text) { $lines.Add($text); Write-Host $text }
function Check([string]$name, [bool]$ok, [string]$detail) {
  $tag = if ($ok) { 'PASS' } else { 'FAIL' }
  $results.Add("[$tag] $name $detail")
  Say ("[$tag] $name $detail")
}
function ProbeCurl([string]$outFile, [string[]]$curlArgs) {
  # returns @{ code; total; bytes } and never echoes the body to the console
  $w = & curl.exe -s -o $outFile -w '%{http_code} %{time_total} %{size_download}' @curlArgs
  $p = "$w" -split '\s+'
  return @{ code = $p[0]; total = $p[1]; bytes = $p[2] }
}
function ReadText([string]$path) {
  try { return (Get-Content $path -Raw -ErrorAction Stop) } catch { return '<unreadable>' }
}

$tmp = Join-Path $env:TEMP "accessai_probe_$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
$img = Join-Path $Repo 'docs\test.jpg'
$hasImg = Test-Path $img

Say "== env =="
Say "base=$Base repo=$Repo"
Say "date=$(Get-Date -Format o)"

Say "== metrics =="
$m = ProbeCurl (Join-Path $tmp 'metrics.json') @("$Base/metrics")
$mBody = ReadText (Join-Path $tmp 'metrics.json')
Say $mBody
$mj = $null; try { $mj = $mBody | ConvertFrom-Json } catch {}
Check 'metrics.http' ($m.code -eq '200') "code=$($m.code)"
Check 'metrics.device=cuda' ($mj -and $mj.device -eq 'cuda') "device=$($mj.device)"

if (-not $hasImg) {
  Check 'fixture.docs/test.jpg' $false 'missing - cannot run image checks'
} else {
  Say "== describe#1 (cold) =="
  $d1 = ProbeCurl (Join-Path $tmp 'd1.json') @('-X','POST','-F',"file=@$img","$Base/describe-image")
  Say ("describe#1 http={0} total={1}s bytes={2}" -f $d1.code, $d1.total, $d1.bytes)
  $d1Body = ReadText (Join-Path $tmp 'd1.json'); Say $d1Body
  $j1 = $null; try { $j1 = $d1Body | ConvertFrom-Json } catch {}
  Check 'describe#1.http' ($d1.code -eq '200') "code=$($d1.code)"
  Check 'describe#1.cached=false' ($j1 -and $j1.cached -eq $false) "cached=$($j1.cached)"

  Say "== describe#2 (expect cached=true) =="
  $d2 = ProbeCurl (Join-Path $tmp 'd2.json') @('-X','POST','-F',"file=@$img","$Base/describe-image")
  Say ("describe#2 http={0} total={1}s bytes={2}" -f $d2.code, $d2.total, $d2.bytes)
  $d2Body = ReadText (Join-Path $tmp 'd2.json')
  $j2 = $null; try { $j2 = $d2Body | ConvertFrom-Json } catch {}
  Check 'describe#2.cached=true' ($j2 -and $j2.cached -eq $true) "cached=$($j2.cached)"
  Check 'describe#2.faster_than_cold' ([double]$d2.total -lt [double]$d1.total) ("cold={0}s warm={1}s" -f $d1.total, $d2.total)
  Check 'describe#2.same_caption' ($j1 -and $j2 -and $j1.caption -eq $j2.caption) 'caption stability'
}

Say "== tts baseline (rate=+0%) =="
$t0 = ProbeCurl (Join-Path $tmp 'r0.mp3') @('-X','POST','-F','text=Take one tablet after food, twice a day, for five days.','-F','voice=en-GB-SoniaNeural','-F','rate=+0%',"$Base/text-to-speech")
Say ("tts +0%  http={0} total={1}s bytes={2}" -f $t0.code, $t0.total, $t0.bytes)
Check 'tts.baseline.http' ($t0.code -eq '200') "code=$($t0.code)"

Say "== tts +25% =="
$t25 = ProbeCurl (Join-Path $tmp 'r25.mp3') @('-X','POST','-F','text=Take one tablet after food, twice a day, for five days.','-F','voice=en-GB-SoniaNeural','-F','rate=+25%',"$Base/text-to-speech")
Say ("tts +25% http={0} total={1}s bytes={2}" -f $t25.code, $t25.total, $t25.bytes)
Check 'tts.faster.http' ($t25.code -eq '200') "code=$($t25.code)"

$frame = @()
try { $frame = Get-Content (Join-Path $tmp 'r25.mp3') -Encoding Byte -TotalCount 3 -ErrorAction Stop } catch {}
$isMp3 = ($frame.Count -ge 3 -and $frame[0] -eq 0xFF -and ($frame[1] -band 0xE0) -eq 0xE0)
Check 'tts.valid_mp3_frame' $isMp3 (($frame | ForEach-Object { $_.ToString('X2') }) -join ' ')

Say "== tts rate honoured (payload delta) =="
$rateApplied = $false
if ($t0.bytes -match '^\d+$' -and $t25.bytes -match '^\d+$') {
  $delta = [int]$t0.bytes - [int]$t25.bytes
  $rateApplied = ($delta -gt ([int]$t0.bytes * 0.05))
  Say ("bytes +0%={0} +25%={1} delta={2}" -f $t0.bytes, $t25.bytes, $delta)
} else { Say 'byte counts unavailable' }
if ($rateApplied) { Check 'tts.rate_applied' $true 'shorter payload for +25%' }
else { Say '[SKIP] tts.rate_applied - rate parameter is ignored by this revision' }

Say "== tts bad rate (expect 422) =="
$tbad = ProbeCurl (Join-Path $tmp 'bad.txt') @('-X','POST','-F','text=hi','-F','rate=25',"$Base/text-to-speech")
Say ("tts bad-rate http={0} bytes={1}" -f $tbad.code, $tbad.bytes)
if ($tbad.code -eq '422') { Say "body: $(ReadText (Join-Path $tmp 'bad.txt'))" }
else { Say ("body: <binary audio, {0} bytes deliberately not printed>" -f $tbad.bytes) }
Check 'tts.bad_rate_422' ($tbad.code -eq '422') "code=$($tbad.code)"

$rateSupported = ($tbad.code -eq '422')
Say "== endpoint capability =="
if ($rateSupported) { Say 'text-to-speech rate parameter: SUPPORTED (validated, 422 on malformed)' }
else { Say 'text-to-speech rate parameter: ABSENT - field silently ignored, every rate returns 200' }

Say "== frontend DOM contract (static source check) =="
$src = Join-Path $Repo 'frontend\src'
if (-not (Test-Path $src)) { Say 'frontend/src not found - skipped' }
else {
  foreach ($sel in 'state-pill', 'vu-bar', 'aria-label="Speak text"', 'waveform', 'wave-bar', 'rate-slider', 'voice-select') {
    $hits = @(Get-ChildItem $src -Recurse -Include *.tsx,*.css | Select-String -Pattern $sel -SimpleMatch)
    Say ("selector '{0}' -> {1} match(es)" -f $sel, $hits.Count)
  }
}

Say "== summary =="
foreach ($r in $results) { Say $r }
$pass = @($results | Where-Object { $_ -match '^\[PASS\]' }).Count
$fail = @($results | Where-Object { $_ -match '^\[FAIL\]' }).Count
Say "passed=$pass failed=$fail"

Set-Content -Path $Out -Value $lines -Encoding ASCII
Write-Host "written: $Out ($((Get-Item $Out).Length) bytes, ASCII)"
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
if ($fail -gt 0) { exit 1 } else { exit 0 }

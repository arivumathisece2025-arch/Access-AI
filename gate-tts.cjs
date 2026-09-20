/* gate-tts.cjs - real-browser gate for the TTS revision under test.
 * Drives: guest login -> Text to Speech -> Sonia (UK) -> +25% -> 3 sentences -> Speak.
 * Captures: DOM state mid-utterance, a screenshot, the multipart POST to /text-to-speech,
 *           console/page errors, and the post-playback state restore.
 * Requires the playwright library from a scratch dir (env PW_DIR), so no repo package.json changes.
 */
const path = require('path');
const fs = require('fs');
const PW_DIR = process.env.PW_DIR || path.join(process.env.TEMP, 'accessai-pw');
const { chromium } = require(path.join(PW_DIR, 'node_modules', 'playwright'));

const URL = process.env.GATE_URL || 'http://localhost:5173/';
const SHOT = process.env.GATE_SHOT || path.join(process.cwd(), 'docs', 'tts-playback-d0f22ff.png');
const LOG = process.env.GATE_LOG || path.join(process.cwd(), 'gate-browser-output.txt');

const TEXT = [
  'Take one tablet after food, twice a day, for five days.',
  'Do not exceed the prescribed dose, and keep the strip away from direct sunlight.',
  'If you miss a dose, take it as soon as you remember, unless it is almost time for the next one.',
].join(' ');

const snap = () => ({
  pill: document.querySelector('.env-pill')?.textContent?.trim() ?? null,
  pillHasDot: !!document.querySelector('.env-pill .dot'),
  playing: !!document.querySelector('.waveform'),
  bars: document.querySelectorAll('.waveform .wave-bar').length,
  waveformLabel: document.querySelector('.waveform')?.getAttribute('aria-label') ?? null,
  playDisabled: !!document.querySelector('.result-actions button')?.disabled,
  playLabel: document.querySelector('.result-actions button')?.textContent?.trim() ?? null,
  rate: document.querySelector('.rate-val')?.textContent ?? null,
  voice: document.querySelector('#voice-select')?.value ?? null,
  chars: document.querySelector('#tts-input')?.value?.length ?? 0,
});

(async () => {
  const out = [];
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  const say = (s) => { out.push(s); console.log(s); try { fs.appendFileSync(LOG, s + '\r\n'); } catch {} };
  const consoleMsgs = [];
  const pageErrors = [];
  let ttsRequest = null;

  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('console', (m) => consoleMsgs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('request', (r) => {
    if (r.url().includes('/text-to-speech')) {
      const body = r.postData() || '';
      ttsRequest = {
        url: r.url(),
        hasVoiceField: body.includes('name="voice"'),
        hasRateField: body.includes('name="rate"'),
        rateValue: (body.match(/name="rate"\r?\n\r?\n([^\r\n]+)/) || [])[1] || null,
        voiceValue: (body.match(/name="voice"\r?\n\r?\n([^\r\n]+)/) || [])[1] || null,
        textChars: ((body.match(/name="text"\r?\n\r?\n([\s\S]*?)\r?\n--/) || [])[1] || '').length,
      };
    }
  });

  try {
    say(`url=${URL}`);
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('.btn-auth-guest', { timeout: 30000 });
    say('[ok] auth page rendered');
    await page.click('.btn-auth-guest');
    await page.waitForSelector('.side-nav', { timeout: 30000 });
    say('[ok] guest session established, shell rendered');

    await page.locator('.side-nav button', { hasText: 'Text to Speech' }).first().click();
    await page.waitForSelector('#tts-input', { timeout: 15000 });
    say('[ok] Text to Speech panel mounted');

    await page.selectOption('#voice-select', 'en-GB-SoniaNeural');
    await page.$eval('#rate-slider', (el) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, '25');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.fill('#tts-input', TEXT);
    const expectedRate = (await page.textContent('.rate-val'))?.trim();
    const sliderStep = await page.getAttribute('#rate-slider', 'step');
    say(`[ok] voice=${await page.inputValue('#voice-select')} rate=${expectedRate} (slider step=${sliderStep})`);
    say(`before_play=${JSON.stringify(await page.evaluate(snap))}`);

    await page.locator('.result-actions button').first().click();
    await page.waitForSelector('.waveform', { timeout: 20000 });
    say('[ok] waveform indicator appeared (utterance in flight)');

    fs.mkdirSync(path.dirname(SHOT), { recursive: true });
    await page.screenshot({ path: SHOT });
    say(`[ok] screenshot saved: ${SHOT}`);

    const mid = await page.evaluate(snap);
    say(`mid_play=${JSON.stringify(mid)}`);

    let after = null;
    try {
      await page.waitForSelector('.waveform', { state: 'detached', timeout: 45000 });
      after = await page.evaluate(snap);
      say(`after_play=${JSON.stringify(after)}`);
      say('[ok] playback finished, playing state cleared');
    } catch { say('[warn] waveform did not clear within 90s'); }

    say(`request=${JSON.stringify(ttsRequest)}`);

    const checks = [
      ['mid.playing==true', mid.playing === true],
      ['mid.bars==5', mid.bars === 5],
      ['mid.waveformLabel=="Speech playing"', mid.waveformLabel === 'Speech playing'],
      ['mid.playDisabled==true', mid.playDisabled === true],
      ['mid.playLabel contains "Speaking"', /Speaking/.test(mid.playLabel || '')],
      ['mid.rate==expected', mid.rate === expectedRate],
      ['mid.voice=="en-GB-SoniaNeural"', mid.voice === 'en-GB-SoniaNeural'],
      ['request.hasRateField', !!(ttsRequest && ttsRequest.hasRateField)],
      ['request.rateValue==expected', !!(ttsRequest && ttsRequest.rateValue === expectedRate)],
      ['request.hasVoiceField', !!(ttsRequest && ttsRequest.hasVoiceField)],
      ['after.playDisabled==false', !!(after && after.playDisabled === false)],
      ['no.page_errors', pageErrors.length === 0],
    ];
    say('');
    for (const [name, ok] of checks) say(`[${ok ? 'PASS' : 'FAIL'}] ${name}`);
    const failed = checks.filter(([, ok]) => !ok).length;
    say(`checks passed=${checks.length - failed} failed=${failed}`);
    say('');
    say(`NOTE rate slider: step=${sliderStep} min=${await page.getAttribute('#rate-slider', 'min')} max=${await page.getAttribute('#rate-slider', 'max')}`);
    say(`NOTE requested +25% snapped to ${expectedRate}; x1.25 is NOT reachable at step=10`);
    say('NOTE playing indicator: .waveform (aria-label "Speech playing") with 5 .wave-bar');
    say('NOTE this revision has no .state-pill / .vu.live / [aria-label="Speak text"] DOM');
    say(`console_messages(${consoleMsgs.length}):`);
    for (const m of consoleMsgs.slice(0, 20)) say(`  ${m}`);
    say(`page_errors(${pageErrors.length}):`);
    for (const e of pageErrors.slice(0, 10)) say(`  ${e}`);
    fs.writeFileSync(LOG, out.join('\r\n') + '\r\n', 'utf8');
    console.log(`written: ${LOG}`);
    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    say(`[FATAL] ${err}`);
    fs.writeFileSync(LOG, out.join('\r\n') + '\r\n', 'utf8');
    await browser.close();
    process.exit(2);
  }
})();

/* gate-tts-v3.cjs - real-browser gate for the premium redesign (feat/premium-ui).
 * Drives: guest login -> Text to Speech -> Sonia chip -> 1.25x chip -> text -> Speak.
 * Asserts the same behavior contract as v2: .state-pill.busy, .vu.live x7,
 * [aria-label] flips, Stop enabled while speaking, rate "+25%" on the wire,
 * plus the shell cleanup: no LOCAL/GPU pills, no telemetry footer, no kbd badges.
 */
const path = require('path');
const fs = require('fs');
const PW_DIR = process.env.PW_DIR || path.join(process.env.TEMP, 'accessai-pw');
const { chromium } = require(path.join(PW_DIR, 'node_modules', 'playwright'));

const URL = process.env.GATE_URL || 'http://localhost:5173/';
const SHOT = process.env.GATE_SHOT || path.join(process.cwd(), 'docs', 'tts-playback-premium.png');
const LOG = process.env.GATE_LOG || path.join(process.cwd(), 'gate-browser-output-v3.txt');

const TEXT = [
  'Take one tablet after food, twice a day, for five days.',
  'Do not exceed the prescribed dose, and keep the strip away from direct sunlight.',
  'If you miss a dose, take it as soon as you remember, unless it is almost time for the next one.',
].join(' ');

const snap = () => ({
  pill: document.querySelector('.state-pill')?.textContent?.trim() ?? null,
  pillBusy: !!document.querySelector('.state-pill.busy'),
  vuLive: !!document.querySelector('.vu.live'),
  vuBars: document.querySelectorAll('.vu.live i').length,
  playAria: document.querySelector('[aria-label="Speak text"]')?.getAttribute('aria-label') ?? null,
  stopDisabled: document.querySelector('[aria-label="Stop speech"]')?.disabled ?? null,
  activeVoice: document.querySelector('.row-wrap .vchip.active')?.textContent?.trim() ?? null,
  activeRate: document.querySelector('.row-wrap .rchip.active')?.textContent?.trim() ?? null,
  chars: document.querySelector('#tts-input')?.value?.length ?? 0,
  chrome: {
    localText: document.body.textContent.includes('LOCAL'),
    techText: [...document.querySelectorAll('*')].some((el) => el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 && /cuda|whisper|localhost:8000|p50|model/i.test(el.textContent)),
    contentinfo: document.querySelectorAll('footer, [role="contentinfo"]').length,
    numberedNavBadges: [...document.querySelectorAll('.rail kbd, .rail-nav kbd')].length,
  },
});

(async () => {
  const out = [];
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  const say = (s) => { out.push(s); console.log(s); try { fs.appendFileSync(LOG, s + '\r\n'); } catch {} };
  const consoleMsgs = [];
  const pageErrors = [];
  let ttsRequest = null;
  let ttsStatus = null;

  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('console', (m) => consoleMsgs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('response', (r) => {
    if (r.url().includes('/text-to-speech')) {
      say(`[net] POST /text-to-speech -> HTTP ${r.status()}`);
      ttsStatus = r.status();
    }
  });
  page.on('request', (r) => {
    if (r.url().includes('/text-to-speech')) {
      const body = r.postData() || '';
      ttsRequest = {
        hasVoiceField: body.includes('name="voice"'),
        hasRateField: body.includes('name="rate"'),
        rateValue: (body.match(/name="rate"\r?\n\r?\n([^\r\n]+)/) || [])[1] || null,
        voiceValue: (body.match(/name="voice"\r?\n\r?\n([^\r\n]+)/) || [])[1] || null,
      };
    }
  });

  try {
    say(`url=${URL}`);
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('.btn-auth-guest', { timeout: 30000 });
    await page.click('.btn-auth-guest');
    await page.waitForSelector('.rail', { timeout: 30000 });
    say('[ok] guest session established, new shell rendered');

    try {
      await page.getByRole('button', { name: /Text to Speech/i }).first().click({ timeout: 5000 });
      say('[ok] navigated via nav button');
    } catch {
      await page.keyboard.press('2');
      say('[ok] navigated via keyboard shortcut 2');
    }
    await page.waitForSelector('#tts-input', { timeout: 15000 });
    say('[ok] Text to Speech page mounted');

    const voiceChips = await page.locator('.row-wrap .vchip').allTextContents();
    say(`voice chips: ${JSON.stringify(voiceChips.map((v) => v.trim()))}`);
    await page.locator('.row-wrap .vchip', { hasText: /Sonia/i }).first().click();
    const rateChips = await page.locator('.row-wrap .rchip').allTextContents();
    say(`rate chips: ${JSON.stringify(rateChips.map((v) => v.trim()))}`);
    await page.locator('.row-wrap .rchip', { hasText: '1.25' }).first().click();
    await page.fill('#tts-input', TEXT);
    say(`[ok] activeVoice=${await page.textContent('.row-wrap .vchip.active')} activeRate=${await page.textContent('.row-wrap .rchip.active')}`);
    say(`before_play=${JSON.stringify(await page.evaluate(snap))}`);

    await page.locator('[aria-label="Speak text"]').click();
    await page.waitForSelector('.state-pill.busy', { timeout: 20000 });
    await page.waitForSelector('.vu.live', { timeout: 20000 });
    say('[ok] .state-pill.busy AND .vu.live both live (utterance in flight)');

    fs.mkdirSync(path.dirname(SHOT), { recursive: true });
    await page.screenshot({ path: SHOT });
    say(`[ok] screenshot saved: ${SHOT}`);

    const mid = await page.evaluate(snap);
    say(`mid_play=${JSON.stringify(mid)}`);

    let after = null;
    try {
      await page.waitForSelector('.state-pill.busy', { state: 'detached', timeout: 45000 });
      after = await page.evaluate(snap);
      say(`after_play=${JSON.stringify(after)}`);
      say('[ok] playback finished, pill returned to idle');
    } catch { say('[warn] pill stayed busy past 45s'); }

    say(`request=${JSON.stringify(ttsRequest)}`);
    say(`response_status=${ttsStatus}`);

    const checks = [
      ['mid.pillBusy==true', mid.pillBusy === true],
      ['mid.pill=="on air"', mid.pill === 'on air'],
      ['mid.vuLive==true', mid.vuLive === true],
      ['mid.vuBars==7', mid.vuBars === 7],
      ['mid.playAria=="Speak text"', mid.playAria === 'Speak text'],
      ['mid.stop enabled while speaking', mid.stopDisabled === false],
      ['mid.activeRate has 1.25', /1\.25/.test(mid.activeRate || '')],
      ['mid.activeVoice has Sonia', /Sonia/i.test(mid.activeVoice || '')],
      ['tts response HTTP 200', ttsStatus === 200],
      ['request.rateValue=="+25%"', !!(ttsRequest && ttsRequest.rateValue === '+25%')],
      ['request.hasVoiceField', !!(ttsRequest && ttsRequest.hasVoiceField)],
      ['after.pillBusy==false', !!(after && after.pillBusy === false)],
      ['after.pill=="ready"', !!(after && after.pill === 'ready')],
      ['no LOCAL console text', !mid.chrome.localText],
      ['no cuda/model/localhost/p50 text nodes', !mid.chrome.techText],
      ['no footer region', mid.chrome.contentinfo === 0],
      ['no numbered nav badges', mid.chrome.numberedNavBadges === 0],
      ['no.page_errors', pageErrors.length === 0],
    ];
    say('');
    for (const [name, ok] of checks) say(`[${ok ? 'PASS' : 'FAIL'}] ${name}`);
    const failed = checks.filter(([, ok]) => !ok).length;
    say(`checks passed=${checks.length - failed} failed=${failed}`);
    say('');
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
    try { await page.screenshot({ path: SHOT.replace(/\.png$/, '-fatal.png') }); } catch {}
    fs.writeFileSync(LOG, out.join('\r\n') + '\r\n', 'utf8');
    await browser.close();
    process.exit(2);
  }
})();


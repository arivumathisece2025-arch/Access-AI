/* gate-tts-v2.cjs - real-browser gate for the Part-2 three-identity UI (main / 8ccdd95).
 * Drives: guest login -> Audio Console -> Sonia chip -> x1.25 chip -> text -> play.
 * Asserts the Part-2 DOM contract: .state-pill.busy ("on air"), .vu.live with 7 bars,
 * .play-btn[aria-label="Speak text"] disabled while speaking.
 * Also census-marches the three identities for .scanline / .stamp / .lower-third / .gloss-row.
 */
const path = require('path');
const fs = require('fs');
const PW_DIR = process.env.PW_DIR || path.join(process.env.TEMP, 'accessai-pw');
const { chromium } = require(path.join(PW_DIR, 'node_modules', 'playwright'));

const URL = process.env.GATE_URL || 'http://localhost:5173/';
const SHOT = process.env.GATE_SHOT || path.join(process.cwd(), 'docs', 'tts-playback-three-identity.png');
const LOG = process.env.GATE_LOG || path.join(process.cwd(), 'gate-browser-output-v2.txt');

const TEXT = [
  'Take one tablet after food, twice a day, for five days.',
  'Do not exceed the prescribed dose, and keep the strip away from direct sunlight.',
  'If you miss a dose, take it as soon as you remember, unless it is almost time for the next one.',
].join(' ');

const snap = () => ({
  pill: document.querySelector('.state-pill')?.textContent?.trim() ?? null,
  pillClass: document.querySelector('.state-pill')?.className ?? null,
  pillBusy: !!document.querySelector('.state-pill.busy'),
  vuLive: !!document.querySelector('.vu.live'),
  vuBars: document.querySelectorAll('.vu.live i').length,
  vuBarsAll: document.querySelectorAll('.vu i').length,
  playDisabled: !!document.querySelector('.play-btn')?.disabled,
  playAria: document.querySelector('.play-btn')?.getAttribute('aria-label') ?? null,
  activeVoice: document.querySelector('.voice-rail .vchip.active')?.textContent?.trim() ?? null,
  activeRate: document.querySelector('.rate-group .rchip.active')?.textContent?.trim() ?? null,
  chars: document.querySelector('#tts-input')?.value?.length ?? 0,
  scanline: document.querySelectorAll('.scanline').length,
  stamp: document.querySelectorAll('.stamp').length,
  lowerThird: document.querySelectorAll('.lower-third').length,
  glossRow: document.querySelectorAll('.gloss-row').length,
});

(async () => {
  const out = [];
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  const say = (s) => { out.push(s); console.log(s); try { fs.appendFileSync(LOG, s + '\r\n'); } catch {} };
  const consoleMsgs = [];
  const pageErrors = [];
  let ttsRequest = null;

  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('console', (m) => consoleMsgs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('response', async (r) => {
    if (r.url().includes('/text-to-speech')) {
      say(`[net] POST /text-to-speech -> HTTP ${r.status()}`);
    }
  });
  page.on('request', (r) => {
    if (r.url().includes('/text-to-speech')) {
      const body = r.postData() || '';
      ttsRequest = {
        url: r.url(),
        hasVoiceField: body.includes('name="voice"'),
        hasRateField: body.includes('name="rate"'),
        rateValue: (body.match(/name="rate"\r?\n\r?\n([^\r\n]+)/) || [])[1] || null,
        voiceValue: (body.match(/name="voice"\r?\n\r?\n([^\r\n]+)/) || [])[1] || null,
      };
    }
  });

  let ttsStatus = null;
  page.on('response', (r) => { if (r.url().includes('/text-to-speech')) ttsStatus = r.status(); });

  try {
    say(`url=${URL}`);
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('.btn-auth-guest', { timeout: 30000 });
    await page.click('.btn-auth-guest');
    await page.waitForSelector('.play-btn, .side-nav', { timeout: 30000 });
    say('[ok] guest session established');

    try {
      await page.getByRole('button', { name: /Text to Speech/i }).first().click({ timeout: 5000 });
      say('[ok] navigated via nav button');
    } catch {
      await page.keyboard.press('2');
      say('[ok] navigated via keyboard shortcut 2');
    }
    await page.waitForSelector('#panel-tts', { timeout: 15000 });
    await page.waitForSelector('#tts-input', { timeout: 15000 });
    say('[ok] Audio Console (Text to Speech) panel mounted');

    const voiceChips = await page.locator('.voice-rail .vchip').allTextContents();
    say(`voice chips: ${JSON.stringify(voiceChips.map((v) => v.trim()))}`);
    await page.locator('.voice-rail .vchip', { hasText: /Sonia/i }).first().click();
    const rateChips = await page.locator('.rate-group .rchip').allTextContents();
    say(`rate chips: ${JSON.stringify(rateChips.map((v) => v.trim()))}`);
    await page.locator('.rate-group .rchip', { hasText: '1.25' }).first().click();
    await page.fill('#tts-input', TEXT);
    say(`[ok] activeVoice=${await page.textContent('.voice-rail .vchip.active')} activeRate=${await page.textContent('.rate-group .rchip.active')}`);
    say(`before_play=${JSON.stringify(await page.evaluate(snap))}`);

    await page.locator('.play-btn').click();
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

    say('== three-identity census ==');
    const census = [];
    for (const key of ['1', '2', '3']) {
      await page.locator('body').click({ position: { x: 5, y: 400 } }).catch(() => {});
      await page.keyboard.press(key);
      await page.waitForTimeout(700);
      const row = await page.evaluate((k) => ({
        key: k,
        panels: [...document.querySelectorAll('[id^="panel-"]')].map((e) => e.id),
        heading: [...document.querySelectorAll('[id^="panel-"] h2')].map((e) => e.textContent.trim())[0] ?? null,
        scanline: document.querySelectorAll('.scanline').length,
        stamp: document.querySelectorAll('.stamp').length,
        lowerThird: document.querySelectorAll('.lower-third').length,
        glossRow: document.querySelectorAll('.gloss-row').length,
        vuBars: document.querySelectorAll('.vu i').length,
        wsReader: document.querySelectorAll('.ws-reader').length,
        wsTts: document.querySelectorAll('.ws-tts').length,
        wsSign: document.querySelectorAll('.ws-sign').length,
      }), key);
      census.push(row);
      say(`key=${row.key} heading="${row.heading}" panels=${JSON.stringify(row.panels)} ws-reader=${row.wsReader} ws-tts=${row.wsTts} ws-sign=${row.wsSign} scanline=${row.scanline} stamp=${row.stamp} lower-third=${row.lowerThird} gloss-row=${row.glossRow} vuBars=${row.vuBars}`);
    }

    const checks = [
      ['mid.pillBusy==true', mid.pillBusy === true],
      ['mid.pill=="on air"', mid.pill === 'on air'],
      ['mid.vuLive==true', mid.vuLive === true],
      ['mid.vuBars==7', mid.vuBars === 7],
      ['mid.playAria=="Speak text"', mid.playAria === 'Speak text'],
      ['mid.playDisabled==true', mid.playDisabled === true],
      ['mid.activeRate has 1.25', /1\.25/.test(mid.activeRate || '')],
      ['mid.activeVoice has Sonia', /Sonia/i.test(mid.activeVoice || '')],
      ['tts response HTTP 200', ttsStatus === 200],
      ['request.rateValue=="+25%"', !!(ttsRequest && ttsRequest.rateValue === '+25%')],
      ['request.hasVoiceField', !!(ttsRequest && ttsRequest.hasVoiceField)],
      ['after.pillBusy==false', !!(after && after.pillBusy === false)],
      ['after.pill=="ready"', !!(after && after.pill === 'ready')],
      ['three identity wrappers rendered (.ws-reader/.ws-tts/.ws-sign)', census.some((c) => c.wsReader > 0) && census.some((c) => c.wsTts > 0) && census.some((c) => c.wsSign > 0)],
      ['no.page_errors', pageErrors.length === 0],
    ];
    say('');
    for (const [name, ok] of checks) say(`[${ok ? 'PASS' : 'FAIL'}] ${name}`);
    const failed = checks.filter(([, ok]) => !ok).length;
    say(`checks passed=${checks.length - failed} failed=${failed}`);
    say('');
    say('NOTE .scanline / .stamp are conditional: ScreenReader.tsx:115 renders scanline only while {loading},');
    say('     ScreenReader.tsx:153 renders .stamp only inside the analysis-report block (needs a describe run).');
    say('NOTE .lower-third / .gloss-row are conditional: SignTranslator.tsx:116/128 inside AnimatePresence,');
    say('     rendered only while a matched sign phrase is on stage (needs a speech-to-sign match).');
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

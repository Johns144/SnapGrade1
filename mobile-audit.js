// Phone audit: every teacher and student screen at common phone sizes with touch emulation.
// Reports sideways overflow, small tap targets, inputs that make iOS zoom in (font-size < 16px),
// tiny text and elements poking past the screen edge. Usage: node mobile-audit.js [shots]
const { chromium } = require('playwright'); const fs = require('fs'); const dir = __dirname;
const SHOTS = process.argv.includes('shots');
const stub = fs.readFileSync(dir + '/pw-test.js', 'utf8').match(/const stub = `([\s\S]*?)`;\n\n\(async/)[1];
const seed = fs.readFileSync(dir + '/seed.json', 'utf8'), seedExam = fs.readFileSync(dir + '/seed-exam.json', 'utf8');
const DEVICES = [['android-small', 360, 640], ['iphone-se', 375, 667], ['iphone-14', 390, 844], ['iphone-max', 430, 932], ['landscape', 740, 360]];

function probe() {
  const W = window.innerWidth, out = { overflow: document.documentElement.scrollWidth - W, wide: [], small: [], zoom: [], tiny: [] };
  const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const name = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') + (el.dataset.act ? '[' + el.dataset.act + ']' : '');
  const scroller = el => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; };
  document.querySelectorAll('body *').forEach(el => {
    if (!vis(el)) return;
    const r = el.getBoundingClientRect();
    if ((r.right > W + 1 || r.left < -1) && !scroller(el) && getComputedStyle(el).position !== 'fixed') out.wide.push(name(el) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
    const tag = el.tagName, t = el.type;
    const tappable = tag === 'BUTTON' || (tag === 'A' && el.href) || tag === 'SELECT' || (tag === 'INPUT' && t !== 'hidden') || tag === 'TEXTAREA' || el.getAttribute('role') === 'tab' || tag === 'SUMMARY';
    if (tappable && !el.disabled) {
      let box = r;
      if (tag === 'INPUT' && (t === 'checkbox' || t === 'radio')) { const l = el.closest('label'); if (l) box = l.getBoundingClientRect(); }
      if (tag === 'INPUT' && t === 'file') return;
      if (box.height < 40 || box.width < 40) out.small.push(name(el) + ' ' + Math.round(box.width) + 'x' + Math.round(box.height));
    }
    if ((tag === 'INPUT' && !['checkbox', 'radio', 'file', 'range', 'button', 'submit'].includes(t)) || tag === 'SELECT' || tag === 'TEXTAREA') {
      const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 16) out.zoom.push(name(el) + ' ' + fs + 'px');
    }
    if (el.childNodes.length && Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim())) {
      const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 12) out.tiny.push(name(el) + ' ' + fs + 'px');
    }
  });
  const uniq = a => Array.from(new Set(a)); ['wide', 'small', 'zoom', 'tiny'].forEach(k => out[k] = uniq(out[k]));
  return out;
}

(async () => {
  const b = await chromium.launch(); const report = {}; const errors = [];
  async function ctxFor(w, h, scheme, extra) {
    const c = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
    await c.addInitScript('window.__SEED = ' + seed + ';'); if (extra) await c.addInitScript(extra); await c.addInitScript(stub);
    await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.goto('file://' + dir + '/index.html'); await p.waitForTimeout(250); return { c, p };
  }
  for (const [dev, w, h] of DEVICES) {
    const R = report[dev] = {};
    const snap = async (p, key) => { R[key] = await p.evaluate(probe); if (SHOTS && dev === 'android-small') await p.screenshot({ path: `${dir}/mob-${dev}-${key}.png` }); };
    let { c, p } = await ctxFor(w, h, dev === 'iphone-14' ? 'dark' : 'light');
    await snap(p, 't1-list');
    await p.tap('.item'); await snap(p, 't2-menu');
    await p.tap('[data-act="mtab"][data-t="stats"]'); await snap(p, 't3-stats');
    await p.tap('[data-act="open-ia"]'); await snap(p, 't4-ia');
    await p.tap('[data-act="menu-back"]'); await p.tap('[data-act="open-tags"]'); await snap(p, 't5-tags');
    await p.tap('[data-act="menu-back"]'); await p.tap('[data-act="edit-key"]'); await p.waitForTimeout(80);
    await p.tap('[data-act="open-item"][data-i="0"]'); await snap(p, 't6-editor');
    await p.tap('.tab[data-t="scan"]'); await snap(p, 't7-scan-empty');
    await p.setInputFiles('#in-file', [dir + '/case1.png']); await p.waitForSelector('[data-cv]', { timeout: 30000 }); await p.waitForTimeout(300);
    await snap(p, 't8-scan-card');
    await p.tap('.tab[data-t="results"]'); await p.waitForSelector('.hist'); await p.tap('.rowbtn >> nth=0'); await snap(p, 't9-results');
    await p.tap('.tab[data-t="settings"]'); await snap(p, 't10-settings');
    await c.close();
    ({ c, p } = await ctxFor(w, h, dev === 'iphone-14' ? 'dark' : 'light', 'window.__PM_EXAM = ' + seedExam + ';'));
    await snap(p, 's1-start');
    await p.fill('#s-name', 'Ana Reyes'); await p.tap('#s-go'); await p.waitForSelector('.choice');
    await p.tap('.choice >> nth=1'); await p.tap('[data-flag]'); await snap(p, 's2-question');
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    await p.waitForTimeout(150);
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    await p.waitForTimeout(150); await snap(p, 's3-away'); await p.tap('#away-ok');
    await p.tap('#submit'); await p.waitForTimeout(100); await snap(p, 's4-review');
    await p.tap('#yes'); await p.waitForSelector('#code'); await snap(p, 's5-done');
    await c.close();
  }
  await b.close();
  // summary
  let problems = 0;
  for (const dev in report) for (const s in report[dev]) {
    const r = report[dev][s], bad = r.overflow > 1 || r.wide.length || r.small.length || r.zoom.length || r.tiny.length;
    if (bad) { problems++; console.log(`\n[${dev}] ${s}  overflow=${r.overflow}`); ['wide', 'small', 'zoom', 'tiny'].forEach(k => r[k].length && console.log('  ' + k + ': ' + r[k].slice(0, 14).join(' | ') + (r[k].length > 14 ? ` (+${r[k].length - 14})` : ''))); }
  }
  console.log('\nerrors:', errors.length ? errors : 'none'); console.log(problems ? problems + ' screen(s) with issues' : 'ALL SCREENS CLEAN');
  fs.writeFileSync(dir + '/mobile-report.json', JSON.stringify(report, null, 1));
})().catch(e => { console.error('AUDIT CRASH', e); process.exit(2); });

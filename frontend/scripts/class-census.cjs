#!/usr/bin/env node
/**
 * class-census - flags any className used in src/**\/*.tsx that has no rule in src/App.css.
 *
 * Why: a class with no CSS behind it renders as nothing and fails silently. This is a
 * static guard, not a visual test - it would have caught the missing .ws / .strength-* gaps.
 *
 *   npm run census                 exits 1 when a class has no CSS (use before committing)
 *   npm run census -- --warn-only  report only, always exit 0
 *
 * Limits: dynamic class names (`strength-${n}`) cannot be verified statically. They are
 * printed as [dynamic: ...] so you can eyeball them after any CSS change that touches them.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src');
const CSS = path.join(SRC, 'App.css');

/** Intentional no-ops: hooks whose visuals come from a parent, sibling or base rule. */
const ALLOW = new Set([
  'r1',   // sign-stage ring: styled via `.mic-orb.on .ring`, delay lives on `.ring.r2`
  'idle', // state pill: base carries the styling, `.state-pill.busy` is the only override
]);

const read = (p) => fs.readFileSync(p, 'utf8');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function addTokens(text, statics, dynamic) {
  for (const raw of text.split(/\s+/)) {
    const token = raw.trim();
    if (!token) continue;
    if (token.endsWith('-')) dynamic.add(token);
    else if (/^[A-Za-z][\w-]*$/.test(token)) statics.add(token);
  }
}

/** Index of the string quote closing the literal that starts at `from`. */
function quoteEnd(src, from) {
  const quote = src[from];
  let i = from + 1;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === quote) return i;
    i++;
  }
  return src.length - 1;
}

/** Index of the `}` matching the `{` at `from`, ignoring braces inside strings/templates. */
function braceEnd(src, from) {
  let depth = 0;
  let i = from;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '"' || c === "'") { i = quoteEnd(src, i) + 1; continue; }
    if (c === '`') { i = templateEnd(src, i) + 1; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
    i++;
  }
  return src.length - 1;
}

/** Index of the backtick closing the template that starts at `from`. */
function templateEnd(src, from) {
  let i = from + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '`') return i;
    if (c === '$' && src[i + 1] === '{') { i = braceEnd(src, i + 1) + 1; continue; }
    i++;
  }
  return src.length - 1;
}

/** Pull class text out of an expression: quoted strings + template static segments. */
function collectLiterals(region, statics, dynamic) {
  let i = 0;
  while (i < region.length) {
    const c = region[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '"' || c === "'") {
      const end = quoteEnd(region, i);
      /* `mode === 'login'` is a comparison operand, not a class name - skip it. */
      const before = region.slice(Math.max(0, i - 24), i).trimEnd();
      if (/(===|==|!==|!=|includes\(|indexOf\(|startsWith\(|endsWith\(|test\()$/.test(before)) {
        i = end + 1;
        continue;
      }
      addTokens(region.slice(i + 1, end), statics, dynamic);
      i = end + 1;
      continue;
    }
    if (c === '`') {
      let k = i + 1;
      let text = '';
      while (k < region.length) {
        const t = region[k];
        if (t === '\\') { k += 2; continue; }
        if (t === '`') { k++; break; }
        if (t === '$' && region[k + 1] === '{') {
          addTokens(text, statics, dynamic);
          text = '';
          const end = braceEnd(region, k + 1);
          collectLiterals(region.slice(k + 2, end), statics, dynamic);
          k = end + 1;
          continue;
        }
        text += t;
        k++;
      }
      addTokens(text, statics, dynamic);
      i = k;
      continue;
    }
    i++;
  }
}

function scanClasses(src) {
  const statics = new Set();
  const dynamic = new Set();
  let i = 0;
  while ((i = src.indexOf('className', i)) !== -1) {
    let j = i + 'className'.length;
    while (j < src.length && /\s/.test(src[j])) j++;
    if (src[j] !== '=') { i += 'className'.length; continue; }
    j++;
    while (j < src.length && /\s/.test(src[j])) j++;
    const quote = src[j];
    if (quote === '"' || quote === "'") {
      const end = quoteEnd(src, j);
      addTokens(src.slice(j + 1, end), statics, dynamic);
      i = end + 1;
      continue;
    }
    if (quote === '{') {
      const end = braceEnd(src, j);
      collectLiterals(src.slice(j + 1, end), statics, dynamic);
      i = end + 1;
      continue;
    }
    if (quote === '`') {
      const end = templateEnd(src, j);
      collectLiterals(src.slice(j, end + 1), statics, dynamic);
      i = end + 1;
      continue;
    }
    i += 'className'.length;
  }
  return { statics, dynamic };
}

if (!fs.existsSync(CSS)) {
  console.error(`class-census: cannot find ${CSS}`);
  process.exit(2);
}
const defined = new Set([...read(CSS).matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]));
const allDynamic = new Set();
let gaps = 0;

console.log(`class-census: ${defined.size} selectors defined in src/App.css (allow-listed: ${[...ALLOW].join(', ')})\n`);
for (const file of walk(SRC).sort()) {
  const { statics, dynamic } = scanClasses(read(file));
  const missing = [...statics].filter((c) => !defined.has(c) && !ALLOW.has(c)).sort();
  for (const d of dynamic) allDynamic.add(d);
  gaps += missing.length;
  const rel = path.relative(path.resolve(SRC, '..'), file).replace(/\\/g, '/');
  console.log(`${rel}  used=${statics.size} gaps=${missing.length}${missing.length ? ' -> ' + missing.join(' ') : ''}${dynamic.size ? '  [dynamic: ' + [...dynamic].sort().join(' ') + ']' : ''}`);
}

if (allDynamic.size) console.log(`\n[dynamic class names - not statically verifiable, check by hand: ${[...allDynamic].sort().join(' ')}]`);
console.log(`\n${gaps === 0 ? 'PASS' : 'FAIL'} - ${gaps} className(s) with no CSS behind them.`);
if (gaps) console.log('Fix it by adding the rule, removing the class, or allow-listing an intentional hook.');
if (gaps && !process.argv.includes('--warn-only')) process.exit(1);

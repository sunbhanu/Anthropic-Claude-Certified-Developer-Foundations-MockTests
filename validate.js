// Usage: node validate.js [paperNumber]   (validates all papers if no number given)
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const EXPECTED = { D1: 8, D2: 17, D3: 2, D4: 1, D5: 9, D6: 6, D7: 4, D8: 6 };
const only = process.argv[2] ? Number(process.argv[2]) : null;
let failed = false;

for (let n = 1; n <= 10; n++) {
  if (only && n !== only) continue;
  const file = path.join(__dirname, "papers", `paper${String(n).padStart(2, "0")}.js`);
  const errs = [];
  if (!fs.existsSync(file)) { console.log(`Paper ${n}: MISSING`); failed = true; continue; }
  const ctx = { window: {} };
  try { vm.runInNewContext(fs.readFileSync(file, "utf8"), ctx); } catch (e) { console.log(`Paper ${n}: JS ERROR ${e.message}`); failed = true; continue; }
  const p = ctx.window.EXAM_PAPERS && ctx.window.EXAM_PAPERS[n];
  if (!p) { console.log(`Paper ${n}: window.EXAM_PAPERS[${n}] not set`); failed = true; continue; }
  const qs = p.questions || [];
  if (qs.length !== 53) errs.push(`expected 53 questions, got ${qs.length}`);
  const dom = {}, pos = {}, diff = {}, stems = new Set();
  let multi = 0;
  qs.forEach((q, i) => {
    const tag = `Q${i + 1}`;
    if (q.id !== i + 1) errs.push(`${tag}: id ${q.id} != ${i + 1}`);
    if (!EXPECTED[q.domain]) errs.push(`${tag}: bad domain ${q.domain}`);
    dom[q.domain] = (dom[q.domain] || 0) + 1;
    diff[q.difficulty] = (diff[q.difficulty] || 0) + 1;
    if (!q.question || !q.explanation) errs.push(`${tag}: missing question/explanation`);
    if (stems.has(q.question)) errs.push(`${tag}: duplicate stem`); stems.add(q.question);
    if (!Array.isArray(q.answer) || !q.answer.length) { errs.push(`${tag}: answer must be non-empty array`); return; }
    if (new Set(q.answer).size !== q.answer.length) errs.push(`${tag}: duplicate answer index`);
    q.answer.forEach(a => { if (!(a >= 0 && a < (q.options || []).length)) errs.push(`${tag}: answer ${a} out of range`); pos[a] = (pos[a] || 0) + 1; });
    if (q.type === "single") {
      if (q.options.length !== 4) errs.push(`${tag}: single must have 4 options`);
      if (q.answer.length !== 1) errs.push(`${tag}: single must have 1 answer`);
    } else if (q.type === "multiple") {
      multi++;
      const k = q.answer.length;
      const word = { 2: "TWO", 3: "THREE" }[k];
      if (!word) errs.push(`${tag}: multiple must have 2 or 3 answers`);
      else if (!q.question.includes(`(Select ${word}.)`)) errs.push(`${tag}: stem must include "(Select ${word}.)"`);
      if (q.options.length < 5 || q.options.length > 6) errs.push(`${tag}: multiple must have 5-6 options`);
    } else errs.push(`${tag}: bad type ${q.type}`);
    if ((q.options || []).some(o => !o || typeof o !== "string")) errs.push(`${tag}: empty option`);
  });
  for (const d in EXPECTED) if ((dom[d] || 0) !== EXPECTED[d]) errs.push(`domain ${d}: expected ${EXPECTED[d]}, got ${dom[d] || 0}`);
  if (multi < 8 || multi > 10) errs.push(`multiple-response count ${multi} (expected 8-10)`);
  // Length-bias check: the correct option should not be a giveaway by being the longest.
  let singles = 0, longest = 0;
  qs.forEach(q => {
    if (q.type !== "single" || !Array.isArray(q.options)) return;
    singles++;
    const lens = q.options.map(o => String(o).length);
    if (lens[q.answer[0]] === Math.max(...lens)) longest++;
  });
  if (singles && longest / singles > 0.4) errs.push(`length bias: correct option is the longest in ${longest}/${singles} single-answer items (max 40%)`);
  const totalAns = Object.values(pos).reduce((a, b) => a + b, 0);
  for (const k in pos) if (pos[k] / totalAns > 0.35) errs.push(`answer position ${"ABCDEF"[k]} holds ${Math.round(pos[k] / totalAns * 100)}% (>35%)`);
  console.log(`Paper ${n}: ${errs.length ? "FAIL" : "OK"} | qs=${qs.length} multi=${multi} domains=${JSON.stringify(dom)} positions=${JSON.stringify(pos)} difficulty=${JSON.stringify(diff)}`);
  errs.forEach(e => console.log("   - " + e));
  if (errs.length) failed = true;
}
process.exit(failed ? 1 : 0);

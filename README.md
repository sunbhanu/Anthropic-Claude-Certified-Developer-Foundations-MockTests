# Claude Certified Developer – Foundations (CCDV-F) Mock Exam Simulator

An offline, static practice-exam simulator for the CCDV-F certification. Ten 53-question,
120-minute mock exams, scored and reviewed entirely in the browser with no server, build
step, or internet connection required.

## How to use

**Easiest way:** double-click `index.html` (or run `run.bat`) and it opens directly in your
default browser over the `file://` protocol. No installation, server, or internet connection
is needed.

**Alternative (optional):** if your browser restricts `file://` scripts, you can instead serve
the folder locally:

```
python -m http.server 8000
```

then open `http://localhost:8000/` in your browser.

Progress (in-progress attempts, settings, and attempt history) is saved to your browser's
`localStorage`, scoped to this folder/origin. Clearing browser data or using a different
browser/profile will lose saved progress. Use the "Reset all progress" button on the
dashboard to deliberately clear everything.

## Adding new papers

Practice papers live in `papers/paper01.js` … `papers/paper10.js`. To add or replace one:

1. Create `papers/paperNN.js` (NN = `01`..`10`) as a classic script (no ES modules) that sets:

   ```js
   window.EXAM_PAPERS = window.EXAM_PAPERS || {};
   window.EXAM_PAPERS[NN] = {
     id: NN,
     title: "Practice Exam NN",
     questions: [ /* exactly 53 question objects, ids 1..53, see below */ ]
   };
   ```

2. Each question object must match `SPEC.md`'s "Data format" section exactly:
   - `id`: 1-based integer matching its position (1..53).
   - `domain`: one of `"D1"`.."D8"` (see `js/domains.js` for the weight/question-count table).
   - `difficulty`: `"easy"`, `"medium"`, or `"hard"`.
   - `type`: `"single"` (4 options, 1 correct) or `"multiple"` (5–6 options, 2–3 correct,
     with the stem ending in `"(Select TWO.)"` or `"(Select THREE.)"`).
   - `options`: array of option strings.
   - `answer`: array of **0-based** indices into `options` that are correct (even for
     `"single"` questions this is a one-element array, e.g. `[1]`).
   - `question` / `explanation`: strings. Backtick-delimited text (e.g. `` `config.json` ``)
     renders as inline code; literal `\n` characters render as line breaks.
3. Re-open or refresh `index.html` — the app loads all ten paper files automatically on
   startup. If a paper file is missing, fails to parse, or doesn't contain exactly 53
   questions, the app marks that exam card "Unavailable" on the dashboard instead of
   crashing; other papers keep working normally.
4. Run `node validate.js` (requires Node.js, used only for authoring/validation — the app
   itself never requires Node or a build step) to check a paper against the full authoring
   rules (domain distribution, answer-position spread, option counts, etc.) before shipping it.

## Scaled-score assumption

The real CCDV-F exam's exact scaled-score conversion curve is **not publicly documented**, so
this simulator uses a documented linear approximation for practice purposes only:

> Let `p = raw correct / 53` (0..1).
> - If `p <= 0.70`: `scaled = round(100 + (p / 0.70) * 620)`
> - Else: `scaled = round(720 + ((p - 0.70) / 0.30) * 280)`

This yields a scaled score of **100** at `p = 0`, **720** (the passing score) at `p = 0.70`,
and **1000** at `p = 1.0`. It is implemented in `js/scoring.js` (`computeScaledScore`) and is
also shown as a footnote on the score-report screen. Treat it as an approximate practice
signal, not a guarantee of your real exam outcome.

## Scoring rule

An item counts as correct only if the set of options you selected is **exactly equal** to the
question's correct-answer set — no partial credit on multiple-response questions, and an
unanswered question is always scored as incorrect.

## Project structure

```
index.html          Entry point; loads papers, then js/domains.js, js/scoring.js,
                     js/storage.js, js/app.js (in that order)
css/styles.css       All styling
js/domains.js        Domain code -> name/weight/question-count table
js/scoring.js        Pure scoring functions (exact-set-match + scaled-score formula);
                     also runnable under plain Node.js for unit testing
js/storage.js        localStorage helpers (in-progress attempts, history, settings)
js/app.js            Screens/controller: dashboard, instructions, exam, review,
                     score report, answer review
papers/paperNN.js    Question data (not modified by this app)
validate.js          Authoring-time paper validator (run with Node.js)
run.bat              Opens index.html in the default browser
```

## Security note

All question/option/explanation text from paper data is rendered exclusively via DOM
`textContent` / `createTextNode` / `createElement` — never via `innerHTML`. This means any
text in a paper file (including something like `<script>...</script>`) always renders as
inert, literal visible text and can never execute or be injected as markup.

// Pure scoring functions for the CCDV-F mock exam simulator.
// Works both as a browser global (window.ExamScoring) and under plain Node.js
// (module.exports) so it can be unit tested with `node -e` / `require`.
(function (root) {
  "use strict";

  var TOTAL_QUESTIONS = 53;
  var PASS_THRESHOLD = 720;

  // Returns true only if the selected index set is EXACTLY equal (as a set)
  // to the question's answer index set. No partial credit for multi-select.
  // Unanswered (selected == null/undefined/empty) is always incorrect.
  function isCorrect(question, selected) {
    var correct = (question && question.answer) || [];
    var sel = selected || [];
    if (sel.length !== correct.length) return false;
    var a = correct.slice().sort(function (x, y) { return x - y; });
    var b = sel.slice().sort(function (x, y) { return x - y; });
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // p = raw correct / total (0..1).
  // p <= 0.70: scaled = 100 + (p/0.70)*620
  // p >  0.70: scaled = 720 + ((p-0.70)/0.30)*280
  // Result is rounded to the nearest integer; yields 100 at p=0, 720 at p=0.70, 1000 at p=1.0.
  function computeScaledScore(rawCorrect, total) {
    total = total || TOTAL_QUESTIONS;
    var p = total > 0 ? rawCorrect / total : 0;
    var scaled;
    if (p <= 0.70) {
      scaled = 100 + (p / 0.70) * 620;
    } else {
      scaled = 720 + ((p - 0.70) / 0.30) * 280;
    }
    return Math.round(scaled);
  }

  function isPass(scaledScore) {
    return scaledScore >= PASS_THRESHOLD;
  }

  // Scores a full attempt given the paper (with .questions[]) and an answers
  // map { [questionId]: number[] selected option indices }.
  // Returns { rawCorrect, total, percent, scaledScore, pass, perDomain, perDifficulty, details }.
  function scoreAttempt(paper, answers) {
    answers = answers || {};
    var questions = (paper && paper.questions) || [];
    var total = questions.length;
    var rawCorrect = 0;
    var perDomain = {};
    var perDifficulty = {};
    var details = [];

    questions.forEach(function (q) {
      var selected = answers[q.id] || [];
      var correct = isCorrect(q, selected);
      if (correct) rawCorrect++;

      if (!perDomain[q.domain]) perDomain[q.domain] = { total: 0, correct: 0 };
      perDomain[q.domain].total++;
      if (correct) perDomain[q.domain].correct++;

      if (!perDifficulty[q.difficulty]) perDifficulty[q.difficulty] = { total: 0, correct: 0 };
      perDifficulty[q.difficulty].total++;
      if (correct) perDifficulty[q.difficulty].correct++;

      details.push({ id: q.id, domain: q.domain, difficulty: q.difficulty, correct: correct, selected: selected });
    });

    var scaledScore = computeScaledScore(rawCorrect, total);
    var percent = total > 0 ? (rawCorrect / total) * 100 : 0;

    return {
      rawCorrect: rawCorrect,
      total: total,
      percent: percent,
      scaledScore: scaledScore,
      pass: isPass(scaledScore),
      perDomain: perDomain,
      perDifficulty: perDifficulty,
      details: details
    };
  }

  var api = {
    TOTAL_QUESTIONS: TOTAL_QUESTIONS,
    PASS_THRESHOLD: PASS_THRESHOLD,
    isCorrect: isCorrect,
    computeScaledScore: computeScaledScore,
    isPass: isPass,
    scoreAttempt: scoreAttempt
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ExamScoring = api;
  }
})(typeof window !== "undefined" ? window : this);

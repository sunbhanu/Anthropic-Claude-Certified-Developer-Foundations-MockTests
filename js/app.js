// Main UI controller for the CCDV-F mock exam simulator.
// Classic script (no ES modules). Depends on window.ExamDomains, window.ExamScoring,
// window.ExamStorage, and window.EXAM_PAPERS (set by papers/paperNN.js files).
(function () {
  "use strict";

  var TOTAL_QUESTIONS = 53;
  var EXAM_DURATION_SEC = 120 * 60;
  var LETTERS = ["A", "B", "C", "D", "E", "F"];
  var PASS_THRESHOLD = (window.ExamScoring && window.ExamScoring.PASS_THRESHOLD) || 720;

  var SCALED_SCORE_FOOTNOTE =
    "Scaled-score assumption: the real CCDV-F conversion curve is not publicly documented, so this " +
    "simulator uses a documented linear approximation for practice purposes only: let p = raw correct / 53. " +
    "If p <= 0.70, scaled = round(100 + (p / 0.70) * 620); otherwise scaled = round(720 + ((p - 0.70) / 0.30) * 280). " +
    "This yields 100 at p=0, 720 (the passing score) at p=0.70, and 1000 at p=1.0. Your real exam result may scale differently.";

  var App = {
    root: null,
    papers: {},            // n -> { available: bool, paper: obj|null }
    examTimerInterval: null,
    examKeyHandler: null,
    lastAttempt: null       // kept in memory for the answer-review screen
  };

  // ---------------------------------------------------------------------
  // Safe text rendering: backtick segments become <code>, "\n" becomes <br>.
  // Never uses innerHTML with paper data.
  // ---------------------------------------------------------------------
  function renderFormattedText(container, text) {
    container.textContent = "";
    var lines = String(text == null ? "" : text).split("\n");
    lines.forEach(function (line, li) {
      if (li > 0) container.appendChild(document.createElement("br"));
      var parts = line.split("`");
      parts.forEach(function (part, pi) {
        if (pi % 2 === 1) {
          var code = document.createElement("code");
          code.textContent = part;
          container.appendChild(code);
        } else if (part.length) {
          container.appendChild(document.createTextNode(part));
        }
      });
    });
  }

  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function fmtClock(totalSec) {
    totalSec = Math.max(0, Math.round(totalSec));
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    if (h > 0) return pad(h) + ":" + pad(m) + ":" + pad(s);
    return pad(m) + ":" + pad(s);
  }

  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return iso;
    }
  }

  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // ---------------------------------------------------------------------
  // Paper availability checking (post-load shape verification).
  // ---------------------------------------------------------------------
  function checkPapers() {
    for (var n = 1; n <= 10; n++) {
      var p = window.EXAM_PAPERS && window.EXAM_PAPERS[n];
      var hadLoadError = window.__paperLoadErrors && window.__paperLoadErrors[n];
      var valid = !hadLoadError && p && Array.isArray(p.questions) && p.questions.length === TOTAL_QUESTIONS;
      App.papers[n] = { available: !!valid, paper: valid ? p : null };
    }
  }

  // ---------------------------------------------------------------------
  // Screen clearing helper
  // ---------------------------------------------------------------------
  function teardownExamRuntime() {
    if (App.examTimerInterval) {
      clearInterval(App.examTimerInterval);
      App.examTimerInterval = null;
    }
    if (App.examKeyHandler) {
      document.removeEventListener("keydown", App.examKeyHandler);
      App.examKeyHandler = null;
    }
  }

  function setScreen(html) {
    teardownExamRuntime();
    App.root.innerHTML = html;
  }

  // =======================================================================
  // DASHBOARD
  // =======================================================================
  function showDashboard() {
    checkPapers();
    var domainRows = window.ExamDomains.DOMAIN_ORDER.map(function (code) {
      var d = window.ExamDomains.DOMAINS[code];
      return "<tr><td>" + d.code + "</td><td>" + escapeHtmlStatic(d.name) + "</td><td>" + d.weight +
        "%</td><td>" + d.questionsPerPaper + "</td></tr>";
    }).join("");

    setScreen(
      '<div class="topbar"><div class="brand">Claude Certified Developer \u2013 Foundations (CCDV-F) Practice Exams</div></div>' +
      '<div class="container">' +
      '  <div class="info-panel">' +
      '    <h2>Exam Information</h2>' +
      '    <div class="facts">' +
      '      <div><strong>53</strong> items</div>' +
      '      <div><strong>120</strong> minutes</div>' +
      '      <div>Formats: multiple-choice &amp; multiple-response</div>' +
      '      <div>Scaled score <strong>100\u20131000</strong></div>' +
      '      <div>Passing score <strong>' + PASS_THRESHOLD + '</strong></div>' +
      '    </div>' +
      '    <table><thead><tr><th>Code</th><th>Domain</th><th>Weight</th><th>Qs / paper</th></tr></thead>' +
      '    <tbody>' + domainRows + '</tbody></table>' +
      '  </div>' +
      '  <div class="toolbar-row">' +
      '    <h2 style="margin:0">Practice Exams</h2>' +
      '    <button id="resetAllBtn" class="danger">Reset all progress</button>' +
      '  </div>' +
      '  <div class="exam-grid" id="examGrid"></div>' +
      '</div>'
    );

    var grid = document.getElementById("examGrid");
    for (var n = 1; n <= 10; n++) {
      grid.appendChild(buildExamCard(n));
    }
    document.getElementById("resetAllBtn").addEventListener("click", function () {
      if (window.confirm("This will erase ALL saved progress, attempt history, and in-progress exams for every practice exam. Continue?")) {
        window.ExamStorage.resetAll();
        showDashboard();
      }
    });
  }

  function escapeHtmlStatic(s) {
    // Used ONLY for static, developer-controlled strings (domain names from domains.js),
    // never for paper question/option/explanation data.
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function buildExamCard(n) {
    var info = App.papers[n];
    var card = el("div", "exam-card" + (info.available ? "" : " unavailable"));
    card.appendChild(el("h3", null, "Exam " + n));
    card.appendChild(el("div", "meta", "53 questions / 120 minutes"));

    if (!info.available) {
      card.appendChild(el("div", null)).appendChild(el("span", "badge-unavailable", "Unavailable"));
      card.appendChild(el("div", "meta", "This paper failed to load or did not match the expected format."));
      var disabledBtn = el("button", null, "Unavailable");
      disabledBtn.disabled = true;
      var actions = el("div", "actions");
      actions.appendChild(disabledBtn);
      card.appendChild(actions);
      return card;
    }

    var best = window.ExamStorage.getBestScore(n);
    var last = window.ExamStorage.getLastAttempt(n);
    if (best) {
      card.appendChild(el("div", "status-line", "Best score: " + best.scaledScore + " (" + best.rawCorrect + "/" + best.totalQuestions + ")"));
    } else {
      card.appendChild(el("div", "status-line", "Not attempted yet"));
    }
    if (last) {
      var lastLine = el("div", "status-line " + (last.pass ? "pass" : "fail"),
        "Last attempt: " + fmtDate(last.date) + " \u2013 " + (last.pass ? "PASS" : "FAIL"));
      card.appendChild(lastLine);
    }

    var inProgress = window.ExamStorage.getInProgress(n);
    var actions2 = el("div", "actions");
    var btn = el("button", "primary", inProgress ? "Resume" : "Start");
    btn.addEventListener("click", function () {
      if (inProgress) {
        showExamScreen(n);
      } else {
        showInstructionsScreen(n);
      }
    });
    actions2.appendChild(btn);
    card.appendChild(actions2);
    return card;
  }

  // =======================================================================
  // PRE-EXAM INSTRUCTIONS
  // =======================================================================
  function showInstructionsScreen(n) {
    setScreen(
      '<div class="topbar"><div class="brand">Exam ' + n + ' \u2013 Instructions</div>' +
      '<button id="backDashBtn">Back to Dashboard</button></div>' +
      '<div class="container">' +
      '  <div class="instructions-box">' +
      '    <h2>Before you begin</h2>' +
      '    <ul>' +
      '      <li>You may move freely backward and forward between questions at any time.</li>' +
      '      <li>You can flag any question for later review.</li>' +
      '      <li>The clock counts down continuously from 120:00 and does not pause.</li>' +
      '      <li>Unanswered items are scored as incorrect.</li>' +
      '      <li>Multiple-response items explicitly say "Select TWO." or "Select THREE." \u2013 you must select ' +
      '          exactly that many options.</li>' +
      '      <li>When time expires, the exam is submitted automatically.</li>' +
      '    </ul>' +
      '    <div class="toggle-row"><input type="checkbox" id="shuffleToggle"> ' +
      '      <label for="shuffleToggle">Shuffle question order</label></div>' +
      '    <div class="toggle-row"><input type="checkbox" id="practiceToggle"> ' +
      '      <label for="practiceToggle">Practice mode (show answer after each question)</label></div>' +
      '    <button id="beginExamBtn" class="primary">Begin Exam</button>' +
      '  </div>' +
      '</div>'
    );
    document.getElementById("backDashBtn").addEventListener("click", showDashboard);
    document.getElementById("beginExamBtn").addEventListener("click", function () {
      var shuffle = document.getElementById("shuffleToggle").checked;
      var practiceMode = document.getElementById("practiceToggle").checked;
      startNewAttempt(n, shuffle, practiceMode);
    });
  }

  function startNewAttempt(n, shuffle, practiceMode) {
    var paper = App.papers[n].paper;
    var ids = paper.questions.map(function (q) { return q.id; });
    var order = shuffle ? shuffleArray(ids) : ids;
    var now = Date.now();
    var state = {
      paperNumber: n,
      endTimestamp: now + EXAM_DURATION_SEC * 1000,
      answers: {},
      flags: {},
      currentIndex: 0,
      order: order,
      practiceMode: !!practiceMode,
      startedAt: now
    };
    window.ExamStorage.saveInProgress(n, state);
    showExamScreen(n);
  }

  // =======================================================================
  // EXAM SCREEN
  // =======================================================================
  function showExamScreen(n) {
    var state = window.ExamStorage.getInProgress(n);
    if (!state || !App.papers[n] || !App.papers[n].available) {
      showDashboard();
      return;
    }
    var paper = App.papers[n].paper;

    // Auto-submit immediately if time already elapsed (e.g. reopened app later).
    if (state.endTimestamp - Date.now() <= 0) {
      submitExam(n, true);
      return;
    }

    setScreen(
      '<div class="exam-topbar">' +
      '  <div class="exam-title">Exam ' + n + '</div>' +
      '  <div class="qcounter" id="qCounter"></div>' +
      '  <div class="timer" id="timerEl">120:00</div>' +
      '  <div>' +
      '    <button id="toggleNavBtn">Navigator</button> ' +
      '    <button id="flagBtn" class="flag-toggle">Flag for Review</button>' +
      '  </div>' +
      '</div>' +
      '<div class="exam-body-wrap">' +
      '  <div class="exam-main">' +
      '    <div class="question-stem" id="questionStem"></div>' +
      '    <div class="select-hint" id="selectHint" style="display:none"></div>' +
      '    <ul class="options-list" id="optionsList"></ul>' +
      '    <div id="checkAnswerArea"></div>' +
      '  </div>' +
      '  <div class="nav-panel hidden" id="navPanel">' +
      '    <div class="nav-legend">' +
      '      <span><span class="legend-dot" style="background:#e4efe8;border:1px solid ' +
      '        #1f7a3d"></span>Answered</span>' +
      '      <span><span class="legend-dot" style="background:#fff"></span>Unanswered</span>' +
      '      <span><span class="legend-dot" style="background:#c99a00"></span>Flagged</span>' +
      '    </div>' +
      '    <div class="nav-grid" id="navGrid"></div>' +
      '  </div>' +
      '</div>' +
      '<div class="exam-bottombar">' +
      '  <div class="group"><button id="prevBtn">\u2190 Previous</button><button id="nextBtn">Next \u2192</button></div>' +
      '  <div class="group"><button id="reviewBtn">Review</button><button id="endExamBtn" class="danger">End Exam</button></div>' +
      '</div>'
    );

    function curIndex() {
      var s = window.ExamStorage.getInProgress(n);
      return s ? s.currentIndex : 0;
    }

    document.getElementById("toggleNavBtn").addEventListener("click", function () {
      document.getElementById("navPanel").classList.toggle("hidden");
    });
    document.getElementById("prevBtn").addEventListener("click", function () { gotoQuestion(n, curIndex() - 1); });
    document.getElementById("nextBtn").addEventListener("click", function () { gotoQuestion(n, curIndex() + 1); });
    document.getElementById("reviewBtn").addEventListener("click", function () { showReviewScreen(n); });
    document.getElementById("endExamBtn").addEventListener("click", function () { showReviewScreen(n); });
    document.getElementById("flagBtn").addEventListener("click", function () {
      var state = window.ExamStorage.getInProgress(n);
      if (!state) return;
      var qid = state.order[state.currentIndex];
      state.flags[qid] = !state.flags[qid];
      window.ExamStorage.saveInProgress(n, state);
      renderQuestionBody(n);
    });

    buildNavGrid(n);
    renderQuestionBody(n);
    startExamTimer(n);

    App.examKeyHandler = function (ev) {
      var tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "INPUT" && document.activeElement.type === "text") return;
      var key = ev.key;
      if (key === "ArrowLeft" || key === "p" || key === "P") { gotoQuestion(n, curIndex() - 1); return; }
      if (key === "ArrowRight" || key === "n" || key === "N") { gotoQuestion(n, curIndex() + 1); return; }
      if (key === "f" || key === "F") { document.getElementById("flagBtn").click(); return; }
      var letterIdx = LETTERS.indexOf(key.toUpperCase());
      var digitIdx = /^[1-6]$/.test(key) ? (Number(key) - 1) : -1;
      var idx = letterIdx >= 0 ? letterIdx : digitIdx;
      if (idx >= 0) {
        var input = document.querySelector('#optionsList input[data-idx="' + idx + '"]');
        if (input) { input.click(); }
      }
    };
    document.addEventListener("keydown", App.examKeyHandler);
  }

  function startExamTimer(n) {
    function tick() {
      var state = window.ExamStorage.getInProgress(n);
      if (!state) return;
      var remainMs = state.endTimestamp - Date.now();
      var timerEl = document.getElementById("timerEl");
      if (!timerEl) return;
      var remainSec = Math.max(0, remainMs / 1000);
      timerEl.textContent = fmtClock(remainSec);
      timerEl.classList.remove("amber", "red");
      if (remainSec <= 5 * 60) timerEl.classList.add("red");
      else if (remainSec <= 15 * 60) timerEl.classList.add("amber");
      if (remainMs <= 0) {
        clearInterval(App.examTimerInterval);
        App.examTimerInterval = null;
        window.alert("Time is up. Your exam is being submitted automatically.");
        submitExam(n, true);
      }
    }
    tick();
    App.examTimerInterval = setInterval(tick, 1000);
  }

  function gotoQuestion(n, idx) {
    var state = window.ExamStorage.getInProgress(n);
    if (!state) return;
    if (idx < 0 || idx >= state.order.length) return;
    state.currentIndex = idx;
    window.ExamStorage.saveInProgress(n, state);
    renderQuestionBody(n);
  }

  function renderQuestionBody(n) {
    var state = window.ExamStorage.getInProgress(n);
    var paper = App.papers[n].paper;
    var qid = state.order[state.currentIndex];
    var q = paper.questions.filter(function (x) { return x.id === qid; })[0];

    document.getElementById("qCounter").textContent = "Question " + (state.currentIndex + 1) + " of " + state.order.length;

    var flagBtn = document.getElementById("flagBtn");
    flagBtn.classList.toggle("active", !!state.flags[qid]);

    var stemEl = document.getElementById("questionStem");
    renderFormattedText(stemEl, q.question);

    var hintEl = document.getElementById("selectHint");
    if (q.type === "multiple") {
      hintEl.style.display = "block";
      hintEl.textContent = "Select " + q.answer.length + " option" + (q.answer.length === 1 ? "" : "s") + ".";
    } else {
      hintEl.style.display = "none";
    }

    var list = document.getElementById("optionsList");
    list.textContent = "";
    var selected = state.answers[qid] || [];

    q.options.forEach(function (optText, idx) {
      var li = el("li");
      if (selected.indexOf(idx) >= 0) li.classList.add("selected");
      var input = document.createElement("input");
      input.type = q.type === "single" ? "radio" : "checkbox";
      input.name = "q_" + qid;
      input.value = String(idx);
      input.setAttribute("data-idx", String(idx));
      input.checked = selected.indexOf(idx) >= 0;
      var letter = el("span", "option-letter", LETTERS[idx] + ".");
      var textSpan = el("span", "option-text");
      renderFormattedText(textSpan, optText);

      input.addEventListener("change", function () {
        var cur = (window.ExamStorage.getInProgress(n).answers[qid] || []).slice();
        if (q.type === "single") {
          cur = [idx];
        } else {
          var pos = cur.indexOf(idx);
          if (input.checked) {
            if (pos < 0) cur.push(idx);
            if (cur.length > q.answer.length) {
              // Enforce max N selections: reject the newest click.
              cur.splice(cur.indexOf(idx), 1);
              input.checked = false;
            }
          } else if (pos >= 0) {
            cur.splice(pos, 1);
          }
        }
        var st = window.ExamStorage.getInProgress(n);
        st.answers[qid] = cur;
        window.ExamStorage.saveInProgress(n, st);
        renderQuestionBody(n);
      });

      li.addEventListener("click", function (ev) {
        if (ev.target !== input) input.click();
      });

      li.appendChild(input);
      li.appendChild(letter);
      li.appendChild(textSpan);
      list.appendChild(li);
    });

    // Practice mode: Check Answer button.
    var checkArea = document.getElementById("checkAnswerArea");
    checkArea.textContent = "";
    if (state.practiceMode) {
      var checkBtn = el("button", null, "Check Answer");
      checkBtn.addEventListener("click", function () {
        var sel = (window.ExamStorage.getInProgress(n).answers[qid] || []);
        var correct = window.ExamScoring.isCorrect(q, sel);
        var box = el("div", "check-answer-box " + (correct ? "correct" : "incorrect"));
        box.appendChild(el("div", null, correct ? "Correct!" : "Incorrect."));
        var correctLabels = q.answer.map(function (a) { return LETTERS[a]; }).join(", ");
        box.appendChild(el("div", null, "Correct answer: " + correctLabels));
        var expDiv = el("div");
        renderFormattedText(expDiv, q.explanation);
        box.appendChild(expDiv);
        checkArea.textContent = "";
        checkArea.appendChild(box);
      });
      checkArea.appendChild(checkBtn);
    }

    highlightNavGrid(n);
  }

  function buildNavGrid(n) {
    var state = window.ExamStorage.getInProgress(n);
    var grid = document.getElementById("navGrid");
    grid.textContent = "";
    state.order.forEach(function (qid, idx) {
      var btn = el("button", null, String(idx + 1));
      btn.addEventListener("click", function () { gotoQuestion(n, idx); });
      btn.dataset.qid = qid;
      grid.appendChild(btn);
    });
  }

  function highlightNavGrid(n) {
    var state = window.ExamStorage.getInProgress(n);
    var grid = document.getElementById("navGrid");
    if (!grid) return;
    Array.prototype.forEach.call(grid.children, function (btn, idx) {
      var qid = state.order[idx];
      var answered = state.answers[qid] && state.answers[qid].length > 0;
      btn.classList.remove("answered", "unanswered", "flagged", "current");
      btn.classList.add(answered ? "answered" : "unanswered");
      if (state.flags[qid]) btn.classList.add("flagged");
      if (idx === state.currentIndex) btn.classList.add("current");
    });
  }

  // =======================================================================
  // REVIEW SCREEN (pre-submission)
  // =======================================================================
  function showReviewScreen(n, filter) {
    filter = filter || "all";
    teardownExamRuntime();
    var state = window.ExamStorage.getInProgress(n);
    var paper = App.papers[n].paper;
    if (!state) { showDashboard(); return; }

    var unansweredCount = state.order.filter(function (qid) {
      return !(state.answers[qid] && state.answers[qid].length);
    }).length;

    setScreen(
      '<div class="topbar"><div class="brand">Exam ' + n + ' \u2013 Review</div></div>' +
      '<div class="container">' +
      '  <h2>Question Review</h2>' +
      '  <p>' + unansweredCount + ' of ' + state.order.length + ' questions are unanswered.</p>' +
      '  <div class="toolbar-row">' +
      '    <div class="group">' +
      '      <button id="revAllBtn">Review All</button>' +
      '      <button id="revIncompleteBtn">Review Incomplete</button>' +
      '      <button id="revFlaggedBtn">Review Flagged</button>' +
      '    </div>' +
      '    <div class="group">' +
      '      <button id="backToExamBtn">Back to Exam</button>' +
      '      <button id="submitExamBtn" class="primary">End Review / Submit Exam</button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="review-grid" id="reviewGrid"></div>' +
      '</div>'
    );

    var grid = document.getElementById("reviewGrid");
    state.order.forEach(function (qid, idx) {
      var answered = state.answers[qid] && state.answers[qid].length > 0;
      var flagged = !!state.flags[qid];
      if (filter === "incomplete" && answered) return;
      if (filter === "flagged" && !flagged) return;
      var btn = el("button", answered ? "answered" : "incomplete", String(idx + 1));
      if (flagged) btn.classList.add("flagged");
      btn.addEventListener("click", function () {
        state.currentIndex = idx;
        window.ExamStorage.saveInProgress(n, state);
        showExamScreen(n);
      });
      grid.appendChild(btn);
    });

    document.getElementById("revAllBtn").addEventListener("click", function () { showReviewScreen(n, "all"); });
    document.getElementById("revIncompleteBtn").addEventListener("click", function () { showReviewScreen(n, "incomplete"); });
    document.getElementById("revFlaggedBtn").addEventListener("click", function () { showReviewScreen(n, "flagged"); });
    document.getElementById("backToExamBtn").addEventListener("click", function () { showExamScreen(n); });
    document.getElementById("submitExamBtn").addEventListener("click", function () {
      showSubmitConfirmModal(n, unansweredCount);
    });
  }

  function showSubmitConfirmModal(n, unansweredCount) {
    var overlay = el("div", "modal-overlay");
    var box = el("div", "modal-box");
    box.appendChild(el("h3", null, "Submit Exam?"));
    box.appendChild(el("p", null, unansweredCount > 0
      ? (unansweredCount + " question(s) are still unanswered and will be scored as incorrect.")
      : "All questions are answered."));
    box.appendChild(el("p", null, "This action ends the exam and cannot be undone."));
    var actions = el("div", "modal-actions");
    var cancelBtn = el("button", null, "Cancel");
    var confirmBtn = el("button", "primary", "Submit Exam");
    cancelBtn.addEventListener("click", function () { overlay.remove(); });
    confirmBtn.addEventListener("click", function () { overlay.remove(); submitExam(n, false); });
    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  // =======================================================================
  // SUBMIT / SCORE
  // =======================================================================
  function submitExam(n, autoSubmitted) {
    var state = window.ExamStorage.getInProgress(n);
    var paper = App.papers[n].paper;
    if (!state) { showDashboard(); return; }

    var result = window.ExamScoring.scoreAttempt(paper, state.answers);
    var elapsedSec = Math.min(EXAM_DURATION_SEC, Math.round((Date.now() - state.startedAt) / 1000));
    if (autoSubmitted) elapsedSec = EXAM_DURATION_SEC;

    var historyEntry = {
      date: new Date().toISOString(),
      scaledScore: result.scaledScore,
      rawCorrect: result.rawCorrect,
      totalQuestions: result.total,
      pass: result.pass,
      timeTakenSec: elapsedSec
    };
    window.ExamStorage.addHistoryEntry(n, historyEntry);

    App.lastAttempt = {
      paperNumber: n,
      paper: paper,
      answers: state.answers,
      flags: state.flags,
      result: result,
      timeTakenSec: elapsedSec
    };

    window.ExamStorage.clearInProgress(n);
    showScoreScreen(n);
  }

  function showScoreScreen(n) {
    teardownExamRuntime();
    var attempt = App.lastAttempt;
    if (!attempt || attempt.paperNumber !== n) { showDashboard(); return; }
    var result = attempt.result;

    setScreen(
      '<div class="topbar"><div class="brand">Exam ' + n + ' \u2013 Score Report</div></div>' +
      '<div class="container">' +
      '  <div class="score-banner ' + (result.pass ? "pass" : "fail") + '">' +
      '    <div class="big-label">' + (result.pass ? "PASS" : "FAIL") + '</div>' +
      '    <div class="scaled-score">Scaled score: ' + result.scaledScore + ' / 1000 (passing: ' + PASS_THRESHOLD + ')</div>' +
      '  </div>' +
      '  <div class="score-stats">' +
      '    <div class="score-stat"><div class="label">Raw Score</div><div class="value">' + result.rawCorrect + ' / ' + result.total + '</div></div>' +
      '    <div class="score-stat"><div class="label">Percent Correct</div><div class="value">' + result.percent.toFixed(1) + '%</div></div>' +
      '    <div class="score-stat"><div class="label">Time Taken</div><div class="value">' + fmtClock(attempt.timeTakenSec) + '</div></div>' +
      '  </div>' +
      '  <h3>Domain Breakdown</h3>' +
      '  <table class="domain-breakdown-table" id="domainTable"></table>' +
      '  <h3>Difficulty Breakdown</h3>' +
      '  <table class="domain-breakdown-table" id="difficultyTable"></table>' +
      '  <div class="toolbar-row">' +
      '    <div class="group">' +
      '      <button id="viewAnswersBtn" class="slate">View Answer Review</button>' +
      '      <button id="retakeBtn">Retake Exam</button>' +
      '      <button id="backDashBtn2" class="primary">Back to Dashboard</button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="footnote">' + escapeHtmlStatic(SCALED_SCORE_FOOTNOTE) + '</div>' +
      '</div>'
    );

    var domainTable = document.getElementById("domainTable");
    var headRow = el("tr");
    ["Domain", "Correct / Total", "Percent", ""].forEach(function (h) { headRow.appendChild(el("th", null, h)); });
    domainTable.appendChild(headRow);
    window.ExamDomains.DOMAIN_ORDER.forEach(function (code) {
      var d = result.perDomain[code];
      if (!d) return;
      var pct = d.total ? (d.correct / d.total) * 100 : 0;
      var weak = pct < 70;
      var row = el("tr");
      row.appendChild(el("td", weak ? "weak-domain-label" : null, window.ExamDomains.getDomainName(code)));
      row.appendChild(el("td", null, d.correct + " / " + d.total));
      row.appendChild(el("td", null, pct.toFixed(0) + "%"));
      var barCell = el("td");
      var track = el("div", "bar-track");
      var fill = el("div", "bar-fill" + (weak ? " weak" : ""));
      fill.style.width = pct + "%";
      track.appendChild(fill);
      barCell.appendChild(track);
      row.appendChild(barCell);
      domainTable.appendChild(row);
    });

    var diffTable = document.getElementById("difficultyTable");
    var headRow2 = el("tr");
    ["Difficulty", "Correct / Total", "Percent", ""].forEach(function (h) { headRow2.appendChild(el("th", null, h)); });
    diffTable.appendChild(headRow2);
    ["easy", "medium", "hard"].forEach(function (diff) {
      var d = result.perDifficulty[diff];
      if (!d) return;
      var pct = d.total ? (d.correct / d.total) * 100 : 0;
      var row = el("tr");
      row.appendChild(el("td", null, diff.charAt(0).toUpperCase() + diff.slice(1)));
      row.appendChild(el("td", null, d.correct + " / " + d.total));
      row.appendChild(el("td", null, pct.toFixed(0) + "%"));
      var barCell = el("td");
      var track = el("div", "bar-track");
      var fill = el("div", "bar-fill");
      fill.style.width = pct + "%";
      track.appendChild(fill);
      barCell.appendChild(track);
      row.appendChild(barCell);
      diffTable.appendChild(row);
    });

    document.getElementById("viewAnswersBtn").addEventListener("click", function () { showAnswerReviewScreen(n); });
    document.getElementById("retakeBtn").addEventListener("click", function () { showInstructionsScreen(n); });
    document.getElementById("backDashBtn2").addEventListener("click", showDashboard);
  }

  // =======================================================================
  // ANSWER REVIEW SCREEN
  // =======================================================================
  function showAnswerReviewScreen(n, filter, domainFilter) {
    filter = filter || "all";
    var attempt = App.lastAttempt;
    if (!attempt || attempt.paperNumber !== n) { showDashboard(); return; }

    var domainOptions = window.ExamDomains.DOMAIN_ORDER.map(function (code) {
      return '<option value="' + code + '">' + escapeHtmlStatic(window.ExamDomains.getDomainName(code)) + '</option>';
    }).join("");

    setScreen(
      '<div class="topbar"><div class="brand">Exam ' + n + ' \u2013 Answer Review</div>' +
      '<button id="backScoreBtn">Back to Score Report</button></div>' +
      '<div class="container">' +
      '  <div class="review-filters">' +
      '    <label><input type="radio" name="filt" value="all" checked> All</label>' +
      '    <label><input type="radio" name="filt" value="incorrect"> Incorrect</label>' +
      '    <label><input type="radio" name="filt" value="flagged"> Flagged</label>' +
      '    <select id="domainFilterSel"><option value="">All domains</option>' + domainOptions + '</select>' +
      '  </div>' +
      '  <div id="reviewItems"></div>' +
      '</div>'
    );

    document.getElementById("backScoreBtn").addEventListener("click", function () { showScoreScreen(n); });
    var radios = document.querySelectorAll('input[name="filt"]');
    radios.forEach(function (r) {
      r.checked = r.value === filter;
      r.addEventListener("change", function () {
        renderAnswerReviewItems(n, r.value, document.getElementById("domainFilterSel").value);
      });
    });
    var domainSel = document.getElementById("domainFilterSel");
    domainSel.value = domainFilter || "";
    domainSel.addEventListener("change", function () {
      var active = document.querySelector('input[name="filt"]:checked').value;
      renderAnswerReviewItems(n, active, domainSel.value);
    });

    renderAnswerReviewItems(n, filter, domainFilter || "");
  }

  function renderAnswerReviewItems(n, filter, domainFilter) {
    var attempt = App.lastAttempt;
    var container = document.getElementById("reviewItems");
    container.textContent = "";
    var result = attempt.result;

    attempt.paper.questions.forEach(function (q) {
      var detail = result.details.filter(function (d) { return d.id === q.id; })[0];
      var flagged = !!attempt.flags[q.id];
      if (filter === "incorrect" && detail.correct) return;
      if (filter === "flagged" && !flagged) return;
      if (domainFilter && q.domain !== domainFilter) return;

      var item = el("div", "review-item");
      var meta = el("div", "q-meta");
      meta.appendChild(el("span", null, "Q" + q.id));
      meta.appendChild(el("span", null, window.ExamDomains.getDomainName(q.domain)));
      meta.appendChild(el("span", null, q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1)));
      meta.appendChild(el("span", detail.correct ? "status-line pass" : "status-line fail", detail.correct ? "Correct" : "Incorrect"));
      if (flagged) meta.appendChild(el("span", null, "\u2691 Flagged"));
      item.appendChild(meta);

      var stemDiv = el("div", "question-stem");
      renderFormattedText(stemDiv, q.question);
      item.appendChild(stemDiv);

      var selected = attempt.answers[q.id] || [];
      q.options.forEach(function (optText, idx) {
        var row = el("div", "option-row");
        var isCorrectOpt = q.answer.indexOf(idx) >= 0;
        var isSelected = selected.indexOf(idx) >= 0;
        if (isCorrectOpt) row.classList.add("correct-answer");
        else if (isSelected) row.classList.add("wrong-selected");
        row.appendChild(el("span", "option-letter", LETTERS[idx] + "."));
        var textSpan = el("span");
        renderFormattedText(textSpan, optText);
        row.appendChild(textSpan);
        if (isSelected) row.appendChild(el("span", "tag-your-pick", "Your answer"));
        item.appendChild(row);
      });

      var expDiv = el("div", "explanation");
      renderFormattedText(expDiv, q.explanation);
      item.appendChild(expDiv);

      container.appendChild(item);
    });

    if (!container.children.length) {
      container.appendChild(el("p", null, "No questions match this filter."));
    }
  }

  // =======================================================================
  // INIT
  // =======================================================================
  function init() {
    App.root = document.getElementById("app");
    checkPapers();
    showDashboard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

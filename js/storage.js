// localStorage helpers for the CCDV-F mock exam simulator.
// Namespaced keys so this app does not collide with anything else on file://.
(function (root) {
  "use strict";

  var PREFIX = "ccdvf_";
  var ATTEMPT_KEY = function (n) { return PREFIX + "attempt_" + n; };
  var HISTORY_KEY = function (n) { return PREFIX + "history_" + n; };
  var SETTINGS_KEY = PREFIX + "settings";

  function hasLocalStorage() {
    try {
      var k = "__ccdvf_test__";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  function readJSON(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function removeKey(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      // ignore
    }
  }

  // --- In-progress attempt state ---
  // shape: { paperNumber, endTimestamp, answers: {qid: [idx,...]}, flags: {qid: true},
  //          currentIndex, shuffleOrder: [qid,...] (shuffled question order, optional),
  //          practiceMode, startedAt }
  function getInProgress(paperNumber) {
    return readJSON(ATTEMPT_KEY(paperNumber), null);
  }

  function saveInProgress(paperNumber, state) {
    return writeJSON(ATTEMPT_KEY(paperNumber), state);
  }

  function clearInProgress(paperNumber) {
    removeKey(ATTEMPT_KEY(paperNumber));
  }

  // --- Attempt history ---
  // entry shape: { date, scaledScore, rawCorrect, totalQuestions, pass, timeTakenSec }
  function getHistory(paperNumber) {
    return readJSON(HISTORY_KEY(paperNumber), []);
  }

  function addHistoryEntry(paperNumber, entry) {
    var history = getHistory(paperNumber);
    history.push(entry);
    writeJSON(HISTORY_KEY(paperNumber), history);
    return history;
  }

  function getBestScore(paperNumber) {
    var history = getHistory(paperNumber);
    if (!history.length) return null;
    return history.reduce(function (best, e) {
      return (!best || e.scaledScore > best.scaledScore) ? e : best;
    }, null);
  }

  function getLastAttempt(paperNumber) {
    var history = getHistory(paperNumber);
    if (!history.length) return null;
    return history[history.length - 1];
  }

  // --- Settings (shuffle / practice mode toggles persist as last used) ---
  function getSettings() {
    return readJSON(SETTINGS_KEY, { shuffle: false, practiceMode: false });
  }

  function saveSettings(settings) {
    return writeJSON(SETTINGS_KEY, settings);
  }

  // --- Reset everything the app owns ---
  function resetAll() {
    try {
      var toRemove = [];
      for (var i = 0; i < window.localStorage.length; i++) {
        var key = window.localStorage.key(i);
        if (key && key.indexOf(PREFIX) === 0) toRemove.push(key);
      }
      toRemove.forEach(removeKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  root.ExamStorage = {
    hasLocalStorage: hasLocalStorage,
    getInProgress: getInProgress,
    saveInProgress: saveInProgress,
    clearInProgress: clearInProgress,
    getHistory: getHistory,
    addHistoryEntry: addHistoryEntry,
    getBestScore: getBestScore,
    getLastAttempt: getLastAttempt,
    getSettings: getSettings,
    saveSettings: saveSettings,
    resetAll: resetAll
  };
})(typeof window !== "undefined" ? window : this);

// Domain metadata table for the CCDV-F exam.
// Shared between app.js (UI) and scoring.js (per-domain breakdown).
(function (root) {
  "use strict";

  var DOMAINS = {
    D1: { code: "D1", name: "Agents and Workflows", weight: 14.7, questionsPerPaper: 8 },
    D2: { code: "D2", name: "Applications and Integration", weight: 33.1, questionsPerPaper: 17 },
    D3: { code: "D3", name: "Claude Code", weight: 3.1, questionsPerPaper: 2 },
    D4: { code: "D4", name: "Eval, Testing, and Debugging", weight: 2.6, questionsPerPaper: 1 },
    D5: { code: "D5", name: "Model Selection and Optimization", weight: 16.8, questionsPerPaper: 9 },
    D6: { code: "D6", name: "Prompt and Context Engineering", weight: 11.0, questionsPerPaper: 6 },
    D7: { code: "D7", name: "Security and Safety", weight: 8.1, questionsPerPaper: 4 },
    D8: { code: "D8", name: "Tools and MCPs", weight: 10.6, questionsPerPaper: 6 }
  };

  var DOMAIN_ORDER = ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"];

  function getDomain(code) {
    return DOMAINS[code] || null;
  }

  function getDomainName(code) {
    var d = DOMAINS[code];
    return d ? d.name : code;
  }

  var api = {
    DOMAINS: DOMAINS,
    DOMAIN_ORDER: DOMAIN_ORDER,
    getDomain: getDomain,
    getDomainName: getDomainName
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ExamDomains = api;
  }
})(typeof window !== "undefined" ? window : this);

/** The saved analysis is immutable. The URL owns layout, page, option, and scenario selection. */
const main = document.querySelector("#main");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const percentage = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const list = (items, empty = "Nothing listed in the saved analysis.") => items.length
  ? `<ul class="compact-list">${items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>`
  : `<p class="empty-note">${escape(empty)}</p>`;

let snapshot;
let previousRoute;
let selectionFocus;

function requireNumber(value, path) {
  if (!Number.isFinite(value)) throw new Error(`Missing numeric input: ${path}.`);
  return value;
}

function prepareSnapshot(raw) {
  const { bill, company, forecast, results, plan, brief } = raw;
  if (bill.bill.id !== results.bill_id || results.bill_id !== brief.bill_id || plan.bill_id !== results.bill_id) {
    throw new Error("The bill, plan, results, and brief belong to different analyses.");
  }
  if (plan.as_of !== results.as_of || forecast.probability !== results.pass_probability) {
    throw new Error("The saved forecast and impact results do not describe the same snapshot.");
  }
  requireNumber(forecast.probability, "forecast.probability");
  const strategies = new Map(results.options.map((option) => [option.option_id, option]));
  const scenarios = new Map(results.scenarios.map((scenario) => [scenario.id, scenario]));
  const recommendation = strategies.get(brief.recommendation.option_id);
  if (!recommendation) throw new Error("The brief recommends a strategy missing from the calculations.");
  if (!scenarios.size) throw new Error("No scenario outcomes are available.");
  for (const option of strategies.values()) {
    requireNumber(option.expected_first_year_impact, `${option.option_id}.expected_first_year_impact`);
    requireNumber(option.worst_case, `${option.option_id}.worst_case`);
    for (const scenario of scenarios.values()) {
      requireNumber(scenario.probability, `${scenario.id}.probability`);
      const outcome = option.by_scenario.find((item) => item.scenario_id === scenario.id);
      if (!outcome) throw new Error(`Missing outcome for ${option.option_id}, ${scenario.id}.`);
      for (const field of ["annual_profit_change", "first_year_impact", "one_time_total", "gross_margin_after"]) {
        requireNumber(outcome[field], `${option.option_id}.${scenario.id}.${field}`);
      }
    }
  }

  // These are explicit sample findings, not numbers extracted from the agent's prose.
  const growth = plan.assumptions.find((assumption) => assumption.id === "A5");
  const powercell = company.suppliers.find((supplier) => supplier.id === "SUP-BAT-01");
  const passScenario = results.scenarios.find((scenario) => scenario.branch === "pass");
  const noAction = strategies.get("do_nothing")?.by_scenario.find((outcome) => outcome.scenario_id === passScenario?.id);
  const findings = {
    opportunities: [
      {
        title: "Room to gain market share",
        detail: "Certified products could pick up demand as less-prepared competitors adjust.",
        value: growth ? `+${requireNumber(growth.value, "assumptions.A5.value")}%` : null,
        label: "e-bike sales", qualifier: "assumption · low confidence",
        source: "Impact plan · assumption A5",
      },
      {
        title: "A head start in New York City",
        detail: brief.opportunities[1] || "No additional opportunity finding is available.",
        value: null, label: "Existing practice", qualifier: "from the saved company brief",
        source: "Saved brief · opportunities",
      },
    ],
    risks: [
      {
        title: "Certification gaps could stop sales",
        detail: "The main battery supplier lacks UL 2271. The Cargo model also needs UL 2849.",
        value: noAction ? compactMoney.format(Math.abs(requireNumber(noAction.annual_profit_change, "do_nothing.pass.annual_profit_change"))) : null,
        label: "annual gross profit exposed", qualifier: "if a rule applies and no action is taken",
        source: "Do nothing · pass scenario · annual_profit_change",
      },
      {
        title: "Switching suppliers early has a cost",
        detail: "Leaving PowerCell before the contract ends triggers an exit penalty.",
        value: powercell?.contract ? compactMoney.format(requireNumber(powercell.contract.early_exit_penalty, "SUP-BAT-01.contract.early_exit_penalty")) : null,
        label: "one-time penalty", qualifier: "for an early supplier exit",
        source: "Company · PowerCell contract",
      },
    ],
  };
  return { ...raw, strategies, scenarios, recommendation, findings };
}

function readRoute() {
  const [page, query = ""] = location.hash.slice(1).split("?");
  const params = new URLSearchParams(query);
  const route = {
    page: page === "strategies" ? "strategies" : "overview",
    layout: params.get("layout") === "decision" ? "decision" : "brief",
    option: params.get("option") || snapshot.recommendation.option_id,
    scenario: params.get("scenario") || snapshot.results.scenarios[0].id,
  };
  if (!snapshot.strategies.has(route.option)) route.option = snapshot.recommendation.option_id;
  if (!snapshot.scenarios.has(route.scenario)) route.scenario = snapshot.results.scenarios[0].id;
  const canonical = href(route);
  if (location.hash !== canonical) history.replaceState(null, "", canonical);
  return route;
}

function href(route) {
  const params = new URLSearchParams({ layout: route.layout });
  if (route.page === "strategies") {
    params.set("option", route.option);
    params.set("scenario", route.scenario);
  }
  return `#${route.page}?${params}`;
}

function findingColumn(kind, title, symbol) {
  const findings = snapshot.findings[kind];
  return `<section class="finding-column ${kind === "risks" ? "risk" : "opportunity"}" aria-labelledby="${kind}-heading">
    <div class="section-label"><span class="section-icon" aria-hidden="true">${symbol}</span><h2 id="${kind}-heading">${title}</h2></div>
    ${findings.length ? findings.map((finding) => `<article class="finding">
      <h3>${escape(finding.title)}</h3><p>${escape(finding.detail)}</p>
      <div class="finding-value">${finding.value === null ? "" : `<strong>${escape(finding.value)}</strong>`}${escape(finding.label)}</div>
      <span class="qualifier">${escape(finding.qualifier)}</span>
    </article>`).join("") : `<p class="empty-note">No ${kind} are listed for this analysis.</p>`}
  </section>`;
}

function verdict(route) {
  const option = snapshot.recommendation;
  const shortName = snapshot.brief.options_compared.find((item) => item.option_id === option.option_id)?.name || option.option_name;
  return `<section class="verdict" aria-labelledby="verdict-heading">
    <div><div class="eyebrow">Recommended approach</div><h2 id="verdict-heading">${escape(shortName)}</h2>
    <p>Keep certification ready to start. Waiting limits the expected cost, but a fast compliance deadline could interrupt sales.</p></div>
    <div class="verdict-right"><strong class="verdict-impact">${escape(compactMoney.format(option.expected_first_year_impact))}</strong>
    <span class="verdict-impact-label">expected first-year impact</span>
    <a class="primary-link" href="${href({ ...route, page: "strategies", option: option.option_id })}">View strategies <span aria-hidden="true">↗</span></a></div>
  </section>`;
}

function overview(route) {
  const date = new Date(`${snapshot.results.as_of}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const findings = `<div class="findings">${findingColumn("opportunities", "Opportunities", "↗")}${findingColumn("risks", "Risks", "!")}</div>`;
  return `<div class="${route.layout === "decision" ? "decision-first" : "brief-layout"}">
    <nav class="breadcrumb" aria-label="Breadcrumb"><span>VoltRide</span><span aria-hidden="true">/</span><span>Bill analysis</span><span aria-hidden="true">/</span><span class="current">H.R. 973</span></nav>
    <div class="bill-hero">
      <div><div class="bill-meta"><span class="sample-label">SAMPLE ANALYSIS</span><span class="analysis-date">${escape(date)}</span></div>
      <h1 tabindex="-1">H.R. 973</h1><p class="bill-subtitle">Battery safety standards.<br>What changes for VoltRide?</p>
      <div class="bill-links"><a class="external-link" href="${escape(snapshot.bill.bill.url)}" target="_blank" rel="noopener noreferrer">Read the bill <span aria-hidden="true">↗</span></a><span class="stage">Passed the House · saved status</span></div></div>
      <div class="probability"><strong>${escape((snapshot.forecast.probability * 100).toFixed(1))}<span>%</span></strong>
      <div><span class="caption">chance of passage</span><div class="probability-track" aria-hidden="true"><span style="width:${snapshot.forecast.probability * 100}%"></span></div></div></div>
    </div>
    ${route.layout === "decision" ? verdict(route) + findings : findings + verdict(route)}
    <p class="overview-note">USD · Fictional VoltRide sample · Financial impacts use saved scenario calculations. Assumptions and conditional exposure are not expected returns.</p>
    <details class="finding-sources"><summary>Where these findings come from</summary><ul class="compact-list">${[...snapshot.findings.opportunities, ...snapshot.findings.risks].map((finding) => `<li><strong>${escape(finding.title)}.</strong> ${escape(finding.source)}</li>`).join("")}</ul></details>
  </div>`;
}

function strategyComparison(route) {
  return `<div class="table-scroll" role="region" aria-label="Strategy comparison" tabindex="0"><table class="comparison">
    <thead><tr><th scope="col">Evaluated strategy</th><th scope="col">Expected first year</th><th scope="col">Worst case</th><th scope="col">Ready if it passes?</th></tr></thead>
    <tbody>${snapshot.results.ranking_by_expected_impact.map((id) => {
      const option = snapshot.strategies.get(id);
      const name = snapshot.brief.options_compared.find((item) => item.option_id === id)?.name || option.option_name;
      return `<tr class="${id === route.option ? "selected" : ""}"><th scope="row"><a class="strategy-choice" data-option="${escape(id)}" ${id === route.option ? 'aria-current="true"' : ""} href="${href({ ...route, option: id })}">${escape(name)}${id === snapshot.recommendation.option_id ? '<span class="recommended-tag">Recommended</span>' : ""}</a></th>
      <td>${escape(money.format(option.expected_first_year_impact))}</td><td>${escape(money.format(option.worst_case))}</td><td><span class="readiness ${option.compliant_in_every_pass_scenario ? "ready" : "not-ready"}">${option.compliant_in_every_pass_scenario ? "Ready" : "Not in every scenario"}</span></td></tr>`;
    }).join("")}</tbody>
  </table></div><p class="table-note">USD relative to the current business. Expected impact weights all scenarios. Worst case is the lowest modeled first-year outcome. Readiness includes certification timing.</p>`;
}

function scenarioDetails(route) {
  const option = snapshot.strategies.get(route.option);
  const scenario = snapshot.scenarios.get(route.scenario);
  const outcome = option.by_scenario.find((item) => item.scenario_id === route.scenario);
  const ready = outcome.compliant && outcome.timing_problems.length === 0;
  const issues = [...outcome.compliance_issues.map((issue) => `${issue.product}: ${issue.problem}. ${issue.result}.`), ...outcome.timing_problems, ...outcome.warnings];
  const costs = outcome.one_time_costs.length
    ? `<dl class="cost-list">${outcome.one_time_costs.map((cost) => `<div class="cost-row"><dt>${escape(cost.item)}</dt><dd>${escape(money.format(cost.amount))}</dd></div>`).join("")}</dl>`
    : '<p class="empty-note">No one-time costs in this scenario.</p>';
  return `<section class="scenario-inspector" aria-labelledby="scenario-heading">
    <div class="section-heading"><div><div class="eyebrow muted">Explore an outcome</div><h2 id="scenario-heading">${escape(option.option_name)}</h2><p>${escape(option.description)}</p></div>
    <div class="scenario-control"><label for="scenario">Scenario</label><select id="scenario">${snapshot.results.scenarios.map((item) => `<option value="${escape(item.id)}" ${item.id === route.scenario ? "selected" : ""}>${escape(item.name)}</option>`).join("")}</select></div></div>
    <p class="scenario-meta">${escape(percentage.format(scenario.probability))} overall scenario probability · ${scenario.months_until_rule_applies === null ? "No rule takes effect" : `Rule applies in ${escape(scenario.months_until_rule_applies)} months (assumption)`}</p>
    <div class="scenario-summary" aria-live="polite">
      <div class="scenario-metric"><span>Annual gross profit change</span><strong>${escape(money.format(outcome.annual_profit_change))}</strong><small>Once the rule applies</small></div>
      <div class="scenario-metric"><span>One-time costs</span><strong>${escape(money.format(outcome.one_time_total))}</strong><small>Including any lost sales while fixes finish</small></div>
      <div class="scenario-metric"><span>Modeled first-year impact</span><strong>${escape(money.format(outcome.first_year_impact))}</strong><small>Annual change less one-time costs</small></div>
    </div>
    <div class="status-note"><span class="readiness ${ready ? "ready" : "not-ready"}">${ready ? (scenario.months_until_rule_applies === null ? "No new compliance deadline" : "Ready by this scenario's deadline") : "Not ready by this scenario's deadline"}</span>
    <span class="readiness ${outcome.feasible ? "ready" : "not-ready"}">${outcome.feasible ? "Within supplier capacity" : "Supplier capacity issue"}</span><span>Gross margin after changes <strong>${escape(percentage.format(outcome.gross_margin_after))}</strong></span></div>
    ${issues.length ? `<aside class="scenario-warnings"><p>${outcome.timing_problems.length ? "Certification can finish after the deadline." : "This outcome has issues to resolve."}</p>${list(issues)}</aside>` : ""}
    <div class="detail-columns"><section><h3>One-time cost breakdown</h3>${costs}</section><section><h3>Products in this outcome</h3><div class="table-scroll" role="region" aria-label="Product outcomes" tabindex="0"><table class="product-table"><thead><tr><th scope="col">Product</th><th scope="col">Annual units</th><th scope="col">Gross profit</th></tr></thead><tbody>${outcome.products_after.map((product) => `<tr><td>${escape(product.name)}</td><td>${escape(integer.format(product.units))}</td><td>${escape(money.format(product.gross_profit))}</td></tr>`).join("")}</tbody></table></div></section></div>
    <details style="margin-top:24px"><summary>Supplier, certification, and market changes</summary>${list(outcome.changes_applied, "No supplier, certification, or market changes in this scenario.")}</details>
  </section>`;
}

function strategies(route) {
  const recommendation = snapshot.brief.recommendation;
  return `<nav class="breadcrumb" aria-label="Breadcrumb"><a class="back-link" href="${href({ ...route, page: "overview" })}">← Back to overview</a><span aria-hidden="true">/</span><span class="current">H.R. 973 strategies</span></nav>
    <div class="page-heading"><div><div class="eyebrow muted">VoltRide · H.R. 973</div><h1 tabindex="-1">Compare your strategies.</h1><p>${escape(recommendation.summary)}</p></div><div class="strategy-context"><strong>${escape(percentage.format(snapshot.forecast.probability))}</strong>chance of passage<br>Saved sample · ${escape(snapshot.results.as_of)}</div></div>
    <div class="recommendation-note"><strong>Why this strategy.</strong> ${escape(recommendation.why)}<br><strong>The tradeoff.</strong> ${escape(recommendation.tradeoff)}</div>
    ${strategyComparison(route)}${scenarioDetails(route)}
    <div class="detail-columns support-section"><section><h3>Reconsider the recommendation if…</h3>${list(recommendation.switch_if)}</section><section><h3>Assumptions that can change the answer</h3>${list(snapshot.brief.assumptions_to_verify)}</section></div>
    <section class="support-section"><h2>Next steps from the saved recommendation</h2><ol class="steps">${snapshot.brief.next_steps.map((step, index) => `<li><span class="step-number">${String(index + 1).padStart(2, "0")}</span><span>${escape(step.step)}</span><span class="step-owner">${escape(step.who)}<span>${escape(step.by_when)}</span></span></li>`).join("")}</ol></section>
    <div class="disclosures"><details><summary>Sources and analysis inputs</summary><ul class="compact-list source-list">${snapshot.brief.sources.map((source) => `<li><a href="${escape(source)}" target="_blank" rel="noopener noreferrer">${escape(source)} ↗</a></li>`).join("")}</ul><p class="verification">Saved inputs are from ${escape(snapshot.results.as_of)}. Newer research has not been mixed into this sample.</p></details><details><summary>Calculation assumptions and limits</summary>${list(snapshot.results.method_notes)}<p class="verification">Displayed scenario probabilities are rounded in the saved inputs and may not sum to exactly 100%.</p></details></div>
    <p class="verification">${snapshot.verification.numbers_trace_to_inputs ? "<strong>Brief numbers trace to the saved inputs.</strong>" : "<strong>The saved brief has numbers that could not be traced to the inputs.</strong>"} This checks numeric traceability, not factual accuracy or legal validity. The recommendation is saved sample prose, not a new agent run.</p>`;
}

function render() {
  const route = readRoute();
  const changedPage = previousRoute && previousRoute.page !== route.page;
  main.innerHTML = route.page === "overview" ? overview(route) : strategies(route);
  document.querySelectorAll("[data-layout]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.layout === route.layout)));
  document.querySelector(".brand").href = href({ ...route, page: "overview" });
  document.title = `${route.page === "strategies" ? "Strategies" : "H.R. 973"} · VoltRide · Policy desk`;
  if (changedPage) {
    main.querySelector("h1").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  } else if (selectionFocus === "scenario") {
    main.querySelector("#scenario")?.focus({ preventScroll: true });
  } else if (selectionFocus) {
    main.querySelector(`[data-option="${selectionFocus}"]`)?.focus({ preventScroll: true });
  }
  selectionFocus = undefined;
  previousRoute = route;
}

async function start() {
  try {
    const response = await fetch("snapshot.json");
    if (!response.ok) throw new Error(`The saved analysis could not load (HTTP ${response.status}).`);
    snapshot = prepareSnapshot(await response.json());
    render();
  } catch (error) {
    main.innerHTML = `<section class="error-state" role="alert"><h1>The analysis couldn't open.</h1><p class="error-text">${escape(error.message)}</p><p>Restart the prototype server if the saved inputs changed.</p><button class="retry" type="button">Try again</button></section>`;
    main.querySelector(".retry").addEventListener("click", start, { once: true });
  }
}

document.querySelectorAll("[data-layout]").forEach((button) => button.addEventListener("click", () => {
  if (snapshot) location.hash = href({ ...readRoute(), layout: button.dataset.layout });
}));
document.querySelector(".skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  main.focus();
  main.scrollIntoView();
});
main.addEventListener("change", (event) => {
  if (event.target.id === "scenario") {
    selectionFocus = "scenario";
    location.hash = href({ ...readRoute(), scenario: event.target.value });
  }
});
main.addEventListener("click", (event) => {
  const optionLink = event.target.closest("[data-option]");
  if (optionLink) selectionFocus = optionLink.dataset.option;
});
window.addEventListener("hashchange", () => { if (snapshot) render(); });
start();

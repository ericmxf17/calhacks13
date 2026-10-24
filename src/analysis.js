const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 1 });
function requireNumber(value, path) {
  if (!Number.isFinite(value)) throw new Error(`Missing numeric input: ${path}.`);
  return value;
}

export function prepareSnapshot(raw) {
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


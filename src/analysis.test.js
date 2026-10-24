import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareSnapshot } from './analysis.js';
import { verifyBrief } from './verify-brief.js';
const load = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
function fixture() {
  return {
    bill: load('agents/hr973-expected-output.json'), company: load('company.json'),
    forecast: load('tests/hr973-forecast.json'), results: load('tests/hr973-impact-results.json'),
    plan: load('tests/hr973-impact-plan.json'), brief: load('tests/hr973-brief.json'),
  };
}
test('overview keeps conditional annual exposure separate from the weighted recommendation', () => {
  const data = prepareSnapshot(fixture());
  const pass = data.results.scenarios.find(item => item.branch === 'pass');
  const exposure = data.strategies.get('do_nothing').by_scenario.find(item => item.scenario_id === pass.id);
  assert.notEqual(exposure.annual_profit_change, data.recommendation.expected_first_year_impact);
  assert.equal(data.findings.risks[0].value, '$5.6M');
  assert.equal(data.findings.risks[1].value, '$75K');
  assert.equal(data.recommendation.option_id, data.brief.recommendation.option_id);
  assert.match(data.findings.opportunities[0].qualifier, /assumption/);
});
test('rejects a forecast that disagrees with the financial calculations', () => {
  const raw = fixture(); raw.forecast.probability = .99;
  assert.throws(() => prepareSnapshot(raw), /same snapshot/);
});
test('rejects missing scenario outcomes rather than showing fabricated numbers', () => {
  const raw = fixture(); raw.results.options[0].by_scenario.pop();
  assert.throws(() => prepareSnapshot(raw), /Missing outcome/);
});

test('the saved brief traces to the same inputs used by the app', () => {
  const { brief, ...sources } = fixture();
  assert.deepEqual(verifyBrief(brief, Object.values(sources)), { numbers_trace_to_inputs: true, problems: [] });
});

test('traceability accepts rounded money, percentages, and bill references', () => {
  const brief = { summary: 'H.R. 973 has a 22.5% chance. UL 2849 costs about $217K.' };
  assert.deepEqual(verifyBrief(brief, [{ probability: 0.225, impact: -217350.36 }]), {
    numbers_trace_to_inputs: true, problems: [],
  });
});

test('traceability reports unsupported amounts with their original sentence', () => {
  const summary = 'This would cost $123,456,789.41.';
  assert.deepEqual(verifyBrief({ summary }, [{ cost: 60000 }]), {
    numbers_trace_to_inputs: false, problems: [['$123,456,789.41', summary]],
  });
});

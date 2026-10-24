import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareSnapshot } from './analysis.js';
const load = path => JSON.parse(readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8'));
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

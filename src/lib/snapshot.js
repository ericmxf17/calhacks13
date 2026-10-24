import 'server-only';
import bill from '../../agents/hr973-expected-output.json';
import company from '../../company.json';
import forecast from '../../tests/hr973-forecast.json';
import results from '../../tests/hr973-impact-results.json';
import plan from '../../tests/hr973-impact-plan.json';
import brief from '../../tests/hr973-brief.json';
import { verifyBrief } from '../verify-brief.js';

export function getSnapshot() {
  return {
    bill, company, forecast, results, plan, brief,
    verification: verifyBrief(brief, [bill, company, forecast, results, plan]),
    fixture_paths: {
      bill: 'agents/hr973-expected-output.json', company: 'company.json',
      forecast: 'tests/hr973-forecast.json', results: 'tests/hr973-impact-results.json',
      plan: 'tests/hr973-impact-plan.json', brief: 'tests/hr973-brief.json',
    },
  };
}

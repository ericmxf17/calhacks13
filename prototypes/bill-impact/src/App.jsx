import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronRight, CircleAlert, FileText, Info, Leaf, ShieldAlert, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { prepareSnapshot } from './analysis';

const compact = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const percent = value => new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(value);
const date = value => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const href = (page = 'overview', option, scenario) => `#${page}${page === 'strategies' ? `?${new URLSearchParams({ option, scenario })}` : ''}`;
const optionName = (data, option) => data.brief.options_compared.find(item => item.option_id === option.option_id)?.name || option.option_name;
function readRoute(data) {
  const [page, search] = location.hash.slice(1).split('?');
  const params = new URLSearchParams(search);
  return {
    page: page === 'strategies' ? page : 'overview',
    option: data.strategies.has(params.get('option')) ? params.get('option') : data.recommendation.option_id,
    scenario: data.scenarios.has(params.get('scenario')) ? params.get('scenario') : data.results.scenarios[0].id,
  };
}
function Bullets({ items }) { return items?.length ? <ul className="detail-list">{items.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p className="muted">Nothing listed in this saved analysis.</p>; }
function Disclosure({ value, title, children }) { return <AccordionItem value={value}><AccordionTrigger>{title}</AccordionTrigger><AccordionContent>{children}</AccordionContent></AccordionItem>; }
function Verdict({ data, route }) {
  const option = data.recommendation;
  return <section className="verdict" aria-labelledby="verdict-heading">
    <div className="verdict-copy"><div className="section-kicker"><span className="verdict-icon"><Check size={14} /></span> The verdict</div>
      <h2 id="verdict-heading">{optionName(data, option)}</h2>
      <p>Prepare certification now. Commit the spend if the bill passes.</p>
      <span className="tradeoff"><CircleAlert size={14} /> A fast deadline could still interrupt sales.</span>
    </div>
    <div className="verdict-action"><div className="verdict-amount">{compact(option.expected_first_year_impact)}</div><div className="verdict-label">expected first-year profit change</div>
      <Button asChild size="lg"><a href={href('strategies', option.option_id, route.scenario)}>View strategies <ArrowRight size={16} /></a></Button>
    </div>
  </section>;
}
function Overview({ data, route }) {
  const [growth, headstart] = data.findings.opportunities;
  const [exposure, penalty] = data.findings.risks;
  return <>
    <section className="bill-header" aria-labelledby="page-title">
      <div><div className="bill-eyebrow"><Badge variant="outline">H.R. 973</Badge><span>119th Congress</span></div>
        <h1 id="page-title" tabIndex={-1}>Safer batteries.<br /><span>What it means for VoltRide.</span></h1>
        <p className="bill-summary">This bill would require e-bikes and their batteries to meet federal safety standards. VoltRide may need to certify its supplier and Cargo model.</p>
        <Button asChild variant="link" className="bill-source"><a href={data.bill.bill.url} target="_blank" rel="noreferrer">Read the bill <ArrowUpRight size={14} /></a></Button>
      </div>
      <aside className="passage" aria-label="Passage forecast"><span className="section-kicker">Will it become law?</span><strong>{percent(data.forecast.probability)}</strong><span className="passage-caption">chance of passage this Congress</span><div className="probability-track" aria-hidden="true"><span style={{ width: percent(data.forecast.probability) }} /></div><span className="passage-stage">Passed the House · Senate pending</span></aside>
    </section>
    <Separator />
    <section className="impact-section" aria-label="What this means for your business">
      <div className="findings-grid">
        <section aria-labelledby="opportunities-title" className="findings opportunities"><h2 id="opportunities-title"><TrendingUp size={18} /> Opportunities<span>What you could gain</span></h2>
          <ul className="finding-list"><li><div className="finding-heading"><h3>{growth.title}</h3><span className="impact-number positive">{growth.value || 'Not quantified'}</span></div><p>More e-bike sales as competitors with uncertified batteries lose ground.</p><span className="finding-caption">Assumed sales growth · not a guaranteed gain</span></li>
          <li><div className="finding-heading"><h3>{headstart.title}</h3><Badge variant="secondary">Existing advantage</Badge></div><p>You already ship certified batteries in NYC—a useful starting point.</p></li></ul>
        </section>
        <section aria-labelledby="risks-title" className="findings risks"><h2 id="risks-title"><ShieldAlert size={18} /> Risks<span>What you could lose</span></h2>
          <ul className="finding-list"><li><div className="finding-heading"><h3>Product sales could stop</h3><span className="impact-number negative">{exposure.value || 'Not quantified'}</span></div><p>Annual gross profit exposed if a rule applies and you take no action.</p><span className="finding-caption">Conditional exposure · not the expected loss</span></li>
          <li><div className="finding-heading"><h3>Leaving your supplier early</h3><span className="impact-number negative">{penalty.value || 'Not quantified'}</span></div><p>One-time contract penalty if you switch before the agreement ends.</p></li></ul>
        </section>
      </div>
    </section>
    <Verdict data={data} route={route} />
    <p className="interpretation"><Info size={14} /><span><strong>How to read this:</strong> risks show what could happen; the verdict weighs the modeled scenarios to suggest what to do.</span></p>
    <Accordion type="single" collapsible className="overview-details"><Disclosure value="context" title="Bill context, assumptions & sources"><p className="detail-intro">{data.bill.bill.title}</p><p>{data.brief.bill_in_plain_english}</p><h3>Assumptions to verify</h3><Bullets items={data.brief.assumptions_to_verify} /><Sources data={data} /></Disclosure></Accordion>
  </>;
}
function Sources({ data }) { return <><h3>Sources</h3><ul className="detail-list sources">{data.brief.sources.map(source => <li key={source}><a href={source} target="_blank" rel="noreferrer">{source}<ArrowUpRight size={12} /></a></li>)}</ul><p className="muted">{data.verification.numbers_trace_to_inputs ? 'Brief numbers trace to the saved inputs.' : 'Some brief numbers could not be traced to the saved inputs.'} Numeric traceability does not verify factual accuracy or legal validity.</p></>; }
function Strategies({ data, route }) {
  const selected = data.strategies.get(route.option);
  const scenario = data.scenarios.get(route.scenario);
  const outcome = selected.by_scenario.find(item => item.scenario_id === scenario.id);
  const ready = outcome.compliant && outcome.timing_problems.length === 0;
  const issues = [...outcome.compliance_issues.map(item => `${item.product}: ${item.problem}. ${item.result}.`), ...outcome.timing_problems, ...outcome.warnings];
  return <>
    <Button asChild variant="ghost" className="back-button"><a href="#overview"><ArrowLeft size={16} /> Back to overview</a></Button>
    <div className="detail-header"><div className="section-kicker">H.R. 973 / Strategy comparison</div><h1 id="page-title" tabIndex={-1}>Choose your next move.</h1><p>Compare cost with readiness. A lower expected cost can come with a larger downside.</p></div>
    <section className="recommendation-explained"><Badge variant="secondary">Recommended</Badge><h2>{optionName(data, data.recommendation)}</h2><p>{data.brief.recommendation.why}</p><div className="tradeoff"><CircleAlert size={16} /><span>{data.brief.recommendation.tradeoff}</span></div></section>
    <div className="comparison-heading"><h2>Compare the evaluated strategies</h2><span>Select a strategy to explore its outcomes</span></div>
    <Table className="strategy-table"><TableHeader><TableRow><TableHead>Strategy</TableHead><TableHead className="text-right">Expected first year</TableHead><TableHead className="text-right">Worst case</TableHead><TableHead>Ready if it passes?</TableHead></TableRow></TableHeader><TableBody>{data.results.ranking_by_expected_impact.map(id => {
      const option = data.strategies.get(id);
      return <TableRow key={id} data-state={id === route.option ? 'selected' : undefined}><TableCell><a className="strategy-link" aria-current={id === route.option ? 'true' : undefined} href={href('strategies', id, route.scenario)}>{optionName(data, option)}{id === data.recommendation.option_id && <Badge variant="secondary">Recommended</Badge>}<ChevronRight size={14} /></a></TableCell><TableCell className="text-right tabular-nums">{money(option.expected_first_year_impact)}</TableCell><TableCell className="text-right tabular-nums">{money(option.worst_case)}</TableCell><TableCell><Badge variant="outline" className={option.compliant_in_every_pass_scenario ? 'status-ready' : 'status-risk'}>{option.compliant_in_every_pass_scenario ? 'Ready' : 'Timing or compliance risk'}</Badge></TableCell></TableRow>;
    })}</TableBody></Table>
    <p className="table-explanation">Expected first year = profit change weighted across scenarios. Worst case = the largest modeled first-year loss. All amounts are relative to the current business, in USD.</p>
    <section className="scenario-section" aria-labelledby="scenario-heading"><div className="scenario-heading"><div><span className="section-kicker">Selected strategy</span><h2 id="scenario-heading">{optionName(data, selected)}</h2><p>{selected.description}</p></div><div className="scenario-control"><label htmlFor="scenario">What if…</label><Select value={route.scenario} onValueChange={value => { location.hash = href('strategies', route.option, value); }}><SelectTrigger id="scenario" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{data.results.scenarios.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div></div>
      <p className="scenario-probability">{percent(scenario.probability)} overall scenario probability · {scenario.months_until_rule_applies === null ? 'No rule takes effect' : `Rule applies in ${scenario.months_until_rule_applies} months (assumption)`}</p>
      <div className="outcome-summary" aria-live="polite"><div><span>Annual gross profit change</span><strong>{money(outcome.annual_profit_change)}</strong><small>Once the rule applies</small></div><div><span>One-time costs</span><strong>{money(outcome.one_time_total)}</strong><small>Includes sales lost while fixes finish</small></div><div><span>First-year profit change</span><strong>{money(outcome.first_year_impact)}</strong><small>For this scenario only</small></div></div>
      <div className="outcome-status"><Badge variant="outline" className={ready ? 'status-ready' : 'status-risk'}>{ready ? (scenario.months_until_rule_applies === null ? 'No new deadline' : 'Ready by deadline') : 'Not ready by deadline'}</Badge><Badge variant="outline" className={outcome.feasible ? 'status-ready' : 'status-risk'}>{outcome.feasible ? 'Within supplier capacity' : 'Supplier capacity issue'}</Badge><span>Gross margin: {percent(outcome.gross_margin_after)}</span></div>
      {issues.length > 0 && <div className="outcome-warning"><CircleAlert size={18} /><div><strong>What needs attention</strong><Bullets items={issues} /></div></div>}
      <Accordion type="multiple"><Disclosure value="breakdown" title="Cost breakdown & affected products"><div className="breakdown-grid"><section><h3>One-time costs</h3>{outcome.one_time_costs.length ? <dl>{outcome.one_time_costs.map((cost, i) => <div className="cost-row" key={i}><dt>{cost.item}</dt><dd>{money(cost.amount)}</dd></div>)}</dl> : <p>No one-time costs in this scenario.</p>}</section><section><h3>Product outcomes</h3><Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Annual units</TableHead><TableHead>Gross profit</TableHead></TableRow></TableHeader><TableBody>{outcome.products_after.map(product => <TableRow key={product.id}><TableCell>{product.name}</TableCell><TableCell>{product.units.toLocaleString('en-US')}</TableCell><TableCell>{money(product.gross_profit)}</TableCell></TableRow>)}</TableBody></Table></section></div><h3>Changes applied</h3><Bullets items={outcome.changes_applied} /></Disclosure></Accordion>
    </section>
    <section className="next-steps"><h2>What to do next</h2><ol>{data.brief.next_steps.map((step, i) => <li key={i}><span className="step-number">{i + 1}</span><span>{step.step}<small>{step.who} · {step.by_when}</small></span></li>)}</ol></section>
    <Accordion type="multiple"><Disclosure value="reconsider" title="When to change the recommendation"><Bullets items={data.brief.recommendation.switch_if} /></Disclosure><Disclosure value="assumptions" title="Assumptions & calculation limits"><Bullets items={data.brief.assumptions_to_verify} /><Bullets items={data.results.method_notes} /><p>Stored scenario probabilities are rounded and may not add up to exactly 100%.</p></Disclosure><Disclosure value="sources" title="Sources & numeric traceability"><Sources data={data} /></Disclosure></Accordion>
  </>;
}
function Analysis({ data }) {
  const [route, setRoute] = useState(() => readRoute(data));
  const previousPage = useRef(route.page);
  useEffect(() => {
    const update = () => setRoute(readRoute(data));
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, [data]);
  useEffect(() => {
    document.title = `${route.page === 'strategies' ? 'Strategies' : 'H.R. 973'} · VoltRide · Policy desk`;
    if (previousPage.current !== route.page) {
      document.getElementById('page-title')?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    previousPage.current = route.page;
  }, [route]);
  return <><div className="analysis-meta"><span>VoltRide <ChevronRight size={12} /> Bill analysis</span><span><Badge variant="outline">Sample analysis</Badge><span>As of {date(data.results.as_of)}</span></span></div>{route.page === 'overview' ? <Overview data={data} route={route} /> : <Strategies data={data} route={route} />}</>;
}
export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch('/snapshot.json', { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error(`Saved analysis unavailable (HTTP ${response.status}).`);
      return response.json();
    }).then(raw => setData(prepareSnapshot(raw))).catch(error => { if (error.name !== 'AbortError') setError(error.message); });
    return () => controller.abort();
  }, [attempt]);
  return <div className="app"><a href="#main" className="skip-link">Skip to analysis</a><header className="app-header"><div className="header-inner"><a href="#overview" className="brand"><span className="brand-icon"><Leaf size={19} /></span>policy desk<span className="brand-dot">.</span></a><span className="header-description">Policy into perspective</span><span className="company-label"><span>V</span>VoltRide</span></div></header><main id="main">{error ? <section role="alert" className="load-state"><CircleAlert /><h1>We couldn’t load the analysis.</h1><p>{error}</p><Button onClick={() => setAttempt(attempt + 1)}>Try again</Button></section> : data ? <Analysis data={data} /> : <div className="load-state" role="status" aria-label="Loading saved analysis"><Skeleton className="h-6 w-48 mb-8" /><Skeleton className="h-24 w-3/4 mb-8" /><Skeleton className="h-48 w-full" /><p>Loading the saved VoltRide analysis…</p></div>}</main><footer><span>Fictional company · Saved sample, not live bill data</span><span>Strategic analysis, not legal advice.</span></footer></div>;
}

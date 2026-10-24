# Council verification

The implementation is present on `codex/agent-council`. The dev server serves the Consul panel. Live deliberation is blocked by missing `FACTORY_API_KEY` in the ignored local environment file.

| Component | Function or file exercised | Observed behavior or remaining check | Method |
| --- | --- | --- | --- |
| Dependencies and types | `web/package.json`, `web/src/lib/council*.ts`, `CouncilPanel.tsx` | Frozen installation and TypeScript complete successfully. | `pnpm install --frozen-lockfile`, `pnpm exec tsc --noEmit`. |
| Source resolution | `resolveCouncilSources` | A real CREAO `bill-analysis.json` download was saved with the current profile and an unidentified-company warning. The coherent saved VoltRide packet yielded six source records including its profile. | Actual local API submission with the Factory key absent. No SDK turns occurred. |
| Company assignment | `resolveCouncilSources`, `councilCompanyMatch` | Harbor Goods cannot attach the saved VoltRide packet. Supplier mentions do not establish document ownership. Conflicting subject companies are rejected. | Actual HTTP request for sample mismatch and direct production-function input probes for subject matching. |
| Numeric support | `validateCouncilClaims` | A claim about `25%` cannot use a literal `125%` excerpt as support. Unsupported ordinals and scientific notation are rejected. Matching exact quoted tokens are accepted. | Direct production-function input probes. No test file or assertion suite was added. |
| Job recovery | `submitCouncil`, `readCouncilJob` | Replaying the same no-key submission reads the original failed record. Changing its question returns HTTP 409. Saved sources remain inspectable and no decision is fabricated. | Actual POST, GET, replay POST and conflicting POST. |
| Local gate | `api/council/route.ts` | Same-machine setup read succeeds. Cross-site Origin with fetch-site headers returns HTTP 403. | Actual HTTP requests. Production/off-flag paths were inspected, not executed in a second server. |
| Browser | `CouncilPanel`, `App`, `Workspace` | Harbor Goods opens Consul with its own data and no VoltRide sample. Real CREAO source choices appear. Editing a product price remounts the council and updates its context. Escape closes the panel and focuses Consul. | In-app browser interaction. The temporary price edit was restored by reloading the unsaved demo. |
| Responsive layout | `council-panel.css` | The phone view places the question before the evidence rail. The bottom navigation remains accessible. No room buttons show behind the council. | Screenshots at the normal browser size and a temporary phone viewport, then viewport reset. |
| Factory runtime | `councilExecutable`, `councilReadiness` | Official native CLI version is 0.249.0. Missing-key readiness is explicit and the Run button is disabled. | Native CLI version and actual setup API read. |
| Live council | `runCouncilRole` and completed `CouncilPanel` | Pending. Observe four real roles, inspect generated citations and decision, then reload and confirm no second execution. | Add the Factory key locally, restart the dev server, select a question and evidence, and convene once. |

No new tests were created, modified or run. No Factory generation was performed. Code inspection and an independent review cover the disabled-tool sequence and local runner ownership; they do not replace the pending live run.

## Review corrections

The independent review found two defects before handoff. Numeric checks used substring matching, and recursive company matching treated supplier names as document owners. Both were changed in the production validators and exercised with the reported concrete inputs. A targeted follow-up found that ordinal and scientific notation tokens escaped the numeric pattern. Their unsupported and supported forms were also exercised after correction. Blank company identity fields now remain unidentified, and non-Latin company names retain their letters during comparison.

## Attention

Reviewed by gpt-6.1-sol.

Live Factory generation remains unverified. The key is absent, even though the browser is signed in to Factory. The product's setup message and this record preserve that distinction. The audit covers this request and its tool results in the current chat, not unrelated chats.

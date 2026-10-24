# Consul council work

The user asked for a new branch and a working Consul menu where a council of AI agents discusses CREAO evidence and recommends a decision for the active company. Factory's SDK must perform the discussion in the running product. Figma supplies the editable design concept.

## Completion check

Open Consul for a company, select evidence or use that company's setup, ask a question, and explicitly convene the council. Observe actual Finance, Operations, Skeptic, and Chair outputs. Inspect their citations and final decision. Reload without dispatching again. Switch company or change its data without displaying the old recommendation as current.

Live generation requires a local Factory API key. Missing credentials must leave the evidence desk usable and explain that generation is unavailable. Saved sample evidence and live council statements must remain distinguishable.

## Workflow

- [x] Read Bean Mode principles and frame the user journey.
- [x] Ground Workspace, CREAO reads, local job storage, and the disabled Consul navigation.
- [x] Verify the Factory SDK and Cal Hacks track requirements.
- [x] Compare two structural designs and obtain an independent review.
- [x] Create and inspect the editable Figma concept.
- [x] Implement the source resolver and four-role SDK coordinator.
- [x] Implement the Consul evidence desk and company freshness handling.
- [x] Inspect the assembled diff and exercise the available local application paths.
- [x] Record verification limits and remaining setup.
- [ ] Run and inspect a complete live Factory council after the local key is configured.

The completion check remains unverified for live generation. Source resolution, rejected source assignment, request replay/conflict behavior, runtime setup, TypeScript, and the available browser interactions were observed. Four live SDK turns, generated citations, the completed decision layout, and recovery of an actual billed run were not exercised because no Factory API key is configured.

## Verification record

See `council-verification.md` for observed results and the compact follow-up checks. Model the Domain shaped the typed source, turn and job contracts. Prove It Works kept the live council outcome explicitly pending instead of treating TypeScript or the designed screen as proof of generation.

## Design decision

Use a serial discussion. Finance opens, Operations responds, Skeptic challenges both, and Chair synthesizes a decision. Each role runs through the Factory SDK. This makes disagreement visible without inventing a conversation in one response.

Use existing app-scoped CREAO runs and artifact downloads. Their history is global to each configured agent, so users explicitly select and assign evidence to the active company. A selection does not prove relevance. Structured company mismatches are rejected, and the council can conclude that evidence is insufficient. Browser-only CREAO chat archives are outside the verified API.

Use a separate local council ledger. Reserve the request ID before generation and never automatically resume an interrupted or uncertain billed run. Persist the browser's request ID before submission. A full company snapshot key prevents stale results from appearing after edits. It is not an authorization boundary. Keep the existing development, opt-in, loopback and same-origin gates.

## Throughput checkpoint

- Blocking first steps. Verify SDK shape, source access and company context before implementation.
- Independent workstreams. Backend owns council types, source resolution, execution, API and CLI. Frontend owns the panel, CSS and Workspace/App integration. Parent owns runtime dependencies, configuration, Figma and assembled verification.
- Shared mutable state. Publish the shared types first. No workers edit the same files. Parent handles package installation and server lifecycle.
- Smallest safe decomposition. Two implementation owners match the API seam. No new queue, database, account-wide CREAO connector, production authentication or scheduled execution.

## Evidence

- [Factory TypeScript SDK](https://docs.factory.com/sdk/typescript).
- Cal Hacks 13.0 Hacker Guide, Factory track. Read from the user's open Google Docs tab.
- [Figma council concept](https://www.figma.com/design/mD2dLj2EvZDrdfv6wpAfLK?node-id=7-9).
- Design candidates and independent rubric review are recorded in this chat. Candidate A was selected. Candidate B's browser request-ID recovery was retained; its new account-wide CREAO connector was rejected as unnecessary.
- Baseline. Consul was disabled in `web/src/components/business/App.tsx`. The updated Harbor Goods route returned HTTP 200 before implementation. No council backend existed.

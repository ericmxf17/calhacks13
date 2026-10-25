# Active Council security and correctness review

**Status: ISSUES** — concrete renderer, provenance, research-address, and recovery issues remain. The preview self-navigation mitigation is plausible by CSP policy inheritance, but real-browser verification was blocked by the browser URL safety gate.

## Issues

1. **Finite chart values can overflow the displayed range.** [CouncilArtifact.tsx:19](../../web/src/components/business/CouncilArtifact.tsx#L19) computes `high - low` directly. `publish_visual` accepts any finite number ([council-tools.ts](../../web/src/lib/council-tools.ts)), so values such as `-1e308` and `1e308` yield an infinite span; every plotted point then collapses to the baseline. Normalize by the largest absolute value before computing the ratio, or reject values whose span is not finite.

2. **Research artifacts are mislabeled as illustrative.** [CouncilArtifact.tsx:71](../../web/src/components/business/CouncilArtifact.tsx#L71) displays “No source evidence · illustrative output” whenever `sourceIds` is empty. `research_url` intentionally creates a non-illustrative research artifact with no input `sourceIds`, while storing the fetched page as tool evidence ([council-tools.ts](../../web/src/lib/council-tools.ts)). This tells the reader that retrieved research is illustrative and hides its own evidence identity. Render provenance according to `kind` and `illustrative`, and expose the research evidence ID.

3. **Public IPv6 research targets are rejected.** [council-web.ts:15](../../web/src/lib/council-web.ts) rejects all `2001:` addresses. This includes globally reachable addresses such as Google Public DNS `2001:4860:4860::8888` ([Google Public DNS docs](https://developers.google.com/speed/public-dns/docs/using)). Since line 25 rejects the hostname if any DNS answer is classified non-public, public dual-stack sites with such AAAA records cannot be researched. Exclude only special-purpose IPv6 ranges instead of the whole `2001::/16` prefix.

4. **A failed snapshot write poisons the in-memory commit queue.** [council.ts:42-45](../../web/src/lib/council.ts#L42) chains from `previous.then(...)`; after any commit rejects, later commits for that `SavedJob` skip their mutation and save entirely. A transient filesystem error can therefore prevent later recovery writes, including marking the job interrupted. Recover the chain for the next commit while still returning each commit’s own error to its caller.

## Preview isolation

`CouncilArtifact.tsx:66` uses `sandbox="allow-scripts"`, omits same-origin and popup/top-navigation privileges, and puts a restrictive meta CSP in the `srcdoc`. The embedded `navigate-to 'none'` is not a CSP Level 3 directive; sandboxing alone permits the frame to navigate itself. The added parent response policy `frame-src 'none'; object-src 'none'` is the right boundary to check: CSP3 defines `frame-src` for URLs loaded into child navigables, and `srcdoc` inherits the creator’s CSP policy ([CSP3 frame-src](https://www.w3.org/TR/CSP/#directive-frame-src), [CSP3 navigation checks](https://www.w3.org/TR/CSP/#should-navigation-request-be-blocked-by-content-security-policy), [local-scheme policy inheritance](https://www.w3.org/TR/CSP/#csp-inheriting-to-avoid-bypasses)). The only iframe found in the app is this Council artifact preview.

**Browser check blocked:** I attempted to load a minimal `data:` probe page to verify self-navigation and initial `srcdoc` rendering under `frame-src 'none'`. The browser URL policy rejected `data:` and explicitly prohibited alternate surfaces or workarounds. I did not retry through another surface. Thus the response policy’s real-browser behavior and preview rendering under it remain unverified.

## Checks and limits

- Read the changed renderer, panel, tool definitions, Droid runner, research reader, compute worker, Council ledger, route handlers, and Next response headers.
- Confirmed statically that inherited tool evidence is included in continuation history, tool results are awaited through the ledger commit callback, and tool writes are serialized per saved job.
- Confirmed static QuickJS boundary: separate child process, bounded input/output, memory, stack and runtime limits; no host callbacks or module loader; deterministic `Date` and `Math.random` disabled; non-finite results rejected.
- Confirmed Droid tool authorization fails closed around the dedicated MCP server and tool identities before sending the role prompt.
- No model generation, code edits outside this audit file, or repository tests/builds were run.

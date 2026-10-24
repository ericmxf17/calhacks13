# Council chat verification

The form layout has been replaced with a conversation, named roster, compact
shared context and a persistent composer. The Chair's decision is part of the
message history. Real model generation and successful follow-ups remain
unverified because the local Factory key is absent.

| Component | File or function | Observed behavior | Verification |
| --- | --- | --- | --- |
| Chat layout | `CouncilPanel`, `council-panel.css` | Latest-message view contains the compact Chair decision and composer; reasoning and evidence expand on demand. | Development preview in the browser at desktop, medium and phone widths. |
| Active role | `CouncilPanel` | The illustrative active preview highlights Skeptic and names its public focus. Live empty chat shows no fabricated activity. | `/demo/council?stage=skeptic` and the real Harbor Goods workspace. |
| Context | `CouncilPanel` | A cited source opens its actual preview excerpt. Closing phone context restores focus to its trigger. Escape closes context while retaining the council view. | Browser interaction and accessibility state. |
| Camera | `CameraRig`, `App` | Consul enters the transition state with the panel absent, then shows the chat after settlement. Rapid Home/Consul/Agents requests settle on the final Agents view without mounting the council. Chrome renders the real 3D building. | Browser navigation and DOM view/settlement attributes. Reduced-motion and renderer fallback branches were inspected in source. |
| Saved threads | `readCouncilThread` | A legacy saved root is normalized to round one with its saved evidence. | Actual HTTP and CLI thread reads. |
| Recovery and limits | `submitCouncil` | Same-payload replay returns its existing record; changed payload conflicts; failed or missing parents and changed follow-up sources are rejected. Cross-site thread reads are forbidden. | Actual local HTTP requests against existing no-key records. No completed records were fabricated. |
| Dependencies and types | `package.json`, added components | Frozen installation and TypeScript pass. Vercel primitives are used in the production renderer with source attribution and license. | Package installation, typecheck and source inspection. |
| Live generation | `runCouncilRole` | Pending. Four actual roles and a successful same-evidence follow-up need a configured Factory key. | Proposed final check through the real company chat. |

No tests were created, modified or run. The preview is a development instrument,
clearly labeled as illustrative, and skips provider calls and storage effects.
It verifies rendering and interaction, not Factory output quality.

## Review corrections

An independent review found that switching source agents retained the old page
offset, and that closing the mobile context could leave focus on a hidden
button. The resets and shared close-and-focus handler were restored. Browser
checks verified the focus behavior. The pagination reset was inspected in code.

Browser inspection also prompted a shorter default Chair card, expanded details
for the full argument, and visible agent names in the medium-width rail.
The final review also identified an unclassified invalid-parent-chain rejection.
Its pre-dispatch error now restores the prior conversation instead of retaining
an unaccepted pending request. Ambiguous dispatch and request-ID conflicts still
retain their original identity.

## Attention

Reviewed by gpt-6.1-sol.

- Live Factory generation and successful multi-round recovery are still pending.
- The Figma Starter-plan tool limit blocked composition of the new chat frame
  after its wrapper was created. The new editable Figma frame is unfinished.
  The working browser previews and app are the checked visual artifacts.
- The audit covers this request and its tool results in this chat. It does not
  claim verification of production account authentication or deployment.

## Theme consistency correction

The user rejected the first chat treatment because it looked separate from
Consul. The revised renderer uses the existing sky and cream palette, navy
outlines, eight-pixel corners, block shadows, blue controls and shared character
SVGs. Council role labels distinguish those illustrations from CREAO agent runs.
Static artwork does not signal a running role.

Compared the actual Agents and council views in the browser. Checked completed
and active illustrative conversations at 1200 by 850 and 390 by 844. The real
Harbor Goods phone view has a 390-pixel document width, its panel begins sixteen
pixels below the header, and its composer remains inside the panel above the
navigation. Closing the phone context with Escape restores focus to Context &
sources. TypeScript and the whitespace diff check pass after the revision.

The council top inset now follows `--world-header-height` at every breakpoint.
This fixes the near-overlap with Business settings seen during the live check.
The existing camera-settlement behavior is unchanged. No new Factory run or
Figma composition was claimed during this visual correction.

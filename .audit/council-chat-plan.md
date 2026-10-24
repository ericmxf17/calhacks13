# Council conversation redesign

The user asked to replace the form-and-card layout with chat history, named agents and active focus on the left, shared context at the upper right, and a bottom composer. The Chair closes each round with a synthesis and structured decision in the conversation. The user also required the Home-to-Consul interaction to use the existing camera-transition style.

## Completion check

Consul opens through a camera swing before revealing the chat. The composer remains visible while messages scroll. Company context and selected artifact excerpts are inspectable. A saved thread contains user questions, public role contributions and the Chair decision. Follow-ups receive server-loaded prior rounds and retain the same evidence snapshot. Reload reads the selected thread without dispatching another run.

Actual live generation still requires the missing local Factory key. The development-only filled-state preview must be labeled as an illustrative design preview and perform no provider calls.

## Workflow and ownership

- [x] Inspect the current browser and identify the oversized heading/form as the main layout issue.
- [x] Build two scratch prototypes without creating worktrees.
- [x] Compare both in the browser and obtain an independent design review.
- [x] Verify Vercel AI Elements sources and select the needed conversation/message primitives.
- [x] Ground and compare two backend designs for follow-ups.
- [x] Implement the chosen conversation layout and inspect desktop and phone states.
- [x] Verify camera navigation and reversals; inspect renderer fallback and reduced-motion handling.
- [x] Verify saved-thread reads and rejected continuation requests through HTTP.
- [x] Review the integrated change and record limitations.
- [ ] Verify a complete live Factory conversation and successful follow-up after the key is configured.
- [ ] Complete the new editable Figma frame when tool access is available.

The browser prototypes are throwaway instruments in the system temporary directory. Prototype B supplies the wider conversation canvas and fixed composer. Prototype A supplies the named roster and public role order. The user subsequently rejected the prototypes' visual styling because it did not match the rest of Consul. Keep the interaction structure and use the existing Home and Agents theme for the final visual treatment.

- [x] Match the running Home and Agents views: sky backdrop, cream surfaces, navy outlines, block shadows, blue controls and existing character artwork.
- [x] Inspect the revised live view and filled-state preview at desktop and phone widths.

Backend work owns the existing council types, ledger, role runner, API, CLI and backend guide. Frontend work owns the chat panel, style sheet, retained Vercel primitives and development preview. Camera work owns App, BusinessScene and the transition style sheet. These are separate file sets in the same checkout.

## Decisions

Use immutable linked rounds with a server-validated parent. The root evidence snapshots stay fixed through follow-ups, so citation IDs retain their meaning. Different evidence or an edited company starts a new conversation. The selected leaf identifies a branch; the model does not impose one global head across tabs.

Use Vercel's Conversation and Message primitives, adapted from the official registry and styled to the current Consul theme. The full upload/model-picker composer is unnecessary for this interaction; the product composer sends to the existing Factory API. Source attribution and license remain with the retained components.

Keep camera navigation in the existing view state. Consul is a real camera destination, opposite Agents. Mount the conversation after settlement and then reveal it. Reduced motion skips animation, and a no-WebGL fallback must still reach the interface.

Figma inspection confirmed the existing theme tokens. A new frame was created, but the Starter-plan MCP tool limit prevented its composition. Do not present that blank frame as a completed design. Continue with the working browser prototypes and record the Figma limitation.

## References

- [Vercel Conversation](https://elements.ai-sdk.dev/components/conversation).
- [Vercel Message](https://elements.ai-sdk.dev/components/message).
- [Vercel Prompt Input](https://elements.ai-sdk.dev/components/prompt-input).
- The current browser and the two prototype screenshots in this chat.

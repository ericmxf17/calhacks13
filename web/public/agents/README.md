# Agent avatars

Created in [GrokBots Studio](https://grokbots.ai/studio).
The SVGs preserve the studio's rendered vector artwork with its background
color variable resolved for standalone use. No remote resources are required.

| File | Shape | Color | Face |
|---|---|---|---|
| bill-analyst.svg | Squircle | Amber | Attentive |
| researcher.svg | Pebble | Purple | Curious |
| impact-planner.svg | Hexagon | Green | Proud |
| test-agent.svg | Circle | Blue | Happy |

The four placeholder cards reuse these assets. They represent layout examples,
not additional CREAO agents.

Each `*-animated.svg` preserves the corresponding static avatar's colors,
gradient, mask, shape, and expression. Its motion comes from GrokBots' actual
`BotEngine.sample()` in the `idle` state: body drift and breathing, eye wandering,
and the engine's scheduled blinks. Six seconds are baked into native SVG
animation, with a 0.4-second interpolation back to the first frame for a seamless
repeating loop. Body geometry is sampled at 8 frames per second; eye transforms
at 40 frames per second retain the engine's short blinks. The animation needs no
scripts, external resources, or runtime engine. The UI selects the static SVG
when reduced motion is requested.

`AgentAvatar.tsx` loads the generated local SVGs inline for mouse tracking.
Each copy gets unique mask and gradient IDs. A separate eye translation layer
follows the mouse while the SVG's blink and idle animations continue. Tracking
returns to center on pointer exit or window blur. Touch input does not drive
the eyes, and reduced-motion mode uses the static image without tracking.

The reviewed source is the public [GrokBots engine chunk](https://grokbots.ai/_next/static/chunks/05_lt5jegssjn.js),
SHA-256 `61b4eb391ad755940f175de941bd66562f413f9741f75eb50298e9c2a9fdf4b3`.
To regenerate from the repository root, save that exact reviewed chunk locally
and run:

```powershell
node web/scripts/generate-agent-avatars.mjs <path-to-reviewed-05_lt5jegssjn.js>
```

The generator rejects changed source and runs the pinned geometry module in a
bounded VM context without Node or browser APIs. Review new source before
changing its pinned hash. It reads the static SVGs as artwork templates and
writes only the four animated SVGs.

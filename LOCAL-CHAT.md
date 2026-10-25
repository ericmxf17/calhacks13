# Local live chat

This isolated checkout stays on the last working app version while the remote Sandbox integration changes the primary checkout.

Open http://127.0.0.1:3002/demo/harbor-goods and select Consul.

From the web directory, run `pnpm dev:local` to start it again. The launcher sets `COUNCIL_EXECUTION_MODE=local`, enables the existing local runner guard, and uses port 3002. Set `LOCAL_CHAT_PORT` to choose a different local port.

Provider configuration is read from ignored `web/.env`. Council history is saved in this checkout's ignored `web/.backend/council` directory. The two existing prepared discussions were copied into this local ledger. This local process does not depend on SpacetimeDB being reachable.

The actual configured seats are Finance GPT-6.1 Sol, Operations Gemini 3.8 Flash, Skeptic Grok 4.7, and Chair Opus 5.5. Live sends use Factory credits.

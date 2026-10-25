# Council snapshot archive

This module stores full Council snapshots in private tables. Only the identity that first publishes the database can call `save_council_snapshot`; only the database owner can query the private table through HTTP SQL. The Next server holds that token and checks each caller's user or curated demo scope before calling the adapter. Never place the token in a `NEXT_PUBLIC_` variable or connect the browser directly to this database.

The archive preserves saved state across deployments. Council execution and session ownership remain the responsibility of the execution host.

## Build and publish

Install the [official SpacetimeDB CLI](https://spacetimedb.com/install) and Node 24, then run from the repository root:

```powershell
npm ci --prefix spacetimedb
spacetime build --module-path spacetimedb
spacetime login
spacetime publish <your-unique-database-name> --module-path spacetimedb --server maincloud --delete-data=never
```

Publication changes the hosted database and should be done by its owner. Use the same publisher identity on later updates. Keep `--delete-data=never`; existing snapshots do not need a destructive reset.

Set these server environment variables in the execution host and Vercel:

```dotenv
SPACETIMEDB_URL=https://maincloud.spacetimedb.com
SPACETIMEDB_DATABASE=<your-unique-database-name>
SPACETIMEDB_TOKEN=<publisher-login-token>
```

The publisher token is the CLI login token in its private `cli.toml` configuration. Transfer it directly into the hosting secret manager; do not paste it into chat, logs or source. The CLI's `login show` prints identity information without the token by default. Store tokens separately for different environments.

## Server adapter

`web/src/lib/council-store.ts` exports:

| Function | Contract |
| --- | --- |
| `saveCouncilSnapshot(owner, saved)` | Save `{job, requestHash, sessions}` atomically. Same revision and JSON is an idempotent retry. |
| `readCouncilSnapshot(owner, id)` | Full saved snapshot, or `null` when no matching owner and id exist. |
| `listCouncilSnapshots(owner, businessKey?)` | Full jobs for this owner, newest update first, optionally filtered by profile key. |
| `councilStoreConfigured()` | Whether all three environment variables have values. |
| `councilStoreReadiness()` | Distinguishes missing configuration from an unavailable or misconfigured archive. Checks private publisher access without reading transcripts. |

Owner scopes are server-constructed `user:<authenticated-id>` or `demo:<curated-company-id>` strings. Company keys are profile freshness identifiers, never authorization. All SQL filters include owner scope; caller values cannot select a table or column. HTTP failures throw `BackendError`, never silently fall back to apparently successful persistence.

`job.updatedAt` is the revision. Use canonical `Date.toISOString()` values strictly increasing for every changed snapshot, even when two local mutations happen in one millisecond. Owner, run id, company key, request hash and creation timestamp cannot change. An older revision, equal revision with different content, or ownership transfer is rejected. This does not coordinate execution across independent workers.

## Inspect an archive

With the three server environment variables set, run:

```powershell
node spacetimedb/scripts/inspect-archive.mjs health
node spacetimedb/scripts/inspect-archive.mjs list user:<authenticated-id>
node spacetimedb/scripts/inspect-archive.mjs read user:<authenticated-id> <run-id>
```

`read` prints the full private snapshot to your terminal. These commands use the production adapter directly and do not mutate records. `register-typescript.mjs` also allows a Node maintenance command to import the server adapter via `node --import ./spacetimedb/scripts/register-typescript.mjs <command.mjs>`.

The HTTP API is deliberately sufficient for an archive, with no browser SDK or subscription state. SpacetimeDB documents these endpoints primarily for management/debugging and notes that WebSocket SDK operations are more optimized; revisit that choice if archive traffic becomes large.

References: [HTTP SQL and reducer calls](https://spacetimedb.com/docs/http/database/), [private tables](https://spacetimedb.com/docs/tutorials/chat-app/), [init publisher identity](https://spacetimedb.com/docs/functions/reducers/lifecycle/).

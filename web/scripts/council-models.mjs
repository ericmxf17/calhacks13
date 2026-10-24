#!/usr/bin/env node
// Read the account's model catalog without starting a model generation.
// Run from web: node --env-file=.env scripts/council-models.mjs
import { listModels } from '@factory/droid-sdk/node'
import { mkdtemp, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { councilEnvironment } from '../src/lib/council-environment.mjs'

const key = process.env.FACTORY_API_KEY?.trim()
if (!key) throw new Error('Set FACTORY_API_KEY in the local environment file.')
const cwd = await mkdtemp(path.join(os.tmpdir(), 'consul-models-'))
const home = path.join(cwd, 'home')
await mkdir(home)
const env = councilEnvironment(key, home)
const redact = value => String(value).replaceAll(key, '[redacted]').slice(0, 1200)
const diagnostics = []
try {
  const models = await listModels({
    apiKey: key, execPath: process.env.DROID_EXECUTABLE, cwd, env,
    observability: { logger: { log(event) {
      diagnostics.push({ message: redact(event.message), detail: redact(JSON.stringify(event.attributes ?? event.error ?? {})) })
    } } },
  })
  console.log(JSON.stringify(models.map(model => ({
    id: model.id, name: model.displayName, multiplier: model.tokenMultiplier,
    reasoning: model.supportedReasoningEfforts, defaultReasoning: model.defaultReasoningEffort,
    disabled: model.disabled,
  })), null, 2))
} catch (error) {
  const causes = []
  for (let cause = error.cause; cause && causes.length < 4; cause = cause.cause) causes.push(redact(cause.message))
  console.error(JSON.stringify({ error: redact(error.message), causes, diagnostics: diagnostics.slice(-12) }, null, 2))
  process.exitCode = 1
}

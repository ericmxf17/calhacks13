import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { BackendError, object } from './backend'
import { createJob, readJob, refreshJob, type Job } from './jobs'
import type { BriefWriterJob } from './agent-run-types'

function publicJob(job: Job): BriefWriterJob {
  return {
    id: job.id, status: job.status, runId: job.runId ?? null,
    message: job.refreshError ? 'Status could not be refreshed. Check this saved request again.'
      : job.status === 'dispatch_unknown' || job.status === 'dispatching'
        ? 'Submission is not confirmed. Check this saved request; do not start another run.'
        : job.status === 'rejected' ? 'CREAO did not accept this run. Check the agent configuration and input pack.'
          : job.error ? 'The run reported an error. Check its details before starting another run.' : null,
  }
}

export async function submitBriefWriter(body: Record<string, unknown>) {
  const pack = object(body.briefInputs, 'Analysis pack')
  for (const field of ['names', 'bill', 'forecast', 'research', 'plan', 'impact_results']) {
    if (Object.keys(object(pack[field], field)).length === 0) {
      throw new BackendError(400, 'INVALID_INPUT', `The analysis pack needs a non-empty ${field} object.`)
    }
  }
  const serialized = JSON.stringify(pack)
  if (Buffer.byteLength(serialized) > 240 * 1024) {
    throw new BackendError(413, 'INPUT_TOO_LARGE', 'Keep the analysis pack below 240 KiB.')
  }
  // The deployed CREAO form has one text field, not six separate inputs.
  const job = await createJob({ requestId: body.requestId, agent: 'brief-writer', inputs: { brief_inputs: serialized } })
  return publicJob(job)
}

export async function readBriefWriterJob(id: string) {
  const job = await readJob(id)
  if (job.agent !== 'brief-writer') throw new BackendError(404, 'JOB_NOT_FOUND', 'This Brief Writer request was not found.')
  // Refresh reads CREAO's status; it never submits an execution request.
  return publicJob(job.runId ? await refreshJob(id) : job)
}

export async function briefWriterExample() {
  const root = path.resolve(process.env.BACKEND_REPO_ROOT || path.join(process.cwd(), '..'))
  const read = async (file: string) => JSON.parse(await readFile(path.join(root, file), 'utf8'))
  const [company, bill, forecast, research, plan, impactResults] = await Promise.all([
    read('company.json'), read('tests/agent1-hr973.json'), read('tests/hr973-forecast.json'),
    read('tests/agent2-hr973.json'), read('tests/hr973-impact-plan.json'), read('tests/hr973-impact-results.json'),
  ])
  const namesFor = (items: { id: string; name?: string }[]) => Object.fromEntries(items.map(item => [item.id, item.name || item.id]))
  return {
    example: 'Fictional VoltRide / H.R. 973 sample, using repository fixtures dated October 2026.',
    briefInputs: {
      names: { company: company.company.name, products: namesFor(company.products), suppliers: namesFor(company.suppliers) },
      company, bill, forecast, research, plan, impact_results: impactResults,
    },
  }
}

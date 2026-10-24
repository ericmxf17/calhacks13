import 'server-only'

import { BackendError } from './backend'
import { validateBusiness } from './business-input'
import { extractAgentJSON } from './agent-output'
import { agentFor } from './creao'
import { createJob, readJob, refreshJob, type Job } from './jobs'
import { profileSource, sceneProfile, type SceneProfile } from './scene-profile'
import { sceneToWire, validateSceneSpec } from './scene-spec'
import type { SceneDesignerJob } from './agent-run-types'

// Checked designs by job ID, so polling a finished job doesn't download its file again.
const designs = new Map<string, Pick<SceneDesignerJob, 'spec' | 'repairs'>>()

function publicJob(job: Job): SceneDesignerJob {
  return {
    id: job.id, status: job.status, runId: job.runId ?? null, spec: null, repairs: [], specError: null,
    message: job.refreshError ? 'Status could not be refreshed. Checking again shortly.'
      : job.status === 'dispatch_unknown' || job.status === 'dispatching'
        ? 'Submission is not confirmed. Keep checking this request; do not start another.'
        : job.status === 'rejected' ? 'CREAO did not accept this run. Check the Scene Designer configuration.'
          : job.error ? 'Scene Designer reported an error.' : null,
  }
}

/** Starts Scene Designer for a company. Only names and descriptions are sent, never prices or units. */
export async function submitSceneDesigner(body: Record<string, unknown>) {
  let profile: SceneProfile
  try {
    profile = sceneProfile(validateBusiness(body.business))
  } catch (error) {
    throw new BackendError(400, 'INVALID_INPUT', error instanceof Error ? error.message : 'Invalid business details.')
  }
  // The deployed CREAO agent has one text input.
  const job = await createJob({ requestId: body.requestId, agent: 'scene-designer', inputs: { company_profile: JSON.stringify(profile) } })
  return publicJob(job)
}

/** Reads a saved Scene Designer request. Once the run finishes, its design is checked and repaired here. */
export async function readSceneDesignerJob(id: string): Promise<SceneDesignerJob> {
  const saved = await readJob(id)
  if (saved.agent !== 'scene-designer') throw new BackendError(404, 'JOB_NOT_FOUND', 'This Scene Designer request was not found.')
  // Refresh reads CREAO's status; it never submits an execution request.
  const job = saved.runId ? await refreshJob(id) : saved
  const response = publicJob(job)
  if (job.status !== 'completed') return response
  const known = designs.get(job.id)
  if (known) return { ...response, ...known }
  try {
    const raw = await extractAgentJSON(agentFor('scene-designer'), job.runId!, job.result, { expectedFile: 'scene-spec.json', required: ['archetype', 'rooms'] })
    const check = validateSceneSpec(raw, profileSource(JSON.parse(String(job.inputs.company_profile)) as SceneProfile))
    if (check.fallback) return { ...response, repairs: check.repairs, specError: 'Scene Designer’s design could not be used.' }
    const design = { spec: sceneToWire(check.spec), repairs: check.repairs }
    designs.set(job.id, design)
    return { ...response, ...design }
  } catch (error) {
    return { ...response, specError: error instanceof BackendError ? error.message : 'Scene Designer’s design could not be read.' }
  }
}

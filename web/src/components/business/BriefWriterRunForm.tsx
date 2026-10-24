'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { BriefWriterJob } from '@/lib/agent-run-types'

const storageKey = 'consul:brief-writer:request'
const terminal = new Set(['completed', 'failed', 'cancelled', 'rejected'])
const statuses = new Set([...terminal, 'dispatching', 'dispatch_unknown', 'pending', 'running'])
const labels: Record<BriefWriterJob['status'], string> = {
  dispatching: 'Submitting', dispatch_unknown: 'Submission unconfirmed', rejected: 'Run rejected',
  pending: 'Queued', running: 'Writing brief', completed: 'Brief completed', failed: 'Run failed', cancelled: 'Run cancelled',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

async function readJobResponse(response: Response): Promise<BriefWriterJob> {
  const body: unknown = await response.json()
  if (!response.ok) {
    const message = isRecord(body) && isRecord(body.error) && typeof body.error.message === 'string'
      ? body.error.message : 'The saved request could not be checked.'
    throw new Error(message)
  }
  if (!isRecord(body) || typeof body.id !== 'string' || typeof body.status !== 'string' || !statuses.has(body.status)
    || (body.runId !== null && typeof body.runId !== 'string')
    || (body.message !== null && typeof body.message !== 'string')) throw new Error('The saved request returned an invalid response.')
  return body as BriefWriterJob
}

export default function BriefWriterRunForm({ enabled, onRunUpdate }: { enabled: boolean; onRunUpdate: (runId: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [pack, setPack] = useState('')
  const [exampleLabel, setExampleLabel] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [job, setJob] = useState<BriefWriterJob | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [exampleLoading, setExampleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkKey, setCheckKey] = useState(0)
  const lastNotification = useRef('')
  const submission = useRef<AbortController | null>(null)
  const exampleRequest = useRef<AbortController | null>(null)
  const sending = useRef(false)

  function receive(next: BriefWriterJob) {
    setJob(next)
    const notification = `${next.runId}:${next.status}`
    if (next.runId && notification !== lastNotification.current) {
      lastNotification.current = notification
      onRunUpdate(next.runId)
    }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved && /^[0-9a-f-]{36}$/i.test(saved)) { setRequestId(saved); setExpanded(true) }
    } catch { /* A new submission will explain if request recovery cannot be saved. */ }
    return () => { submission.current?.abort(); exampleRequest.current?.abort() }
  }, [])

  useEffect(() => {
    if (!requestId || submitting) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    async function check() {
      try {
        const next = await readJobResponse(await fetch(`/api/agent-runs/brief-writer/jobs/${requestId}`, {
          cache: 'no-store', signal: controller.signal,
        }))
        if (controller.signal.aborted) return
        setError(null)
        receive(next)
        if (['pending', 'running', 'dispatching'].includes(next.status) && !next.message) timer = setTimeout(check, 4000)
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Check the saved request again before submitting another run.')
      }
    }
    void check()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [requestId, submitting, checkKey, onRunUpdate])

  async function loadExample() {
    const controller = new AbortController()
    exampleRequest.current?.abort()
    exampleRequest.current = controller
    setExampleLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/agent-runs/brief-writer/example', { cache: 'no-store', signal: controller.signal })
      if (!response.ok) throw new Error('The VoltRide example could not be loaded.')
      const body = await response.json()
      if (!body.briefInputs || typeof body.example !== 'string') throw new Error('The example returned an invalid response.')
      setPack(JSON.stringify(body.briefInputs, null, 2))
      setExampleLabel(body.example)
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not load the example.')
    } finally { if (!controller.signal.aborted) setExampleLoading(false) }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (sending.current || job) return
    setError(null)
    let briefInputs: unknown
    try {
      briefInputs = JSON.parse(pack)
      if (!briefInputs || typeof briefInputs !== 'object' || Array.isArray(briefInputs)) throw new Error()
    } catch { setError('Paste a valid JSON object, or load the VoltRide example.'); return }
    const id = requestId || crypto.randomUUID()
    // Save the identity before sending. Reopening the dialog can recover the same job.
    try { localStorage.setItem(storageKey, id) }
    catch { setError('Allow local storage so this run can be recovered if the connection drops.'); return }
    const controller = new AbortController()
    submission.current = controller
    sending.current = true
    setRequestId(id)
    setSubmitting(true)
    try {
      const next = await readJobResponse(await fetch('/api/agent-runs/brief-writer/jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id, briefInputs }), signal: controller.signal,
      }))
      if (!controller.signal.aborted) receive(next)
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Submission could not be confirmed. Check the saved request before starting another run.')
    } finally {
      sending.current = false
      if (!controller.signal.aborted) setSubmitting(false)
    }
  }

  function newBrief() {
    try { localStorage.removeItem(storageKey) } catch { setError('Could not clear the saved request.'); return }
    setRequestId(null)
    setJob(null)
    setError(null)
    lastNotification.current = ''
  }

  const locked = submitting || job !== null
  return <section className="brief-writer-launcher" aria-label="Run Brief Writer">
    <div className="brief-writer-launcher-heading">
      <div><h3>Write a brief</h3><p>Run Brief Writer here to see its output and files below.</p></div>
      <button type="button" className="agent-run-primary" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
        {expanded ? 'Hide run form' : 'Run Brief Writer'}
      </button>
    </div>
    {expanded && <>
      {job && <div className="brief-writer-job" role="status">
        <strong>{labels[job.status]}</strong>
        <p>{job.message || (job.status === 'completed' ? 'The output and artifacts are ready below.' : terminal.has(job.status) ? 'Open the run details below.' : 'Checking progress automatically. You can close this dialog and return later.')}</p>
      </div>}
      {!job && <form onSubmit={event => void submit(event)}>
        <div className="brief-writer-input-heading">
          <label htmlFor="brief-writer-pack">Analysis pack (JSON)</label>
          <button type="button" className="agent-run-refresh" onClick={() => void loadExample()} disabled={locked || exampleLoading}>
            {exampleLoading ? 'Loading example…' : 'Use VoltRide example'}
          </button>
        </div>
        <p id="brief-writer-pack-hint">Include names, bill, forecast, research, plan, and impact_results.</p>
        {exampleLabel && <p className="brief-writer-example-label">{exampleLabel}</p>}
        <textarea id="brief-writer-pack" aria-describedby="brief-writer-pack-hint" value={pack}
          onChange={event => { setPack(event.target.value); setExampleLabel(null) }} disabled={locked || exampleLoading} spellCheck={false} required rows={7}/>
        <div className="brief-writer-submit"><p>Starts one CREAO run using your account credits.</p>
          <button type="submit" className="agent-run-primary" disabled={!enabled || locked || exampleLoading || !pack.trim()}>
            {submitting ? 'Starting brief…' : requestId ? 'Submit saved request' : 'Run brief'}
          </button>
        </div>
      </form>}
      {requestId && <div className="brief-writer-request">
        <p>Saved request <code>{requestId}</code></p>
        <button type="button" className="agent-run-refresh" onClick={() => setCheckKey(key => key + 1)} disabled={submitting}>Check saved request</button>
        {job && terminal.has(job.status) && <button type="button" className="agent-run-refresh" onClick={newBrief}>Write another brief</button>}
      </div>}
      {error && <p className="agent-run-error" role="alert">{error}</p>}
    </>}
  </section>
}

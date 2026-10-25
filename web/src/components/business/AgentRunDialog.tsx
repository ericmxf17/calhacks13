'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import AgentAvatar from './AgentAvatar'
import BriefWriterRunForm from './BriefWriterRunForm'
import type { AgentRunDetail, AgentRunsResponse, ArchivedAgentEvidence, ArtifactPreview, BrowserAgentRole } from '@/lib/agent-run-types'
import './agent-run-dialog.css'

type AgentRunDialogProps = {
  agent: { name: string; role: BrowserAgentRole; avatar: { still: string; animated: string } }
  reducedMotion: boolean
  onClose: () => void
}

const pageSize = 20
const runStatuses = new Set(['pending', 'running', 'completed', 'failed', 'cancelled'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function isRunDetail(value: unknown): value is AgentRunDetail {
  if (!isRecord(value) || typeof value.id !== 'string' || !runStatuses.has(String(value.status))
    || !isNullableString(value.threadId) || !isNullableString(value.createdAt)
    || !isNullableString(value.startedAt) || !isNullableString(value.completedAt)
    || !isNullableString(value.errorCode) || !isRecord(value.output)
    || !isNullableString(value.output.text) || !isNullableString(value.output.conversation)
    || !Array.isArray(value.artifacts)) return false

  return value.artifacts.every(item => isRecord(item) && Number.isInteger(item.index)
    && typeof item.title === 'string' && typeof item.mediaType === 'string'
    && typeof item.downloadUrl === 'string' && isNullableString(item.previewUrl))
}

function isRunsResponse(value: unknown): value is AgentRunsResponse {
  return isRecord(value) && isRecord(value.agent)
    && typeof value.agent.name === 'string'
    && (value.agent.connection === 'connected' || value.agent.connection === 'not_configured')
    && Array.isArray(value.runs) && value.runs.every(isRunDetail)
    && Number.isInteger(value.limit) && Number.isInteger(value.offset)
}

function formatDate(value: string | null) {
  if (!value) return 'Not reported'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Not reported'
    : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function outputText(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function statusLabel(status: AgentRunDetail['status']) {
  return status === 'running' ? 'Running' : status[0].toUpperCase() + status.slice(1)
}

function RunStatus({ status }: { status: AgentRunDetail['status'] }) {
  return <span className={`agent-run-status agent-run-status-${status}`}>
    <span aria-hidden="true" />{statusLabel(status)}
  </span>
}

function ArtifactCard({ artifact }: { artifact: AgentRunDetail['artifacts'][number] }) {
  const previewRequest = useRef<AbortController | null>(null)
  const [preview, setPreview] = useState<ArtifactPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => () => previewRequest.current?.abort(), [])

  async function loadPreview() {
    if (!artifact.previewUrl) return
    previewRequest.current?.abort()
    const controller = new AbortController()
    previewRequest.current = controller
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const response = await fetch(artifact.previewUrl, { cache: 'no-store', signal: controller.signal })
      if (!response.ok) throw new Error(`Preview unavailable (${response.status}).`)
      const body: unknown = await response.json()
      if (!isRecord(body) || typeof body.title !== 'string' || typeof body.mediaType !== 'string'
        || typeof body.content !== 'string' || typeof body.truncated !== 'boolean') {
        throw new Error('The preview returned an invalid response.')
      }
      if (controller.signal.aborted) return
      setPreview(body as ArtifactPreview)
    } catch (error) {
      if (controller.signal.aborted) return
      setPreviewError(error instanceof Error ? error.message : 'Preview unavailable. Try again.')
    } finally {
      if (!controller.signal.aborted) setPreviewLoading(false)
    }
  }

  return <article className="agent-run-artifact">
    <span className="agent-run-artifact-type">{artifact.mediaType.split('/').pop()?.toUpperCase() || 'FILE'}</span>
    <h4>{artifact.title}</h4>
    <p>{artifact.mediaType}</p>
    <div className="agent-run-artifact-actions">
      {artifact.previewUrl && <button type="button" className="agent-run-primary" onClick={() => void loadPreview()} disabled={previewLoading}>
        {previewLoading ? 'Loading preview…' : preview ? 'Refresh preview' : previewError ? 'Try preview again' : 'Preview file'}
      </button>}
      <a className="agent-run-download" href={artifact.downloadUrl} download>Download</a>
    </div>
    {previewError && <p className="agent-run-inline-error" role="alert">{previewError}</p>}
    {preview && <section className="agent-run-preview" aria-label={`Preview of ${artifact.title}`}>
      {preview.truncated && <p className="agent-run-preview-note">Preview shortened. Download the file to see the full contents.</p>}
      <pre>{preview.content}</pre>
    </section>}
  </article>
}

export default function AgentRunDialog({ agent, reducedMotion, onClose }: AgentRunDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const selectedRunRef = useRef<string | null>(null)
  const submittedRun = useRef<string | null>(null)
  const [runs, setRuns] = useState<AgentRunDetail[] | null>(null)
  const [connection, setConnection] = useState<AgentRunsResponse['agent']['connection'] | null>(null)
  const [archive, setArchive] = useState<ArchivedAgentEvidence | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AgentRunDetail | null>(null)
  const [offset, setOffset] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [listLoading, setListLoading] = useState(agent.role !== null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const showSubmittedRun = useCallback((id: string) => {
    submittedRun.current = id
    selectedRunRef.current = id
    setSelectedRunId(id)
    setOffset(0)
    setRefreshKey(key => key + 1)
  }, [])

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (!element.open) element.showModal()
    return () => {
      if (element.open) element.close()
      document.body.style.overflow = previousOverflow
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setListLoading(true)
    setListError(null)

    async function loadRuns() {
      try {
        const response = await fetch(`/api/agent-runs/${agent.role}?limit=${pageSize}&offset=${offset}`, {
          cache: 'no-store', signal: controller.signal,
        })
        if (!response.ok) throw new Error(`Run history unavailable (${response.status}).`)
        const body: unknown = await response.json()
        if (!isRunsResponse(body)) throw new Error('Run history returned an invalid response.')
        setRuns(body.runs)
        setConnection(body.agent.connection)
        setArchive(body.evidence?.mode === 'archive' ? body.evidence : null)
        const current = selectedRunRef.current
        const next = current && (body.runs.some(run => run.id === current) || (offset === 0 && current === submittedRun.current)) ? current : body.runs[0]?.id ?? null
        selectedRunRef.current = next
        setSelectedRunId(next)
      } catch (error) {
        if (controller.signal.aborted) return
        setListError(error instanceof Error ? error.message : 'Run history unavailable. Try again.')
      } finally {
        if (!controller.signal.aborted) setListLoading(false)
      }
    }

    void loadRuns()
    return () => controller.abort()
  }, [agent.role, offset, refreshKey])

  useEffect(() => {
    if (!selectedRunId) {
      setDetail(null)
      setDetailLoading(false)
      setDetailError(null)
      return
    }
    const controller = new AbortController()
    const runId = selectedRunId
    setDetailLoading(true)
    setDetailError(null)

    async function loadDetail() {
      try {
        const response = await fetch(`/api/agent-runs/${agent.role}/${encodeURIComponent(runId)}`, {
          cache: 'no-store', signal: controller.signal,
        })
        if (!response.ok) throw new Error(`Run details unavailable (${response.status}).`)
        const body: unknown = await response.json()
        if (!isRunDetail(body) || body.id !== runId) throw new Error('Run details returned an invalid response.')
        setDetail(body)
      } catch (error) {
        if (controller.signal.aborted) return
        setDetailError(error instanceof Error ? error.message : 'Run details unavailable. Try again.')
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false)
      }
    }

    void loadDetail()
    return () => controller.abort()
  }, [agent.role, selectedRunId, refreshKey])

  function selectRun(id: string) {
    selectedRunRef.current = id
    setSelectedRunId(id)
  }

  function closeFromEscape(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }

  const hasNextPage = (runs?.length ?? 0) === pageSize
  const visibleDetail = detail?.id === selectedRunId ? detail : null
  const runInProgress = visibleDetail?.status === 'pending' || visibleDetail?.status === 'running'

  return <dialog ref={dialog} className="agent-run-dialog" aria-label={`${agent.name} run history`}
    data-reduced-motion={reducedMotion || undefined}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose() }}
    onKeyDown={closeFromEscape}
    onClick={event => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
    }}>
    <header className="agent-run-header">
      <AgentAvatar stillSrc={agent.avatar.still} animatedSrc={agent.avatar.animated} reducedMotion={reducedMotion} />
      <div className="agent-run-identity"><h2>{agent.name}</h2><p>CREAO API run history, output and files</p></div>
      <span className={`agent-run-connection ${connection === 'connected' ? 'is-connected' : ''}`}>
        <span aria-hidden="true" />{archive ? 'Saved runs' : connection === 'connected' ? 'Connected' : connection === 'not_configured' ? 'Not connected' : listError ? 'Connection unavailable' : 'Checking connection'}
      </span>
      <button type="button" className="agent-run-close" aria-label="Close run history" onClick={onClose}>×</button>
    </header>

    <div className="agent-run-body">
      <aside className="agent-run-sidebar" aria-label="Recent runs">
        <h3>Recent runs</h3>
        <p className="agent-run-count">{runs ? `${runs.length} run${runs.length === 1 ? '' : 's'} on this page` : 'Run history'}</p>
        {runs?.map(run => <button type="button" key={run.id} className="agent-run-item" aria-pressed={run.id === selectedRunId}
          onClick={() => selectRun(run.id)}>
          <RunStatus status={run.status} />
          <strong>{formatDate(run.createdAt) === 'Not reported' ? 'Date not reported' : formatDate(run.createdAt)}</strong>
          <span className="agent-run-item-meta"><code>{run.id.slice(0, 8)}…</code> · {run.artifacts.length ? `${run.artifacts.length} artifact${run.artifacts.length === 1 ? '' : 's'}` : 'No artifacts'}</span>
        </button>)}
        {listLoading && !runs && <p className="agent-run-muted">Loading recent runs…</p>}
        {runs?.length === 0 && connection === 'connected' && <p className="agent-run-muted">No runs have been recorded yet.</p>}
        {runs && connection === 'connected' && <nav className="agent-run-pagination" aria-label="Run history pages">
          <button type="button" onClick={() => setOffset(Math.max(0, offset - pageSize))} disabled={offset === 0 || listLoading}>Previous</button>
          <span>Page {Math.floor(offset / pageSize) + 1}</span>
          <button type="button" onClick={() => setOffset(offset + pageSize)} disabled={!hasNextPage || listLoading}>Next</button>
        </nav>}
      </aside>

      <div className="agent-run-content">
        {archive && <p className="agent-run-muted">{archive.label}</p>}
        {agent.role === 'brief-writer' && !archive && <BriefWriterRunForm enabled={connection === 'connected'} onRunUpdate={showSubmittedRun}/>}
        <div className="agent-run-toolbar">
          <label className="agent-run-mobile-select">Select a run
            <select aria-label="Select a recent run" value={selectedRunId ?? ''} onChange={event => selectRun(event.target.value)} disabled={!runs?.length}>
              {runs?.map(run => <option key={run.id} value={run.id}>{formatDate(run.createdAt)} · {run.id.slice(0, 8)}</option>)}
            </select>
          </label>
          <button type="button" className="agent-run-refresh" onClick={() => setRefreshKey(key => key + 1)} disabled={listLoading}>
            {listLoading && runs ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {runs && connection === 'connected' && <nav className="agent-run-mobile-pagination" aria-label="Run history pages">
          <button type="button" onClick={() => setOffset(Math.max(0, offset - pageSize))} disabled={offset === 0 || listLoading}>Previous</button>
          <span>Page {Math.floor(offset / pageSize) + 1}</span>
          <button type="button" onClick={() => setOffset(offset + pageSize)} disabled={!hasNextPage || listLoading}>Next</button>
        </nav>}

        {listError && <p className="agent-run-error" role="alert">{listError} {runs && 'Showing the last loaded history.'}</p>}
        {connection === 'not_configured' && <section className="agent-run-message"><h3>Agent not connected</h3><p>{agent.name} is not configured for run history yet.</p></section>}
        {connection === null && !listError && <p className="agent-run-muted">Checking the agent connection…</p>}
        {connection === 'connected' && runs?.length === 0 && !listLoading && <section className="agent-run-message"><h3>No API runs on this page</h3><p>Runs started through the CREAO API will appear here, along with their output and artifacts. Conversations started on the CREAO website are not included.</p></section>}
        {detailError && <p className="agent-run-error" role="alert">{detailError} {visibleDetail && 'Showing the last loaded details.'}</p>}

        {visibleDetail && <>
          <section className="agent-run-detail-heading">
            <div><h3>Run details</h3><p>{formatDate(visibleDetail.createdAt)}</p></div>
            <RunStatus status={visibleDetail.status} />
          </section>
          <section className="agent-run-metadata" aria-label="Run metadata">
            <p><strong>Run ID</strong><code>{visibleDetail.id}</code></p>
            <p><strong>Started</strong><span>{formatDate(visibleDetail.startedAt)}</span></p>
            <p><strong>Finished</strong><span>{formatDate(visibleDetail.completedAt)}</span></p>
            {visibleDetail.errorCode && <p><strong>Error</strong><span>{visibleDetail.errorCode}</span></p>}
          </section>
          {detailLoading && <p className="agent-run-muted">Loading run details…</p>}
          {!detailLoading && !visibleDetail.output.conversation && !visibleDetail.output.text && <p className="agent-run-muted">This run has not returned output yet.</p>}
          <div className="agent-run-result-grid">
            <section className="agent-run-output">
              <h3>Output</h3>
              <div className="agent-run-output-card">
                {visibleDetail.output.conversation && <div><h4>Conversation</h4><pre>{visibleDetail.output.conversation}</pre></div>}
                {visibleDetail.output.text && <details><summary>Run output</summary><pre>{outputText(visibleDetail.output.text)}</pre></details>}
                {!visibleDetail.output.conversation && !visibleDetail.output.text && <p>There is no output for this run.</p>}
              </div>
            </section>
            <section className="agent-run-artifacts">
              <h3>Files <span>· {visibleDetail.artifacts.length}</span></h3>
              {visibleDetail.artifacts.map(artifact => <ArtifactCard key={`${visibleDetail.id}-${artifact.index}`} artifact={artifact} />)}
              {visibleDetail.artifacts.length === 0 && <p className="agent-run-muted">{runInProgress ? 'Files will appear here when the run returns them.' : 'No files were returned by this run.'}</p>}
              <p className="agent-run-footnote">Files belong to the selected run.</p>
            </section>
          </div>
        </>}
        {connection === 'connected' && selectedRunId && !visibleDetail && !detailError && detailLoading && <p className="agent-run-muted">Loading selected run…</p>}
      </div>
    </div>
  </dialog>
}

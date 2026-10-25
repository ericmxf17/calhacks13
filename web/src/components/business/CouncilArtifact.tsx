'use client'

import { useId, useState } from 'react'
import type { CouncilArtifact } from '@/lib/council-types'
import { Button } from '@/components/ui/button'

const colors = ['#6750a4', '#087f8c', '#2468d2', '#98598c']

// The host policy is first in the document. The opaque sandbox has no host bridge.
function previewDocument(html: string) {
  const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'"
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer"></head><body>${html}</body></html>`
}

function Chart({ artifact }: { artifact: Extract<CouncilArtifact, { kind: 'chart' }> }) {
  const values = artifact.series.flatMap((series) => series.values)
  const low = Math.min(0, ...values)
  const high = Math.max(1, ...values)
  // Normalize before subtracting: opposite finite extremes can overflow their raw range.
  const scale = Math.max(Math.abs(low), Math.abs(high))
  const normalizedLow = low / scale
  const range = high / scale - normalizedLow
  const y = (value: number) => 170 - ((value / scale - normalizedLow) / range) * 145
  const groupWidth = 520 / Math.max(artifact.labels.length, 1)
  return <>
    <svg className="council-chart" viewBox="0 0 600 220" role="img" aria-label={`${artifact.title}. Exact values in chart data below.`}>
      <line x1="50" y1={y(0)} x2="580" y2={y(0)} stroke="#526b82" />
      <text x="5" y="20">{high}{artifact.unit ? ` ${artifact.unit}` : ''}</text>
      <text x="5" y="175">{low}</text>
      {artifact.series.map((series, seriesIndex) => <g key={`${seriesIndex}:${series.label}`}>
        {artifact.chartType === 'line' && <polyline fill="none" stroke={colors[seriesIndex % colors.length]} strokeWidth="3" points={series.values.map((value, index) => `${50 + (index + .5) * groupWidth},${y(value)}`).join(' ')} />}
        {series.values.map((value, index) => artifact.chartType === 'bar'
          ? <rect key={index} x={50 + index * groupWidth + seriesIndex * groupWidth / (artifact.series.length + 1)} y={Math.min(y(value), y(0))} width={groupWidth / (artifact.series.length + 1) * .8} height={Math.abs(y(value) - y(0))} fill={colors[seriesIndex % colors.length]} />
          : <circle key={index} cx={50 + (index + .5) * groupWidth} cy={y(value)} r="4" fill={colors[seriesIndex % colors.length]} />)}
      </g>)}
      {artifact.labels.map((label, index) => <text key={`${index}:${label}`} x={50 + (index + .5) * groupWidth} y="202" textAnchor="middle">{label.length > 15 ? `${label.slice(0, 14)}…` : label}</text>)}
    </svg>
    <div className="council-chart-legend">{artifact.series.map((series, index) => <span key={`${index}:${series.label}`}><i style={{ background: colors[index % colors.length] }} />{series.label}</span>)}</div>
    <details><summary>Chart data{artifact.unit ? ` · ${artifact.unit}` : ''}</summary><DataTable columns={['Label', ...artifact.series.map((series) => series.label)]} rows={artifact.labels.map((label, index) => [label, ...artifact.series.map((series) => series.values[index] ?? null)])} /></details>
  </>
}

// A fixed grid makes cycles and disconnected nodes finite and deterministic.
function Flowchart({ artifact }: { artifact: Extract<CouncilArtifact, { kind: 'flowchart' }> }) {
  const arrowId = useId().replace(/:/g, '')
  const columns = Math.min(3, Math.max(1, artifact.nodes.length))
  const width = columns * 240 + 60
  const height = Math.ceil(artifact.nodes.length / columns) * 150 + 60
  const positions = new Map(artifact.nodes.map((node, index) => [node.id, { x: 50 + index % columns * 240, y: 40 + Math.floor(index / columns) * 150 }]))
  return <>
    <div className="council-flow-scroll"><svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${artifact.title}. Directed connections are also listed below.`}>
      <defs><marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#087f8c" /></marker></defs>
      {artifact.edges.map((edge, index) => {
        const from = positions.get(edge.from), to = positions.get(edge.to)
        if (!from || !to) return null
        const forward = to.y > from.y
        const x1 = from.x + 90, y1 = from.y + (forward ? 64 : 0)
        const x2 = to.x + 90, y2 = to.y + (forward ? 0 : 64)
        const bend = from.y === to.y ? from.y - 24 - index % 3 * 12 : (y1 + y2) / 2
        const path = edge.from === edge.to ? `M${from.x + 180} ${from.y + 20} C${from.x + 220} ${from.y - 30},${from.x + 220} ${from.y + 90},${from.x + 180} ${from.y + 44}` : `M${x1} ${y1} C${x1} ${bend},${x2} ${bend},${x2} ${y2}`
        return <g key={`${edge.from}:${edge.to}:${index}`}><path d={path} fill="none" stroke="#087f8c" strokeWidth="2" markerEnd={`url(#${arrowId})`} />{edge.label && <text x={(x1 + x2) / 2} y={bend - 5} textAnchor="middle" className="council-flow-edge-label">{edge.label.length > 28 ? `${edge.label.slice(0, 27)}…` : edge.label}</text>}</g>
      })}
      {artifact.nodes.map((node) => { const position = positions.get(node.id)!; return <g key={node.id}><rect x={position.x} y={position.y} width="180" height="64" rx="8" fill="#efeaf8" stroke="#6750a4" /><text x={position.x + 90} y={position.y + 28} textAnchor="middle" fill="#243957" fontSize="14">{[node.label.slice(0, 24), node.label.slice(24, 48)].map((line, index) => <tspan key={index} x={position.x + 90} dy={index ? 18 : 0}>{line}{index === 1 && node.label.length > 48 ? '…' : ''}</tspan>)}</text></g> })}
    </svg></div>
    <details><summary>Decision paths in text</summary><ol className="council-flow">{artifact.nodes.map((node) => <li key={node.id}><strong>{node.label}</strong>{artifact.edges.filter((edge) => edge.from === node.id).map((edge, index) => <span key={`${edge.from}:${edge.to}:${index}`}>→ {edge.label ? `${edge.label}: ` : ''}{artifact.nodes.find((target) => target.id === edge.to)?.label ?? edge.to}</span>)}</li>)}</ol></details>
  </>
}

function DataTable({ columns, rows }: { columns: string[]; rows: (string | number | null)[][] }) {
  return <div className="council-data-scroll"><table><thead><tr>{columns.map((column, index) => <th scope="col" key={`${index}:${column}`}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((value, column) => <td key={column}>{value ?? '—'}</td>)}</tr>)}</tbody></table></div>
}

export default function CouncilArtifactView({ artifact, onSource }: { artifact: CouncilArtifact; onSource: (id: string) => void }) {
  const ownEvidence = artifact.kind === 'research' || artifact.kind === 'calculation'
  const sourceIds = [...new Set([...(ownEvidence ? [artifact.id] : []), ...artifact.sourceIds])]
  const [open, setOpen] = useState(false)
  const [revision, setRevision] = useState(0)
  return <section className="council-artifact" aria-label={artifact.title}>
    <header><span className="council-artifact-kind">{artifact.illustrative ? 'Illustrative scenario' : artifact.kind === 'calculation' ? 'Computed result' : 'Source-linked output'} · {artifact.kind}</span><h3>{artifact.title}</h3></header>
    {artifact.kind === 'chart' && <Chart artifact={artifact} />}
    {artifact.kind === 'table' && <DataTable columns={artifact.columns} rows={artifact.rows} />}
    {artifact.kind === 'flowchart' && <Flowchart artifact={artifact} />}
    {artifact.kind === 'map' && <>
      <p className="council-artifact-note">Schematic geographic grid · no street map or routing</p>
      <svg className="council-map" viewBox="0 0 600 300" role="img" aria-label="Marker locations on a longitude and latitude grid. Coordinates follow below.">
        <rect width="600" height="300" fill="#e0f4f1" />
        {[-120, -60, 0, 60, 120].map((longitude) => <line key={longitude} x1={(longitude + 180) / 360 * 600} y1="0" x2={(longitude + 180) / 360 * 600} y2="300" stroke="#bdd7e7" />)}
        {[-60, -30, 0, 30, 60].map((latitude) => <line key={latitude} x1="0" y1={(90 - latitude) / 180 * 300} x2="600" y2={(90 - latitude) / 180 * 300} stroke="#bdd7e7" />)}
        {artifact.markers.map((marker, index) => <g key={`${index}:${marker.label}`}><circle cx={(marker.longitude + 180) / 360 * 600} cy={(90 - marker.latitude) / 180 * 300} r="6" fill="#6750a4" /><text x={(marker.longitude + 180) / 360 * 600 + 9} y={(90 - marker.latitude) / 180 * 300 - 9}>{index + 1}</text></g>)}
      </svg>
      <DataTable columns={['Location', 'Latitude', 'Longitude']} rows={artifact.markers.map((marker, index) => [`${index + 1}. ${marker.label}`, marker.latitude, marker.longitude])} />
    </>}
    {artifact.kind === 'html' && <>
      <p className="council-artifact-note">Interactive document · isolated from this app. External connections are blocked.</p>
      <div className="council-preview-controls"><Button onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Close preview' : 'Open preview'}</Button>{open && <Button onClick={() => setRevision(revision + 1)}>Reload preview</Button>}</div>
      {open && <iframe key={revision} title={artifact.title} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={previewDocument(artifact.html)} className="council-html-preview" />}
    </>}
    {artifact.kind === 'calculation' && <details open><summary>Computed with {artifact.engine} · inspect inputs and result</summary><h4>Inputs</h4><pre>{JSON.stringify(artifact.input, null, 2)}</pre><h4>Result</h4><pre>{JSON.stringify(artifact.result, null, 2)}</pre><details><summary>Calculation code</summary><pre>{artifact.code}</pre></details></details>}
    {artifact.kind === 'research' && <><p className="council-artifact-note">Retrieved {artifact.retrievedAt}</p><a href={artifact.url} target="_blank" rel="noreferrer">Open research source ↗</a><details><summary>Retrieved excerpt</summary><pre>{artifact.text}</pre></details></>}
    {artifact.assumptions.length > 0 && <div className="council-artifact-assumptions"><strong>Assumptions</strong><ul>{artifact.assumptions.map((assumption, index) => <li key={`${index}:${assumption}`}>{assumption}</li>)}</ul></div>}
    <footer>{sourceIds.length ? sourceIds.map((id) => <Button size="sm" key={id} onClick={() => onSource(id)} aria-label={`Inspect source ${id}`}>{id}</Button>) : <span>{artifact.illustrative ? 'No source evidence · illustrative output' : 'Generated output · not independent factual evidence'}</span>}</footer>
  </section>
}

// Export only the six reviewed completed executions, never provider-wide history.
// Run from the repository root after the audit artifact downloads are saved.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = '.audit/deployment-readiness-2026-10-25/demo-data';
const manifest = JSON.parse(await fs.readFile(`${root}/manifest.json`, 'utf8'));
const evidenceLabel = 'Archived real CREAO output • October 25, 2026 • Fictional VoltRide. Model-generated legislative claims and financial assumptions are dated evidence, not verified current law or guaranteed savings.';
const runs = [];
for (const entry of manifest.runs) {
  const source = JSON.parse(await fs.readFile(`${root}/${entry.runFile}`, 'utf8'));
  if (source.status !== 'completed' || source.id !== entry.runId) throw new Error('Only reviewed completed runs can be exported.');
  const artifacts = [];
  const contents = [];
  for (const artifact of source.artifacts) {
    // Executable implementation files are not judge-facing evidence and may carry private runtime paths.
    if (!['application/json', 'text/markdown', 'text/plain'].includes(artifact.mediaType) || /\.py$/i.test(artifact.title)) continue;
    const stem = entry.runFile.replace('-run.json', '');
    const content = await fs.readFile(`${root}/${stem}-artifact-${artifact.index}.txt`, 'utf8');
    if (/signedurl|backend_api_token|authorization\s*:\s*bearer|\/tmp\/|\/mnt\/|\/home\//i.test(content)) throw new Error(`Private content in ${artifact.title}`);
    artifacts.push(artifact);
    contents.push({ index: artifact.index, content, sha256: createHash('sha256').update(content).digest('hex') });
  }
  const { id, status, threadId, createdAt, startedAt, completedAt, errorCode, output } = source;
  const detail = { id, status, threadId, createdAt, startedAt, completedAt, errorCode, output, artifacts };
  const serialized = JSON.stringify(detail);
  if (/signedurl|backend_api_token|authorization\s*:\s*bearer|\/tmp\/|\/mnt\/|\/home\//i.test(serialized)) throw new Error(`Private output in ${id}`);
  runs.push({ role: entry.role, detail, contents });
}
const exported = { evidenceLabel, recordedAt: manifest.createdAt, runs };
await fs.writeFile('web/src/demo-data/agent-evidence.json', JSON.stringify(exported, null, 2) + '\n');
console.log(JSON.stringify({ runs: runs.length, artifacts: runs.reduce((n, run) => n + run.contents.length, 0) }));

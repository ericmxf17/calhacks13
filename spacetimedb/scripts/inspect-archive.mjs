import './register-typescript.mjs'

const { councilStoreReadiness, listCouncilSnapshots, readCouncilSnapshot } = await import('../../web/src/lib/council-store.ts')
const [command, owner, value] = process.argv.slice(2)
if (command === 'health') console.log(JSON.stringify(await councilStoreReadiness(), null, 2))
else if (command === 'list' && owner) {
  const jobs = await listCouncilSnapshots(owner, value)
  console.log(JSON.stringify(jobs.map(({ id, businessKey, question, status, createdAt, updatedAt }) => ({ id, businessKey, question, status, createdAt, updatedAt })), null, 2))
} else if (command === 'read' && owner && value) console.log(JSON.stringify(await readCouncilSnapshot(owner, value), null, 2))
else {
  console.error('Usage: node spacetimedb/scripts/inspect-archive.mjs health | list <owner> [company-key] | read <owner> <run-id>')
  process.exitCode = 1
}

// Private archive accessed only by the Next server using the publisher identity.
import { schema, table, t, SenderError } from 'spacetimedb/server'

const archiveAdmin = table({ name: 'archive_admin' }, {
  identity: t.identity().primaryKey(),
})
const councilSnapshot = table({ name: 'council_snapshot' }, {
  run_id: t.string().primaryKey(),
  owner_scope: t.string().index('btree'),
  company_key: t.string(),
  request_hash: t.string(),
  snapshot_json: t.string(),
  created_at: t.string(),
  updated_at: t.string(),
})
const spacetimedb = schema({ archiveAdmin, councilSnapshot })
export default spacetimedb

export const init = spacetimedb.init(ctx => {
  ctx.db.archiveAdmin.insert({ identity: ctx.sender })
})

export const reserve_council_snapshot = spacetimedb.reducer({
  owner_scope: t.string(), snapshot_json: t.string(), daily_limit: t.u32(), concurrent_limit: t.u32(),
}, (ctx, { owner_scope, snapshot_json, daily_limit, concurrent_limit }) => {
  if (!ctx.db.archiveAdmin.identity.find(ctx.sender)) throw new SenderError('Archive publisher identity required.')
  if (!/^user:[a-f0-9]{64}$/.test(owner_scope) || snapshot_json.length > 2 * 1024 * 1024 || daily_limit < 1 || daily_limit > 1000 || concurrent_limit < 1 || concurrent_limit > 8) throw new SenderError('Invalid council reservation.')
  const saved = JSON.parse(snapshot_json)
  const job = saved?.job
  if (saved.ownerScope !== owner_scope || !job || !/^[0-9a-f-]{36}$/.test(job.id) || !/^[a-f0-9]{16}$/.test(job.businessKey) || !/^[a-f0-9]{64}$/.test(saved.requestHash) || job.status !== 'resolving' || !Array.isArray(job.turns) || job.turns.length || !Number.isFinite(Date.parse(job.createdAt)) || job.createdAt !== job.updatedAt) throw new SenderError('Invalid initial council snapshot.')
  if (ctx.db.councilSnapshot.run_id.find(job.id)) throw new SenderError('COUNCIL_REQUEST_EXISTS')
  const now = ctx.timestamp.toDate()
  if (Math.abs(now.getTime() - Date.parse(job.createdAt)) > 60_000) throw new SenderError('Council reservation timestamp is stale.')
  const day = now.toISOString().slice(0, 10)
  let daily = 0, active = 0, ownedActive = 0
  for (const row of ctx.db.councilSnapshot.iter()) {
    if (!row.owner_scope.startsWith('user:')) continue
    if (row.created_at.startsWith(day)) daily++
    const previous = JSON.parse(row.snapshot_json).job
    if (['resolving', 'running'].includes(previous.status) && now.getTime() - Date.parse(row.updated_at) < 20 * 60_000) {
      active++
      if (row.owner_scope === owner_scope) ownedActive++
    }
  }
  if (daily >= daily_limit || active >= concurrent_limit || ownedActive) throw new SenderError('COUNCIL_RATE_LIMIT')
  ctx.db.councilSnapshot.insert({ run_id: job.id, owner_scope, company_key: job.businessKey, request_hash: saved.requestHash, snapshot_json, created_at: job.createdAt, updated_at: job.updatedAt })
})

export const save_council_snapshot = spacetimedb.reducer({
  owner_scope: t.string(),
  snapshot_json: t.string(),
}, (ctx, { owner_scope, snapshot_json }) => {
  if (!ctx.db.archiveAdmin.identity.find(ctx.sender)) throw new SenderError('Archive publisher identity required.')
  if (!/^(user|demo):[A-Za-z0-9._:@-]{1,200}$/.test(owner_scope)) throw new SenderError('Invalid archive owner scope.')
  if (snapshot_json.length > 2 * 1024 * 1024) throw new SenderError('Council snapshot exceeds 2 MiB.')
  const saved = JSON.parse(snapshot_json)
  const job = saved?.job
  if (!job || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(job.id)
    || typeof job.businessKey !== 'string' || !/^[a-f0-9]{16}$/.test(job.businessKey)
    || typeof saved.requestHash !== 'string' || !/^[a-f0-9]{64}$/.test(saved.requestHash)
    || typeof job.createdAt !== 'string' || typeof job.updatedAt !== 'string'
    || !Number.isFinite(Date.parse(job.createdAt)) || !Number.isFinite(Date.parse(job.updatedAt))
    || Date.parse(job.updatedAt) < Date.parse(job.createdAt)) throw new SenderError('Invalid council snapshot metadata.')
  if (new Date(job.createdAt).toISOString() !== job.createdAt || new Date(job.updatedAt).toISOString() !== job.updatedAt) throw new SenderError('Council snapshot timestamps must be canonical ISO UTC strings.')
  const existing = ctx.db.councilSnapshot.run_id.find(job.id)
  if (existing) {
    // A retry cannot transfer ownership, change the original request, or rewind progress.
    if (existing.owner_scope !== owner_scope || existing.request_hash !== saved.requestHash
      || existing.company_key !== job.businessKey || existing.created_at !== job.createdAt) throw new SenderError('Council snapshot identity conflict.')
    if (Date.parse(job.updatedAt) < Date.parse(existing.updated_at)) throw new SenderError('Stale council snapshot revision.')
    if (job.updatedAt === existing.updated_at) {
      if (snapshot_json === existing.snapshot_json) return
      throw new SenderError('Council snapshot revision conflict.')
    }
  }
  const row = { run_id: job.id, owner_scope, company_key: job.businessKey, request_hash: saved.requestHash, snapshot_json, created_at: job.createdAt, updated_at: job.updatedAt }
  if (existing) ctx.db.councilSnapshot.run_id.update(row)
  else ctx.db.councilSnapshot.insert(row)
})

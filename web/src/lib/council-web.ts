import 'server-only'
import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import ipaddr from 'ipaddr.js'
import { BackendError } from './backend'

// Normalize IPv4-mapped IPv6 before classifying. The maintained address table
// excludes private, loopback, link-local, reserved and transition ranges.
export function isPublicAddress(address: string): boolean {
  try { return ipaddr.process(address).range() === 'unicast' } catch { return false }
}
function bad(message: string): never { throw new BackendError(400, 'RESEARCH_URL_REJECTED', message) }
export async function readCouncilUrl(raw: string): Promise<{ url: string; text: string; retrievedAt: string }> {
  const deadline = Date.now() + 12_000
  let url = new URL(raw)
  for (let redirect = 0; redirect <= 3; redirect++) {
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) bad('Research requires a public HTTPS URL without credentials or a custom port.')
    const hostname = url.hostname.replace(/^\[|\]$/g, '')
    let dnsTimer: ReturnType<typeof setTimeout> | undefined
    const addresses = await Promise.race([lookup(hostname, { all: true }), new Promise<never>((_, reject) => { dnsTimer = setTimeout(() => reject(new Error('DNS lookup timed out')), Math.max(1, deadline - Date.now())) })]).finally(() => clearTimeout(dnsTimer))
    if (!addresses.length || addresses.some(entry => !isPublicAddress(entry.address))) bad('Research cannot access private, reserved, or local addresses.')
    const pinned = addresses[0]
    const response = await new Promise<{ status: number; location?: string; body: string }>((resolve, reject) => {
      const remaining = deadline - Date.now()
      if (remaining <= 0) return reject(new Error('Research timed out'))
      const req = request(url, { method: 'GET', agent: false, family: pinned.family, headers: { Accept: 'text/html,text/plain,application/json', 'Accept-Encoding': 'identity', 'User-Agent': 'Consul-Council/1.0' }, lookup: (_host, _options, callback) => callback(null, pinned.address, pinned.family) }, res => {
        const status = res.statusCode || 0
        if ([301, 302, 303, 307, 308].includes(status)) { res.resume(); resolve({ status, location: res.headers.location, body: '' }); return }
        if (status !== 200) { res.resume(); reject(new Error(`Research HTTP status ${status}`)); return }
        const contentType = (res.headers['content-type'] || '').split(';')[0].trim()
        if (!['text/html', 'text/plain', 'application/json'].includes(contentType) || (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity')) { res.destroy(); reject(new Error('Research supports uncompressed HTML, text, or JSON only')); return }
        const chunks: Buffer[] = []; let bytes = 0
        res.on('data', chunk => { bytes += chunk.length; if (bytes > 256 * 1024) { res.destroy(new Error('Research page exceeds 256 KiB')); return }; chunks.push(chunk) })
        res.on('error', reject)
        res.on('end', () => resolve({ status, body: Buffer.concat(chunks).toString('utf8') }))
      })
      const timer = setTimeout(() => req.destroy(new Error('Research timed out')), remaining)
      req.on('close', () => clearTimeout(timer)); req.on('error', reject); req.end()
    })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (!response.location || redirect === 3) bad('Research redirect limit reached.')
      url = new URL(response.location, url); continue
    }
    const text = response.body.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()
    if (!text) bad('The page contains no readable text.')
    return { url: url.href, text: text.slice(0, 24_000), retrievedAt: new Date().toISOString() }
  }
  return bad('Research redirect limit reached.')
}

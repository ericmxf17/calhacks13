// Generate the requested demo voiceover once, then derive captions from its alignment.
// Run from web: node --env-file=../.env.local scripts/narrate-demo.mjs
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const output = path.join(root, '.audit/deployment-readiness-2026-10-25/media/narration')
const text = `Consul helps a business turn policy research into a decision it can examine.
Here, VoltRide is a fictional e-bike company, with its products, costs, and operations in one workspace.
The Agents panel opens completed CREAO runs for bill analysis, research, planning, and a written brief. We can inspect their original output and files, rather than relying on a summary alone.
The council uses Factory to bring Finance, Operations, a Skeptic, and a Chair into the same decision. Its recommendation cites the selected evidence and keeps missing facts visible.
Deterministic Python scenarios make the assumptions and calculations inspectable. Their results are scenarios, not promises of savings.
SpacetimeDB saves the shared conversation. Reloading restores the discussion without starting another paid run.
The backend dashboards show the real services behind this walkthrough. Together, the workspace, evidence, and saved discussion give the team a concrete starting point for a decision, with uncertainty still in view.`

await mkdir(path.dirname(output), { recursive: true })
let alignment
if (process.argv.includes('--captions-only')) {
  const saved = JSON.parse(await readFile(`${output}-alignment.json`, 'utf8'))
  alignment = saved.alignment
} else {
  try {
    await access(`${output}.mp3`)
    throw new Error('Narration already exists; refusing to create another paid generation.')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (!process.env.ELEVENLABS_API_KEY)
    throw new Error('Load the project environment with --env-file=../.env.local.')
  await writeFile(`${output}.txt`, `${text}\n`)
  const client = new ElevenLabsClient()
  const response = await client.textToSpeech.convertWithTimestamps('JBFqnCBsd6RMkjVDRZzb', {
    text,
    modelId: 'eleven_v4',
    outputFormat: 'mp3_44100_128',
    voiceSettings: { stability: 0.5, similarityBoost: 0.75 },
  })
  await writeFile(`${output}.mp3`, Buffer.from(response.audioBase64, 'base64'))
  alignment = response.alignment
  await writeFile(
    `${output}-alignment.json`,
    JSON.stringify({ alignment, normalizedAlignment: response.normalizedAlignment }, null, 2),
  )
}
if (!alignment?.characters?.length)
  throw new Error('Audio saved, but the response did not include caption alignment.')

// Balance sentence chunks so captions do not leave a single trailing word on screen.
const words = [...alignment.characters.join('').matchAll(/\S+/g)].map((match) => ({
  text: match[0],
  start: alignment.characterStartTimesSeconds[match.index],
  end: alignment.characterEndTimesSeconds[match.index + match[0].length - 1],
}))
const sentences = []
let sentence = []
for (const word of words) {
  sentence.push(word)
  if (/[.!?]$/.test(word.text)) {
    sentences.push(sentence)
    sentence = []
  }
}
if (sentence.length) sentences.push(sentence)
const cues = []
for (const sentence of sentences) {
  const chunks = Math.ceil(sentence.map((word) => word.text).join(' ').length / 70)
  let start = 0
  for (let remaining = chunks; remaining > 0; remaining--) {
    const end = start + Math.ceil((sentence.length - start) / remaining)
    cues.push(sentence.slice(start, end))
    start = end
  }
}
function timestamp(seconds, separator) {
  const milliseconds = Math.round(seconds * 1000)
  const parts = [
    Math.floor(milliseconds / 3600000),
    Math.floor(milliseconds / 60000) % 60,
    Math.floor(milliseconds / 1000) % 60,
  ]
  return (
    parts.map((value) => String(value).padStart(2, '0')).join(':') +
    separator +
    String(milliseconds % 1000).padStart(3, '0')
  )
}
function lines(words) {
  const text = words.map((word) => word.text).join(' ')
  if (text.length <= 40) return text
  let split = 1
  let difference = Infinity
  for (let index = 1; index < words.length; index++) {
    const left = words
      .slice(0, index)
      .map((word) => word.text)
      .join(' ')
    const right = words
      .slice(index)
      .map((word) => word.text)
      .join(' ')
    if (Math.abs(left.length - right.length) < difference) {
      difference = Math.abs(left.length - right.length)
      split = index
    }
  }
  return [words.slice(0, split), words.slice(split)]
    .map((line) => line.map((word) => word.text).join(' '))
    .join('\n')
}
function captions(separator) {
  return cues
    .map(
      (words, index) =>
        `${index + 1}\n${timestamp(words[0].start, separator)} --> ${timestamp(words.at(-1).end, separator)}\n${lines(words)}\n`,
    )
    .join('\n')
}
await writeFile(`${output}.srt`, captions(','))
await writeFile(`${output}.vtt`, `WEBVTT\n\n${captions('.')}`)
await writeFile(
  `${output}-timings.json`,
  JSON.stringify(
    cues.map((words) => ({
      start: words[0].start,
      end: words.at(-1).end,
      text: words.map((word) => word.text).join(' '),
    })),
    null,
    2,
  ),
)
console.log(
  JSON.stringify({
    output,
    words: text.split(/\s+/).length,
    durationSeconds: words.at(-1).end,
    cues: cues.length,
    voice: 'George',
    model: 'eleven_v4',
  }),
)

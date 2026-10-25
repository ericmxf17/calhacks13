// Capture only the developer-owned local app in a fresh, isolated Chrome profile.
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
const args = process.argv.slice(2)
const option = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback
const url = new URL(option('--url', 'http://127.0.0.1:3001/demo/voltride'))
if (!['localhost', '127.0.0.1'].includes(url.hostname))
  throw new Error('Capture a local development app only.')
const output = path.resolve(
  option('--out', '.audit/deployment-readiness-2026-10-25/media'),
)
const profile = await mkdtemp(path.join(tmpdir(), 'consul-capture-'))
await mkdir(output, { recursive: true })
class DevTools {
  pending = new Map()
  listeners = new Map()
  sequence = 0
  constructor(socket) {
    this.socket = socket
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id) {
        const pending = this.pending.get(message.id)
        if (!pending) return
        this.pending.delete(message.id)
        message.error
          ? pending.reject(new Error(message.error.message))
          : pending.resolve(message.result)
      } else {
        for (const listener of this.listeners.get(message.method) || [])
          listener(message.params)
      }
    })
    socket.addEventListener('close', () => {
      for (const pending of this.pending.values())
        pending.reject(new Error('DevTools disconnected'))
      this.pending.clear()
    })
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.sequence
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`DevTools timeout for ${method}`))
      }, 30000)
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
      })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }
  on(method, listener) {
    const listeners = this.listeners.get(method) || []
    listeners.push(listener)
    this.listeners.set(method, listeners)
    return () =>
      this.listeners.set(
        method,
        listeners.filter((value) => value !== listener),
      )
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text,
      )
    return result.result.value
  }
  async wait(expression) {
    for (let attempt = 0; attempt < 300; attempt++) {
      if (await this.evaluate(expression)) return
      await sleep(100)
    }
    const state = await this.evaluate(
      `({url:location.href,title:document.title,text:document.body.innerText.slice(0,2000),errors:window.__consulPerf?.errors})`,
    )
    throw new Error(
      `Page did not reach ${expression}\n${JSON.stringify(state)}`,
    )
  }
}

const child = spawn(
  option('--chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'),
  [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--window-size=1920,1080',
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
)
let dev
let recording = false
let recordingTask
try {
  let port
  for (let n = 0; n < 100; n++) {
    try {
      port = Number(
        (
          await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')
        ).split('\n')[0],
      )
      break
    } catch {
      await sleep(100)
    }
  }
  if (!port) throw new Error('Chrome did not start')
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) =>
    r.json(),
  )
  const socket = new WebSocket(
    targets.find((t) => t.type === 'page').webSocketDebuggerUrl,
  )
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  dev = new DevTools(socket)
  await dev.send('Page.enable')
  await dev.send('Runtime.enable')
  await dev.send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  })
  // Chrome can stall if two screenshot requests overlap. Serialize stills and
  // video sampling through the same queue.
  let captureQueue = Promise.resolve()
  function captureScreenshot(options) {
    const capture = captureQueue.then(() =>
      dev.send('Page.captureScreenshot', options),
    )
    captureQueue = capture.catch(() => {})
    return capture
  }
  const frames = []
  let startedAt
  async function startRecording() {
    if (!args.includes('--video')) return
    await mkdir(path.join(output, 'frames'), { recursive: true })
    recording = true
    startedAt = performance.now()
    recordingTask = (async () => {
      while (recording) {
        const time = (performance.now() - startedAt) / 1000
        const result = await captureScreenshot({
          format: 'jpeg',
          quality: 88,
          captureBeyondViewport: false,
        })
        const file = `frame-${String(frames.length).padStart(5, '0')}.jpg`
        await writeFile(
          path.join(output, 'frames', file),
          Buffer.from(result.data, 'base64'),
        )
        frames.push({ file, time })
        await sleep(150)
      }
    })()
    // Keep failures owned by the awaited recording task, including during cleanup.
    recordingTask.catch(() => {})
  }
  async function stopRecording() {
    if (!args.includes('--video')) return
    recording = false
    await recordingTask
    const duration = (performance.now() - startedAt) / 1000
    const concat =
      frames
        .map(
          (frame, index) =>
            `file 'frames/${frame.file}'\nduration ${(frames[index + 1]?.time ?? duration) - frame.time}\n`,
        )
        .join('') + `file 'frames/${frames.at(-1).file}'\n`
    await writeFile(path.join(output, 'frames.txt'), concat)
    const encoder = spawn(
      path.resolve(option('--ffmpeg', '.tools/media/ffmpeg.exe')),
      [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        path.join(output, 'frames.txt'),
        '-vf',
        'fps=15',
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '20',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        path.join(output, 'consul-walkthrough-silent.mp4'),
      ],
      { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
    )
    let error = ''
    encoder.stderr.on('data', (chunk) => (error += chunk))
    await new Promise((resolve, reject) => {
      encoder.on('error', reject)
      encoder.on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error(error)),
      )
    })
    manifest.video = {
      file: 'consul-walkthrough-silent.mp4',
      duration,
      frames: frames.length,
      audio: false,
    }
    await writeFile(
      path.join(output, 'frame-timestamps.json'),
      JSON.stringify(frames, null, 2),
    )
    const frameDirectory = path.resolve(output, 'frames')
    if (path.dirname(frameDirectory) !== output)
      throw new Error('Capture frame directory escaped output.')
    await rm(frameDirectory, { recursive: true, force: true })
    await rm(path.join(output, 'frames.txt'))
    console.log(JSON.stringify({ video: manifest.video }))
  }
  const hold = (ms) => sleep(args.includes('--video') ? ms : 300)
  const manifest = {
    capturedAt: new Date().toISOString(),
    url: url.href,
    viewport: [1920, 1080],
    shots: [],
  }
  async function shot(name) {
    const result = await captureScreenshot({
      format: 'png',
      captureBeyondViewport: false,
    })
    await writeFile(
      path.join(output, name + '.png'),
      Buffer.from(result.data, 'base64'),
    )
    const state = await dev.evaluate(
      `({url:location.href,text:document.body.innerText,buttons:[...document.querySelectorAll('button')].map(e=>({text:e.innerText,label:e.getAttribute('aria-label'),id:e.id,className:e.className}))})`,
    )
    await writeFile(
      path.join(output, name + '.json'),
      JSON.stringify(state, null, 2),
    )
    manifest.shots.push({
      name,
      timeSeconds: startedAt ? (performance.now() - startedAt) / 1000 : null,
    })
    console.log(
      JSON.stringify({
        shot: name,
        text: state.text.slice(0, 2000),
        buttons: state.buttons,
      }),
    )
  }
  async function click(selector) {
    await dev.wait(
      `document.querySelector(${JSON.stringify(selector)}) !== null`,
    )
    await dev.evaluate(
      `document.querySelector(${JSON.stringify(selector)}).click()`,
    )
  }
  async function navigate(next) {
    await dev.send('Page.navigate', { url: next })
    await dev.wait(
      `document.querySelector('.world[data-view-settled="true"] .room-hotspot') !== null`,
    )
    await sleep(3500)
    await dev.evaluate(`document.querySelector('.tour-skip')?.click()`)
    await sleep(800)
  }
  await navigate(url.href)
  await startRecording()
  await shot('01-voltride-home')
  await hold(6500)
  await click('#nav-agents')
  await dev.wait(`document.querySelector('.agents-panel') !== null`)
  await sleep(3000)
  await shot('02-voltride-agents')
  await hold(7500)
  await dev.evaluate(
    `[...document.querySelectorAll('.bottom-navigation-item')].find(e=>e.textContent.trim()==='Home').click()`,
  )
  await dev.wait(
    `document.querySelector('.world[data-view="home"][data-view-settled="true"]') !== null`,
  )
  await sleep(1500)
  const rooms = await dev.evaluate(
    `[...document.querySelectorAll('.room-hotspot')].map(e=>({text:e.textContent,label:e.getAttribute('aria-label')}))`,
  )
  console.log(JSON.stringify({ rooms }))
  await click('.room-hotspot')
  await dev.wait(`document.querySelector('.department-view') !== null`)
  await sleep(2000)
  await shot('03-voltride-department')
  await hold(7500)
  if (args.includes('--council')) {
    await navigate(new URL('/demo/harbor-goods', url).href)
    await hold(4000)
    await click('#nav-consul')
    await dev.wait(`document.querySelector('.council-panel') !== null`)
    await sleep(4500)
    await dev.evaluate(`(() => {
      const select = document.querySelector('select[aria-label="Saved conversations"]')
      const option = select && [...select.options].find(item => item.value === '94ef87a3-4149-40d6-bc2f-2548e6c0e081')
      if (!option) throw new Error('The real saved Harbor Goods strategy discussion is missing.')
      select.value = option.value
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })()`)
    await dev.wait(`document.querySelector('.council-decision') !== null`)
    await sleep(2000)
    await shot('04-harbor-council')
    await hold(6500)
    const councilState = await dev.evaluate(
      `({decision:!!document.querySelector('.council-decision'),scrollers:[...document.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+100&&e.clientHeight>100).map(e=>({tag:e.tagName,cls:e.className,height:e.clientHeight,scroll:e.scrollHeight})).slice(-12)})`,
    )
    console.log(JSON.stringify({ councilState }))
    if (councilState.decision) {
      await dev.evaluate(
        `document.querySelector('.council-decision').scrollIntoView({block:'center',behavior:'smooth'})`,
      )
      await sleep(1500)
      await shot('05-harbor-chair-decision')
      await hold(7000)
      await dev.evaluate(
        `[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Context & sources')?.click()`,
      )
      await sleep(1300)
      await dev.evaluate(
        `document.querySelector('.council-evidence-item')?.click()`,
      )
      await sleep(800)
      await dev.evaluate(
        `document.querySelector('.council-source-excerpt')?.scrollIntoView({block:'center',behavior:'smooth'})`,
      )
      await sleep(800)
      await shot('06-harbor-evidence')
      await hold(6000)
    }
    const api = new URL('/api/council?view=history&demo=harbor-goods', url).href
    const response = await fetch(api)
    const result = await response.json()
    if (!response.ok) throw new Error(`History unavailable: ${response.status}`)
    await writeFile(
      path.join(output, 'backend-history.json'),
      JSON.stringify({ url: api, status: response.status, result }, null, 2),
    )
    // Stop sampling before Chrome switches to its native JSON viewer. Capture the
    // actual formatted response once, then hold that frame in the raw walkthrough.
    recording = false
    await recordingTask
    await dev.send('Page.navigate', { url: api })
    await sleep(2500)
    // Format only the actual JSON response, preserving every returned value.
    await dev.evaluate(`(() => {
      const pre = document.querySelector('pre')
      if (!pre) throw new Error('Expected the browser JSON response document.')
      pre.textContent = JSON.stringify(JSON.parse(pre.textContent), null, 2)
      pre.style.cssText = 'white-space:pre-wrap;font:24px/1.6 monospace;margin:32px;padding:24px;color:#183653;background:#fff'
    })()`)
    await shot('07-backend-history')
    if (args.includes('--video')) {
      const result = await captureScreenshot({
        format: 'jpeg',
        quality: 88,
        captureBeyondViewport: false,
      })
      const file = `frame-${String(frames.length).padStart(5, '0')}.jpg`
      await writeFile(
        path.join(output, 'frames', file),
        Buffer.from(result.data, 'base64'),
      )
      frames.push({ file, time: (performance.now() - startedAt) / 1000 })
    }
    await hold(6000)
  }
  await stopRecording()
  await writeFile(
    path.join(output, 'capture-manifest.json'),
    JSON.stringify(manifest, null, 2),
  )
  await dev.send('Browser.close').catch(() => {})
} finally {
  recording = false
  await recordingTask?.catch(() => {})
  dev?.socket.close()
  if (child.exitCode === null) child.kill()
  if (
    path.dirname(profile) === path.resolve(tmpdir()) &&
    path.basename(profile).startsWith('consul-capture-')
  )
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    }).catch(() => {})
}

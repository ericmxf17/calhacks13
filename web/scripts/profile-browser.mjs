import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const args = process.argv.slice(2)
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback
const url = new URL(option('--url', 'http://localhost:3000/demo/voltride'))
if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Profile a local development URL.')
const output = path.resolve(option('--out', path.join(tmpdir(), 'consul-performance')))
const tag = option('--tag', 'profile')
const seconds = Number(option('--seconds', '3'))
const repeat = Number(option('--repeat', '1'))
const width = Number(option('--width', '1280'))
const height = Number(option('--height', '900'))
if (!Number.isFinite(seconds) || seconds < 1 || seconds > 60 || !Number.isInteger(repeat) || repeat < 1 || repeat > 20) throw new Error('Use 1 to 60 seconds and 1 to 20 repetitions.')
if (![width, height].every(value => Number.isInteger(value) && value >= 320 && value <= 3840)) throw new Error('Use viewport dimensions between 320 and 3840 pixels.')
if (!/^[a-zA-Z0-9_-]+$/.test(tag)) throw new Error('Use letters, numbers, underscores or hyphens in the capture tag.')
const chrome = option('--chrome', process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe')
const profile = await mkdtemp(path.join(tmpdir(), 'consul-chrome-'))
await mkdir(output, { recursive: true })

class DevTools {
  pending = new Map()
  listeners = new Map()
  sequence = 0
  constructor(socket) {
    this.socket = socket
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      if (message.id) {
        const pending = this.pending.get(message.id)
        if (!pending) return
        this.pending.delete(message.id)
        message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result)
      } else {
        for (const listener of this.listeners.get(message.method) || []) listener(message.params)
      }
    })
    socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) pending.reject(new Error('DevTools disconnected'))
      this.pending.clear()
    })
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.sequence
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`DevTools timeout for ${method}`)) }, 30000)
      this.pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value) }, reject: error => { clearTimeout(timer); reject(error) } })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }
  on(method, listener) {
    const listeners = this.listeners.get(method) || []
    listeners.push(listener)
    this.listeners.set(method, listeners)
    return () => this.listeners.set(method, listeners.filter(value => value !== listener))
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }
  async wait(expression) {
    for (let attempt = 0; attempt < 300; attempt++) {
      if (await this.evaluate(expression)) return
      await sleep(100)
    }
    const state = await this.evaluate(`({url:location.href,title:document.title,text:document.body.innerText.slice(0,2000),errors:window.__consulPerf?.errors})`)
    throw new Error(`Page did not reach ${expression}\n${JSON.stringify(state)}`)
  }
}

// Count actual work without depending on React or Three's private renderer state.
const instrument = `(() => {
  const p = window.__consulPerf = { active:false, draws:0, rects:0, commits:0, mutations:0, errors:[] };
  for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const original = Object.hasOwn(prototype,name) && prototype[name];
      if (original) prototype[name] = function(...args) { if(p.active) p.draws++; return original.apply(this,args) };
    }
  }
  const rect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function(...args) { if(p.active) p.rects++; return rect.apply(this,args) };
  new MutationObserver(records => { if(p.active) p.mutations += records.length }).observe(document,{subtree:true,attributes:true,childList:true});
  window.addEventListener('error',e=>p.errors.push(e.message));
  window.addEventListener('unhandledrejection',e=>p.errors.push(String(e.reason)));
  let renderer=0;
  const renderers=new Map();
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber:true, renderers, inject(value){renderers.set(++renderer,value);return renderer}, onCommitFiberUnmount(){}, checkDCE(){},
    onCommitFiberRoot() { if(p.active) p.commits++ }
  };
})()`

const child = spawn(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank'], { windowsHide: true, stdio: 'ignore' })
let dev
try {
  let port
  for (let attempt = 0; attempt < 100; attempt++) {
    try { port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break } catch { await sleep(100) }
  }
  if (!port) throw new Error('Chrome did not expose a local DevTools port.')
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json())
  const socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once:true }); socket.addEventListener('error', reject, { once:true }) })
  dev = new DevTools(socket)
  await dev.send('Page.enable')
  await dev.send('Runtime.enable')
  await dev.send('Performance.enable')
  await dev.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor:1, mobile:false })
  await dev.send('Page.addScriptToEvaluateOnNewDocument', { source: instrument })
  const responseErrors = []
  await dev.send('Network.enable')
  dev.on('Network.responseReceived', event => { if (event.response.status >= 400) responseErrors.push({ status:event.response.status, url:event.response.url }) })
  dev.on('Network.loadingFailed', event => responseErrors.push({ failure:event.errorText, canceled:event.canceled }))
  await dev.send('Page.navigate', { url:url.href })
  await dev.wait(`document.querySelector('.world[data-view-settled="true"] .room-hotspot') !== null`)
  await sleep(4000)
  const environment = await dev.evaluate(`(() => { const gl=document.querySelector('canvas')?.getContext('webgl2'); const info=gl?.getExtension('WEBGL_debug_renderer_info'); return {userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight],visibility:document.visibilityState,canvases:document.querySelectorAll('canvas').length,renderer:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):null} })()`)
  const rows = []
  const avatars = () => dev.evaluate(`Array.from(document.querySelectorAll('.agent-avatar-animation svg')).map(svg=>{
    const group=svg.querySelector('animateTransform')?.parentElement;
    const list=group?.transform?.animVal;
    return {time:svg.getCurrentTime(),paused:svg.animationsPaused(),matrix:list?Array.from({length:list.numberOfItems},(_,i)=>{const m=list.getItem(i).matrix;return [m.a,m.b,m.c,m.d,m.e,m.f]}):[]};
  })`)
  const metrics = async () => Object.fromEntries((await dev.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]))
  async function sample(name, moving, trace) {
    const events = []
    let stopCollecting = () => {}
    if (trace) {
      stopCollecting = dev.on('Tracing.dataCollected', event => events.push(...event.value))
      await dev.send('Tracing.start', { categories:'devtools.timeline,v8,blink.user_timing,disabled-by-default-devtools.timeline', options:'sampling-frequency=1000' })
      await dev.send('Profiler.enable')
      await dev.send('Profiler.start')
    }
    const animationBefore = await avatars()
    await dev.evaluate(`Object.assign(__consulPerf,{active:true,draws:0,rects:0,commits:0,mutations:0,errors:[]})`)
    const before = await metrics()
    const start = performance.now()
    let moves = 0
    while (performance.now() - start < seconds * 1000) {
      if (moving) {
        const phase = (performance.now() - start) / 800
        await dev.send('Input.dispatchMouseEvent', { type:'mouseMoved', x:width*(.5+Math.sin(phase)*.36), y:height*(.46+Math.cos(phase)*.24) })
        moves++
      }
      await sleep(moving ? 16 : 100)
    }
    const after = await metrics()
    const counts = await dev.evaluate(`(__consulPerf.active=false,{...__consulPerf,state:document.querySelector('.world').dataset.view,avatars:document.querySelectorAll('.agent-avatar[data-animated="true"]').length})`)
    const animationAfter = await avatars()
    counts.advancingAvatars = animationAfter.filter((value,index)=>value.time>animationBefore[index]?.time && JSON.stringify(value.matrix)!==JSON.stringify(animationBefore[index]?.matrix)).length
    const row = { name, traced:trace, seconds:(performance.now()-start)/1000, moves, ...counts, metrics:Object.fromEntries(['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','JSHeapUsedSize'].map(key=>[key,after[key]-before[key]])) }
    rows.push(row)
    if (trace) {
      const cpu = await dev.send('Profiler.stop')
      await writeFile(path.join(output, `${tag}-${name}.cpuprofile`), JSON.stringify(cpu.profile))
      const complete = new Promise(resolve => {
        const stop = dev.on('Tracing.tracingComplete', value => { stop(); resolve(value) })
      })
      await dev.send('Tracing.end')
      await complete
      stopCollecting()
      await writeFile(path.join(output, `${tag}-${name}.trace.json`), JSON.stringify({ traceEvents:events }))
    }
    console.log(JSON.stringify(row))
  }
  for (let run = 0; run < repeat; run++) await sample(`home-${run}`, false, args.includes('--trace') && run === 0)
  // Pointer parallax on Home redraws the building every frame, so its draw count tracks scene size.
  for (let run = 0; run < repeat; run++) await sample(`home-pointer-${run}`, true, false)
  await sleep(2000)
  await dev.evaluate(`document.querySelector('#nav-agents').click()`)
  // Wait until every avatar in the agents grid has switched to its animated version.
  await dev.wait(`document.querySelector('.agents-panel') !== null && document.querySelectorAll('.agent-avatar').length > 0 && document.querySelectorAll('.agent-avatar[data-animated="true"]').length === document.querySelectorAll('.agent-avatar').length`)
  await sleep(2000)
  for (let run = 0; run < repeat; run++) await sample(`agents-idle-${run}`, false, args.includes('--trace') && run === 0)
  for (let run = 0; run < repeat; run++) await sample(`agents-pointer-${run}`, true, args.includes('--trace') && run === 0)
  if (args.includes('--interactions')) {
    const checks = []
    const click = selector => dev.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
    await dev.evaluate(`Array.from(document.querySelectorAll('.bottom-navigation-item')).find(e=>e.textContent.trim()==='Home').click()`)
    await dev.wait(`document.querySelector('.world[data-view="home"][data-view-settled="true"]') !== null`)
    await sleep(3000)
    const resting = await dev.evaluate(`({state:document.querySelector('.world').dataset.view,box:document.querySelector('.room-hotspot').getBoundingClientRect().toJSON()})`)
    await dev.send('Input.dispatchMouseEvent', {type:'mouseMoved',x:width*.1,y:height*.2})
    await sleep(750)
    const moved = await dev.evaluate(`document.querySelector('.room-hotspot').getBoundingClientRect().toJSON()`)
    checks.push({name:'home-pointer',resting,moved})
    await click('#nav-agents'); await sleep(200)
    await dev.evaluate(`Array.from(document.querySelectorAll('.bottom-navigation-item')).find(e=>e.textContent.trim()==='Home').click()`)
    await sleep(100); await click('#nav-agents')
    await dev.wait(`document.querySelector('.agents-panel') !== null`)
    checks.push({name:'rapid-reversal',state:await dev.evaluate(`document.querySelector('.world').dataset.view`)})
    await dev.evaluate(`Array.from(document.querySelectorAll('.bottom-navigation-item')).find(e=>e.textContent.trim()==='Home').click()`)
    await dev.wait(`document.querySelector('.world[data-view="home"][data-view-settled="true"]') !== null`)
    await click('.room-hotspot')
    await dev.wait(`document.querySelector('.department-view') !== null`)
    await sleep(3000)
    checks.push({name:'department',title:await dev.evaluate(`document.querySelector('.department-view h1').textContent`)})
    await dev.send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:false})
    await sleep(1000)
    checks.push({name:'resize',value:await dev.evaluate(`({width:innerWidth,pageWidth:document.documentElement.scrollWidth,canvases:document.querySelectorAll('canvas').length})`)})
    await dev.send('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]})
    await click('#nav-agents')
    await dev.wait(`document.querySelector('.agents-panel') !== null`)
    checks.push({name:'reduced-motion',value:await dev.evaluate(`({reduced:document.querySelector('.agents-panel').dataset.reducedMotion,animated:document.querySelectorAll('.agent-avatar[data-animated="true"]').length})`)})
    await writeFile(path.join(output,`${tag}-interactions.json`),JSON.stringify(checks,null,2))
    console.log(JSON.stringify({interactions:checks}))
  }
  await writeFile(path.join(output, `${tag}.json`), JSON.stringify({ url:url.href, environment, responseErrors, rows }, null, 2))
  await dev.send('Browser.close').catch(() => {})
} finally {
  dev?.socket.close()
  if (child.exitCode === null) child.kill()
  if (path.dirname(profile) === path.resolve(tmpdir()) && path.basename(profile).startsWith('consul-chrome-')) {
    await rm(profile, { recursive:true, force:true, maxRetries:10, retryDelay:200 }).catch(error => console.warn(`Could not remove temporary Chrome profile: ${error.message}`))
  }
}

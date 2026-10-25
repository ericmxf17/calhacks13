// Generated programs execute only inside QuickJS, with no host functions or module loader.
import { getQuickJS } from 'quickjs-emscripten'
let raw = ''
for await (const chunk of process.stdin) { raw += chunk; if (raw.length > 48_000) throw new Error('Input limit exceeded') }
try {
  const { code, input } = JSON.parse(raw)
  const QuickJS = await getQuickJS()
  const runtime = QuickJS.newRuntime()
  runtime.setMemoryLimit(16 * 1024 * 1024)
  runtime.setMaxStackSize(512 * 1024)
  const deadline = Date.now() + 1500
  runtime.setInterruptHandler(() => Date.now() > deadline)
  const context = runtime.newContext()
  const handles = []
  function evaluate(source) {
    const evaluated = context.evalCode(source, 'council-calculation.js')
    if (evaluated.error) {
      const failure = context.dump(evaluated.error); evaluated.error.dispose()
      throw new Error(typeof failure?.message === 'string' ? failure.message : 'QuickJS rejected the program')
    }
    handles.push(evaluated.value)
    return evaluated.value
  }
  try {
    evaluate("Object.defineProperty(globalThis, 'Date', {value: undefined, writable: false, configurable: false}); Object.defineProperty(Math, 'random', {value: undefined, writable: false, configurable: false})")
    // Capture serialization builtins in a closure before the generated program
    // runs. Program mutations cannot replace our finite-number check.
    const serializer = evaluate(`(() => { const stringify = JSON.stringify, finite = Number.isFinite; return value => stringify(value, (_key, item) => { if (typeof item === 'number' && !finite(item)) throw new Error('Calculation returned a nonfinite number'); if (item === undefined || typeof item === 'function' || typeof item === 'symbol' || typeof item === 'bigint') throw new Error('Calculation must return JSON values only'); if (item && typeof item.then === 'function') throw new Error('Calculation must return synchronously, not a Promise'); return item }) })()`)
    // Parse the input before evaluating generated code so keys such as
    // __proto__ keep JSON semantics and the program cannot replace the parser.
    const inputValue = evaluate(`JSON.parse(${JSON.stringify(JSON.stringify(input))})`)
    const program = evaluate(`(${code})`)
    const execution = context.callFunction(program, context.undefined, inputValue)
    if (execution.error) {
      const failure = context.dump(execution.error); execution.error.dispose()
      throw new Error(failure?.message || 'Calculation failed')
    }
    handles.push(execution.value)
    const result = execution.value
    const serializedResult = context.callFunction(serializer, context.undefined, result)
    if (serializedResult.error) {
      const failure = context.dump(serializedResult.error); serializedResult.error.dispose()
      throw new Error(failure?.message || 'Result serialization failed')
    }
    handles.push(serializedResult.value)
    const serialized = context.getString(serializedResult.value)
    if (Buffer.byteLength(serialized) > 32_000) throw new Error('Result exceeds 32 KB')
    process.stdout.write(JSON.stringify({ ok: true, result: JSON.parse(serialized) }))
  } finally { handles.reverse().forEach(handle => handle.dispose()); context.dispose(); runtime.dispose() }
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: String(error.message).slice(0, 500) }))
  process.exitCode = 1
}

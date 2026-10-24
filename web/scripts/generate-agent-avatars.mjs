// Bake the reviewed GrokBots idle engine into standalone SVG animation.
// Usage: node web/scripts/generate-agent-avatars.mjs <reviewed-chunk.js>
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const engineHash = '61b4eb391ad755940f175de941bd66562f413f9741f75eb50298e9c2a9fdf4b3';
const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Pass the local, reviewed GrokBots 05_lt5jegssjn.js chunk. See public/agents/README.md.');
const source = await readFile(sourcePath, 'utf8');
if (createHash('sha256').update(source).digest('hex') !== engineHash) {
  throw new Error('Engine hash differs from the reviewed source. Review the changed engine before updating this generator.');
}

const avatars = [
  ['bill-analyst', 'squircle', 'attentif'],
  ['researcher', 'galet', 'curieux'],
  ['impact-planner', 'hexagone', 'fier'],
  ['test-agent', 'cercle', 'heureux'],
];
const sampledSeconds = 6;
const loopSeconds = 6.4;
const bodyRate = 8;
const eyeRate = 40;

// The pinned chunk is pure geometry. Run only its first module factory in a
// fresh context without Node, DOM, timers, or network APIs, with bounded work.
const context = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
vm.runInContext(source, context, { timeout: 5000 });
vm.runInContext(`
  const exportsByModule = new Map();
  TURBOPACK[0].find(value => typeof value === 'function')({
    s(entries, moduleId) {
      const exports = {};
      for (let index = 0; index < entries.length; index += 3) {
        exports[entries[index]] = entries[index + 2];
      }
      exportsByModule.set(moduleId, exports);
    }
  });
`, context, { timeout: 10000 });

const round = value => String(Number(value.toFixed(5)));
const times = rate => Array.from({ length: sampledSeconds * rate + 1 }, (_, index) => index / rate);
const bodyTimes = times(bodyRate);
const eyeTimes = times(eyeRate);
const keyTimes = frameTimes => [...frameTimes.map(time => round(time / loopSeconds)), '1'].join(';');

function animation(attribute, values, frameTimes, type) {
  const tag = type ? 'animateTransform' : 'animate';
  return `<${tag} attributeName="${attribute}"${type ? ` type="${type}"` : ''} dur="${loopSeconds}s" repeatCount="indefinite" calcMode="linear" keyTimes="${keyTimes(frameTimes)}" values="${[...values, values[0]].join(';')}"/>`;
}

// SVG animateTransform cannot animate a matrix directly. QR decomposition
// expresses the engine's affine matrix exactly as translate/rotate/skew/scale.
function decompose(matrix) {
  const [a, b, c, d, x, y] = matrix.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const scaleX = Math.hypot(a, b);
  const scaleY = (a * d - b * c) / scaleX;
  return {
    translate: `${round(x)} ${round(y)}`,
    rotate: round(Math.atan2(b, a) * 180 / Math.PI),
    skewX: round(Math.atan((a * c + b * d) / (scaleX * scaleY)) * 180 / Math.PI),
    scale: `${round(scaleX)} ${round(scaleY)}`,
  };
}

for (const [name, shape, expression] of avatars) {
  const frames = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const engine = new (exportsByModule.get(43307).BotEngine)(100, 'idle',
      exportsByModule.get(734648).SHAPE_BY_ID.get(${JSON.stringify(shape)}).radii,
      exportsByModule.get(769341).EXPRESSION_BY_ID.get(${JSON.stringify(expression)}));
    return ${JSON.stringify(eyeTimes)}.map(time => engine.sample(time));
  })())`, context, { timeout: 10000 }));
  const bodyFrames = frames.filter((_, index) => index % (eyeRate / bodyRate) === 0);
  const bodyPaths = bodyFrames.map(frame => frame.bodyPath);
  const assetDirectory = new URL('../public/agents/', import.meta.url);
  let svg = await readFile(new URL(`${name}.svg`, assetDirectory), 'utf8');
  let eyeIndex = 0;
  svg = svg.replace(/<path\b[^>]*><\/path>/g, path => {
    if (!path.includes('transform="matrix(')) {
      return path.replace(/d="[^"]*"/, `d="${bodyPaths[0]}"`)
        .replace('</path>', `${animation('d', bodyPaths, bodyTimes)}</path>`);
    }
    const eyes = frames.map(frame => frame.eyes[eyeIndex]);
    eyeIndex += 1;
    const transforms = eyes.map(eye => decompose(eye.matrix));
    let animatedEye = path.replace(/ transform="[^"]*"/, '').replace(/d="[^"]*"/, `d="${eyes[0].d}"`);
    if (eyes.some(eye => eye.d !== eyes[0].d)) {
      animatedEye = animatedEye.replace('</path>', `${animation('d', eyes.map(eye => eye.d), eyeTimes)}</path>`);
    }
    for (const type of ['scale', 'skewX', 'rotate', 'translate']) {
      animatedEye = `<g transform="${type}(${transforms[0][type]})">${animation('transform', transforms.map(transform => transform[type]), eyeTimes, type)}${animatedEye}</g>`;
    }
    return animatedEye;
  });
  svg = svg.replace(/ class="[^"]*"/, '');
  const output = new URL(`${name}-animated.svg`, assetDirectory);
  await writeFile(output, svg);
  console.log(`${fileURLToPath(output)}: ${Buffer.byteLength(svg)} bytes; ${bodyFrames.length} body frames, ${frames.length} eye frames`);
}

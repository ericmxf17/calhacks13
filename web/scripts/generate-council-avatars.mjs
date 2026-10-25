// Recolor the local reviewed artwork without changing CREAO originals or motion.
import { readFile, writeFile } from 'node:fs/promises'

const palettes = {
  'bill-analyst': [['#f9e3ae', '#f3c354', '#f0b429', '#94701d'], ['#e4dcf4', '#a38ac9', '#6750a4', '#493374']],
  'impact-planner': [['#b6edd4', '#65d9a5', '#3ecf8e', '#29805a'], ['#d3efef', '#64bbc2', '#087f8c', '#075964']],
  researcher: [['#d3c1fc', '#a27df8', '#8b5cf6', '#573b98'], ['#e3d9ef', '#af89c3', '#835399', '#513466']],
  'test-agent': [['#b5d6f9', '#62a9f3', '#3b93f0', '#275c95'], ['#ceebed', '#65b5bf', '#207c8c', '#14525e']],
}

// Validate every input before writing any derived file, so changed palettes fail clearly.
const outputs = []
for (const [name, [original, council]] of Object.entries(palettes)) {
  for (const suffix of ['', '-animated']) {
    const sourceUrl = new URL(`../public/agents/${name}${suffix}.svg`, import.meta.url)
    let svg = await readFile(sourceUrl, 'utf8')
    for (let index = 0; index < original.length; index++) {
      if (!/^#[0-9a-f]{6}$/.test(council[index]) || !svg.includes(original[index])) {
        throw new Error(`Avatar palette changed: ${name}${suffix}.svg requires ${original[index]}. Review the source before updating this generator.`)
      }
      svg = svg.replaceAll(original[index], council[index])
    }
    outputs.push([new URL(`../public/agents/council-${name}${suffix}.svg`, import.meta.url), svg])
  }
}
for (const [url, svg] of outputs) await writeFile(url, svg)
console.log(`Generated ${outputs.length} Council avatars; CREAO originals unchanged.`)

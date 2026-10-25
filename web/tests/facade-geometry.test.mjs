import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { createFacadeGeometry } from '../src/components/business/scene/facade-geometry.ts'

for (const [cols, rows] of [[2, 2], [3, 2], [3, 4]]) {
  test(`${cols}x${rows} facade has open windows and continuous structural strips`, () => {
    const x = Array.from({ length: cols }, (_, i) => (i - (cols - 1) / 2) * 3.14)
    const y = Array.from({ length: rows }, (_, i) => 3.65 + i * 2.05)
    const top = y.at(-1), bottom = y[0]
    const mids = x.slice(1).map((value, i) => (value + x[i]) / 2)
    const beams = [bottom - 1.1, ...y.slice(1).map((value, i) => (value + y[i]) / 2 - .005), top + 1.17]
    const { geometry, centerY } = createFacadeGeometry({
      half: (cols * 3.14 - 1.03) / 2, mids, beams,
      pierY: (bottom - 1.33 + top + 1.32) / 2, pierHeight: top - bottom + 2.65,
      roofBase: top + 1.36,
    })
    const material = new MeshBasicMaterial(), mesh = new Mesh(geometry, material)
    mesh.position.set(0, centerY, .42)
    mesh.updateMatrixWorld(true)
    const hit = (px, py) => new Raycaster(new Vector3(px, py, 4), new Vector3(0, 0, -1)).intersectObject(mesh).length > 0
    try {
      for (const px of x) for (const py of y) assert.equal(hit(px, py), false, 'A window must not be filled by the facade')
      for (const px of mids) for (const py of y) assert.equal(hit(px, py), true, 'A structural strip must remain solid')
      for (const py of beams) for (const px of x) assert.equal(hit(px, py), true, 'A beam must span every column')
      geometry.computeBoundingBox()
      assert.ok(Math.abs(geometry.boundingBox.min.y + geometry.boundingBox.max.y) < 1e-5, 'Geometry must stay centered for the assembly animation')
      assert.ok(Math.abs(geometry.boundingBox.max.y + centerY - (top + 1.36)) < 1e-5, 'Facade must meet the roof slab without overlapping its front face')
    } finally {
      geometry.dispose()
      material.dispose()
    }
  })
}

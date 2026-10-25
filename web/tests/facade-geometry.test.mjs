import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BoxGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { createFacadeGeometry } from '../src/components/business/scene/facade-geometry.ts'
import { cornerPipeSegments, facadeDepth, groundPostVolume, shellVolumes, signBandVolume } from '../src/components/business/scene/shell-volumes.ts'

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
    const volumes = shellVolumes(cols * 3.14 - 1.03, top + 1.44)
    const shell = Object.values(volumes).map(({ at, size }) => {
      const part = new Mesh(new BoxGeometry(...size), material)
      part.position.set(...at)
      part.updateMatrixWorld(true)
      return part
    })
    const hit = (px, py) => new Raycaster(new Vector3(px, py, 4), new Vector3(0, 0, -1)).intersectObject(mesh).length > 0
    try {
      for (const px of x) for (const py of y) assert.equal(hit(px, py), false, 'A window must not be filled by the facade')
      for (const px of mids) for (const py of y) assert.equal(hit(px, py), true, 'A structural strip must remain solid')
      for (const py of beams) for (const px of x) assert.equal(hit(px, py), true, 'A beam must span every column')
      geometry.computeBoundingBox()
      assert.ok(Math.abs(geometry.boundingBox.min.y + geometry.boundingBox.max.y) < 1e-5, 'Geometry must stay centered for the assembly animation')
      assert.ok(Math.abs(geometry.boundingBox.max.y + centerY - (top + 1.36)) < 1e-5, 'Facade must meet the roof slab without overlapping its front face')
      const outerEdge = (cols * 3.14 - 1.03) / 2
      const sideRay = z => new Raycaster(new Vector3(cols * 3.14, bottom, z), new Vector3(-1, 0, 0)).intersectObjects([...shell, mesh]).filter(hit => hit.point.x > outerEdge - .05)
      for (const z of [-1.01, -.95, -.8, 0, .13, .2, .5, .7]) {
        assert.equal(sideRay(z).length, 1, `The side wall at depth ${z} must have one exterior surface, not competing shell/facade faces`)
      }
      const frontSide = sideRay(.5)[0], backSide = sideRay(0)[0]
      assert.ok(Math.abs(frontSide.point.x - backSide.point.x) < 1e-5, 'The facade and shell must join in the same side plane')
      const bodyFront = volumes.body.at[2] + volumes.body.size[2] / 2
      assert.ok(Math.abs(bodyFront - facadeDepth.back) < 1e-10, 'The shell must end exactly where the facade starts')
      for (const pipe of cornerPipeSegments(top)) for (const trimY of [.16, 2.51, top + 1.29]) {
        const overlap = Math.min(pipe.top, trimY + .06) - Math.max(pipe.bottom, trimY - .06)
        assert.ok(overlap < 1e-10, 'The corner pipe must not poke through a trim band')
      }
    } finally {
      geometry.dispose()
      for (const part of shell) part.geometry.dispose()
      material.dispose()
    }
  })
}

test('ground-floor corner posts never overlap the sign band side faces', () => {
  for (const width of [5.25, 8.39]) {
    const sign = signBandVolume(width), post = groundPostVolume(width / 2 - .1)
    const postTop = post.at[1] + post.size[1] / 2, signBottom = sign.at[1] - sign.size[1] / 2
    assert.ok(Math.abs(postTop - signBottom) < 1e-10, 'The post must meet the sign underside exactly')
    const material = new MeshBasicMaterial()
    const meshes = [sign, post].map(({ at, size }) => {
      const mesh = new Mesh(new BoxGeometry(...size), material)
      mesh.position.set(...at)
      mesh.updateMatrixWorld(true)
      return mesh
    })
    try {
      for (const y of [1.8, 1.92, 2.01, 2.2]) {
        const hits = new Raycaster(new Vector3(width, y, .98), new Vector3(-1, 0, 0)).intersectObjects(meshes)
        assert.equal(hits.length, 1, `Only one side face may cover the corner at height ${y}`)
      }
    } finally {
      meshes.forEach(mesh => mesh.geometry.dispose())
      material.dispose()
    }
  }
})

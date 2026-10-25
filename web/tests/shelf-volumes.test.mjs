import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BoxGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { shelfVolumes } from '../src/components/business/scene/shelf-volumes.ts'

test('orange shelves meet the uprights with exactly one visible face at each join', () => {
  const frame = shelfVolumes(), material = new MeshBasicMaterial()
  const meshes = [...frame.posts, ...frame.rails].map(({ at, size }) => {
    const mesh = new Mesh(new BoxGeometry(...size), material)
    mesh.position.set(...at)
    mesh.updateMatrixWorld(true)
    return mesh
  })
  try {
    for (const rail of frame.rails) {
      const left = rail.at[0] - rail.size[0] / 2, right = rail.at[0] + rail.size[0] / 2
      assert.ok(Math.abs(left - (frame.posts[0].at[0] + frame.posts[0].size[0] / 2)) < 1e-10)
      assert.ok(Math.abs(right - (frame.posts[1].at[0] - frame.posts[1].size[0] / 2)) < 1e-10)
      for (const x of [-.43, -.41, -.39, 0, .39, .41, .43]) {
        const hits = new Raycaster(new Vector3(x, rail.at[1] + .003, 1), new Vector3(0, 0, -1)).intersectObjects(meshes)
        assert.equal(hits.length, 1, `Shelf at ${rail.at[1]}, x=${x} must not expose competing orange and blue faces`)
      }
    }
  } finally {
    meshes.forEach(mesh => mesh.geometry.dispose())
    material.dispose()
  }
})

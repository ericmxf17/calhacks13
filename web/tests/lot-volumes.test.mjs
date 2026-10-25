import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BoxGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { groundShadowY, lotVolumes } from '../src/components/business/scene/lot-volumes.ts'

for (const width of [8.3, 11.44, 14.58]) {
  test(`the ${width} wide lot has no overlapping side layers or shadow plane`, () => {
    const volumes = lotVolumes(width), material = new MeshBasicMaterial()
    const meshes = Object.values(volumes).map(({ at, size }) => {
      const mesh = new Mesh(new BoxGeometry(...size), material)
      mesh.position.set(...at)
      mesh.updateMatrixWorld(true)
      return mesh
    })
    try {
      for (const y of [-.25, -.1, -.04, -.02, .02]) {
        const ray = new Raycaster(new Vector3(width, y, .31), new Vector3(-1, 0, 0))
        const outerFaces = ray.intersectObjects(meshes).filter(hit => hit.point.x > width / 2 - .05)
        assert.equal(outerFaces.length, 1, `Only one exterior pavement face may occupy height ${y}`)
      }
      assert.ok(groundShadowY < volumes.base.at[1] - volumes.base.size[1] / 2, 'The shadow receiver must sit below the entire pavement base')
      const roadBack = volumes.road.at[2] - volumes.road.size[2] / 2
      const curbFront = volumes.base.at[2] + volumes.base.size[2] / 2
      assert.ok(Math.abs(roadBack - curbFront) < 1e-10, 'The road must meet the curb without intersecting it')
    } finally {
      meshes.forEach(mesh => mesh.geometry.dispose())
      material.dispose()
    }
  })
}

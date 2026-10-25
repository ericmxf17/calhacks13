import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Quaternion, Vector3 } from 'three'
import { clearScenePosition } from '../src/components/business/scene/view-framing.ts'

for (const width of [390, 1280, 1920, 3440]) for (const side of [-1, 1]) {
  test(`the complete lot exits ${side < 0 ? 'left' : 'right'} at ${width}px`, () => {
    const position = new Vector3(7.3, 6.7, 17), original = position.clone()
    const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), side * Math.PI / 2)
    const zoom = 55, lotWidth = 11.44, roadHalf = (lotWidth + 3.7) / 2
    const destination = clearScenePosition(position, rotation, width, zoom, lotWidth, 7.3, side)
    const inverse = rotation.clone().invert(), edge = width / (2 * zoom)
    for (const x of [-roadHalf, roadHalf]) for (const y of [-.4, 9.3]) for (const z of [-2.7, 3.8]) {
      const screenX = new Vector3(x, y, z).sub(destination).applyQuaternion(inverse).x
      assert.ok(side < 0 ? screenX < -edge : screenX > edge, 'No vehicle or corner of the lot should remain at the viewport edge')
    }
    assert.deepEqual(position, original, 'Returning Home must retain its original camera position')
  })
}

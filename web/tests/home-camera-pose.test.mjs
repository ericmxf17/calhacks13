import assert from 'node:assert/strict'
import { test } from 'node:test'
import { OrthographicCamera, Quaternion, Vector3 } from 'three'
import { homeCameraPose } from '../src/components/business/scene/home-camera-pose.ts'

for (const size of [{ width: 390, height: 844 }, { width: 1280, height: 720 }, { width: 3440, height: 1440 }]) {
  for (const source of ['council', 'agents']) {
    test(`${source} to Home at ${size.width}px has no orientation or framing jump at the handoff`, () => {
      const home = homeCameraPose({ homeTarget: [-1.19, 4.15, 0], scale: 1.38 }, size, { x: .7, y: -.4 }, false)
      const camera = new OrthographicCamera(-size.width / 2, size.width / 2, size.height / 2, -size.height / 2, .1, 100)
      const turn = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), source === 'agents' ? -Math.PI / 2 : Math.PI / 2)
      const initialRotation = home.rotation.clone().premultiply(turn)
      const initialPosition = home.position.clone().add(new Vector3(source === 'agents' ? 8 : -8, 0, 0))
      for (let frame = 0; frame <= 54; frame++) {
        const t = frame / 54, ease = t * t * (3 - 2 * t)
        camera.position.lerpVectors(initialPosition, home.position, ease)
        camera.quaternion.slerpQuaternions(initialRotation, home.rotation, ease)
        camera.zoom = home.zoom * (1.9 + (1 - 1.9) * ease)
      }
      camera.updateProjectionMatrix()
      camera.updateMatrixWorld()
      const points = [new Vector3(-4, 0, 1), new Vector3(4, 8, 0)]
      const landing = points.map(point => point.clone().project(camera))
      // The first normal Home frame uses lookAt, unlike the turn's quaternion interpolation.
      camera.lookAt(home.target)
      camera.updateMatrixWorld()
      points.forEach((point, i) => assert.ok(point.clone().project(camera).distanceTo(landing[i]) < 1e-10, 'Switching camera controllers must not move the building on screen'))
      assert.ok(Math.abs(camera.zoom - home.zoom) < 1e-10, 'The Home zoom must already be reached before normal motion resumes')
    })
  }
}

test('reduced-motion Home ignores pointer offsets', () => {
  const layout = { homeTarget: [-.25, 3.5, 0], scale: 1 }
  const size = { width: 1280, height: 720 }
  const neutral = homeCameraPose(layout, size, { x: 0, y: 0 }, true)
  const moved = homeCameraPose(layout, size, { x: 1, y: -1 }, true)
  assert.deepEqual(moved.position, neutral.position)
  assert.ok(moved.rotation.angleTo(neutral.rotation) < 1e-7)
})

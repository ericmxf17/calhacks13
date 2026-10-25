import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Vector3 } from 'three'
import { paneDestination, windowClipPlanes } from '../src/components/business/scene/window-pane-motion.ts'

test('left glass panes close from right to left; other panes retain their original direction', () => {
  assert.ok(paneDestination(true, 'left') > paneDestination(false, 'left'))
  for (const side of ['center', 'right']) {
    assert.equal(paneDestination(true, side), -1.35)
    assert.equal(paneDestination(false, side), 0)
  }
})

for (const roomY of [3.65, 5.7]) {
  test(`the left pane at height ${roomY} stays within its frame throughout the slide`, () => {
    const roomX = -3.14, planes = windowClipPlanes(roomX)
    const visible = x => planes.every(plane => plane.distanceToPoint(new Vector3(roomX + x, roomY, 1.1)) >= 0)
    for (const offset of [-.51, 0, .51]) assert.equal(visible(offset), true, 'The closed glass must remain visible')
    for (const offset of [-.51, 0, .51]) assert.equal(visible(paneDestination(true, 'left') + offset), false, 'Open glass must not float beside the frame')
    assert.equal(visible(.6 - .51), true, 'A closing pane must be revealed inside the frame')
    assert.equal(visible(.6 + .51), false, 'The portion outside the frame must stay hidden')
  })
}

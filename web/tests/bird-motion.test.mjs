import assert from 'node:assert/strict'
import { test } from 'node:test'
import { birdEntrySide, birdFlightPoint, cardBirdSize, roofBirdSize } from '../src/components/business/scene/bird-motion.ts'

test('destination flights enter from opposite sides and land at the exact perch', () => {
  const target = { x: 250, y: 120 }
  assert.equal(birdEntrySide('agents'), -1)
  assert.equal(birdEntrySide('council'), 1)
  for (const start of [{ x: -32, y: 85 }, { x: 1032, y: 85 }]) {
    assert.deepEqual(birdFlightPoint(start, target, 0, 30), start)
    const end = birdFlightPoint(start, target, 1, 30)
    assert.equal(end.x, target.x)
    assert.ok(Math.abs(end.y - target.y) < 1e-10)
    const middle = birdFlightPoint(start, target, .5, 30)
    assert.ok(middle.y < Math.min(start.y, target.y))
  }
})

test('birds shrink with smaller scenes and stay modest on cards', () => {
  assert.ok(roofBirdSize(35) < roofBirdSize(70))
  assert.ok(cardBirdSize(260) < cardBirdSize(400))
  for (const width of [200, 300, 600, 1400]) assert.ok(cardBirdSize(width) <= 21)
  assert.ok(roofBirdSize(1) >= 9)
})


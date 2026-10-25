type Volume = { at: [number, number, number]; size: [number, number, number] }

/** Rails fit between the uprights instead of sharing their front faces. */
export function shelfVolumes(): { posts: Volume[]; rails: Volume[] } {
  const postX = .42, postWidth = .05, opening = postX * 2 - postWidth
  return {
    posts: [-postX, postX].map(x => ({ at: [x, -.25, -.45], size: [postWidth, 1.1, .3] })),
    rails: [-.6, -.25, .1].map(y => ({ at: [0, y, -.45], size: [opening, .04, .3] })),
  }
}

'use client'

// Adapted from Vercel AI Elements Shimmer (Apache-2.0; see ai-elements-LICENSE).
// CSS supplies the upstream gradient sweep without a separate motion runtime.
import { memo, type CSSProperties } from 'react'
import './motion.css'

export const Shimmer = memo(function Shimmer({
  children,
  as: Component = 'span',
  duration = 2,
  reducedMotion = false,
}: {
  children: string
  as?: 'p' | 'span'
  duration?: number
  reducedMotion?: boolean
}) {
  return <Component
    className="council-shimmer"
    data-reduced-motion={reducedMotion || undefined}
    style={{ '--shimmer-spread': `${children.length * 2}px`, animationDuration: `${duration}s` } as CSSProperties}
  >{children}</Component>
})

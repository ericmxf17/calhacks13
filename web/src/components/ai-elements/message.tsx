'use client'
// Adapted from Vercel AI Elements (Apache-2.0; see ai-elements-LICENSE).
// Only Message and MessageContent are retained; roles match the council's public thread.
import type { HTMLAttributes } from 'react'
export function Message({
  className = '',
  from,
  ...props
}: HTMLAttributes<HTMLDivElement> & { from: 'user' | 'assistant' }) {
  return <div className={`council-message is-${from} ${className}`} {...props} />
}
export function MessageContent({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`council-message-content ${className}`} {...props} />
}

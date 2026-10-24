'use client'
// Adapted from Vercel AI Elements (Apache-2.0; see ai-elements-LICENSE).
// Roles match the council's public thread; response text uses Vercel Streamdown.
import { memo, type ComponentProps, type HTMLAttributes } from 'react'
import { Streamdown } from 'streamdown'
import 'streamdown/styles.css'
import './motion.css'
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

// Council summaries are prose. Citation buttons remain in the evidence UI.
export const MessageResponse = memo(function MessageResponse({
  className = '',
  ...props
}: ComponentProps<typeof Streamdown>) {
  return <Streamdown
    {...props}
    className={`council-response ${className}`}
    allowedElements={['p', 'span', 'strong', 'em', 'br']}
    skipHtml
    unwrapDisallowed
  />
})

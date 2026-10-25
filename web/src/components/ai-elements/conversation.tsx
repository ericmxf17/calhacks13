'use client'
// Adapted from Vercel AI Elements (Apache-2.0; see ai-elements-LICENSE).
// Retains the conversation primitives; native themed controls replace shadcn UI.
import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom'
export function Conversation({ className = '', ...props }: ComponentProps<typeof StickToBottom>) {
  return (
    <StickToBottom
      className={`council-conversation ${className}`}
      initial="instant"
      resize="instant"
      role="log"
      {...props}
    />
  )
}
export function ConversationContent({
  className = '',
  ...props
}: ComponentProps<typeof StickToBottom.Content>) {
  return (
    <StickToBottom.Content className={`council-conversation-content ${className}`} {...props} />
  )
}
export function ConversationScrollButton() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()
  return (
    !isAtBottom && (
      <Button
        className="council-scroll-bottom"
        type="button"
        onClick={() => void scrollToBottom({ animation: 'instant' })}
        aria-label="Scroll to latest message"
      >
        ↓ Latest
      </Button>
    )
  )
}

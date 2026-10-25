import type { ComponentPropsWithRef } from 'react'

type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: 'primary' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'icon'
}

// Owned-source UI control: callers retain native button semantics and behavior.
export function Button({ variant = 'outline', size = 'default', className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={`ui-button ui-button--${variant} ui-button--${size} ${className}`} {...props} />
}

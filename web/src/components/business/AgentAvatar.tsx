'use client'

import { useEffect, useId, useRef, useState } from 'react'

const svgSources = new Map<string, Promise<string>>()

type AgentAvatarProps = {
  stillSrc: string
  animatedSrc: string
  reducedMotion: boolean
}

export default function AgentAvatar({ stillSrc, animatedSrc, reducedMotion }: AgentAvatarProps) {
  const avatar = useRef<HTMLSpanElement>(null)
  const host = useRef<HTMLSpanElement>(null)
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, '_')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
    if (reducedMotion) return

    let disposed = false
    let frame = 0
    let removeListeners = () => {}

    async function loadAvatar() {
      // Only our generated local assets are imported into the page DOM.
      const url = new URL(animatedSrc, window.location.href)
      if (url.origin !== window.location.origin || !/^\/agents\/[a-z-]+-animated\.svg$/.test(url.pathname)) return
      let source = svgSources.get(url.href)
      if (!source) {
        source = fetch(url.href).then(response => {
          if (!response.ok) throw new Error('Avatar unavailable')
          return response.text()
        }).catch(error => {
          svgSources.delete(url.href)
          throw error
        })
        svgSources.set(url.href, source)
      }
      const markup = await source
      if (disposed || !host.current || !avatar.current) return
      const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml')
      if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg') return
      const svg = document.importNode(parsed.documentElement, true)

      // Each inline copy needs its own mask and gradient IDs.
      const ids = new Map<string, string>()
      for (const element of svg.querySelectorAll('[id]')) {
        const id = element.getAttribute('id')!
        ids.set(id, `${prefix}-${id}`)
        element.setAttribute('id', `${prefix}-${id}`)
      }
      for (const element of [svg, ...svg.querySelectorAll('*')]) {
        for (const attribute of Array.from(element.attributes)) {
          const value = attribute.value.replace(/url\(#([^)]*)\)/g, (reference, id: string) =>
            ids.has(id) ? `url(#${ids.get(id)})` : reference)
          element.setAttributeNS(attribute.namespaceURI, attribute.name, value)
        }
      }

      // The eye groups live inside the body mask. Add an outer translation so
      // their existing SMIL rotation, blink, scale, and wander keep running.
      const eyes = Array.from(svg.querySelectorAll('mask > g[transform]')).map(eye => {
        const tracker = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        tracker.setAttribute('data-eye-tracker', '')
        tracker.setAttribute('transform', 'translate(0 0)')
        eye.replaceWith(tracker)
        tracker.append(eye)
        return tracker
      })
      svg.setAttribute('width', '100%')
      svg.setAttribute('height', '100%')
      svg.setAttribute('aria-hidden', 'true')
      svg.setAttribute('focusable', 'false')
      host.current.replaceChildren(svg)
      setLoaded(true)

      let bounds = avatar.current.getBoundingClientRect()
      let pointer: { x: number; y: number } | null = null
      let targetX = 0
      let targetY = 0
      let x = 0
      let y = 0
      const finePointer = window.matchMedia('(any-pointer: fine)')
      const animate = () => {
        x += (targetX - x) * 0.16
        y += (targetY - y) * 0.16
        const settled = Math.abs(targetX - x) + Math.abs(targetY - y) < 0.01
        if (settled) { x = targetX; y = targetY }
        for (const eye of eyes) eye.setAttribute('transform', `translate(${x.toFixed(3)} ${y.toFixed(3)})`)
        frame = settled ? 0 : requestAnimationFrame(animate)
      }
      const aim = () => {
        const clamp = (value: number) => Math.max(-1, Math.min(1, value))
        targetX = pointer ? clamp((pointer.x - bounds.left - bounds.width / 2) / 160) * 14 : 0
        targetY = pointer ? clamp((pointer.y - bounds.top - bounds.height / 2) / 160) * 10 : 0
        if (!frame) frame = requestAnimationFrame(animate)
      }
      const move = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse' || !finePointer.matches) return
        if (avatar.current) bounds = avatar.current.getBoundingClientRect()
        pointer = { x: event.clientX, y: event.clientY }
        aim()
      }
      const reset = () => { pointer = null; aim() }
      const refresh = () => {
        if (!avatar.current) return
        bounds = avatar.current.getBoundingClientRect()
        aim()
      }
      window.addEventListener('pointermove', move, { passive: true })
      document.documentElement.addEventListener('pointerleave', reset)
      window.addEventListener('blur', reset)
      window.addEventListener('resize', refresh)
      window.addEventListener('scroll', refresh, true)
      removeListeners = () => {
        window.removeEventListener('pointermove', move)
        document.documentElement.removeEventListener('pointerleave', reset)
        window.removeEventListener('blur', reset)
        window.removeEventListener('resize', refresh)
        window.removeEventListener('scroll', refresh, true)
      }
    }

    void loadAvatar().catch(() => { /* Keep the static avatar when loading fails. */ })
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      removeListeners()
      host.current?.replaceChildren()
    }
  }, [animatedSrc, prefix, reducedMotion])

  return <span className="agent-avatar" ref={avatar} aria-hidden="true" data-animated={loaded && !reducedMotion || undefined}>
    <img className="agent-avatar-still" src={stillSrc} alt="" />
    <span className="agent-avatar-animation" ref={host} />
  </span>
}

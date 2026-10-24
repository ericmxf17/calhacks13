import { createContext, useContext, useEffect, useMemo } from 'react'
import { BoxGeometry, CanvasTexture, MeshStandardMaterial } from 'three'
import { ARCHETYPE_DEFAULTS, type Archetype, type ScenePalette } from '@/lib/scene-spec'
import type { Vec3 } from './layout'

export type Theme = ScenePalette & { wall: string; dark: string; gold: string; glass: string; floor: string; roomIdle: string }

export function sceneTheme(archetype: Archetype, palette: ScenePalette): Theme {
  const defaults = ARCHETYPE_DEFAULTS[archetype].palette
  // The original storefront's back wall is a shade off its roof; other designs reuse the roof color.
  const wall = archetype === 'storefront' && palette.roof === defaults.roof ? '#ef8259' : palette.roof
  return { ...palette, wall, dark: '#253b64', gold: '#ffd447', glass: '#58cde3', floor: '#e48b58', roomIdle: '#b8dfe9' }
}

const ThemeContext = createContext<Theme>(sceneTheme('storefront', ARCHETYPE_DEFAULTS.storefront.palette))
export const ThemeProvider = ThemeContext.Provider
export const useTheme = () => useContext(ThemeContext)

// Every box scales one shared unit cube, and boxes of the same color share a material.
// They are passed as props, not children, so React Three Fiber never disposes them.
const unitBox = new BoxGeometry(1, 1, 1)
const materials = new Map<string, MeshStandardMaterial>()
export function material(color: string, roughness = .84) {
  const key = `${color}|${roughness}`
  let found = materials.get(key)
  if (!found) materials.set(key, found = new MeshStandardMaterial({ color, roughness }))
  return found
}

export function Box({ at, size, color, cast = true, roughness, rotation }: { at: Vec3; size: Vec3; color?: string; cast?: boolean; roughness?: number; rotation?: Vec3 }) {
  const theme = useTheme()
  return <mesh position={at} scale={size} rotation={rotation} geometry={unitBox} material={material(color ?? theme.body, roughness)} castShadow={cast} receiveShadow/>
}

export function Sign({ text, tagline = '', background, color, at, width, height = .49 }: { text: string; tagline?: string; background: string; color: string; at: Vec3; width: number; height?: number }) {
  const texture = useMemo(() => {
    // Keep the original sign's canvas proportions (1024x128 on a 4.75 x .49 plane) at any size.
    const w = Math.round(1024 * (width / height) / (4.75 / .49)), c = document.createElement('canvas'); c.width = w; c.height = 128
    const ctx = c.getContext('2d')!
    ctx.fillStyle = background; ctx.fillRect(0, 0, w, 128)
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const fit = (label: string, size: number, weight: string) => {
      ctx.font = `${weight} ${size}px sans-serif`
      ctx.font = `${weight} ${Math.min(size, size * (w - 80) / Math.max(ctx.measureText(label).width, 1))}px sans-serif`
    }
    const label = text.toUpperCase()
    fit(label, tagline ? 48 : 58, 'bold')
    ctx.fillText(label, w / 2, tagline ? 50 : 65)
    if (tagline) { fit(tagline, 26, '600'); ctx.globalAlpha = .85; ctx.fillText(tagline, w / 2, 101) }
    return new CanvasTexture(c)
  }, [text, tagline, background, color, width, height])
  useEffect(() => () => texture.dispose(), [texture])
  return <mesh position={at}><planeGeometry args={[width, height]}/><meshStandardMaterial map={texture} roughness={1}/></mesh>
}

export function Plant({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return <group position={[x, 0.12, z]} scale={scale}>
    <Box at={[0, .17, 0]} size={[.4, .34, .4]} color="#ee7758" />
    <Box at={[0, .48, 0]} size={[.09, .35, .09]} color="#9c663d" />
    <Box at={[0, .7, 0]} size={[.53, .5, .5]} color="#49b968" />
    <Box at={[.09, .98, .02]} size={[.34, .3, .33]} color="#88d65f" />
  </group>
}

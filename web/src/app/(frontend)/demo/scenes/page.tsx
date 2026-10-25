import { notFound } from 'next/navigation'
import ScenePreview from '@/components/ScenePreview'

// Development only: /demo/scenes?archetype=cafe&rooms=5&props=chimney;cafe_tables,planters
// Every preview opens with the loading screen. Add &build=8 to show the Scene Designer note for 8 seconds after it,
// as if the agent were still working (&build=wait keeps the note up).
export default async function ScenesPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { archetype, rooms, props, build } = await searchParams
  const count = Math.min(6, Math.max(3, Number(rooms) || 4))
  const seconds = typeof build !== 'string' ? undefined : build === 'wait' ? Infinity : Math.max(0, Number(build) || 0)
  return <ScenePreview archetype={typeof archetype === 'string' ? archetype : 'storefront'} rooms={count} props={typeof props === 'string' ? props : undefined} build={seconds}/>
}

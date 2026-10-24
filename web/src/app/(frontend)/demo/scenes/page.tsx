import { notFound } from 'next/navigation'
import ScenePreview from '@/components/ScenePreview'

// Development only: /demo/scenes?archetype=cafe&rooms=5&props=chimney;cafe_tables,planters
export default async function ScenesPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { archetype, rooms, props } = await searchParams
  const count = Math.min(6, Math.max(3, Number(rooms) || 4))
  return <ScenePreview archetype={typeof archetype === 'string' ? archetype : 'storefront'} rooms={count} props={typeof props === 'string' ? props : undefined}/>
}

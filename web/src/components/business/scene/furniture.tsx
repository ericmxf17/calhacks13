import type { Furniture } from '@/lib/scene-spec'
import { Box, useTheme } from './parts'
import { shelfVolumes } from './shelf-volumes'

// Each set fits inside a room (1.03 wide, 1.6 tall, floor at y -.79, back wall at z -.65).
// Only the original desk casts shadows, so new sets add few shadow draws.
type Props = { color: string; variant: number }
const wood = '#dc8550'

function Desk({ color, variant }: Props) {
  const { dark } = useTheme()
  return <group>
    <Box at={[0, -.37, .15]} size={[.82, .07, .48]} color={wood}/>
    {[-.32, .32].map(x => <Box key={x} at={[x, -.62, .16]} size={[.045, .45, .32]} color={dark}/>)}
    <Box at={[.05, -.16, .03]} size={[.3, .27, .035]} color={dark}/>
    <Box at={[.05, -.15, .056]} size={[.25, .21, .01]} color="#bcefff"/>
    <Box at={[-.31, -.27, .19]} size={[.12, .1, .15]} color={color}/>
    <Box at={[.35, .35, -.52]} size={[.32, .43, .035]} color={color}/>
    <Box at={[0, -.8, .4]} size={[.3, .09, .3]} color={color}/>
    <Box at={[0, -.64, .53]} size={[.31, .36, .05]} color={color}/>
    {variant % 2 === 0 && <Box at={[-.4, .17, -.4]} size={[.27, .07, .25]} color={dark}/>}
  </group>
}

function Shelves({ color }: Props) {
  const { dark } = useTheme()
  const frame = shelfVolumes()
  return <group>
    {frame.posts.map(post => <Box key={post.at[0]} {...post} color={dark} cast={false}/>)}
    {frame.rails.map(rail => <Box key={rail.at[1]} {...rail} color={wood} cast={false}/>)}
    <Box at={[-.2, -.51, -.42]} size={[.22, .14, .22]} color={color} cast={false}/>
    <Box at={[.15, -.16, -.42]} size={[.3, .14, .22]} color="#ffd473" cast={false}/>
    <Box at={[-.1, .18, -.42]} size={[.26, .12, .2]} color={color} cast={false}/>
    <Box at={[.25, -.72, .25]} size={[.25, .12, .25]} color={dark} cast={false}/>
  </group>
}

function Workbench({ color }: Props) {
  const { dark } = useTheme()
  return <group>
    <Box at={[0, -.42, -.1]} size={[.9, .06, .5]} color="#c98a55" cast={false}/>
    {[-.4, .4].map(x => <Box key={x} at={[x, -.62, -.1]} size={[.06, .36, .45]} color={dark} cast={false}/>)}
    <Box at={[-.28, -.33, -.15]} size={[.14, .12, .14]} color="#8c99a8" cast={false}/>
    <Box at={[.15, -.34, -.05]} size={[.3, .1, .2]} color={color} cast={false}/>
    <Box at={[0, .15, -.58]} size={[.8, .5, .03]} color="#e9dcc0" cast={false}/>
    <Box at={[-.2, .18, -.555]} size={[.04, .3, .02]} color={dark} cast={false}/>
    <Box at={[.25, .15, -.555]} size={[.12, .12, .02]} color={color} cast={false}/>
    <Box at={[.3, -.68, .3]} size={[.2, .2, .2]} color={dark} cast={false}/>
  </group>
}

function Counter({ color }: Props) {
  const { dark, trim } = useTheme()
  return <group>
    <Box at={[0, -.55, .15]} size={[.85, .45, .32]} color={color} cast={false}/>
    <Box at={[0, -.31, .15]} size={[.92, .05, .38]} color={trim} cast={false}/>
    <Box at={[-.2, -.22, .12]} size={[.2, .14, .16]} color={dark} cast={false}/>
    <Box at={[-.2, -.1, .08]} size={[.16, .1, .02]} color="#bcefff" cast={false}/>
    <Box at={[0, .05, -.55]} size={[.85, .04, .18]} color={wood} cast={false}/>
    {['#ff6488', '#6d8aef', '#ffd447'].map((c, i) => <Box key={c} at={[-.25 + i * .25, .13, -.55]} size={[.15, .12, .12]} color={c} cast={false}/>)}
  </group>
}

function MeetingTable({ color }: Props) {
  const { dark } = useTheme()
  return <group>
    <Box at={[0, -.42, .05]} size={[.6, .05, .45]} color="#f4ead6" cast={false}/>
    <Box at={[0, -.62, .05]} size={[.08, .36, .08]} color={dark} cast={false}/>
    {[-.42, .42].map(x => <Box key={x} at={[x, -.65, .05]} size={[.18, .28, .2]} color={color} cast={false}/>)}
    <Box at={[0, -.65, .42]} size={[.2, .28, .18]} color={color} cast={false}/>
    <Box at={[0, .2, -.58]} size={[.8, .45, .03]} color="#ffffff" cast={false}/>
    <Box at={[-.1, .25, -.56]} size={[.4, .03, .01]} color={color} cast={false}/>
    <Box at={[.05, .12, -.56]} size={[.3, .03, .01]} color={dark} cast={false}/>
  </group>
}

function DraftingTable({ color }: Props) {
  const { dark } = useTheme()
  return <group>
    <Box at={[0, -.3, -.05]} size={[.7, .04, .5]} rotation={[-.5, 0, 0]} color="#f9f4e6" cast={false}/>
    {[-.3, .3].map(x => <Box key={x} at={[x, -.6, -.05]} size={[.04, .4, .04]} color={dark} cast={false}/>)}
    <Box at={[.3, -.05, -.25]} size={[.03, .35, .03]} color={dark} cast={false}/>
    <Box at={[.22, .12, -.2]} size={[.12, .06, .1]} color={color} cast={false}/>
    <Box at={[0, .2, -.58]} size={[.75, .45, .03]} color="#e9dcc0" cast={false}/>
    <Box at={[-.18, .24, -.56]} size={[.2, .18, .01]} color={color} cast={false}/>
    <Box at={[.15, .16, -.56]} size={[.22, .14, .01]} color="#ff8a72" cast={false}/>
  </group>
}

function Lounge({ color }: Props) {
  return <group>
    <Box at={[0, -.66, -.3]} size={[.8, .2, .35]} color={color} cast={false}/>
    <Box at={[0, -.45, -.47]} size={[.8, .3, .08]} color={color} cast={false}/>
    {[-.42, .42].map(x => <Box key={x} at={[x, -.58, -.3]} size={[.08, .28, .35]} color={color} cast={false}/>)}
    <Box at={[0, -.68, .15]} size={[.45, .08, .3]} color={wood} cast={false}/>
    <Box at={[.38, -.68, .32]} size={[.14, .16, .14]} color="#ee7758" cast={false}/>
    <Box at={[.38, -.5, .32]} size={[.2, .2, .2]} color="#49b968" cast={false}/>
    <Box at={[0, .2, -.58]} size={[.4, .3, .03]} color="#ffd473" cast={false}/>
  </group>
}

function Crates({ color }: Props) {
  const { dark } = useTheme()
  return <group>
    <Box at={[0, -.75, -.1]} size={[.8, .06, .55]} color="#c98a55" cast={false}/>
    <Box at={[-.2, -.59, -.15]} size={[.35, .26, .35]} color="#d9a066" cast={false}/>
    <Box at={[.2, -.59, -.15]} size={[.35, .26, .35]} color="#c48a52" cast={false}/>
    <Box at={[-.05, -.33, -.15]} size={[.35, .26, .35]} color="#d9a066" cast={false}/>
    <Box at={[.35, -.55, .3]} size={[.05, .5, .05]} color={dark} cast={false}/>
    <Box at={[.35, -.77, .38]} size={[.2, .03, .15]} color={dark} cast={false}/>
    <Box at={[-.3, .15, -.58]} size={[.25, .32, .03]} color="#ffffff" cast={false}/>
    <Box at={[.25, .15, -.58]} size={[.3, .18, .03]} color={color} cast={false}/>
  </group>
}

const sets: Record<Furniture, (props: Props) => React.JSX.Element> = {
  desk: Desk, shelves: Shelves, workbench: Workbench, counter: Counter,
  meeting_table: MeetingTable, drafting_table: DraftingTable, lounge: Lounge, crates: Crates,
}

export default function RoomFurniture({ type = 'desk', ...props }: Props & { type?: Furniture }) {
  const Set = sets[type] ?? Desk
  return <Set {...props}/>
}

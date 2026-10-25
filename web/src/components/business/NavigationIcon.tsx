type Props = { kind: 'terminal' | 'home' | 'robot' }

/** Small, filled illustrations that keep their colors in every navigation state. */
export default function NavigationIcon({ kind }: Props) {
  return <svg className="navigation-icon" viewBox="0 0 32 32" fill="none" stroke="#243957" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {kind === 'terminal' ? <>
      <rect x="2.5" y="5" width="27" height="23" rx="4" fill="#263d65"/>
      <path d="M3 11h26" stroke="#718caf"/>
      <circle cx="7" cy="8" r="1" fill="#ff826d" stroke="none"/>
      <circle cx="11" cy="8" r="1" fill="#ffda62" stroke="none"/>
      <circle cx="15" cy="8" r="1" fill="#71e4b5" stroke="none"/>
      <path d="m8 16 4 4-4 4m8 0h7" stroke="#87f4cf" strokeWidth="2.4"/>
    </> : kind === 'home' ? <>
      <path d="M6 14v14h20V14L16 6z" fill="#ffe6a0"/>
      <path d="M23 4h4v9h-4z" fill="#e25b58"/>
      <path d="m2 15 14-12 14 12-3 3L16 8 5 18z" fill="#f36b62"/>
      <path d="M19 28v-9h-6v9" fill="#53c7b5"/>
      <path d="M8.5 18h3v4h-3z" fill="#a2deef" strokeWidth="1.2"/>
      <path d="M4 29h24"/>
      <circle cx="17" cy="24" r=".7" fill="#243957" stroke="none"/>
    </> : <>
      <path d="M16 7V4"/>
      <circle cx="16" cy="3.5" r="2" fill="#ffcf4c"/>
      <rect x="1.5" y="14" width="5" height="9" rx="2" fill="#ff8b72"/>
      <rect x="25.5" y="14" width="5" height="9" rx="2" fill="#ff8b72"/>
      <rect x="5" y="8" width="22" height="21" rx="6" fill="#a48aff"/>
      <rect x="8" y="12" width="16" height="11" rx="4" fill="#b5f5dc"/>
      <path d="M12 16v3m8-3v3" strokeWidth="2.8"/>
      <path d="M14 25h4" stroke="#fff2bd" strokeWidth="2"/>
    </>}
  </svg>
}

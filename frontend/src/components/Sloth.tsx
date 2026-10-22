import { useId } from 'react'

export default function Sloth({ small = false }: { small?: boolean }) {
  const uid = useId()
  return <svg viewBox="0 0 360 290" className={small ? 'sloth-small' : 'sloth-art'} aria-hidden="true">
    <defs>
      <linearGradient id={`${uid}-shell`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d2c6ff"/><stop offset=".48" stopColor="#9276d8"/><stop offset="1" stopColor="#46336f"/></linearGradient>
      <linearGradient id={`${uid}-mask`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#252039"/><stop offset="1" stopColor="#12121f"/></linearGradient>
      <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#9e8acb"/><stop offset="1" stopColor="#2d2445"/></linearGradient>
      <filter id={`${uid}-glow`}><feGaussianBlur stdDeviation="3"/></filter>
    </defs>
    <ellipse cx="185" cy="265" rx="112" ry="12" fill="#0d0b1c" opacity=".7"/>
    <g className="sloth-float">
      <path d="M137 157q-27 19-30 64l29 13 97-1 29-20q-10-43-35-56" fill={`url(#${uid}-body)`} stroke="#c4b1ef" strokeWidth="1.5"/>
      <ellipse cx="181" cy="211" rx="39" ry="40" fill="#292336" stroke="#9c8abb"/>
      <path d="M162 214h41m-34 7h27" stroke="#5a486b" strokeWidth="2"/>
      <path d="M129 181q-54-18-57 14t58 42l17-27" fill={`url(#${uid}-shell)`} stroke="#c7b4ed" strokeWidth="1.5"/>
      <path d="M232 181q41-22 54-2t-35 53l-28-21" fill={`url(#${uid}-shell)`} stroke="#c7b4ed" strokeWidth="1.5"/>
      <path d="m88 190 10 10m-14-2 11 9m-12 0 10 8m180-25-8 10m13-2-9 10m12-3-9 10" stroke="#e4d4ff" strokeWidth="4" strokeLinecap="round"/>
      <path d="M144 228q-33 2-28 19t57 1m42-22q39-2 34 16t-57 9" fill={`url(#${uid}-shell)`} stroke="#bda9e0" strokeWidth="1.5"/>
      <path d="m134 244 3 9m8-10 2 10m8-10v9m64-12-2 10m-8-9-1 10m-9-9v10" stroke="#ddd1f1" strokeWidth="3" strokeLinecap="round"/>
      <path d="M98 111q-13-10-4-29t28-7m119 0q22-12 31 10t-8 29" fill={`url(#${uid}-body)`} stroke="#ad96da" strokeWidth="2"/>
      <path d="M101 98q0-55 80-56 80 0 81 57l-3 49q-13 36-77 38-66-1-80-39z" fill={`url(#${uid}-shell)`} stroke="#d8c8ff" strokeWidth="1.5"/>
      <path d="M116 97q22-33 66-6 40-27 65 4l-2 43q-18 28-63 28-45 0-65-29z" fill={`url(#${uid}-mask)`} stroke="#7e6c9b"/>
      <path d="M127 107q19-12 37 13m36 0q20-26 36-13" fill="none" stroke="#3d3159" strokeWidth="24" strokeLinecap="round"/>
      <g stroke="#79ecf4" strokeWidth="4" strokeLinecap="round" fill="none"><path d="m134 117 17 6m61 0 17-6"/><path d="m134 117 17 6m61 0 17-6" filter={`url(#${uid}-glow)`}/></g>
      <path d="M173 132q9-6 18 0-1 10-9 10t-9-10" fill="#a99ac2"/>
      <path d="M171 146q11 9 22-1" fill="none" stroke="#c3b5db" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M159 55h43m-29 5h17" stroke="#ebddff" opacity=".6" strokeLinecap="round"/>
      <path d="m106 115-1 18m151-18v18" stroke="#7eeef5" strokeWidth="3"/>
      <circle cx="181" cy="195" r="5" fill="#72dae7"/><circle cx="181" cy="195" r="8" fill="#72dae7" opacity=".2"/>
    </g>
    {!small && <g fill="#c1aff5" fontFamily="monospace"><text x="283" y="65" fontSize="23" transform="rotate(12 283 65)">z</text><text x="306" y="43" fontSize="16" transform="rotate(12 306 43)">z</text><text x="323" y="25" fontSize="11">z</text></g>}
  </svg>
}

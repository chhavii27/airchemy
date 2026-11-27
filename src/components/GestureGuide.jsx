import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const GUIDE = [
  { gesture: 'Closed fist', action: 'Electric Plasma' },
  { gesture: 'Two fingers (peace)', action: 'Mystic Wings' },
  { gesture: 'Three fingers', action: 'Divine Blossom' },
  { gesture: 'Open palm', action: 'Golden Orbit' },
  { gesture: 'Fist, then burst open', action: 'Big Bang → Cosmic Infinity', special: true },
  { gesture: 'Two-hand heart', action: 'Eternal Love', special: true },
  { gesture: 'Thumb + index (L shape)', action: 'Resize: close the gap to shrink' },
  { gesture: 'Two hands apart / together', action: 'Expand / compress' },
  { gesture: 'Move / tilt your hand', action: 'Move / rotate' },
]

/** Collapsible cheat-sheet of gestures. */
export default function GestureGuide() {
  const [open, setOpen] = useState(true)
  return (
    <section className="glass w-80 overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-white"
      >
        Gesture guide
        <ChevronDown className={`h-4 w-4 text-white/50 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <ul className="min-h-0 space-y-2 overflow-hidden px-4 text-xs">
          {GUIDE.map(({ gesture, action, special }) => (
            <li key={gesture} className="flex justify-between gap-3">
              <span className={special ? 'text-pink-300' : 'text-white/80'}>{gesture}</span>
              <span className="text-right text-white/45">{action}</span>
            </li>
          ))}
          <li className="border-t border-white/10 pt-2 pb-4 text-[11px] leading-relaxed text-white/40">
            Hold each gesture for a moment. Face your palm to the camera in good light.
          </li>
        </ul>
      </div>
    </section>
  )
}

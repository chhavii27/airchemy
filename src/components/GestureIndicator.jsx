import { Hand } from 'lucide-react'
import { gestureStore } from '../state/stores.js'
import { useStore } from '../utils/store.js'
import { GESTURES } from '../utils/gestureRecognition.js'

/** Live readout of the recognised gesture and how many hands are visible. */
export default function GestureIndicator() {
  const hands = useStore(gestureStore, (s) => s.hands)
  const gesture = useStore(gestureStore, (s) => s.gesture)
  const raw = useStore(gestureStore, (s) => s.raw)
  const mode = useStore(gestureStore, (s) => s.mode)
  let info = null
  if (mode === 'spread') info = { label: 'Two hands', action: 'Move apart to expand, together to compress' }
  else if (gesture) info = GESTURES[gesture]
  // Show what we think we see while it is still being confirmed.
  const confirming = !mode && raw && raw !== 'none' && raw !== gesture

  return (
    <div className="glass flex items-center gap-3 rounded-2xl px-4 py-2.5" aria-live="polite">
      <span className={`grid h-8 w-8 place-items-center rounded-full ${hands ? 'bg-cyan-glow/15 text-cyan-glow' : 'bg-white/5 text-white/35'}`}>
        <Hand className="h-4 w-4" />
      </span>
      <div className="min-w-32 leading-tight">
        <p className="text-sm text-white">
          {info ? info.label : hands ? 'Hand detected' : 'Show your hand'}
          {confirming && <span className="text-white/40"> · {GESTURES[raw].label}?</span>}
        </p>
        <p className="text-[11px] text-white/45">
          {info ? `→ ${info.action}` : hands ? 'Hold a gesture steady' : 'No hands in view'}
          {hands > 0 && ` · ${hands} hand${hands > 1 ? 's' : ''}`}
        </p>
      </div>
    </div>
  )
}

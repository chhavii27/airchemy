import { formationStore } from '../state/stores.js'
import { useStore } from '../utils/store.js'
import { FORMATIONS } from '../utils/particleShapes.js'

/**
 * Poetic name of the current formation, e.g. "ELECTRIC PLASMA".
 * Keyed on the formation id, so React remounts it on every change and the
 * CSS fade-in animation replays.
 */
export default function FormationTitle() {
  const id = useStore(formationStore, (s) => s.id)
  const formation = FORMATIONS[id]
  if (!formation) return null
  return (
    <p key={id} className="formation-title pointer-events-none text-center font-display text-xs tracking-[0.45em] text-white/55 uppercase">
      {formation.name}
    </p>
  )
}

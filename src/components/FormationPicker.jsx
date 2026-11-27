import { FORMATIONS, FORMATION_IDS } from '../utils/particleShapes.js'
import { formationStore } from '../state/stores.js'
import { useStore } from '../utils/store.js'

/** Manual formation selection — lets the app be demoed without a webcam. */
export default function FormationPicker({ engineRef }) {
  const value = useStore(formationStore, (s) => s.id)
  const onChange = (id) => engineRef.current?.setFormation(id)
  return (
    <nav aria-label="Formation" className="glass flex gap-1 rounded-full p-1">
      {FORMATION_IDS.map((id) => {
        const active = id === value
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            title={FORMATIONS[id].hint}
            aria-pressed={active}
            className={`shrink-0 rounded-full px-4 py-2 text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-cyan-glow ${
              active ? 'bg-white/12 text-white shadow-[0_0_20px_rgba(166,107,255,0.35)]' : 'text-white/55 hover:text-white'
            }`}
          >
            {FORMATIONS[id].label}
          </button>
        )
      })}
    </nav>
  )
}

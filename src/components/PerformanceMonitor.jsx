import { statsStore } from '../state/stores.js'
import { useStore } from '../utils/store.js'

/** FPS + particle count readout. Subscribes to statsStore on its own, so
 *  frequent updates re-render only this small component. */
export default function PerformanceMonitor() {
  const fps = useStore(statsStore, (s) => Math.round(s.fps))
  const particles = useStore(statsStore, (s) => s.particles)
  const tone = fps >= 50 ? 'bg-emerald-400' : fps >= 30 ? 'bg-amber-300' : 'bg-rose-400'

  return (
    <div className="glass flex items-center gap-3 rounded-full px-3.5 py-1.5 font-mono text-[11px] tracking-wide text-white/70">
      <span className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${tone}`} />
        <span className="w-6 text-right text-white tabular-nums">{fps}</span> FPS
      </span>
      <span className="h-3 w-px bg-white/15" />
      <span className="tabular-nums">{particles.toLocaleString()} pts</span>
    </div>
  )
}

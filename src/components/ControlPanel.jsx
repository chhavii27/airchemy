import { useEffect, useRef, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { BACKGROUNDS } from '../hooks/useSettings.js'

function Slider({ label, value, min, max, step, format = (v) => v, onChange }) {
  return (
    <label className="block">
      <span className="flex justify-between text-xs">
        <span className="text-white/70">{label}</span>
        <span className="font-mono text-white/45 tabular-nums">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-pink-300"
      />
    </label>
  )
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="block text-xs text-white/70">{label}</span>
        {hint && <span className="block text-[10px] text-white/35">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-300 ${checked ? 'bg-pink-400/80' : 'bg-white/15'}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-300 ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  )
}

/** Settings popover behind a single gear button. */
export default function ControlPanel({ settings, onChange, onReset }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  // Close on Escape or a click outside the panel.
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    const onClick = (e) => !rootRef.current?.contains(e.target) && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onClick)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Settings"
        aria-expanded={open}
        title="Settings"
        onClick={() => setOpen((o) => !o)}
        className={`glass grid h-9 w-9 place-items-center rounded-full transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white/40 ${open ? 'text-white' : 'text-white/65'}`}
      >
        <Settings2 className={`h-4 w-4 transition-transform duration-500 ${open ? 'rotate-90' : ''}`} />
      </button>

      <div
        className={`glass absolute top-11 right-0 z-30 w-72 origin-top-right rounded-2xl p-4 transition-all duration-300 ${
          open ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        }`}
        aria-hidden={!open}
      >
        <section className="space-y-4">
            <p className="text-[10px] tracking-[0.2em] text-white/40 uppercase">Particles</p>
            <Slider label="Count" value={settings.count} min={3000} max={16000} step={1000} format={(v) => v.toLocaleString()} onChange={(count) => onChange({ count })} />
            <Slider label="Size" value={settings.size} min={1.2} max={4} step={0.1} format={(v) => v.toFixed(1)} onChange={(size) => onChange({ size })} />
            <Slider label="Speed" value={settings.speed} min={0.25} max={2} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(speed) => onChange({ speed })} />
            <Slider label="Intensity" value={settings.glow} min={0.4} max={1.2} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(glow) => onChange({ glow })} />
            <div>
              <p className="text-xs text-white/70">Background</p>
              <div className="mt-2 flex gap-2">
                {BACKGROUNDS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    title={b.label}
                    aria-label={b.label}
                    aria-pressed={settings.background === b.hex}
                    onClick={() => onChange({ background: b.hex })}
                    className={`h-7 w-7 rounded-full border transition-all ${settings.background === b.hex ? 'border-white/80 ring-2 ring-white/20' : 'border-white/20 hover:border-white/50'}`}
                    style={{ background: b.hex }}
                  />
                ))}
              </div>
            </div>
            <Toggle label="Auto performance" hint="Adjusts particle count to stay smooth" checked={settings.adaptive} onChange={(adaptive) => onChange({ adaptive })} />
            <div className="h-px bg-white/10" />
        </section>
        <section className="mt-4 space-y-4">
          <p className="text-[10px] tracking-[0.2em] text-white/40 uppercase">Camera</p>
          <Toggle label="Camera preview" checked={settings.showPreview} onChange={(showPreview) => onChange({ showPreview })} />
          <Toggle label="Hand skeleton" checked={settings.showSkeleton} onChange={(showSkeleton) => onChange({ showSkeleton })} />
        </section>
        <button type="button" onClick={onReset} className="mt-4 w-full rounded-full py-1.5 text-xs text-white/45 transition-colors hover:bg-white/5 hover:text-white">
          Restore defaults
        </button>
      </div>
    </div>
  )
}

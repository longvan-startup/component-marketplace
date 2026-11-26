/**
 * Controls for a demo's knobs. Range knobs become sliders, enum knobs become a
 * chip group. Each control is labelled and reports the new value upward; the
 * bench decides how to send it to the demo.
 */
import type { DemoKnob, DemoValues } from '../../../features/demo/demo-manifest'
import { Chip } from '../../ui/chip'

export function KnobControls({
  knobs,
  values,
  onChange,
}: {
  knobs: readonly DemoKnob[]
  values: DemoValues
  onChange: (key: string, value: number | string) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      {knobs.map((knob) => {
        if (knob.type === 'range') {
          const value = Number(values[knob.key] ?? knob.default)
          return (
            <label key={knob.key} className="flex flex-col gap-2">
              <span className="flex items-center justify-between text-sm">
                <span className="font-medium">{knob.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{value}</span>
              </span>
              <input
                type="range"
                min={knob.min}
                max={knob.max}
                step={knob.step}
                value={value}
                onChange={(event) => onChange(knob.key, Number(event.target.value))}
                className="w-full accent-primary"
              />
            </label>
          )
        }

        const current = String(values[knob.key] ?? knob.default)
        return (
          <div key={knob.key} className="flex flex-col gap-2">
            <span className="text-sm font-medium">{knob.label}</span>
            <div className="flex flex-wrap gap-2">
              {knob.options.map((option) => (
                <Chip
                  key={option.value}
                  selected={current === option.value}
                  onClick={() => onChange(knob.key, option.value)}
                >
                  {option.label}
                </Chip>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

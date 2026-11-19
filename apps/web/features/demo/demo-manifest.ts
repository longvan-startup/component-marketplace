/**
 * Demo manifest: what a component's live demo needs to be shown and tuned.
 * Lives in the web app until the contract is agreed in `packages/shared`
 * (owner review: Long). Keep it plain data so it can cross the server/client
 * boundary as props.
 */

export type DemoKnob =
  | {
      key: string
      label: string
      type: 'range'
      min: number
      max: number
      step: number
      default: number
    }
  | {
      key: string
      label: string
      type: 'enum'
      options: readonly { value: string; label: string }[]
      default: string
    }

export interface DemoManifest {
  slug: string
  /** Iframe source. Same origin for now; a separate demo origin later. */
  src: string
  knobs: readonly DemoKnob[]
}

export type DemoValues = Record<string, number | string>

export function defaultValues(knobs: readonly DemoKnob[]): DemoValues {
  return Object.fromEntries(knobs.map((knob) => [knob.key, knob.default]))
}

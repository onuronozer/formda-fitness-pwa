import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}

export function ChoiceGrid<T extends string>({ label, value, options, onChange, columns = 2 }: { label: string; value: T; options: ReadonlyArray<{ value: T; label: string; icon?: ReactNode }>; onChange: (value: T) => void; columns?: 2 | 3 }) {
  return <fieldset className="choice-fieldset"><legend>{label}</legend><div className={`choice-grid columns-${columns}`}>{options.map((option) => <button key={option.value} type="button" role="radio" aria-checked={value === option.value} className={value === option.value ? 'selected' : ''} onClick={() => onChange(option.value)}>{option.icon}<span>{option.label}</span>{value === option.value && <Check className="choice-check" size={16} />}</button>)}</div></fieldset>
}

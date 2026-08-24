import { ExternalLink, Info, X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useRef } from 'react'
import type { Exercise } from '../domain/models'
import { ExerciseRepository } from '../db/repositories'
import { useDialogFocus } from './useDialogFocus'

const repository = new ExerciseRepository()

export function ExerciseInfoSheet({ exercise, open, onClose }: { exercise?: Exercise; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null)
  const muscles = useLiveQuery(() => exercise ? repository.listMuscles() : [], [exercise?.id], [])
  const media = useLiveQuery(() => exercise ? repository.getVerifiedMedia(exercise.id) : undefined, [exercise?.id])
  useDialogFocus(open, ref, onClose)
  if (!open || !exercise) return null
  const names = (ids: string[]) => muscles.filter((muscle) => ids.includes(muscle.id)).map((muscle) => muscle.name)
  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section ref={ref} className="measurement-sheet exercise-info-sheet" role="dialog" aria-modal="true" aria-labelledby="exercise-info-title">
    <header><span className="info-mark"><Info size={19} /></span><h2 id="exercise-info-title">Hareket bilgisi</h2><button className="icon-button" aria-label="Kapat" onClick={onClose}><X size={20} /></button></header>
    <h3>{exercise.name}</h3>
    <div className="muscle-groups"><div><span>Ana kas</span><p>{names(exercise.primaryMuscleIds).map((name) => <b key={name}>{name}</b>)}</p></div>{exercise.secondaryMuscleIds.length > 0 && <div><span>Yardımcı</span><p>{names(exercise.secondaryMuscleIds).map((name) => <b key={name}>{name}</b>)}</p></div>}</div>
    <section><h4>Nasıl yapılır</h4><ul>{exercise.instructions.map((item) => <li key={item}>{item}</li>)}</ul></section>
    <section><h4>Dikkat</h4><ul>{exercise.commonMistakes.map((item) => <li key={item}>{item}</li>)}</ul></section>
    {media?.status === 'VERIFIED' && media.url && <a className="primary-button media-action" href={media.url} target="_blank" rel="noreferrer"><ExternalLink size={18} /> Hareketi Gör</a>}
  </section></div>
}

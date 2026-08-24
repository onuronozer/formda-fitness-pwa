import { AlertTriangle, Check, X } from 'lucide-react'
import { useRef } from 'react'
import { useDialogFocus } from './useDialogFocus'

export function PreWorkoutSheet({ open, onClose, onUnchanged, onChanged }: { open: boolean; onClose: () => void; onUnchanged: () => void; onChanged: () => void }) {
  const ref = useRef<HTMLElement>(null)
  useDialogFocus(open, ref, onClose)
  if (!open) return null
  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section ref={ref} className="measurement-sheet pre-workout-sheet" role="dialog" aria-modal="true" aria-labelledby="pre-workout-title">
    <header><span /><h2 id="pre-workout-title">Antrenman öncesi</h2><button className="icon-button" aria-label="Kapat" onClick={onClose}><X size={20} /></button></header>
    <AlertTriangle size={25} /><h3>Bugünkü durumunda değişiklik oldu mu?</h3>
    <div><button className="primary-button" onClick={onUnchanged}><Check size={18} /> Hayır, aynı</button><button className="secondary-button" onClick={onChanged}>Evet, değişti</button></div>
  </section></div>
}

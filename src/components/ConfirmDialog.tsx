import { AlertTriangle } from 'lucide-react'

export function ConfirmDialog({ open, title, message, onCancel, onConfirm }: { open: boolean; title: string; message: string; onCancel: () => void; onConfirm: () => void }) {
  if (!open) return null
  return <div className="dialog-backdrop"><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><AlertTriangle size={24} /><h2 id="confirm-title">{title}</h2><p>{message}</p><div><button className="secondary-button" onClick={onCancel}>Vazgeç</button><button className="danger-button" onClick={onConfirm}>Sil</button></div></section></div>
}

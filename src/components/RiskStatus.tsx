import { AlertOctagon, CheckCircle2, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import type { HealthGateStatus } from '../domain/enums'

const content = {
  NORMAL: { title: 'Program oluşturulabilir', text: 'Sağlık profilinde ek uyarlama gerektiren bir durum yok.', icon: CheckCircle2, tone: 'success' },
  MODIFIED: { title: 'Profiline göre uyarlanacak', text: 'Program seçtiğin sağlık durumları dikkate alınarak düzenlenecek.', icon: SlidersHorizontal, tone: 'warning' },
  MEDICAL_REVIEW_REQUIRED: { title: 'Önce profesyonel değerlendirme', text: 'Program oluşturmadan önce bir sağlık profesyoneliyle görüşmen önerilir.', icon: ShieldCheck, tone: 'review' },
  RED_FLAG_BLOCKED: { title: 'Program oluşturma durduruldu', text: 'Belirttiğin yanıtlar nedeniyle önce profesyonel değerlendirme gerekli.', icon: AlertOctagon, tone: 'danger' },
} as const

export function RiskStatus({ status, compact = false }: { status: HealthGateStatus; compact?: boolean }) {
  const item = content[status]
  const Icon = item.icon
  return <section className={`risk-status ${item.tone} ${compact ? 'compact' : ''}`} aria-live="polite"><Icon size={compact ? 20 : 24} /><div><strong>{item.title}</strong>{!compact && <p>{item.text}</p>}</div></section>
}

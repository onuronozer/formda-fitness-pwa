import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { shortcutActionSchema } from '../validation/phase3bSchemas'
import { WaterService } from '../services/WaterService'

const waterService = new WaterService()
const shortcutQuerySchema = shortcutActionSchema.extend({ id: z.string().min(8).max(200).optional() })

export function ShortcutActionHandler({ userId }: { userId: string }) {
  const location = useLocation()
  const navigate = useNavigate()
  const processing = useRef<string | undefined>(undefined)

  useEffect(() => {
    const parameters = new URLSearchParams(location.search)
    if (!parameters.has('action')) return
    const parsed = shortcutQuerySchema.safeParse({ action: parameters.get('action'), ml: parameters.get('ml'), id: parameters.get('id') ?? undefined })
    if (!parsed.success) {
      navigate('/today', { replace: true, state: { shortcutMessage: 'Kestirme bağlantısı geçersiz.' } })
      return
    }
    const historyState = (window.history.state ?? {}) as Record<string, unknown>
    const actionId = parsed.data.id ?? (typeof historyState.formdaShortcutActionId === 'string' ? historyState.formdaShortcutActionId : crypto.randomUUID())
    if (!parsed.data.id && historyState.formdaShortcutActionId !== actionId) window.history.replaceState({ ...historyState, formdaShortcutActionId: actionId }, '', window.location.href)
    if (processing.current === actionId) return
    processing.current = actionId
    void waterService.addShortcut(userId, parsed.data.ml, actionId).then((result) => {
      navigate('/today', { replace: true, state: { shortcutMessage: result.duplicate ? 'Su kaydı zaten eklenmiş.' : `${parsed.data.ml} ml su eklendi.` } })
    }).catch(() => navigate('/today', { replace: true, state: { shortcutMessage: 'Su eklenemedi.' } }))
  }, [location.search, navigate, userId])

  return null
}

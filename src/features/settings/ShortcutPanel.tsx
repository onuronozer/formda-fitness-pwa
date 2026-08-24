import { Check, Copy, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { HYDRATION_CONFIG } from '../../config/phase3b'

export function ShortcutPanel() {
  const [copied, setCopied] = useState<number>()
  const linkFor = (amount: number) => {
    const url = new URL(import.meta.env.BASE_URL, window.location.origin)
    url.searchParams.set('action', 'water'); url.searchParams.set('ml', String(amount))
    return url.toString()
  }
  const copy = async (amount: number) => { await navigator.clipboard.writeText(linkFor(amount)); setCopied(amount); window.setTimeout(() => setCopied(undefined), 1_500) }
  return <section className="settings-section shortcut-section"><h2>iPhone Su Kestirmesi</h2><div className="shortcut-guide"><Smartphone size={21} /><ol><li>Kestirmeler'de URL aç aksiyonu ekle.</li><li>Aşağıdaki Formda linklerinden birini kullan.</li><li>Kestirmeyi kilit ekranına veya Denetim Merkezi'ne ekle.</li></ol></div><div className="shortcut-links">{HYDRATION_CONFIG.quickAmountsMl.map((amount) => <div key={amount}><span>+{amount} ml</span><code>{linkFor(amount)}</code><button title={`${amount} ml linkini kopyala`} aria-label={`${amount} ml linkini kopyala`} onClick={() => void copy(amount)}>{copied === amount ? <Check size={18} /> : <Copy size={18} />}</button></div>)}</div></section>
}

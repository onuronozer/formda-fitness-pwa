export function AppLogo({ compact = false }: { compact?: boolean }) {
  return <div className={`app-logo ${compact ? 'compact' : ''}`}><img src={`${import.meta.env.BASE_URL}favicon.png`} alt="" />{!compact && <span>FORMDA</span>}</div>
}

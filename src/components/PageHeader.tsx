import type { ReactNode } from 'react'
import { AppLogo } from './AppLogo'

export function PageHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <header className="page-header"><div><AppLogo />{eyebrow && <p>{eyebrow}</p>}<h1>{title}</h1></div>{action}</header>
}

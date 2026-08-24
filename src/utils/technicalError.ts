export function reportTechnicalError(context: string, cause: unknown) {
  if (!import.meta.env.DEV || import.meta.env.MODE === 'test') return
  const name = cause instanceof Error ? cause.name : 'UnknownError'
  const code = typeof cause === 'object' && cause && 'code' in cause && typeof cause.code === 'string' ? cause.code.slice(0, 80) : undefined
  console.error(`[${context}]`, { name, code })
}

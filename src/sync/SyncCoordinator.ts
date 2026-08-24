import { SyncService } from './SyncService'

export class SyncCoordinator {
  private timer?: number
  private onlineHandler?: () => void
  constructor(private readonly service = new SyncService()) {}

  start(userId: string) {
    this.stop()
    const sync = () => { void this.service.syncNow(userId).catch(() => undefined) }
    this.onlineHandler = sync
    window.addEventListener('online', sync)
    this.timer = window.setInterval(sync, 30_000)
    sync()
    return () => this.stop()
  }

  stop() {
    if (this.onlineHandler) window.removeEventListener('online', this.onlineHandler)
    if (this.timer !== undefined) window.clearInterval(this.timer)
    this.onlineHandler = undefined
    this.timer = undefined
  }
}

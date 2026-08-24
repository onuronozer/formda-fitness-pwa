import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useLiveQuery } from 'dexie-react-hooks'
import { Footprints, Minus, Pencil, Plus, Ruler, Scale, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { MeasurementSheet, type MeasurementRecord } from '../../components/MeasurementSheet'
import { PageHeader } from '../../components/PageHeader'
import { PROGRESS_RANGES, type ProgressRange } from '../../config/measurements'
import type { StepRecord, WaistRecord, WeightRecord } from '../../domain/models'
import { UserRepository } from '../../db/repositories'
import { MeasurementDashboardService } from '../../services/MeasurementDashboardService'
import { MeasurementService, type MeasurementKind } from '../../services/MeasurementService'
import { toLocalDate } from '../../utils/localDate'
import { reportTechnicalError } from '../../utils/technicalError'

type Category = 'weight' | 'waist' | 'steps'
interface EditorState { kind?: MeasurementKind; record?: MeasurementRecord }
interface DeleteState { kind: MeasurementKind; record: MeasurementRecord }

const userRepository = new UserRepository()
const dashboardService = new MeasurementDashboardService()
const measurementService = new MeasurementService()
const MeasurementChart = lazy(() => import('../../components/MeasurementChart').then((module) => ({ default: module.MeasurementChart })))

function LazyChart(props: React.ComponentProps<typeof MeasurementChart>) {
  return <Suspense fallback={<div className="chart-empty" role="status"><strong>Grafik hazırlanıyor</strong></div>}><MeasurementChart {...props} /></Suspense>
}

function signed(value: number | undefined, unit: string) {
  if (value === undefined) return 'Henüz yok'
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${Math.abs(value).toFixed(1)} ${unit}`
}

function recordDate(localDate: string) { return format(parseISO(localDate), 'd MMM', { locale: tr }) }

export function ProgressPage() {
  const [category, setCategory] = useState<Category>('weight')
  const [range, setRange] = useState<ProgressRange>(30)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DeleteState | null>(null)
  const profile = useLiveQuery(() => userRepository.getActive())
  const endDate = toLocalDate(new Date())
  const data = useLiveQuery(() => profile ? dashboardService.getProgress(profile.id, profile.targetWeightKg, endDate, range) : undefined, [profile?.id, profile?.targetWeightKg, endDate, range], null)

  const remove = async () => {
    if (!pendingDelete) return
    try { await measurementService.delete(pendingDelete.kind, pendingDelete.record.id) }
    catch (error) { reportTechnicalError('Measurement delete', error) }
    finally { setPendingDelete(null) }
  }

  return <div className="page-content progress-page">
    <PageHeader eyebrow="ÖLÇÜM GEÇMİŞİ" title="İlerleme" action={<button className="secondary-button icon-command" onClick={() => setEditor({})}><Plus size={18} /> Ekle</button>} />
    <div className="progress-category-tabs" role="tablist" aria-label="İlerleme kategorisi">
      <button role="tab" aria-selected={category === 'weight'} className={category === 'weight' ? 'active' : ''} onClick={() => setCategory('weight')}><Scale size={18} /> Kilo</button>
      <button role="tab" aria-selected={category === 'waist'} className={category === 'waist' ? 'active' : ''} onClick={() => setCategory('waist')}><Ruler size={18} /> Bel</button>
      <button role="tab" aria-selected={category === 'steps'} className={category === 'steps' ? 'active' : ''} onClick={() => setCategory('steps')}><Footprints size={18} /> Aktivite</button>
    </div>
    <div className="range-control" aria-label="Tarih aralığı">{PROGRESS_RANGES.map((days) => <button key={days} className={range === days ? 'active' : ''} onClick={() => setRange(days)}>Son {days} Gün</button>)}</div>

    {category === 'weight' && <WeightProgress data={data?.weight} target={profile?.targetWeightKg} onAdd={() => setEditor({ kind: 'weight' })} onEdit={(record) => setEditor({ kind: 'weight', record })} onDelete={(record) => setPendingDelete({ kind: 'weight', record })} />}
    {category === 'waist' && <WaistProgress data={data?.waist} onAdd={() => setEditor({ kind: 'waist' })} onEdit={(record) => setEditor({ kind: 'waist', record })} onDelete={(record) => setPendingDelete({ kind: 'waist', record })} />}
    {category === 'steps' && <StepProgress data={data?.steps} onAdd={() => setEditor({ kind: 'steps' })} onEdit={(record) => setEditor({ kind: 'steps', record })} onDelete={(record) => setPendingDelete({ kind: 'steps', record })} />}

    <MeasurementSheet open={Boolean(editor)} userId={profile?.id ?? ''} initialKind={editor?.kind} record={editor?.record} onClose={() => setEditor(null)} />
    <ConfirmDialog open={Boolean(pendingDelete)} title="Kaydı sil?" message="Bu ölçüm ilerleme hesaplarından çıkarılacak." onCancel={() => setPendingDelete(null)} onConfirm={remove} />
  </div>
}

function WeightProgress({ data, target, onAdd, onEdit, onDelete }: { data?: Awaited<ReturnType<MeasurementDashboardService['getProgress']>>['weight']; target?: number; onAdd: () => void; onEdit: (record: WeightRecord) => void; onDelete: (record: WeightRecord) => void }) {
  const metrics = data?.metrics
  const TrendIcon = metrics?.trend === 'up' ? TrendingUp : metrics?.trend === 'down' ? TrendingDown : Minus
  return <>
    <section className="progress-hero"><span>ŞİMDİ</span><div className="progress-value"><strong>{metrics?.latestWeight?.toFixed(1) ?? '--'}</strong><small>kg</small></div><div className={`trend-chip ${metrics?.trend ?? ''}`}><TrendIcon size={15} /> {signed(metrics?.changeFromStart, 'kg')}</div>
      <div className="goal-progress"><div><span>Başlangıç {metrics?.startingWeight?.toFixed(1) ?? '--'}</span><span>Hedef {target?.toFixed(1) ?? '--'}</span></div><div className="goal-track"><span style={{ width: `${(metrics?.goalProgress ?? 0) * 100}%` }} /></div></div>
    </section>
    <section className="progress-stat-row"><div><span>7 gün ort.</span><strong>{metrics?.rolling7DayAverage?.toFixed(1) ?? '--'} kg</strong></div><div><span>Önceki 7 gün</span><strong>{metrics?.previous7DayAverage?.toFixed(1) ?? '--'} kg</strong></div><div><span>Kalan</span><strong>{metrics?.remainingToTarget?.toFixed(1) ?? '--'} kg</strong></div></section>
    <section className="chart-section"><h2>Kilo trendi</h2><LazyChart data={data?.series ?? []} unit="kg" target={target} /></section>
    <HistorySection title="Kilo geçmişi" empty="İlk kilo ölçümünü ekle." onAdd={onAdd}>{data?.history.map((record) => <HistoryRow key={record.id} icon={<Scale size={18} />} title={`${record.valueKg.toFixed(1)} kg`} subtitle={`${recordDate(record.localDate)} · ${format(new Date(record.measuredAt), 'HH:mm')}`} note={record.note} onEdit={() => onEdit(record)} onDelete={() => onDelete(record)} />)}</HistorySection>
  </>
}

function WaistProgress({ data, onAdd, onEdit, onDelete }: { data?: Awaited<ReturnType<MeasurementDashboardService['getProgress']>>['waist']; onAdd: () => void; onEdit: (record: WaistRecord) => void; onDelete: (record: WaistRecord) => void }) {
  return <>
    <section className="progress-hero waist"><span>SON BEL ÖLÇÜMÜ</span><div className="progress-value"><strong>{data?.metrics.latest?.toFixed(1) ?? '--'}</strong><small>cm</small></div><div className="trend-chip">{signed(data?.metrics.change, 'cm')}</div></section>
    <section className="chart-section"><h2>Bel trendi</h2><LazyChart data={data?.series ?? []} unit="cm" /></section>
    <HistorySection title="Bel geçmişi" empty="İlk bel ölçümünü ekle." onAdd={onAdd}>{data?.history.map((record) => <HistoryRow key={record.id} icon={<Ruler size={18} />} title={`${record.valueCm.toFixed(1)} cm`} subtitle={`${recordDate(record.localDate)} · ${format(new Date(record.measuredAt), 'HH:mm')}`} note={record.note} onEdit={() => onEdit(record)} onDelete={() => onDelete(record)} />)}</HistorySection>
  </>
}

function StepProgress({ data, onAdd, onEdit, onDelete }: { data?: Awaited<ReturnType<MeasurementDashboardService['getProgress']>>['steps']; onAdd: () => void; onEdit: (record: StepRecord) => void; onDelete: (record: StepRecord) => void }) {
  return <>
    <section className="progress-hero steps"><span>BUGÜN</span><div className="progress-value"><strong>{data?.metrics.todaySteps?.toLocaleString('tr-TR') ?? '--'}</strong><small>adım</small></div><div className="goal-progress"><div><span>Günlük hedef</span><span>{data?.target.toLocaleString('tr-TR')}</span></div><div className="goal-track"><span style={{ width: `${(data?.metrics.progress ?? 0) * 100}%` }} /></div></div></section>
    <section className="chart-section"><h2>Günlük aktivite</h2><LazyChart data={data?.series ?? []} unit="adım" target={data?.target} variant="bar" /></section>
    <HistorySection title="Adım geçmişi" empty="İlk günlük adımını ekle." onAdd={onAdd}>{data?.history.map((record) => <HistoryRow key={record.id} icon={<Footprints size={18} />} title={`${record.stepCount.toLocaleString('tr-TR')} adım`} subtitle={recordDate(record.localDate)} onEdit={() => onEdit(record)} onDelete={() => onDelete(record)} />)}</HistorySection>
  </>
}

function HistorySection({ title, empty, onAdd, children }: { title: string; empty: string; onAdd: () => void; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return <section className="history-section"><header><h2>{title}</h2><button className="text-command" onClick={onAdd}><Plus size={16} /> Ekle</button></header>{hasChildren ? <div className="history-list">{children}</div> : <div className="history-empty"><p>{empty}</p><button className="secondary-button" onClick={onAdd}><Plus size={17} /> Ekle</button></div>}</section>
}

function HistoryRow({ icon, title, subtitle, note, onEdit, onDelete }: { icon: React.ReactNode; title: string; subtitle: string; note?: string; onEdit: () => void; onDelete: () => void }) {
  return <article className="history-row"><span className="history-icon">{icon}</span><div><strong>{title}</strong><span>{subtitle}</span>{note && <small>{note}</small>}</div><div className="history-actions"><button title="Düzenle" aria-label={`${title} kaydını düzenle`} onClick={onEdit}><Pencil size={17} /></button><button title="Sil" aria-label={`${title} kaydını sil`} onClick={onDelete}><Trash2 size={17} /></button></div></article>
}

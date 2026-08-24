import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import type { ChartPoint } from '../services/MeasurementDashboardService'

interface MeasurementChartProps {
  data: ChartPoint[]
  unit: string
  target?: number
  variant?: 'line' | 'bar'
  averageLabel?: string
}

const WIDTH = 360
const HEIGHT = 190
const PAD_X = 20
const PAD_TOP = 28
const PAD_BOTTOM = 28

export function MeasurementChart({ data, unit, target, variant = 'line', averageLabel = '7 gün ort.' }: MeasurementChartProps) {
  const [selected, setSelected] = useState(Math.max(0, data.length - 1))
  const geometry = useMemo(() => {
    if (!data.length) return undefined
    const values = data.flatMap((point) => [point.value, point.average].filter((value): value is number => value !== undefined))
    if (target !== undefined) values.push(target)
    const low = Math.min(...values)
    const high = Math.max(...values)
    const padding = Math.max((high - low) * .16, unit === 'adım' ? 500 : 1)
    const min = Math.max(0, low - padding)
    const max = high + padding
    const x = (index: number) => data.length === 1 ? WIDTH / 2 : PAD_X + index * ((WIDTH - PAD_X * 2) / (data.length - 1))
    const y = (value: number) => PAD_TOP + (max - value) / (max - min || 1) * (HEIGHT - PAD_TOP - PAD_BOTTOM)
    const path = (key: 'value' | 'average') => data.map((point, index) => point[key] === undefined ? null : `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point[key]!)}`).filter(Boolean).join(' ')
    return { min, max, x, y, rawPath: path('value'), averagePath: path('average') }
  }, [data, target, unit])

  if (!data.length || !geometry) return <div className="chart-empty"><strong>Henüz veri yok</strong><p>İlk ölçümün burada görünecek.</p></div>
  const current = data[Math.min(selected, data.length - 1)]
  const displayValue = unit === 'adım' ? Math.round(current.value).toLocaleString('tr-TR') : current.value.toFixed(1)

  return <div className="measurement-chart">
    <div className="chart-tooltip"><span>{format(parseISO(current.localDate), 'd MMM', { locale: tr })}</span><strong>{displayValue} {unit}</strong>{current.average !== undefined && <small>{averageLabel}: {unit === 'adım' ? Math.round(current.average).toLocaleString('tr-TR') : current.average.toFixed(1)}</small>}</div>
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${data.length} günlük ölçüm grafiği`}>
      {target !== undefined && <><line className="chart-target" x1={PAD_X} x2={WIDTH - PAD_X} y1={geometry.y(target)} y2={geometry.y(target)} /><text className="chart-target-label" x={WIDTH - PAD_X} y={geometry.y(target) - 6} textAnchor="end">Hedef {target.toLocaleString('tr-TR')}</text></>}
      {variant === 'bar' ? data.map((point, index) => { const x = geometry.x(index); const y = geometry.y(point.value); return <rect key={point.localDate} className={index === selected ? 'chart-bar selected' : 'chart-bar'} x={x - Math.min(11, 125 / data.length)} width={Math.min(22, 250 / data.length)} y={y} height={HEIGHT - PAD_BOTTOM - y} rx="2" /> }) : <path className="chart-raw-line" d={geometry.rawPath} />}
      {geometry.averagePath && <path className="chart-average-line" d={geometry.averagePath} />}
      {data.map((point, index) => <circle key={point.localDate} className="chart-hit" cx={geometry.x(index)} cy={geometry.y(point.value)} r="13" tabIndex={0} onPointerEnter={() => setSelected(index)} onPointerDown={() => setSelected(index)} onFocus={() => setSelected(index)}><title>{point.localDate}: {point.value} {unit}</title></circle>)}
      <text className="chart-axis-label" x={PAD_X} y={HEIGHT - 7}>{format(parseISO(data[0].localDate), 'd MMM', { locale: tr })}</text>
      <text className="chart-axis-label" x={WIDTH - PAD_X} y={HEIGHT - 7} textAnchor="end">{format(parseISO(data.at(-1)!.localDate), 'd MMM', { locale: tr })}</text>
    </svg>
    <div className="chart-legend"><span><i className="raw" /> Günlük</span><span><i className="average" /> {averageLabel}</span>{target !== undefined && <span><i className="target" /> Hedef</span>}</div>
  </div>
}

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, ArrowLeft, FileDown, ChevronDown, ChevronUp } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useBrewing } from '../context/BrewingContext'
import { srmToColor } from '../simulation/constants'
import type { ArchivedProject } from '../types/brewing'

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`
  return `${m} min`
}

function exportArchivePDF(archive: ArchivedProject) {
  const recipe = archive.recipeSnapshot
  const needsHumidity = archive.projectType === 'koji' || archive.projectType === 'mushroom'
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const gravityPoints = !needsHumidity
    ? archive.gravityHistory
        .filter((_, i) => i % Math.max(1, Math.floor(archive.gravityHistory.length / 20)) === 0 || i === archive.gravityHistory.length - 1)
        .map(p => `<tr><td>J${Math.floor(p.time / 86400)}</td><td>${p.gravity.toFixed(3)}</td><td>${p.temperature.toFixed(1)}°C</td></tr>`)
        .join('')
    : ''

  const humidityPoints = needsHumidity && archive.humidityHistory
    ? archive.humidityHistory
        .filter((_, i) => i % Math.max(1, Math.floor(archive.humidityHistory!.length / 20)) === 0 || i === archive.humidityHistory!.length - 1)
        .map(p => `<tr><td>J${Math.floor(p.time / 86400)}</td><td>${p.humidity.toFixed(1)}%</td><td>${p.setpoint.toFixed(0)}%</td></tr>`)
        .join('')
    : ''

  const tempSummary = archive.temperatureHistory.length > 0
    ? (() => {
        const temps = archive.temperatureHistory.map(t => t.temp)
        return `Min: ${Math.min(...temps).toFixed(1)}°C / Max: ${Math.max(...temps).toFixed(1)}°C / Moy: ${(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)}°C`
      })()
    : 'Aucune donnée'

  const brewStepsHtml = archive.brewSteps
    .map(s => {
      const step = recipe.steps.find(rs => rs.id === s.stepId)
      return `<tr>
        <td>${step?.description ?? s.stepId}</td>
        <td>${s.status === 'completed' ? 'Terminé' : s.status === 'skipped' ? 'Passé' : s.status}</td>
        <td>${s.elapsedSeconds > 0 ? formatDuration(s.elapsedSeconds) : '-'}</td>
      </tr>`
    })
    .join('')

  const ingredientsHtml = recipe.ingredients
    .map(i => `<tr><td>${i.name}</td><td>${i.type}</td><td>${i.quantity} ${i.unit}</td><td>${i.addAt}</td></tr>`)
    .join('')

  const metricsHtml = needsHumidity
    ? `<div class="metrics">
        <div class="metric"><div class="metric-label">Type</div><div class="metric-value">${archive.projectType === 'koji' ? 'Koji' : 'Champignons'}</div></div>
        <div class="metric"><div class="metric-label">Masse</div><div class="metric-value">${archive.batchSize} kg</div></div>
        <div class="metric"><div class="metric-label">Humidité finale</div><div class="metric-value">${archive.finalHumidity?.toFixed(0) ?? '-'}%</div></div>
        <div class="metric"><div class="metric-label">Fermentation</div><div class="metric-value">${archive.totalFermentationDays}j</div></div>
      </div>
      <div class="metrics">
        <div class="metric"><div class="metric-label">Températures</div><div class="metric-value" style="font-size:11px">${tempSummary}</div></div>
      </div>`
    : `<div class="metrics">
        <div class="metric"><div class="metric-label">OG</div><div class="metric-value">${archive.og.toFixed(3)}</div></div>
        <div class="metric"><div class="metric-label">FG Visée</div><div class="metric-value">${archive.fg.toFixed(3)}</div></div>
        <div class="metric"><div class="metric-label">FG Réelle</div><div class="metric-value">${archive.finalGravity.toFixed(3)}</div></div>
        <div class="metric"><div class="metric-label">ABV</div><div class="metric-value">${archive.actualAbv}%</div></div>
      </div>
      <div class="metrics">
        <div class="metric"><div class="metric-label">Volume</div><div class="metric-value">${archive.batchSize}L</div></div>
        <div class="metric"><div class="metric-label">SRM</div><div class="metric-value">${archive.srm}</div></div>
        <div class="metric"><div class="metric-label">Fermentation</div><div class="metric-value">${archive.totalFermentationDays}j</div></div>
        <div class="metric"><div class="metric-label">Températures</div><div class="metric-value" style="font-size:11px">${tempSummary}</div></div>
      </div>`

  const historyHtml = needsHumidity
    ? `<h2>Historique humidité (${archive.humidityHistory?.length ?? 0} mesures)</h2>
       <table>
         <thead><tr><th>Jour</th><th>Humidité</th><th>Cible</th></tr></thead>
         <tbody>${humidityPoints || '<tr><td colspan="3">Aucune mesure</td></tr>'}</tbody>
       </table>`
    : `<h2>Historique de densité (${archive.gravityHistory.length} mesures)</h2>
       <table>
         <thead><tr><th>Jour</th><th>Densité</th><th>Température</th></tr></thead>
         <tbody>${gravityPoints || '<tr><td colspan="3">Aucune mesure</td></tr>'}</tbody>
       </table>`

  printWindow.document.write(`<!DOCTYPE html>
<html><head><title>Rapport - ${archive.name}</title>
<style>
body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #222; font-size: 12px; }
h1 { font-size: 20px; margin-bottom: 4px; }
h2 { font-size: 14px; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; color: #444; }
.subtitle { color: #666; font-size: 12px; margin-bottom: 20px; }
.metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
.metric { background: #f5f5f5; border-radius: 6px; padding: 10px; text-align: center; }
.metric-label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
.metric-value { font-size: 16px; font-weight: 700; margin-top: 2px; font-family: monospace; }
table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 8px 0; }
th, td { border: 1px solid #ddd; padding: 5px 8px; text-align: left; }
th { background: #f5f5f5; font-weight: 600; font-size: 10px; text-transform: uppercase; }
.color-dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; vertical-align: middle; margin-right: 6px; }
.footer { margin-top: 30px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
@media print { body { padding: 0; } }
</style></head><body>
<h1><span class="color-dot" style="background:${srmToColor(archive.srm)}"></span>${archive.name}</h1>
<div class="subtitle">${recipe.name} - ${archive.style} | Archivé le ${formatDate(archive.archivedAt)}</div>

${metricsHtml}

<h2>Ingrédients</h2>
<table>
  <thead><tr><th>Nom</th><th>Type</th><th>Quantité</th><th>Ajout</th></tr></thead>
  <tbody>${ingredientsHtml || '<tr><td colspan="4">Aucun ingrédient enregistré</td></tr>'}</tbody>
</table>

<h2>Étapes de brassage</h2>
<table>
  <thead><tr><th>Étape</th><th>Statut</th><th>Durée</th></tr></thead>
  <tbody>${brewStepsHtml || '<tr><td colspan="3">Aucune étape enregistrée</td></tr>'}</tbody>
</table>

${historyHtml}

<h2>Dates clés</h2>
<table>
  <thead><tr><th>Événement</th><th>Date</th></tr></thead>
  <tbody>
    <tr><td>Création du projet</td><td>${formatDate(archive.createdAt)}</td></tr>
    ${archive.brewStartedAt ? `<tr><td>Début du brassage</td><td>${formatDate(archive.brewStartedAt)}</td></tr>` : ''}
    ${archive.brewCompletedAt ? `<tr><td>Fin du brassage</td><td>${formatDate(archive.brewCompletedAt)}</td></tr>` : ''}
    ${archive.fermentationStartedAt ? `<tr><td>Début fermentation</td><td>${formatDate(archive.fermentationStartedAt)}</td></tr>` : ''}
    <tr><td>Archivage</td><td>${formatDate(archive.archivedAt)}</td></tr>
  </tbody>
</table>

<div class="footer">Rapport généré par BrewSCADA le ${formatDate(Date.now())}</div>
</body></html>`)
  printWindow.document.close()
  printWindow.print()
}

function ArchiveReport({ archive }: { archive: ArchivedProject }) {
  const recipe = archive.recipeSnapshot
  const needsHumidity = archive.projectType === 'koji' || archive.projectType === 'mushroom'

  const tempChartData = useMemo(() => {
    if (archive.temperatureHistory.length === 0) return []
    const step = Math.max(1, Math.floor(archive.temperatureHistory.length / 200))
    return archive.temperatureHistory
      .filter((_, i) => i % step === 0 || i === archive.temperatureHistory.length - 1)
      .map(p => ({
        day: p.time / 86400,
        temp: Number(p.temp.toFixed(1)),
        setpoint: Number(p.setpoint.toFixed(1)),
      }))
  }, [archive.temperatureHistory])

  const humidityChartData = useMemo(() => {
    if (!archive.humidityHistory || archive.humidityHistory.length === 0) return []
    const step = Math.max(1, Math.floor(archive.humidityHistory.length / 200))
    return archive.humidityHistory
      .filter((_, i) => i % step === 0 || i === archive.humidityHistory.length - 1)
      .map(p => ({
        day: p.time / 86400,
        humidity: Number(p.humidity.toFixed(1)),
        setpoint: Number(p.setpoint.toFixed(1)),
      }))
  }, [archive.humidityHistory])

  const metricsItems = needsHumidity
    ? [
        { label: 'Humidité finale', value: archive.finalHumidity ? `${archive.finalHumidity.toFixed(0)}%` : '-' },
        { label: 'Fermentation', value: `${archive.totalFermentationDays} jours` },
        { label: 'Volume', value: `${archive.batchSize} kg` },
        { label: 'Type', value: archive.projectType === 'koji' ? 'Koji' : 'Champignons' },
      ]
    : [
        { label: 'OG', value: archive.og.toFixed(3) },
        { label: 'FG Réelle', value: archive.finalGravity.toFixed(3) },
        { label: 'ABV', value: `${archive.actualAbv}%` },
        { label: 'Fermentation', value: `${archive.totalFermentationDays} jours` },
      ]

  return (
    <div className="space-y-4">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {metricsItems.map(m => (
          <div key={m.label} className="bg-scada-bg rounded-lg p-2.5 text-center">
            <div className="text-[8px] text-scada-text-muted uppercase tracking-wider">{m.label}</div>
            <div className="font-mono text-sm font-bold text-white mt-0.5">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-scada-bg rounded-lg p-2 text-center">
          <div className="text-[8px] text-scada-text-muted uppercase">Créé</div>
          <div className="text-[10px] text-white font-mono mt-0.5">{formatDate(archive.createdAt)}</div>
        </div>
        {archive.brewStartedAt && (
          <div className="bg-scada-bg rounded-lg p-2 text-center">
            <div className="text-[8px] text-scada-text-muted uppercase">Brassé</div>
            <div className="text-[10px] text-white font-mono mt-0.5">{formatDate(archive.brewStartedAt)}</div>
          </div>
        )}
        {archive.fermentationStartedAt && (
          <div className="bg-scada-bg rounded-lg p-2 text-center">
            <div className="text-[8px] text-scada-text-muted uppercase">Fermenté</div>
            <div className="text-[10px] text-white font-mono mt-0.5">{formatDate(archive.fermentationStartedAt)}</div>
          </div>
        )}
        <div className="bg-scada-bg rounded-lg p-2 text-center">
          <div className="text-[8px] text-scada-text-muted uppercase">Archivé</div>
          <div className="text-[10px] text-white font-mono mt-0.5">{formatDate(archive.archivedAt)}</div>
        </div>
      </div>

      {/* Temperature Chart */}
      {tempChartData.length > 0 && (
        <div>
          <div className="text-[10px] text-scada-text-secondary uppercase tracking-wider font-medium mb-2">
            Température de fermentation
          </div>
          <div className="bg-scada-bg rounded-lg p-3" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tempChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#555', fontSize: 9 }}
                  tickFormatter={(d: number) => `J${Math.floor(d)}`}
                  stroke="#222"
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fill: '#555', fontSize: 9 }}
                  tickFormatter={(v: number) => `${v}°`}
                  stroke="#222"
                  width={35}
                />
                <Tooltip
                  contentStyle={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 6, fontSize: 10 }}
                  labelFormatter={(d: number) => `Jour ${Math.floor(d as number)}`}
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(1)}°C`,
                    name === 'temp' ? 'Température' : 'Consigne'
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="temp"
                  stroke="#ff6b35"
                  strokeWidth={1.5}
                  dot={false}
                  name="temp"
                />
                <Line
                  type="stepAfter"
                  dataKey="setpoint"
                  stroke="#00d4aa"
                  strokeWidth={1}
                  strokeDasharray="4 2"
                  dot={false}
                  name="setpoint"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Humidity Chart (koji/mushroom) */}
      {needsHumidity && humidityChartData.length > 0 && (
        <div>
          <div className="text-[10px] text-scada-text-secondary uppercase tracking-wider font-medium mb-2">
            Humidité relative
          </div>
          <div className="bg-scada-bg rounded-lg p-3" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={humidityChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#555', fontSize: 9 }}
                  tickFormatter={(d: number) => `J${Math.floor(d)}`}
                  stroke="#222"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#555', fontSize: 9 }}
                  tickFormatter={(v: number) => `${v}%`}
                  stroke="#222"
                  width={35}
                />
                <Tooltip
                  contentStyle={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 6, fontSize: 10 }}
                  labelFormatter={(d: number) => `Jour ${Math.floor(d as number)}`}
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(1)}%`,
                    name === 'humidity' ? 'Humidité' : 'Cible'
                  ]}
                />
                <ReferenceLine
                  y={archive.humidityHistory?.[0]?.setpoint ?? 85}
                  stroke="#00d4aa"
                  strokeDasharray="6 3"
                  strokeWidth={0.5}
                />
                <Line
                  type="monotone"
                  dataKey="humidity"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  dot={false}
                  name="humidity"
                />
                <Line
                  type="stepAfter"
                  dataKey="setpoint"
                  stroke="#00d4aa"
                  strokeWidth={1}
                  strokeDasharray="4 2"
                  dot={false}
                  name="setpoint"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Ingredients */}
      <div>
        <div className="text-[10px] text-scada-text-secondary uppercase tracking-wider font-medium mb-2">Ingrédients</div>
        <div className="space-y-1">
          {recipe.ingredients.map(ing => (
            <div key={ing.id} className="flex items-center justify-between p-2 bg-scada-bg rounded text-[10px]">
              <div className="flex items-center gap-2">
                <span className="text-white">{ing.name}</span>
                <span className="text-scada-text-muted">({ing.type})</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-scada-text-secondary">
                <span>{ing.quantity} {ing.unit}</span>
                <span className="text-scada-text-muted">· {ing.addAt}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Brew Steps */}
      {archive.brewSteps.length > 0 && (
        <div>
          <div className="text-[10px] text-scada-text-secondary uppercase tracking-wider font-medium mb-2">Étapes de brassage</div>
          <div className="space-y-1">
            {archive.brewSteps.map(bs => {
              const step = recipe.steps.find(s => s.id === bs.stepId)
              return (
                <div key={bs.stepId} className="flex items-center justify-between p-2 bg-scada-bg rounded text-[10px]">
                  <span className="text-white">{step?.description ?? bs.stepId}</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-medium ${
                      bs.status === 'completed' ? 'bg-scada-accent/15 text-scada-accent'
                      : bs.status === 'skipped' ? 'bg-scada-text-muted/15 text-scada-text-muted'
                      : 'bg-scada-warning/15 text-scada-warning'
                    }`}>
                      {bs.status === 'completed' ? 'Terminé' : bs.status === 'skipped' ? 'Passé' : bs.status}
                    </span>
                    {bs.elapsedSeconds > 0 && (
                      <span className="font-mono text-scada-text-muted">{formatDuration(bs.elapsedSeconds)}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Gravity History (beer/mead) */}
      {!needsHumidity && archive.gravityHistory.length > 0 && (
        <div>
          <div className="text-[10px] text-scada-text-secondary uppercase tracking-wider font-medium mb-2">
            Historique densité ({archive.gravityHistory.length} mesures)
          </div>
          <div className="max-h-[200px] overflow-y-auto space-y-0.5">
            {archive.gravityHistory
              .filter((_, i) => i % Math.max(1, Math.floor(archive.gravityHistory.length / 30)) === 0 || i === archive.gravityHistory.length - 1)
              .map((p, i) => (
                <div key={i} className="flex items-center justify-between p-1.5 bg-scada-bg rounded text-[9px] font-mono">
                  <span className="text-scada-text-muted">J{Math.floor(p.time / 86400)}</span>
                  <span className="text-white">{p.gravity.toFixed(3)}</span>
                  <span className="text-scada-text-muted">{p.temperature.toFixed(1)}°C</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Humidity History (koji/mushroom) */}
      {needsHumidity && archive.humidityHistory && archive.humidityHistory.length > 0 && (
        <div>
          <div className="text-[10px] text-scada-text-secondary uppercase tracking-wider font-medium mb-2">
            Historique humidité ({archive.humidityHistory.length} mesures)
          </div>
          <div className="max-h-[200px] overflow-y-auto space-y-0.5">
            {archive.humidityHistory
              .filter((_, i) => i % Math.max(1, Math.floor(archive.humidityHistory!.length / 30)) === 0 || i === archive.humidityHistory!.length - 1)
              .map((p, i) => (
                <div key={i} className="flex items-center justify-between p-1.5 bg-scada-bg rounded text-[9px] font-mono">
                  <span className="text-scada-text-muted">J{Math.floor(p.time / 86400)}</span>
                  <span className="text-white">{p.humidity.toFixed(1)}%</span>
                  <span className="text-scada-text-muted">cible: {p.setpoint.toFixed(0)}%</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function ArchivesPage() {
  const navigate = useNavigate()
  const { state } = useBrewing()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const archives = [...state.archivedProjects].sort((a, b) => b.archivedAt - a.archivedAt)

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="scada-btn-neutral p-2">
          <ArrowLeft size={14} />
        </button>
        <div className="flex items-center gap-2">
          <Archive size={16} className="text-scada-text-secondary" />
          <span className="scada-label">Archives</span>
        </div>
        <span className="text-[10px] text-scada-text-muted">
          {archives.length} projet{archives.length > 1 ? 's' : ''} archivé{archives.length > 1 ? 's' : ''}
        </span>
        <div className="flex-1" />
        {expandedId && (
          <button
            onClick={() => {
              const archive = archives.find(a => a.id === expandedId)
              if (archive) exportArchivePDF(archive)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] rounded-lg font-medium bg-scada-accent/15 text-scada-accent border border-scada-accent/30 hover:bg-scada-accent/25 transition-colors"
          >
            <FileDown size={12} />
            Exporter PDF
          </button>
        )}
      </div>

      {archives.length === 0 ? (
        <div className="scada-card flex flex-col items-center justify-center py-12">
          <Archive size={32} className="text-scada-text-muted mb-3" />
          <p className="text-sm text-scada-text-muted">Aucun projet archivé</p>
          <p className="text-[10px] text-scada-text-muted mt-1">
            Archivez un projet depuis sa page de détail pour le retrouver ici
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {archives.map(archive => (
            <div key={archive.id} className="scada-card">
              <button
                onClick={() => setExpandedId(expandedId === archive.id ? null : archive.id)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: srmToColor(archive.srm) }} />
                  <div>
                    <div className="text-xs font-bold text-white">{archive.name}</div>
                    <div className="text-[9px] text-scada-text-muted">
                      {archive.style} · {archive.totalFermentationDays}j
                      {(archive.projectType === 'koji' || archive.projectType === 'mushroom')
                        ? ` · ${archive.finalHumidity?.toFixed(0) ?? '-'}% HR`
                        : ` · ${archive.actualAbv}% ABV`
                      }
                      {' '}· Archivé le {formatDate(archive.archivedAt)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right mr-2">
                    <div className="font-mono text-[10px] text-scada-text-secondary">
                      {(archive.projectType === 'koji' || archive.projectType === 'mushroom')
                        ? `${archive.batchSize} kg`
                        : `${archive.og.toFixed(3)} → ${archive.finalGravity.toFixed(3)}`
                      }
                    </div>
                  </div>
                  {expandedId === archive.id ? <ChevronUp size={14} className="text-scada-text-muted" /> : <ChevronDown size={14} className="text-scada-text-muted" />}
                </div>
              </button>

              {expandedId === archive.id && (
                <div className="mt-4 pt-4 border-t border-scada-border">
                  <ArchiveReport archive={archive} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

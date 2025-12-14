import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { DensityReading, FermentationType, FERMENTATION_TYPES } from '../types';

// ========================================
// Prédiction de fin de fermentation
// Modèle: SG(t) = FG + (OG - FG) × e^(-k×t)
// ========================================

interface FermentationPrediction {
  estimatedFG: number;           // Densité finale estimée
  estimatedEndDate: Date;        // Date de fin estimée
  daysRemaining: number;         // Jours restants
  attenuation: number;           // % d'atténuation estimé
  confidence: 'low' | 'medium' | 'high';  // Confiance de la prédiction
  isComplete: boolean;           // Fermentation terminée ?
  r2: number;                    // Coefficient de détermination (qualité du fit)
}

function predictFermentationEnd(data: DensityReading[]): FermentationPrediction | null {
  // Besoin d'au moins 3 points pour une régression fiable
  if (data.length < 3) return null;

  const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const OG = sortedData[0].density;
  const currentSG = sortedData[sortedData.length - 1].density;

  // Si la densité est déjà très basse ou stable, fermentation probablement terminée
  const lastReadings = sortedData.slice(-3);
  const isStable = lastReadings.length >= 3 &&
    Math.abs(lastReadings[lastReadings.length - 1].density - lastReadings[0].density) < 0.002;

  // Vérifier si la fermentation a déjà commencé (chute de densité)
  if (OG - currentSG < 0.005) {
    return null; // Pas assez de données de fermentation active
  }

  // Convertir les timestamps en jours depuis le début
  const t0 = sortedData[0].timestamp;
  const dataPoints = sortedData.map(d => ({
    t: (d.timestamp - t0) / (24 * 60 * 60 * 1000), // jours
    sg: d.density
  }));

  // Estimation initiale de FG (utiliser la valeur la plus basse observée - 0.002)
  // Une bière typique atteint 75-80% d'atténuation
  const minObserved = Math.min(...sortedData.map(d => d.density));
  const typicalFG = OG - (OG - 1.000) * 0.78; // 78% atténuation typique
  let estimatedFG = Math.max(minObserved - 0.003, typicalFG, 1.000);

  // Régression non-linéaire simplifiée via linéarisation
  // ln(SG - FG) = ln(OG - FG) - k*t
  // On itère pour affiner FG

  let bestK = 0;
  let bestFG = estimatedFG;
  let bestR2 = -Infinity;

  // Chercher le meilleur FG entre minObserved et une valeur raisonnable
  for (let fg = minObserved; fg >= Math.max(1.000, minObserved - 0.015); fg -= 0.001) {
    // Filtrer les points où SG > FG pour pouvoir calculer le log
    const validPoints = dataPoints.filter(p => p.sg > fg + 0.001);
    if (validPoints.length < 3) continue;

    // Régression linéaire sur ln(SG - FG) = a - k*t
    const n = validPoints.length;
    const lnY = validPoints.map(p => Math.log(p.sg - fg));
    const sumT = validPoints.reduce((s, p) => s + p.t, 0);
    const sumLnY = lnY.reduce((s, y) => s + y, 0);
    const sumTLnY = validPoints.reduce((s, p, i) => s + p.t * lnY[i], 0);
    const sumT2 = validPoints.reduce((s, p) => s + p.t * p.t, 0);

    const k = (n * sumTLnY - sumT * sumLnY) / (n * sumT2 - sumT * sumT);
    if (k >= 0 || isNaN(k)) continue; // k doit être négatif (décroissance)

    const kAbs = -k;
    const a = (sumLnY - k * sumT) / n;

    // Calculer R² pour évaluer la qualité du fit
    const predicted = validPoints.map(p => fg + Math.exp(a) * Math.exp(k * p.t));
    const actual = validPoints.map(p => p.sg);
    const meanActual = actual.reduce((s, v) => s + v, 0) / n;
    const ssRes = actual.reduce((s, v, i) => s + Math.pow(v - predicted[i], 2), 0);
    const ssTot = actual.reduce((s, v) => s + Math.pow(v - meanActual, 2), 0);
    const r2 = 1 - ssRes / ssTot;

    if (r2 > bestR2) {
      bestR2 = r2;
      bestK = kAbs;
      bestFG = fg;
    }
  }

  // Si pas de bon fit trouvé, estimer avec les valeurs par défaut
  if (bestK === 0 || bestR2 < 0.5) {
    // Estimation simple basée sur la tendance actuelle
    const daysSoFar = dataPoints[dataPoints.length - 1].t;
    const dropSoFar = OG - currentSG;
    const estimatedTotalDrop = dropSoFar * 1.3; // Estimer 30% de plus
    bestFG = Math.max(OG - estimatedTotalDrop, 1.000);
    bestK = -Math.log((currentSG - bestFG) / (OG - bestFG)) / daysSoFar;
    bestR2 = 0.5;
  }

  // Calculer quand SG sera à 0.001 de FG (considéré comme terminé)
  // SG(t) - FG = 0.001 => (OG - FG) × e^(-k×t) = 0.001
  // t = -ln(0.001 / (OG - FG)) / k
  const threshold = 0.001;
  const tEnd = -Math.log(threshold / (OG - bestFG)) / bestK;

  const currentDays = dataPoints[dataPoints.length - 1].t;
  const daysRemaining = Math.max(0, tEnd - currentDays);

  const estimatedEndDate = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000);

  // Calculer l'atténuation
  const attenuation = ((OG - bestFG) / (OG - 1.000)) * 100;

  // Déterminer le niveau de confiance
  let confidence: 'low' | 'medium' | 'high' = 'low';
  if (bestR2 >= 0.9 && data.length >= 5) {
    confidence = 'high';
  } else if (bestR2 >= 0.7 && data.length >= 4) {
    confidence = 'medium';
  }

  // Vérifier si la fermentation est terminée
  const isComplete = isStable && currentSG < OG - 0.010;

  return {
    estimatedFG: bestFG,
    estimatedEndDate,
    daysRemaining: Math.round(daysRemaining * 10) / 10,
    attenuation: Math.round(attenuation),
    confidence,
    isComplete,
    r2: bestR2
  };
}

// Générer les points de la courbe de prédiction
function generatePredictionCurve(
  data: DensityReading[],
  prediction: FermentationPrediction
): { timestamp: number; predictedDensity: number }[] {
  if (data.length < 2) return [];

  const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const OG = sortedData[0].density;
  const t0 = sortedData[0].timestamp;
  const currentTime = sortedData[sortedData.length - 1].timestamp;

  // Calculer k à partir des données
  const currentDays = (currentTime - t0) / (24 * 60 * 60 * 1000);
  const currentSG = sortedData[sortedData.length - 1].density;

  // Estimer k à partir de la dernière mesure
  const k = -Math.log((currentSG - prediction.estimatedFG) / (OG - prediction.estimatedFG)) / currentDays;

  const points: { timestamp: number; predictedDensity: number }[] = [];

  // Générer des points du début à la fin prédite + 2 jours
  const endTime = prediction.estimatedEndDate.getTime() + 2 * 24 * 60 * 60 * 1000;
  const totalDays = (endTime - t0) / (24 * 60 * 60 * 1000);
  const step = totalDays / 50; // 50 points sur la courbe

  for (let d = 0; d <= totalDays; d += step) {
    const timestamp = t0 + d * 24 * 60 * 60 * 1000;
    const predictedDensity = prediction.estimatedFG + (OG - prediction.estimatedFG) * Math.exp(-k * d);
    points.push({ timestamp, predictedDensity });
  }

  return points;
}

interface DensityChartProps {
  data: DensityReading[];
  type: FermentationType;
  onAddDensity: (density: number, timestamp: number) => void;
  role?: 'admin' | 'viewer' | null;
}

type TimePeriod = '1h' | '6h' | '24h' | '7d' | '30d' | 'all';

export function DensityChart({ data, type, onAddDensity, role }: DensityChartProps) {
  const config = FERMENTATION_TYPES[type];
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('24h');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDensity, setNewDensity] = useState('');
  const [newDate, setNewDate] = useState('');

  const formatTime = (timestamp: number, isLongPeriod: boolean) => {
    const date = new Date(timestamp);
    if (isLongPeriod) {
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' +
             date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const filteredData = useMemo(() => {
    if (data.length === 0) return [];

    const now = Date.now();
    let cutoff = now;

    switch (timePeriod) {
      case '1h':
        cutoff = now - 60 * 60 * 1000;
        break;
      case '6h':
        cutoff = now - 6 * 60 * 60 * 1000;
        break;
      case '24h':
        cutoff = now - 24 * 60 * 60 * 1000;
        break;
      case '7d':
        cutoff = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
        cutoff = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case 'all':
        cutoff = 0;
        break;
    }

    return data.filter(reading => reading.timestamp >= cutoff);
  }, [data, timePeriod]);

  const isLongPeriod = timePeriod === '7d' || timePeriod === '30d' || timePeriod === 'all';

  const chartData = filteredData.map(reading => ({
    time: formatTime(reading.timestamp, isLongPeriod),
    density: reading.density,
    timestamp: reading.timestamp
  }));

  const handleAddDensity = () => {
    const density = parseFloat(newDensity);
    if (!isNaN(density) && density >= 0.990 && density <= 1.200) {
      let timestamp = Date.now();
      if (newDate) {
        timestamp = new Date(newDate).getTime();
      }
      onAddDensity(density, timestamp);
      setNewDensity('');
      setNewDate('');
      setShowAddModal(false);
    }
  };

  // Calcul ABV si au moins 2 mesures
  const calculateABV = () => {
    if (data.length < 2) return null;
    const initialDensity = data[0].density;
    const finalDensity = data[data.length - 1].density;
    // Formule standard: ABV = (OG - FG) * 131.25
    const abv = ((initialDensity - finalDensity) * 131.25).toFixed(2);
    return abv;
  };

  const abv = calculateABV();

  // Prédiction de fin de fermentation
  const prediction = useMemo(() => predictFermentationEnd(data), [data]);

  // Données du graphique avec courbe de prédiction
  const chartDataWithPrediction = useMemo(() => {
    if (!prediction || timePeriod === '1h' || timePeriod === '6h') {
      return chartData.map(d => ({ ...d, predictedDensity: undefined }));
    }

    const predictionCurve = generatePredictionCurve(data, prediction);

    // Fusionner les données réelles avec la courbe de prédiction
    const allTimestamps = new Set([
      ...chartData.map(d => d.timestamp),
      ...predictionCurve.map(p => p.timestamp)
    ]);

    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    return sortedTimestamps.map(ts => {
      const realData = chartData.find(d => d.timestamp === ts);
      const predData = predictionCurve.find(p => Math.abs(p.timestamp - ts) < 3600000); // 1h de tolérance

      return {
        time: formatTime(ts, isLongPeriod),
        timestamp: ts,
        density: realData?.density,
        predictedDensity: predData?.predictedDensity
      };
    });
  }, [chartData, prediction, data, timePeriod, isLongPeriod]);

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3>Suivi de densité</h3>
        <div className="chart-controls">
          <div className="time-period-buttons">
            <button
              className={`period-btn ${timePeriod === '1h' ? 'active' : ''}`}
              onClick={() => setTimePeriod('1h')}
            >
              1h
            </button>
            <button
              className={`period-btn ${timePeriod === '6h' ? 'active' : ''}`}
              onClick={() => setTimePeriod('6h')}
            >
              6h
            </button>
            <button
              className={`period-btn ${timePeriod === '24h' ? 'active' : ''}`}
              onClick={() => setTimePeriod('24h')}
            >
              24h
            </button>
            <button
              className={`period-btn ${timePeriod === '7d' ? 'active' : ''}`}
              onClick={() => setTimePeriod('7d')}
            >
              7j
            </button>
            <button
              className={`period-btn ${timePeriod === '30d' ? 'active' : ''}`}
              onClick={() => setTimePeriod('30d')}
            >
              30j
            </button>
            <button
              className={`period-btn ${timePeriod === 'all' ? 'active' : ''}`}
              onClick={() => setTimePeriod('all')}
            >
              Tout
            </button>
          </div>
          {role === 'admin' && (
            <button className="btn-primary" onClick={() => setShowAddModal(true)}>
              + Ajouter une mesure
            </button>
          )}
        </div>
      </div>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartDataWithPrediction} margin={{ top: 5, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2e33" />
            <XAxis
              dataKey="time"
              stroke="#6e7175"
              style={{ fontSize: '11px', fill: '#8e9196' }}
              angle={0}
              textAnchor="middle"
              height={30}
            />
            <YAxis
              stroke="#6e7175"
              style={{ fontSize: '11px', fill: '#8e9196' }}
              domain={[
                (dataMin: number) => Math.min(dataMin, prediction?.estimatedFG ?? dataMin) - 0.002,
                'dataMax + 0.005'
              ]}
              tickFormatter={(value) => value.toFixed(3)}
              label={{ value: 'SG', angle: -90, position: 'insideLeft', style: { fill: '#8e9196' } }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2328',
                border: '1px solid #2a2e33',
                borderRadius: '2px',
                fontSize: '12px',
                color: '#d4d5d8'
              }}
              labelStyle={{ color: '#8e9196', fontWeight: '500' }}
              formatter={(value: number, name: string) => {
                if (name === 'predictedDensity') return [value?.toFixed(3), 'Prédiction'];
                return [value?.toFixed(3), 'Densité'];
              }}
            />
            {/* Ligne horizontale pour FG estimé */}
            {prediction && (
              <ReferenceLine
                y={prediction.estimatedFG}
                stroke="#4AC694"
                strokeDasharray="5 5"
                strokeOpacity={0.7}
              />
            )}
            {/* Courbe de prédiction (en pointillés) */}
            {prediction && (
              <Line
                type="monotone"
                dataKey="predictedDensity"
                stroke="#4AC694"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls
              />
            )}
            {/* Données réelles */}
            <Line
              type="monotone"
              dataKey="density"
              stroke={config.color}
              strokeWidth={2}
              dot={{ fill: config.color, r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-stats">
        <div className="stat">
          <span className="stat-label">OG (Initiale)</span>
          <span className="stat-value">
            {data.length > 0 ? data[0].density.toFixed(3) : '—'}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">FG (Actuelle)</span>
          <span className="stat-value">
            {data.length > 0 ? data[data.length - 1].density.toFixed(3) : '—'}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">ABV</span>
          <span className="stat-value">
            {abv !== null ? `${abv}%` : '—'}
          </span>
        </div>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Ajouter une mesure de densité</h2>
            <div className="form-group">
              <label htmlFor="date-input" className="form-label">
                Date et heure
              </label>
              <input
                id="date-input"
                type="datetime-local"
                className="form-input"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label htmlFor="density-input" className="form-label">
                Densité (SG - Specific Gravity)
              </label>
              <input
                id="density-input"
                type="number"
                step="0.001"
                min="0.990"
                max="1.200"
                className="form-input"
                placeholder="Ex: 1.050"
                value={newDensity}
                onChange={(e) => setNewDensity(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={handleAddDensity}>
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

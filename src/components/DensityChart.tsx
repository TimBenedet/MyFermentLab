import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DensityReading, FermentationType, FERMENTATION_TYPES } from '../types';

interface DensityChartProps {
  data: DensityReading[];
  type: FermentationType;
  onAddDensity: (density: number, timestamp: number) => void;
}

type TimePeriod = '1h' | '6h' | '24h' | '7d' | '30d' | 'all';

export function DensityChart({ data, type, onAddDensity }: DensityChartProps) {
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
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            + Ajouter une mesure
          </button>
        </div>
      </div>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 20 }}>
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
              domain={[1.000, 'dataMax + 0.005']}
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
            />
            <Line
              type="monotone"
              dataKey="density"
              stroke={config.color}
              strokeWidth={2}
              dot={{ fill: config.color, r: 4 }}
              activeDot={{ r: 6 }}
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

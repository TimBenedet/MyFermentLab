import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { HumidityReading } from '../types';

interface HumidityChartProps {
  data: HumidityReading[];
  targetHumidity?: number;
  onAddHumidity?: (humidity: number, timestamp: number) => void;
  role?: 'admin' | 'viewer' | null;
}

type TimePeriod = '1h' | '6h' | '24h' | '7d' | '30d' | 'all';

export function HumidityChart({ data, targetHumidity, onAddHumidity, role }: HumidityChartProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('24h');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHumidity, setNewHumidity] = useState('');
  const [newDate, setNewDate] = useState('');

  // Couleur bleue pour l'humidité
  const humidityColor = '#3B82F6';

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
    humidity: reading.humidity,
    timestamp: reading.timestamp
  }));

  const handleAddHumidity = () => {
    const humidity = parseFloat(newHumidity);
    if (!isNaN(humidity) && humidity >= 0 && humidity <= 100 && onAddHumidity) {
      let timestamp = Date.now();
      if (newDate) {
        timestamp = new Date(newDate).getTime();
      }
      onAddHumidity(humidity, timestamp);
      setNewHumidity('');
      setNewDate('');
      setShowAddModal(false);
    }
  };

  // Calcul des statistiques
  const stats = useMemo(() => {
    if (data.length === 0) return { min: null, max: null, avg: null, current: null };

    const humidities = data.map(d => d.humidity);
    const min = Math.min(...humidities);
    const max = Math.max(...humidities);
    const avg = humidities.reduce((a, b) => a + b, 0) / humidities.length;
    const current = data[data.length - 1].humidity;

    return { min, max, avg, current };
  }, [data]);

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3>Suivi d'humidité</h3>
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
          {role === 'admin' && onAddHumidity && (
            <button className="btn-primary" onClick={() => setShowAddModal(true)}>
              + Ajouter une mesure
            </button>
          )}
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
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              label={{ value: 'Humidité', angle: -90, position: 'insideLeft', style: { fill: '#8e9196' } }}
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
              formatter={(value: number) => [`${value.toFixed(1)}%`, 'Humidité']}
            />
            {/* Ligne de référence pour l'humidité cible */}
            {targetHumidity && (
              <ReferenceLine
                y={targetHumidity}
                stroke="#4AC694"
                strokeDasharray="5 5"
                strokeOpacity={0.7}
                label={{ value: 'Cible', fill: '#4AC694', fontSize: 10 }}
              />
            )}
            <Line
              type="monotone"
              dataKey="humidity"
              stroke={humidityColor}
              strokeWidth={2}
              dot={chartData.length < 50 ? { fill: humidityColor, r: 3 } : false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-stats">
        <div className="stat">
          <span className="stat-label">Actuelle</span>
          <span className="stat-value" style={{ color: humidityColor }}>
            {stats.current !== null ? `${stats.current.toFixed(1)}%` : '—'}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Moyenne</span>
          <span className="stat-value">
            {stats.avg !== null ? `${stats.avg.toFixed(1)}%` : '—'}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Min</span>
          <span className="stat-value">
            {stats.min !== null ? `${stats.min.toFixed(1)}%` : '—'}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Max</span>
          <span className="stat-value">
            {stats.max !== null ? `${stats.max.toFixed(1)}%` : '—'}
          </span>
        </div>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Ajouter une mesure d'humidité</h2>
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
              <label htmlFor="humidity-input" className="form-label">
                Humidité (%)
              </label>
              <input
                id="humidity-input"
                type="number"
                step="0.1"
                min="0"
                max="100"
                className="form-input"
                placeholder="Ex: 85.5"
                value={newHumidity}
                onChange={(e) => setNewHumidity(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>
                Annuler
              </button>
              <button className="btn-primary" onClick={handleAddHumidity}>
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TemperatureReading, FermentationType, FERMENTATION_TYPES } from '../types';

interface TemperatureChartProps {
  data: TemperatureReading[];
  targetTemperature: number;
  type: FermentationType;
}

type TimePeriod = '1h' | '6h' | '24h' | '7d' | '30d' | 'all';

export function TemperatureChart({ data, targetTemperature, type }: TemperatureChartProps) {
  const config = FERMENTATION_TYPES[type];
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('24h');

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
    temperature: reading.temperature,
    timestamp: reading.timestamp
  }));


  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3>Évolution de la température</h3>
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
              domain={[config.minTemp - 2, config.maxTemp + 2]}
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
            <ReferenceLine
              y={targetTemperature}
              stroke={config.color}
              strokeDasharray="5 5"
              strokeWidth={1}
              label={{
                value: `Cible: ${targetTemperature}°C`,
                position: 'right',
                fill: '#8e9196',
                fontSize: 11,
                fontWeight: '500'
              }}
            />
            <Line
              type="monotone"
              dataKey="temperature"
              stroke={config.color}
              strokeWidth={2}
              dot={chartData.length < 50 ? { fill: config.color, r: 3 } : false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-stats">
        <div className="stat">
          <span className="stat-label">Min</span>
          <span className="stat-value">
            {filteredData.length > 0 ? Math.min(...filteredData.map(d => d.temperature)).toFixed(1) : '—'}°C
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Max</span>
          <span className="stat-value">
            {filteredData.length > 0 ? Math.max(...filteredData.map(d => d.temperature)).toFixed(1) : '—'}°C
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Moyenne</span>
          <span className="stat-value">
            {filteredData.length > 0
              ? (filteredData.reduce((acc, d) => acc + d.temperature, 0) / filteredData.length).toFixed(1)
              : '—'}°C
          </span>
        </div>
      </div>
    </div>
  );
}

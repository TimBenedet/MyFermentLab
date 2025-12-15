import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts';
import { TemperatureReading, DensityReading, FermentationType, FERMENTATION_TYPES } from '../../src/types';

interface MobileChartProps {
  temperatureData: TemperatureReading[];
  densityData?: DensityReading[];
  targetTemperature: number;
  type: FermentationType;
}

type TimePeriod = '6h' | '24h' | '7d';
type ChartType = 'temperature' | 'density';

export function MobileChart({ temperatureData, densityData, targetTemperature, type }: MobileChartProps) {
  const config = FERMENTATION_TYPES[type];
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('24h');
  const [chartType, setChartType] = useState<ChartType>('temperature');

  const hasDensityData = densityData && densityData.length > 0;

  const formatTime = (timestamp: number, isLongPeriod: boolean) => {
    const date = new Date(timestamp);
    if (isLongPeriod) {
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    }
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const filteredTempData = useMemo(() => {
    if (temperatureData.length === 0) return [];

    const now = Date.now();
    let cutoff = now;

    switch (timePeriod) {
      case '6h':
        cutoff = now - 6 * 60 * 60 * 1000;
        break;
      case '24h':
        cutoff = now - 24 * 60 * 60 * 1000;
        break;
      case '7d':
        cutoff = now - 7 * 24 * 60 * 60 * 1000;
        break;
    }

    return temperatureData.filter(reading => reading.timestamp >= cutoff);
  }, [temperatureData, timePeriod]);

  const filteredDensityData = useMemo(() => {
    if (!densityData || densityData.length === 0) return [];

    const now = Date.now();
    let cutoff = now;

    switch (timePeriod) {
      case '6h':
        cutoff = now - 6 * 60 * 60 * 1000;
        break;
      case '24h':
        cutoff = now - 24 * 60 * 60 * 1000;
        break;
      case '7d':
        cutoff = now - 7 * 24 * 60 * 60 * 1000;
        break;
    }

    return densityData.filter(reading => reading.timestamp >= cutoff);
  }, [densityData, timePeriod]);

  const isLongPeriod = timePeriod === '7d';

  const tempChartData = filteredTempData.map(reading => ({
    time: formatTime(reading.timestamp, isLongPeriod),
    value: reading.temperature,
    timestamp: reading.timestamp
  }));

  const densityChartData = filteredDensityData.map(reading => ({
    time: formatTime(reading.timestamp, isLongPeriod),
    value: reading.density,
    timestamp: reading.timestamp
  }));

  const currentData = chartType === 'temperature' ? tempChartData : densityChartData;
  const currentFilteredData = chartType === 'temperature' ? filteredTempData : filteredDensityData;

  // Calculate stats
  const stats = useMemo(() => {
    if (chartType === 'temperature' && filteredTempData.length > 0) {
      const values = filteredTempData.map(d => d.temperature);
      return {
        min: Math.min(...values).toFixed(1) + '°C',
        max: Math.max(...values).toFixed(1) + '°C',
        avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) + '°C'
      };
    } else if (chartType === 'density' && filteredDensityData.length > 0) {
      const values = filteredDensityData.map(d => d.density);
      return {
        min: Math.min(...values).toFixed(3),
        max: Math.max(...values).toFixed(3),
        avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(3)
      };
    }
    return { min: '—', max: '—', avg: '—' };
  }, [chartType, filteredTempData, filteredDensityData]);

  if (temperatureData.length === 0) {
    return (
      <div className="mobile-chart-empty">
        <span>📊</span>
        <p>Aucune donnée disponible</p>
      </div>
    );
  }

  return (
    <div className="mobile-chart">
      {/* Chart Type Selector */}
      {hasDensityData && (
        <div className="chart-type-selector">
          <button
            className={`chart-type-btn ${chartType === 'temperature' ? 'active' : ''}`}
            onClick={() => setChartType('temperature')}
          >
            🌡️ Température
          </button>
          <button
            className={`chart-type-btn ${chartType === 'density' ? 'active' : ''}`}
            onClick={() => setChartType('density')}
          >
            📏 Densité
          </button>
        </div>
      )}

      {/* Time Period Selector */}
      <div className="chart-period-selector">
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
      </div>

      {/* Chart */}
      <div className="chart-container-mobile">
        {currentData.length === 0 ? (
          <div className="chart-no-data">
            <p>Pas de données sur cette période</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="time"
                stroke="#666"
                tick={{ fontSize: 10, fill: '#888' }}
                tickLine={false}
                axisLine={{ stroke: '#333' }}
              />
              <YAxis
                stroke="#666"
                tick={{ fontSize: 10, fill: '#888' }}
                tickLine={false}
                axisLine={{ stroke: '#333' }}
                domain={chartType === 'temperature'
                  ? [config.minTemp - 2, config.maxTemp + 2]
                  : ['auto', 'auto']
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                labelStyle={{ color: '#888' }}
                formatter={(value: number) => [
                  chartType === 'temperature' ? `${value.toFixed(1)}°C` : value.toFixed(3),
                  chartType === 'temperature' ? 'Temp' : 'Densité'
                ]}
              />
              {chartType === 'temperature' && (
                <ReferenceLine
                  y={targetTemperature}
                  stroke={config.color}
                  strokeDasharray="5 5"
                  strokeWidth={1}
                />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke={chartType === 'temperature' ? config.color : '#3b82f6'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: chartType === 'temperature' ? config.color : '#3b82f6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Stats */}
      <div className="chart-stats-mobile">
        <div className="chart-stat">
          <span className="stat-label">Min</span>
          <span className="stat-value">{stats.min}</span>
        </div>
        <div className="chart-stat">
          <span className="stat-label">Moy</span>
          <span className="stat-value">{stats.avg}</span>
        </div>
        <div className="chart-stat">
          <span className="stat-label">Max</span>
          <span className="stat-value">{stats.max}</span>
        </div>
      </div>
    </div>
  );
}

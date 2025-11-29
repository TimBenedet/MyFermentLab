export type FermentationType = 'beer' | 'koji' | 'kombucha' | 'wine' | 'cheese';

export interface TemperatureReading {
  timestamp: number;
  temperature: number;
}

export interface DensityReading {
  timestamp: number;
  density: number; // Densité en g/L
}

export interface Device {
  id: string;
  name: string;
  type: 'sensor' | 'outlet';
  ip?: string;
  entityId?: string; // Home Assistant entity ID
}

export interface Project {
  id: string;
  name: string;
  fermentationType: FermentationType;
  sensorId: string;
  outletId: string;
  targetTemperature: number;
  currentTemperature: number;
  outletActive: boolean;
  history: TemperatureReading[];
  densityHistory?: DensityReading[];
  showDensity?: boolean;
  createdAt: number;
}

export const FERMENTATION_TYPES = {
  beer: { name: 'Bière', icon: '🍺', color: '#F5A742', minTemp: 15, maxTemp: 30 },
  koji: { name: 'Koji', icon: '🍚', color: '#4AC694', minTemp: 25, maxTemp: 35 },
  kombucha: { name: 'Kombucha', icon: '🍵', color: '#9D7EDB', minTemp: 20, maxTemp: 30 },
  wine: { name: 'Vin', icon: '🍷', color: '#E74856', minTemp: 18, maxTemp: 28 },
  cheese: { name: 'Fromage', icon: '🧀', color: '#E9B54D', minTemp: 10, maxTemp: 25 }
} as const;

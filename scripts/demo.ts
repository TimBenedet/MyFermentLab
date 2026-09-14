import { FERMENTATION_BY_ID, FERMENTATIONS, tracksGravity } from '../src/config/fermentations';
import { FermentationEngine, HISTORY_WINDOW_MS, TICK_MS } from '../src/simulation/engine';
import { formatClock, formatMeasure, formatSigned } from '../src/lib/format';
import { assess } from '../src/lib/reading';
import type { FermentConfig } from '../src/types';

const START = Date.UTC(2026, 8, 11, 12, 0, 0);
const engine = new FermentationEngine(FERMENTATIONS, START);

const sizes: number[] = [];
const expectedMax = Math.floor(HISTORY_WINDOW_MS / 30_000) + 1;
let elapsed = 0;

// 45 minutes de ticks de 2 s, puis un onglet resté inactif 3 h d'un seul coup.
for (let tick = 0; tick < 1_350; tick += 1) {
  elapsed += TICK_MS;
  engine.advance(START + elapsed);
  sizes.push(engine.snapshot().fermentations.ipa.history.length);
}
elapsed += 3 * 3_600_000;
engine.advance(START + elapsed);
sizes.push(engine.snapshot().fermentations.ipa.history.length);

const max = Math.max(...sizes);
const min = Math.min(...sizes);

console.log(`Après 45 min de ticks puis 3 h d'inactivité`);
console.log(`Historique IPA : ${min} … ${max} échantillons (plafond attendu ${expectedMax})`);
console.log(max <= expectedMax ? 'OK borne respectée' : 'ÉCHEC la borne est dépassée');

const feed = engine.snapshot();
console.log('\n10 itérations simulées :');
for (let index = 0; index < 10; index += 1) {
  elapsed += TICK_MS;
  engine.advance(START + elapsed);
  const reading = engine.snapshot().fermentations.koji;
  const a = assess(reading);
  const density = reading.current.density ?? Number.NaN;
  console.log(
    `${formatClock(reading.current.t)}  ` +
      `T ${formatMeasure(reading.current.temperature, 2)}  ` +
      `HR ${formatMeasure(reading.current.humidity ?? Number.NaN, 1)}  ` +
      `ΔT ${formatSigned(a.temperatureDelta, 2)}  ` +
      `ΔHR ${formatSigned(a.humidityDelta ?? Number.NaN, 2)}  ` +
      `densité ${Number.isNaN(density) ? '—' : formatMeasure(density, 3)}  ` +
      `${a.temperatureStatus}/${String(a.humidityStatus)}`,
  );
}

console.log('\nContrôles :');
for (const reading of Object.values(feed.fermentations)) {
  const a = assess(reading);
  const finite =
    Number.isFinite(reading.current.temperature) &&
    (reading.current.humidity === null || Number.isFinite(reading.current.humidity)) &&
    (reading.current.density === null || Number.isFinite(reading.current.density));
  const spread = Math.abs(a.temperatureDelta);
  console.log(
    `${reading.config.id.padEnd(9)} ` +
      `type=${reading.config.kind.padEnd(6)} ` +
      `densité=${tracksGravity(reading.config.kind) ? 'suivie' : 'ignorée'} ` +
      `fini=${String(finite).padEnd(5)} ` +
      `écart T ${formatSigned(a.temperatureDelta, 2)} °C  ` +
      `|écart| max sur 24 h ~ ${spread.toFixed(2)}  ` +
      `hist=${reading.history.length}`,
  );
}

/*
 * Le type fait autorité : même si une paire OG/FG traîne dans la configuration d'un
 * ferment dont le type ne suit pas la densité, elle doit être ignorée.
 */
const forged: FermentConfig = {
  ...FERMENTATION_BY_ID.koji,
  gravity: { original: 1.05, final: 1.01, elapsedHours: 48 },
};
const forgedReading = new FermentationEngine([forged], START).snapshot().fermentations.koji;
const forgedAssessment = assess(forgedReading);
console.log(
  `\nType koji avec OG/FG forcés : ` +
    `engine.density=${String(forgedReading.current.density)} ` +
    `assess.density=${String(forgedAssessment.density)} ` +
    `assess.attenuation=${String(forgedAssessment.attenuation)} ` +
    (forgedAssessment.density === null && forgedAssessment.attenuation === null
      ? 'OK densité ignorée'
      : 'ÉCHEC la densité est suivie'),
);

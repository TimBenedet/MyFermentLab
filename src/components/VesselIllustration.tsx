import type { VesselConfig } from '../types';
import { KojiTray } from './KojiTray';
import { MisoCrock } from './MisoCrock';
import { TankVessel } from './TankVessel';

/**
 * Aiguillage vers l'illustration du contenant.
 * L'union discriminée garantit qu'un nouveau type de contenant sans illustration
 * ne compile pas.
 */
export function VesselIllustration({ vessel }: { vessel: VesselConfig }) {
  if (vessel.kind === 'tank') return <TankVessel vessel={vessel} />;
  if (vessel.kind === 'koji') return <KojiTray vessel={vessel} />;
  return <MisoCrock vessel={vessel} />;
}

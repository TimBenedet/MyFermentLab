import { useState, useRef, useCallback, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './LabelGeneratorPage.css';

interface LabelGeneratorPageProps {
  onBack: () => void;
}

type LabelTheme = 'biere' | 'hydromel' | 'koji';

interface LabelData {
  brandName: string;
  brandSubtitle: string;
  productName: string;
  productSeries: string;
  ingredients: string;
  theme: LabelTheme;
  qrCodeUrl: string;
  showQrCode: boolean;
}

interface ElementPosition {
  x: number;
  y: number;
  rotation: number;
}

interface ElementStyle {
  bold: boolean;
  italic: boolean;
  color: string;
  fontSize: number;
}

interface SnapGuide {
  type: 'horizontal' | 'vertical' | 'hCenter' | 'vCenter';
  pos: number;
  style: string;
}

interface SnapResult {
  x: number | null;
  y: number | null;
  guides: SnapGuide[];
}

// Configuration du snap
const SNAP_THRESHOLD = 8;
const LABEL_WIDTH = 700;
const LABEL_HEIGHT = 320;
const MARGIN = 20;
const SMALL_MARGIN = 10;

// Points d'ancrage de l'étiquette - grille complète
const labelAnchorsX = [
  { pos: 0, type: 'edge' },
  { pos: SMALL_MARGIN, type: 'margin-sm' },
  { pos: MARGIN, type: 'margin' },
  { pos: 40, type: 'grid' },
  { pos: 60, type: 'grid' },
  { pos: 80, type: 'grid' },
  { pos: 100, type: 'grid' },
  { pos: 120, type: 'grid' },
  { pos: 140, type: 'grid' },
  { pos: 170, type: 'grid' },
  { pos: LABEL_WIDTH / 4, type: 'quarter' },
  { pos: LABEL_WIDTH / 3, type: 'third' },
  { pos: LABEL_WIDTH / 2, type: 'center' },
  { pos: (LABEL_WIDTH * 2) / 3, type: 'third' },
  { pos: (LABEL_WIDTH * 3) / 4, type: 'quarter' },
  { pos: LABEL_WIDTH - 100, type: 'grid' },
  { pos: LABEL_WIDTH - 80, type: 'grid' },
  { pos: LABEL_WIDTH - 60, type: 'grid' },
  { pos: LABEL_WIDTH - 40, type: 'grid' },
  { pos: LABEL_WIDTH - MARGIN, type: 'margin' },
  { pos: LABEL_WIDTH - SMALL_MARGIN, type: 'margin-sm' },
  { pos: LABEL_WIDTH, type: 'edge' }
];

const labelAnchorsY = [
  { pos: 0, type: 'edge' },
  { pos: SMALL_MARGIN, type: 'margin-sm' },
  { pos: MARGIN, type: 'margin' },
  { pos: 40, type: 'grid' },
  { pos: 50, type: 'grid' },
  { pos: 60, type: 'grid' },
  { pos: 80, type: 'grid' },
  { pos: LABEL_HEIGHT / 4, type: 'quarter' },
  { pos: 100, type: 'grid' },
  { pos: LABEL_HEIGHT / 3, type: 'third' },
  { pos: 120, type: 'grid' },
  { pos: 140, type: 'grid' },
  { pos: LABEL_HEIGHT / 2, type: 'center' },
  { pos: 180, type: 'grid' },
  { pos: 200, type: 'grid' },
  { pos: (LABEL_HEIGHT * 2) / 3, type: 'third' },
  { pos: 220, type: 'grid' },
  { pos: 240, type: 'grid' },
  { pos: (LABEL_HEIGHT * 3) / 4, type: 'quarter' },
  { pos: 260, type: 'grid' },
  { pos: 280, type: 'grid' },
  { pos: LABEL_HEIGHT - MARGIN, type: 'margin' },
  { pos: LABEL_HEIGHT - SMALL_MARGIN, type: 'margin-sm' },
  { pos: LABEL_HEIGHT, type: 'edge' }
];

// Thèmes de couleurs basés sur hakko_labels-2.html
const THEMES: Record<LabelTheme, {
  name: string;
  background: string;
  logoColor: string;
  breweryColor: string;
  dividerColor: string;
  productColor: string;
  seriesColor: string;
  ingredientsColor: string;
}> = {
  biere: {
    name: 'Bière',
    background: 'linear-gradient(135deg, #c9c0b0 0%, #d4cab8 30%, #c5baa8 70%, #bdb2a0 100%)',
    logoColor: '#5c4a3a',
    breweryColor: '#5c4a3a',
    dividerColor: '#5c4a3a',
    productColor: '#4a3828',
    seriesColor: '#c45c20',
    ingredientsColor: '#6a5a4a'
  },
  hydromel: {
    name: 'Hydromel',
    background: 'linear-gradient(135deg, #c9a55c 0%, #d4b068 30%, #c19a4e 70%, #b8914a 100%)',
    logoColor: '#5a4220',
    breweryColor: '#5a4220',
    dividerColor: '#5a4220',
    productColor: '#4a3518',
    seriesColor: '#8b5a00',
    ingredientsColor: '#5a4220'
  },
  koji: {
    name: 'Koji',
    background: 'linear-gradient(135deg, #e8e4dc 0%, #f0ebe3 30%, #e5e0d6 70%, #ddd8ce 100%)',
    logoColor: '#4a5548',
    breweryColor: '#4a5548',
    dividerColor: '#4a5548',
    productColor: '#3a4538',
    seriesColor: '#6b8068',
    ingredientsColor: '#4a5548'
  }
};

// Composant SVG Hop Vine pour la bière
const HopVineSVG = ({ color }: { color: string }) => (
  <svg viewBox="0 0 300 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 28 Q50 10 100 24 Q150 42 200 26 Q250 10 300 30" stroke={color} strokeWidth="1.2" fill="none"/>
    <path d="M55 18 Q60 10 56 2" stroke={color} strokeWidth="0.6" fill="none"/>
    <path d="M115 38 Q122 48 118 58 Q114 65 119 70" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M220 16 Q228 8 224 0" stroke={color} strokeWidth="0.6" fill="none"/>
    <path d="M275 28 Q282 36 278 45" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M32 22 Q24 14 18 18 Q14 24 18 32 Q22 38 30 36 Q36 32 36 26 Q36 20 32 22" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M165 30 Q156 22 150 26 Q146 32 150 40 Q154 46 162 44 Q168 40 168 34 Q168 28 165 30" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M252 22 Q244 14 238 18 Q234 24 238 32 Q242 38 250 36 Q256 32 256 26 Q256 20 252 22" stroke={color} strokeWidth="0.5" fill="none"/>
    <g transform="translate(65, 22)">
      <path d="M0 0 L0 8" stroke={color} strokeWidth="0.8" fill="none"/>
      <ellipse cx="0" cy="8" rx="2" ry="3" stroke={color} strokeWidth="0.5" fill="none"/>
      <path d="M0 10 Q-3 14 -2 20 Q0 22 2 20 Q3 14 0 10 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M-2 16 Q-12 20 -14 32 Q-12 38 -6 36 Q-2 28 -2 20 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M2 16 Q12 20 14 32 Q12 38 6 36 Q2 28 2 20 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M-4 28 Q-16 34 -18 48 Q-16 56 -8 52 Q-4 42 -4 32 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M0 26 Q-6 36 -6 50 Q0 56 6 50 Q6 36 0 26 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M4 28 Q16 34 18 48 Q16 56 8 52 Q4 42 4 32 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M-6 46 Q-18 54 -20 70 Q-18 78 -10 74 Q-6 62 -6 50 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M0 44 Q-8 56 -8 72 Q0 80 8 72 Q8 56 0 44 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M6 46 Q18 54 20 70 Q18 78 10 74 Q6 62 6 50 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M0 84 Q-4 94 0 102 Q4 94 0 84 Z" stroke={color} strokeWidth="0.35" fill="none"/>
    </g>
    <g transform="translate(138, 38)">
      <path d="M0 0 L0 10" stroke={color} strokeWidth="0.8" fill="none"/>
      <ellipse cx="0" cy="10" rx="2.5" ry="3.5" stroke={color} strokeWidth="0.5" fill="none"/>
      <path d="M0 12 Q-4 18 -3 26 Q0 29 3 26 Q4 18 0 12 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M-3 20 Q-14 26 -16 40 Q-14 48 -7 44 Q-3 34 -3 24 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M3 20 Q14 26 16 40 Q14 48 7 44 Q3 34 3 24 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M-5 36 Q-20 44 -22 62 Q-20 72 -10 66 Q-5 52 -5 40 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M0 34 Q-8 46 -8 64 Q0 74 8 64 Q8 46 0 34 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M5 36 Q20 44 22 62 Q20 72 10 66 Q5 52 5 40 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M0 106 Q-5 118 0 128 Q5 118 0 106 Z" stroke={color} strokeWidth="0.35" fill="none"/>
    </g>
    <g transform="translate(198, 20)">
      <path d="M0 0 L0 6" stroke={color} strokeWidth="0.7" fill="none"/>
      <ellipse cx="0" cy="6" rx="1.5" ry="2.5" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M0 8 Q-2 12 -1.5 18 Q0 20 1.5 18 Q2 12 0 8 Z" stroke={color} strokeWidth="0.35" fill="none"/>
      <path d="M-2 14 Q-10 18 -11 28 Q-10 34 -5 31 Q-2 24 -2 17 Z" stroke={color} strokeWidth="0.35" fill="none"/>
      <path d="M2 14 Q10 18 11 28 Q10 34 5 31 Q2 24 2 17 Z" stroke={color} strokeWidth="0.35" fill="none"/>
      <path d="M0 62 Q-3 72 0 80 Q3 72 0 62 Z" stroke={color} strokeWidth="0.3" fill="none"/>
    </g>
    <g transform="translate(262, 26)">
      <path d="M0 0 L0 8" stroke={color} strokeWidth="0.8" fill="none"/>
      <ellipse cx="0" cy="8" rx="2" ry="3" stroke={color} strokeWidth="0.5" fill="none"/>
      <path d="M0 10 Q-3 14 -2 20 Q0 22 2 20 Q3 14 0 10 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M-2 16 Q-12 20 -14 32 Q-12 38 -6 36 Q-2 28 -2 20 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M2 16 Q12 20 14 32 Q12 38 6 36 Q2 28 2 20 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M0 84 Q-4 94 0 102 Q4 94 0 84 Z" stroke={color} strokeWidth="0.35" fill="none"/>
    </g>
  </svg>
);

// Composant SVG Honeycomb pour l'hydromel
const HoneycombSVG = ({ color }: { color: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M25 10 L35 5 L45 10 L45 22 L35 27 L25 22 Z" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M45 10 L55 5 L65 10 L65 22 L55 27 L45 22 Z" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M65 10 L75 5 L85 10 L85 22 L75 27 L65 22 Z" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M15 25 L25 20 L35 25 L35 37 L25 42 L15 37 Z" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M35 25 L45 20 L55 25 L55 37 L45 42 L35 37 Z" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M55 25 L65 20 L75 25 L75 37 L65 42 L55 37 Z" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M75 25 L85 20 L95 25 L95 37 L85 42 L75 37 Z" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M25 40 L35 35 L45 40 L45 52 L35 57 L25 52 Z" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M45 40 L55 35 L65 40 L65 52 L55 57 L45 52 Z" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M65 40 L75 35 L85 40 L85 52 L75 57 L65 52 Z" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M25 70 L35 65 L45 70 L45 82 L35 87 L25 82 Z" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M45 70 L55 65 L65 70 L65 82 L55 87 L45 82 Z" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M65 70 L75 65 L85 70 L85 82 L75 87 L65 82 Z" stroke={color} strokeWidth="0.5" fill="none"/>
  </svg>
);

// Composant SVG Bee pour l'hydromel
const BeeSVG = ({ color }: { color: string }) => (
  <svg viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="25" cy="28" rx="10" ry="14" stroke={color} strokeWidth="0.8" fill="none"/>
    <path d="M16 24 Q25 22 34 24" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M16 30 Q25 28 34 30" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M17 36 Q25 34 33 36" stroke={color} strokeWidth="0.5" fill="none"/>
    <circle cx="25" cy="12" r="5" stroke={color} strokeWidth="0.8" fill="none"/>
    <ellipse cx="14" cy="22" rx="7" ry="4" stroke={color} strokeWidth="0.5" fill="none" transform="rotate(-20 14 22)"/>
    <ellipse cx="36" cy="22" rx="7" ry="4" stroke={color} strokeWidth="0.5" fill="none" transform="rotate(20 36 22)"/>
    <path d="M22 8 Q20 4 18 2" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M28 8 Q30 4 32 2" stroke={color} strokeWidth="0.5" fill="none"/>
  </svg>
);

// Composant SVG Koji pattern
const KojiPatternSVG = ({ color }: { color: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="3" fill={color} opacity="0.6"/>
    <circle cx="50" cy="50" r="6" stroke={color} strokeWidth="0.3" fill="none" opacity="0.4"/>
    <path d="M50 50 Q55 40 60 25" stroke={color} strokeWidth="0.4" fill="none"/>
    <path d="M50 50 Q60 45 75 40" stroke={color} strokeWidth="0.4" fill="none"/>
    <path d="M50 50 Q60 55 78 58" stroke={color} strokeWidth="0.4" fill="none"/>
    <path d="M50 50 Q55 60 62 78" stroke={color} strokeWidth="0.4" fill="none"/>
    <path d="M50 50 Q45 60 40 80" stroke={color} strokeWidth="0.4" fill="none"/>
    <path d="M50 50 Q40 55 22 60" stroke={color} strokeWidth="0.4" fill="none"/>
    <path d="M50 50 Q40 48 20 45" stroke={color} strokeWidth="0.4" fill="none"/>
    <path d="M50 50 Q45 40 35 22" stroke={color} strokeWidth="0.4" fill="none"/>
    <circle cx="58" cy="15" r="2" fill={color} opacity="0.5"/>
    <circle cx="85" cy="32" r="2" fill={color} opacity="0.5"/>
    <circle cx="90" cy="55" r="1.8" fill={color} opacity="0.5"/>
    <circle cx="55" cy="90" r="2" fill={color} opacity="0.5"/>
    <circle cx="35" cy="92" r="1.8" fill={color} opacity="0.5"/>
    <circle cx="8" cy="55" r="2" fill={color} opacity="0.5"/>
    <circle cx="5" cy="40" r="1.8" fill={color} opacity="0.5"/>
    <circle cx="25" cy="12" r="2" fill={color} opacity="0.5"/>
  </svg>
);

export function LabelGeneratorPage({ onBack }: LabelGeneratorPageProps) {
  const [labelData, setLabelData] = useState<LabelData>({
    brandName: 'HAKKO',
    brandSubtitle: 'BREWERY',
    productName: 'Lumière dorée',
    productSeries: 'Série I — Bière de Noël',
    ingredients: 'Malt pilsner, houblon Saaz, miel de tilleul, levure belge',
    theme: 'biere',
    qrCodeUrl: '',
    showQrCode: false
  });

  // Positions des éléments (pour le drag & drop)
  // Layout par défaut basé sur hakko_labels-2.html
  const [positions, setPositions] = useState<Record<string, ElementPosition>>({
    brand: { x: 45, y: 50, rotation: 0 },
    subtitle: { x: 95, y: 95, rotation: 0 },
    divider: { x: 140, y: 25, rotation: 0 },
    product: { x: 170, y: 55, rotation: 0 },
    series: { x: 170, y: 125, rotation: 0 },
    ingredients: { x: 170, y: 200, rotation: 0 },
    qrcode: { x: 630, y: 250, rotation: 0 }
  });

  // Styles des éléments
  const [styles, setStyles] = useState<Record<string, ElementStyle>>({
    brand: { bold: false, italic: false, color: '#5c4a3a', fontSize: 38 },
    subtitle: { bold: false, italic: false, color: '#5c4a3a', fontSize: 9 },
    product: { bold: false, italic: false, color: '#4a3828', fontSize: 58 },
    series: { bold: false, italic: false, color: '#c45c20', fontSize: 13 },
    ingredients: { bold: false, italic: true, color: '#6a5a4a', fontSize: 20 }
  });

  const [fontSizePopover, setFontSizePopover] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeGuides, setActiveGuides] = useState<SnapGuide[]>([]);
  const [isSnapped, setIsSnapped] = useState(false);
  const [dragCoords, setDragCoords] = useState<{ x: number; y: number; mouseX: number; mouseY: number } | null>(null);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    brand: true,
    product: false,
    appearance: false,
    qrcode: false
  });

  const labelRef = useRef<HTMLDivElement>(null);
  const elementRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);

  const theme = THEMES[labelData.theme];

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleInputChange = (field: keyof LabelData, value: string | boolean) => {
    setLabelData(prev => ({ ...prev, [field]: value }));
  };

  const handleStyleToggle = (element: string, style: 'bold' | 'italic') => {
    setStyles(prev => ({
      ...prev,
      [element]: { ...prev[element], [style]: !prev[element][style] }
    }));
  };

  const handleColorChange = (element: string, color: string) => {
    setStyles(prev => ({
      ...prev,
      [element]: { ...prev[element], color }
    }));
  };

  const handleFontSizeChange = (element: string, fontSize: number) => {
    setStyles(prev => ({
      ...prev,
      [element]: { ...prev[element], fontSize: Math.max(8, Math.min(120, fontSize)) }
    }));
  };

  const toggleFontSizePopover = (element: string) => {
    setFontSizePopover(prev => prev === element ? null : element);
  };

  const handleRotationChange = (element: string, rotation: number) => {
    setPositions(prev => ({
      ...prev,
      [element]: { ...prev[element], rotation }
    }));
  };

  // Obtenir les points d'ancrage d'un élément
  const getElementAnchors = useCallback((elementKey: string) => {
    const element = elementRefs.current[elementKey];
    if (!element) return null;
    const pos = positions[elementKey];
    const rect = element.getBoundingClientRect();
    return {
      left: pos.x,
      centerX: pos.x + rect.width / 2,
      right: pos.x + rect.width,
      top: pos.y,
      centerY: pos.y + rect.height / 2,
      bottom: pos.y + rect.height,
      width: rect.width,
      height: rect.height
    };
  }, [positions]);

  // Trouver les snaps possibles
  const findSnaps = useCallback((currentKey: string, newLeft: number, newTop: number): SnapResult => {
    const currentElement = elementRefs.current[currentKey];
    if (!currentElement) return { x: null, y: null, guides: [] };

    const currentRect = currentElement.getBoundingClientRect();
    const currentWidth = currentRect.width;
    const currentHeight = currentRect.height;

    const snaps: SnapResult = { x: null, y: null, guides: [] };

    const currentAnchors = {
      left: newLeft,
      centerX: newLeft + currentWidth / 2,
      right: newLeft + currentWidth,
      top: newTop,
      centerY: newTop + currentHeight / 2,
      bottom: newTop + currentHeight
    };

    // Snaps avec les ancres de l'étiquette (X)
    for (const anchor of labelAnchorsX) {
      if (Math.abs(currentAnchors.left - anchor.pos) < SNAP_THRESHOLD) {
        snaps.x = anchor.pos;
        snaps.guides.push({ type: anchor.type === 'center' ? 'vCenter' : 'vertical', pos: anchor.pos, style: anchor.type });
      } else if (Math.abs(currentAnchors.centerX - anchor.pos) < SNAP_THRESHOLD) {
        snaps.x = anchor.pos - currentWidth / 2;
        snaps.guides.push({ type: anchor.type === 'center' ? 'vCenter' : 'vertical', pos: anchor.pos, style: anchor.type });
      } else if (Math.abs(currentAnchors.right - anchor.pos) < SNAP_THRESHOLD) {
        snaps.x = anchor.pos - currentWidth;
        snaps.guides.push({ type: anchor.type === 'center' ? 'vCenter' : 'vertical', pos: anchor.pos, style: anchor.type });
      }
    }

    // Snaps avec les ancres de l'étiquette (Y)
    for (const anchor of labelAnchorsY) {
      if (Math.abs(currentAnchors.top - anchor.pos) < SNAP_THRESHOLD) {
        snaps.y = anchor.pos;
        snaps.guides.push({ type: anchor.type === 'center' ? 'hCenter' : 'horizontal', pos: anchor.pos, style: anchor.type });
      } else if (Math.abs(currentAnchors.centerY - anchor.pos) < SNAP_THRESHOLD) {
        snaps.y = anchor.pos - currentHeight / 2;
        snaps.guides.push({ type: anchor.type === 'center' ? 'hCenter' : 'horizontal', pos: anchor.pos, style: anchor.type });
      } else if (Math.abs(currentAnchors.bottom - anchor.pos) < SNAP_THRESHOLD) {
        snaps.y = anchor.pos - currentHeight;
        snaps.guides.push({ type: anchor.type === 'center' ? 'hCenter' : 'horizontal', pos: anchor.pos, style: anchor.type });
      }
    }

    // Alignement avec les autres éléments
    Object.keys(positions).forEach(otherKey => {
      if (otherKey === currentKey) return;
      const otherAnchors = getElementAnchors(otherKey);
      if (!otherAnchors) return;

      // Alignements horizontaux
      if (Math.abs(currentAnchors.top - otherAnchors.top) < SNAP_THRESHOLD) {
        snaps.y = otherAnchors.top;
        snaps.guides.push({ type: 'horizontal', pos: otherAnchors.top, style: 'element' });
      }
      if (Math.abs(currentAnchors.centerY - otherAnchors.centerY) < SNAP_THRESHOLD) {
        snaps.y = otherAnchors.centerY - currentHeight / 2;
        snaps.guides.push({ type: 'horizontal', pos: otherAnchors.centerY, style: 'element' });
      }

      // Alignements verticaux
      if (Math.abs(currentAnchors.left - otherAnchors.left) < SNAP_THRESHOLD) {
        snaps.x = otherAnchors.left;
        snaps.guides.push({ type: 'vertical', pos: otherAnchors.left, style: 'element' });
      }
      if (Math.abs(currentAnchors.centerX - otherAnchors.centerX) < SNAP_THRESHOLD) {
        snaps.x = otherAnchors.centerX - currentWidth / 2;
        snaps.guides.push({ type: 'vertical', pos: otherAnchors.centerX, style: 'element' });
      }
    });

    return snaps;
  }, [positions, getElementAnchors]);

  const handleMouseDown = (element: string, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedElement(element);
    setIsDragging(true);
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startLeft: positions[element].x,
      startTop: positions[element].y
    };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !selectedElement || !dragStateRef.current) return;

    const deltaX = e.clientX - dragStateRef.current.startX;
    const deltaY = e.clientY - dragStateRef.current.startY;

    let newLeft = dragStateRef.current.startLeft + deltaX;
    let newTop = dragStateRef.current.startTop + deltaY;

    const snaps = findSnaps(selectedElement, newLeft, newTop);
    if (snaps.x !== null) newLeft = snaps.x;
    if (snaps.y !== null) newTop = snaps.y;

    newLeft = Math.max(0, Math.min(LABEL_WIDTH - 20, newLeft));
    newTop = Math.max(0, Math.min(LABEL_HEIGHT - 20, newTop));

    setActiveGuides(snaps.guides);
    setIsSnapped(snaps.guides.length > 0);
    setDragCoords({ x: Math.round(newLeft), y: Math.round(newTop), mouseX: e.clientX, mouseY: e.clientY });

    setPositions(prev => ({
      ...prev,
      [selectedElement]: { ...prev[selectedElement], x: newLeft, y: newTop }
    }));
  }, [isDragging, selectedElement, findSnaps]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setActiveGuides([]);
    setIsSnapped(false);
    setDragCoords(null);
    dragStateRef.current = null;
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handlePrint = () => {
    window.print();
  };

  const handleReset = () => {
    setLabelData({
      brandName: 'HAKKO',
      brandSubtitle: 'BREWERY',
      productName: 'Lumière dorée',
      productSeries: 'Série I — Bière de Noël',
      ingredients: 'Malt pilsner, houblon Saaz, miel de tilleul, levure belge',
      theme: 'biere',
      qrCodeUrl: '',
      showQrCode: false
    });
    setPositions({
      brand: { x: 45, y: 50, rotation: 0 },
      subtitle: { x: 95, y: 95, rotation: 0 },
      divider: { x: 140, y: 25, rotation: 0 },
      product: { x: 170, y: 55, rotation: 0 },
      series: { x: 170, y: 125, rotation: 0 },
      ingredients: { x: 170, y: 200, rotation: 0 },
      qrcode: { x: 630, y: 250, rotation: 0 }
    });
    setStyles({
      brand: { bold: false, italic: false, color: '#5c4a3a', fontSize: 38 },
      subtitle: { bold: false, italic: false, color: '#5c4a3a', fontSize: 9 },
      product: { bold: false, italic: false, color: '#4a3828', fontSize: 58 },
      series: { bold: false, italic: false, color: '#c45c20', fontSize: 13 },
      ingredients: { bold: false, italic: true, color: '#6a5a4a', fontSize: 20 }
    });
    setFontSizePopover(null);
  };

  // Mettre à jour les couleurs quand le thème change
  useEffect(() => {
    setStyles(prev => ({
      ...prev,
      brand: { ...prev.brand, color: theme.logoColor },
      subtitle: { ...prev.subtitle, color: theme.breweryColor },
      product: { ...prev.product, color: theme.productColor },
      series: { ...prev.series, color: theme.seriesColor },
      ingredients: { ...prev.ingredients, color: theme.ingredientsColor }
    }));
  }, [labelData.theme, theme]);

  const renderDecoration = () => {
    switch (labelData.theme) {
      case 'biere':
        return <div className="decoration hop-vine"><HopVineSVG color={theme.productColor} /></div>;
      case 'hydromel':
        return (
          <>
            <div className="decoration honeycomb-pattern"><HoneycombSVG color={theme.productColor} /></div>
            <div className="decoration bee-illustration"><BeeSVG color={theme.productColor} /></div>
          </>
        );
      case 'koji':
        return <div className="decoration koji-pattern"><KojiPatternSVG color={theme.productColor} /></div>;
      default:
        return null;
    }
  };

  const isHorizontalGuide = (type: string) => type === 'horizontal' || type === 'hCenter';

  // Composant de contrôle de style réutilisable
  const StyleControls = ({ element, label }: { element: string; label: string }) => (
    <div className="label-form-group">
      <label>{label}</label>
      {element === 'brand' || element === 'subtitle' || element === 'product' || element === 'series' || element === 'ingredients' ? (
        <input
          type="text"
          value={element === 'brand' ? labelData.brandName :
                 element === 'subtitle' ? labelData.brandSubtitle :
                 element === 'product' ? labelData.productName :
                 element === 'series' ? labelData.productSeries :
                 labelData.ingredients}
          onChange={(e) => handleInputChange(
            element === 'brand' ? 'brandName' :
            element === 'subtitle' ? 'brandSubtitle' :
            element === 'product' ? 'productName' :
            element === 'series' ? 'productSeries' :
            'ingredients', e.target.value)}
        />
      ) : null}
      <div className="element-controls">
        <div className="control-row">
          <div className="style-buttons">
            <button
              className={`style-btn ${styles[element]?.bold ? 'active' : ''}`}
              onClick={() => handleStyleToggle(element, 'bold')}
            >B</button>
            <button
              className={`style-btn italic ${styles[element]?.italic ? 'active' : ''}`}
              onClick={() => handleStyleToggle(element, 'italic')}
            >I</button>
            <div className="font-size-control">
              <button
                className={`style-btn px-btn ${fontSizePopover === element ? 'active' : ''}`}
                onClick={() => toggleFontSizePopover(element)}
              >px</button>
              {fontSizePopover === element && (
                <div className="font-size-popover">
                  <input
                    type="number"
                    value={styles[element]?.fontSize || 16}
                    onChange={(e) => handleFontSizeChange(element, parseInt(e.target.value) || 8)}
                    min={8}
                    max={120}
                  />
                  <span>px</span>
                </div>
              )}
            </div>
          </div>
          <input
            type="color"
            value={styles[element]?.color || '#000000'}
            onChange={(e) => handleColorChange(element, e.target.value)}
            className="color-picker"
          />
          <div className="rotation-control">
            <input
              type="range"
              min="-180"
              max="180"
              value={positions[element]?.rotation || 0}
              onChange={(e) => handleRotationChange(element, parseInt(e.target.value))}
            />
            <input
              type="number"
              className="rotation-input"
              min="-180"
              max="180"
              value={positions[element]?.rotation || 0}
              onChange={(e) => handleRotationChange(element, parseInt(e.target.value) || 0)}
            />
            <span>°</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="label-generator-page">
      <div className="page-header">
        <div>
          <h1>Générateur d'étiquettes</h1>
          <p className="page-subtitle">Créez vos étiquettes personnalisées</p>
        </div>
        <button className="btn-secondary" onClick={onBack}>← Retour</button>
      </div>

      <div className="label-generator-container">
        <div className="label-form-section">
          {/* Section Marque */}
          <div className="accordion-section">
            <button className={`accordion-header ${openSections.brand ? 'open' : ''}`} onClick={() => toggleSection('brand')}>
              <span>Zone gauche - Marque</span>
              <span className="accordion-icon">{openSections.brand ? '−' : '+'}</span>
            </button>
            {openSections.brand && (
              <div className="accordion-content">
                <StyleControls element="brand" label="Nom de marque" />
                <StyleControls element="subtitle" label="Sous-titre" />
              </div>
            )}
          </div>

          {/* Section Produit */}
          <div className="accordion-section">
            <button className={`accordion-header ${openSections.product ? 'open' : ''}`} onClick={() => toggleSection('product')}>
              <span>Zone droite - Produit</span>
              <span className="accordion-icon">{openSections.product ? '−' : '+'}</span>
            </button>
            {openSections.product && (
              <div className="accordion-content">
                <StyleControls element="product" label="Nom du produit" />
                <StyleControls element="series" label="Type / Série" />
                <div className="label-form-group">
                  <label>Ingrédients / Description</label>
                  <textarea
                    value={labelData.ingredients}
                    onChange={(e) => handleInputChange('ingredients', e.target.value)}
                    rows={3}
                  />
                  <div className="element-controls">
                    <div className="control-row">
                      <div className="style-buttons">
                        <button className={`style-btn ${styles.ingredients?.bold ? 'active' : ''}`} onClick={() => handleStyleToggle('ingredients', 'bold')}>B</button>
                        <button className={`style-btn italic ${styles.ingredients?.italic ? 'active' : ''}`} onClick={() => handleStyleToggle('ingredients', 'italic')}>I</button>
                        <div className="font-size-control">
                          <button className={`style-btn px-btn ${fontSizePopover === 'ingredients' ? 'active' : ''}`} onClick={() => toggleFontSizePopover('ingredients')}>px</button>
                          {fontSizePopover === 'ingredients' && (
                            <div className="font-size-popover">
                              <input type="number" value={styles.ingredients?.fontSize || 20} onChange={(e) => handleFontSizeChange('ingredients', parseInt(e.target.value) || 8)} min={8} max={120} />
                              <span>px</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <input type="color" value={styles.ingredients?.color || '#6a5a4a'} onChange={(e) => handleColorChange('ingredients', e.target.value)} className="color-picker" />
                      <div className="rotation-control">
                        <input type="range" min="-180" max="180" value={positions.ingredients?.rotation || 0} onChange={(e) => handleRotationChange('ingredients', parseInt(e.target.value))} />
                        <input type="number" className="rotation-input" min="-180" max="180" value={positions.ingredients?.rotation || 0} onChange={(e) => handleRotationChange('ingredients', parseInt(e.target.value) || 0)} />
                        <span>°</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section Apparence */}
          <div className="accordion-section">
            <button className={`accordion-header ${openSections.appearance ? 'open' : ''}`} onClick={() => toggleSection('appearance')}>
              <span>Apparence</span>
              <span className="accordion-icon">{openSections.appearance ? '−' : '+'}</span>
            </button>
            {openSections.appearance && (
              <div className="accordion-content">
                <div className="label-form-group">
                  <label>Thème de l'étiquette</label>
                  <div className="theme-selector">
                    {(Object.keys(THEMES) as LabelTheme[]).map((themeKey) => (
                      <button
                        key={themeKey}
                        className={`theme-option ${labelData.theme === themeKey ? 'active' : ''}`}
                        onClick={() => handleInputChange('theme', themeKey)}
                        style={{ background: THEMES[themeKey].background }}
                      >
                        <span className="theme-name">{THEMES[themeKey].name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section QR Code */}
          <div className="accordion-section">
            <button className={`accordion-header ${openSections.qrcode ? 'open' : ''}`} onClick={() => toggleSection('qrcode')}>
              <span>QR Code</span>
              <span className="accordion-icon">{openSections.qrcode ? '−' : '+'}</span>
            </button>
            {openSections.qrcode && (
              <div className="accordion-content">
                <div className="label-form-group">
                  <label className="toggle-label">
                    <input type="checkbox" checked={labelData.showQrCode} onChange={(e) => handleInputChange('showQrCode', e.target.checked)} />
                    <span>Afficher un QR Code</span>
                  </label>
                </div>
                {labelData.showQrCode && (
                  <div className="label-form-group">
                    <label>URL du lien</label>
                    <input type="text" value={labelData.qrCodeUrl} onChange={(e) => handleInputChange('qrCodeUrl', e.target.value)} placeholder="https://myfermentlab.app/batch/123" />
                    <p className="input-hint">Lien vers la fiche du brassin ou votre site web</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="label-actions">
            <button className="btn-primary" onClick={handlePrint}>Imprimer</button>
            <button className="btn-secondary" onClick={handleReset}>Reset</button>
          </div>
        </div>

        {/* Section preview */}
        <div className="label-preview-section">
          <p className="edit-hint">Cliquez et glissez pour déplacer les éléments</p>

          <div ref={labelRef} className={`label-preview label-${labelData.theme}`} style={{ background: theme.background }}>
            <div className="linen-texture" />

            {/* Tooltip coordonnées pendant le drag */}
            {dragCoords && (
              <>
                <div className="drag-coords-tooltip" style={{ left: dragCoords.x + 10, top: dragCoords.y - 30 }}>
                  <span className="coord">X: {dragCoords.x}px</span>
                  <span className="coord">Y: {dragCoords.y}px</span>
                </div>
                {/* Distance markers */}
                <div className="distance-marker left" style={{ left: 0, top: dragCoords.y + 10, width: dragCoords.x }}>
                  <span className="distance-label">{dragCoords.x}px</span>
                </div>
                <div className="distance-marker right" style={{ left: dragCoords.x + 20, top: dragCoords.y + 10, width: LABEL_WIDTH - dragCoords.x - 20 }}>
                  <span className="distance-label">{LABEL_WIDTH - dragCoords.x - 20}px</span>
                </div>
                <div className="distance-marker top" style={{ left: dragCoords.x + 10, top: 0, height: dragCoords.y }}>
                  <span className="distance-label">{dragCoords.y}px</span>
                </div>
                <div className="distance-marker bottom" style={{ left: dragCoords.x + 10, top: dragCoords.y + 20, height: LABEL_HEIGHT - dragCoords.y - 20 }}>
                  <span className="distance-label">{LABEL_HEIGHT - dragCoords.y - 20}px</span>
                </div>
              </>
            )}

            {/* Guides d'alignement */}
            {activeGuides.map((guide, index) => (
              <div
                key={index}
                className={`snap-guide ${isHorizontalGuide(guide.type) ? 'horizontal' : 'vertical'} ${guide.style} visible`}
                style={isHorizontalGuide(guide.type) ? { top: `${guide.pos}px` } : { left: `${guide.pos}px` }}
              />
            ))}

            {renderDecoration()}

            {/* Logo - Draggable */}
            <div
              ref={el => { elementRefs.current['brand'] = el; }}
              className={`draggable logo-text ${selectedElement === 'brand' ? 'selected' : ''} ${isSnapped && selectedElement === 'brand' ? 'snapped' : ''}`}
              style={{
                left: `${positions.brand.x}px`,
                top: `${positions.brand.y}px`,
                transform: `rotate(${positions.brand.rotation}deg)`,
                color: styles.brand.color,
                fontWeight: styles.brand.bold ? 'bold' : 300,
                fontStyle: styles.brand.italic ? 'italic' : 'normal',
                fontSize: `${styles.brand.fontSize}px`
              }}
              onMouseDown={(e) => handleMouseDown('brand', e)}
            >
              {labelData.brandName}
            </div>

            {/* Subtitle - Draggable */}
            <div
              ref={el => { elementRefs.current['subtitle'] = el; }}
              className={`draggable brewery-text ${selectedElement === 'subtitle' ? 'selected' : ''} ${isSnapped && selectedElement === 'subtitle' ? 'snapped' : ''}`}
              style={{
                left: `${positions.subtitle.x}px`,
                top: `${positions.subtitle.y}px`,
                transform: `rotate(${positions.subtitle.rotation}deg)`,
                color: styles.subtitle.color,
                fontWeight: styles.subtitle.bold ? 'bold' : 300,
                fontStyle: styles.subtitle.italic ? 'italic' : 'normal',
                fontSize: `${styles.subtitle.fontSize}px`
              }}
              onMouseDown={(e) => handleMouseDown('subtitle', e)}
            >
              {labelData.brandSubtitle}
            </div>

            {/* Divider - Draggable */}
            <div
              ref={el => { elementRefs.current['divider'] = el; }}
              className={`draggable divider ${selectedElement === 'divider' ? 'selected' : ''} ${isSnapped && selectedElement === 'divider' ? 'snapped' : ''}`}
              style={{
                left: `${positions.divider.x}px`,
                top: `${positions.divider.y}px`,
                transform: `rotate(${positions.divider.rotation}deg)`,
                background: theme.dividerColor
              }}
              onMouseDown={(e) => handleMouseDown('divider', e)}
            />

            {/* Product name - Draggable */}
            <div
              ref={el => { elementRefs.current['product'] = el; }}
              className={`draggable beer-name ${selectedElement === 'product' ? 'selected' : ''} ${isSnapped && selectedElement === 'product' ? 'snapped' : ''}`}
              style={{
                left: `${positions.product.x}px`,
                top: `${positions.product.y}px`,
                transform: `rotate(${positions.product.rotation}deg)`,
                color: styles.product.color,
                fontWeight: styles.product.bold ? 'bold' : 300,
                fontStyle: styles.product.italic ? 'italic' : 'normal',
                fontSize: `${styles.product.fontSize}px`
              }}
              onMouseDown={(e) => handleMouseDown('product', e)}
            >
              {labelData.productName}
            </div>

            {/* Series - Draggable */}
            <div
              ref={el => { elementRefs.current['series'] = el; }}
              className={`draggable series ${selectedElement === 'series' ? 'selected' : ''} ${isSnapped && selectedElement === 'series' ? 'snapped' : ''}`}
              style={{
                left: `${positions.series.x}px`,
                top: `${positions.series.y}px`,
                transform: `rotate(${positions.series.rotation}deg)`,
                color: styles.series.color,
                fontWeight: styles.series.bold ? 'bold' : 400,
                fontStyle: styles.series.italic ? 'italic' : 'normal',
                fontSize: `${styles.series.fontSize}px`
              }}
              onMouseDown={(e) => handleMouseDown('series', e)}
            >
              {labelData.productSeries}
            </div>

            {/* Ingredients - Draggable */}
            <div
              ref={el => { elementRefs.current['ingredients'] = el; }}
              className={`draggable ingredients ${selectedElement === 'ingredients' ? 'selected' : ''} ${isSnapped && selectedElement === 'ingredients' ? 'snapped' : ''}`}
              style={{
                left: `${positions.ingredients.x}px`,
                top: `${positions.ingredients.y}px`,
                transform: `rotate(${positions.ingredients.rotation}deg)`,
                color: styles.ingredients.color,
                fontWeight: styles.ingredients.bold ? 'bold' : 300,
                fontStyle: styles.ingredients.italic ? 'italic' : 'normal',
                fontSize: `${styles.ingredients.fontSize}px`
              }}
              onMouseDown={(e) => handleMouseDown('ingredients', e)}
            >
              {labelData.ingredients}
            </div>

            {/* QR Code - Draggable */}
            {labelData.showQrCode && labelData.qrCodeUrl && (
              <div
                ref={el => { elementRefs.current['qrcode'] = el; }}
                className={`draggable qr-code-container ${selectedElement === 'qrcode' ? 'selected' : ''} ${isSnapped && selectedElement === 'qrcode' ? 'snapped' : ''}`}
                style={{
                  left: `${positions.qrcode.x}px`,
                  top: `${positions.qrcode.y}px`,
                  transform: `rotate(${positions.qrcode.rotation}deg)`
                }}
                onMouseDown={(e) => handleMouseDown('qrcode', e)}
              >
                <QRCodeSVG value={labelData.qrCodeUrl} size={45} bgColor="rgba(255,255,255,0.9)" fgColor={theme.productColor} level="M" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

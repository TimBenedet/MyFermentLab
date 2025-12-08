import { useState, useRef } from 'react';
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
    {/* Main curving vine */}
    <path d="M0 28 Q50 10 100 24 Q150 42 200 26 Q250 10 300 30"
          stroke={color} strokeWidth="1.2" fill="none"/>

    {/* Curling tendrils */}
    <path d="M55 18 Q60 10 56 2" stroke={color} strokeWidth="0.6" fill="none"/>
    <path d="M115 38 Q122 48 118 58 Q114 65 119 70" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M220 16 Q228 8 224 0" stroke={color} strokeWidth="0.6" fill="none"/>
    <path d="M275 28 Q282 36 278 45" stroke={color} strokeWidth="0.5" fill="none"/>

    {/* Hop leaf 1 */}
    <path d="M32 22 Q24 14 18 18 Q14 24 18 32 Q22 38 30 36 Q36 32 36 26 Q36 20 32 22"
          stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M26 22 Q24 28 26 34" stroke={color} strokeWidth="0.25" fill="none"/>

    {/* Hop leaf 2 */}
    <path d="M165 30 Q156 22 150 26 Q146 32 150 40 Q154 46 162 44 Q168 40 168 34 Q168 28 165 30"
          stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M158 28 Q156 34 158 42" stroke={color} strokeWidth="0.25" fill="none"/>

    {/* Hop leaf 3 */}
    <path d="M252 22 Q244 14 238 18 Q234 24 238 32 Q242 38 250 36 Q256 32 256 26 Q256 20 252 22"
          stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M246 22 Q244 28 246 34" stroke={color} strokeWidth="0.25" fill="none"/>

    {/* HOP CONE 1 */}
    <g transform="translate(65, 22)">
      <path d="M0 0 L0 8" stroke={color} strokeWidth="0.8" fill="none"/>
      <ellipse cx="0" cy="8" rx="2" ry="3" stroke={color} strokeWidth="0.5" fill="none"/>
      <path d="M0 10 Q-3 14 -2 20 Q0 22 2 20 Q3 14 0 10 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M0 12 L0 20" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M-2 16 Q-12 20 -14 32 Q-12 38 -6 36 Q-2 28 -2 20 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M-8 22 Q-10 28 -8 34" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M2 16 Q12 20 14 32 Q12 38 6 36 Q2 28 2 20 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M8 22 Q10 28 8 34" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M-4 28 Q-16 34 -18 48 Q-16 56 -8 52 Q-4 42 -4 32 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M-11 36 Q-13 44 -11 50" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M0 26 Q-6 36 -6 50 Q0 56 6 50 Q6 36 0 26 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M0 30 L0 52" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M4 28 Q16 34 18 48 Q16 56 8 52 Q4 42 4 32 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M11 36 Q13 44 11 50" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M-6 46 Q-18 54 -20 70 Q-18 78 -10 74 Q-6 62 -6 50 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M-13 54 Q-15 64 -13 72" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M0 44 Q-8 56 -8 72 Q0 80 8 72 Q8 56 0 44 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M0 48 L0 76" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M6 46 Q18 54 20 70 Q18 78 10 74 Q6 62 6 50 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M13 54 Q15 64 13 72" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M-4 68 Q-12 78 -12 90 Q-8 96 -2 90 Q-2 80 -4 72 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M-7 76 Q-9 84 -7 90" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M4 68 Q12 78 12 90 Q8 96 2 90 Q2 80 4 72 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M7 76 Q9 84 7 90" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M0 84 Q-4 94 0 102 Q4 94 0 84 Z" stroke={color} strokeWidth="0.35" fill="none"/>
      <path d="M0 86 L0 100" stroke={color} strokeWidth="0.15" fill="none"/>
    </g>

    {/* HOP CONE 2 (larger) */}
    <g transform="translate(138, 38)">
      <path d="M0 0 L0 10" stroke={color} strokeWidth="0.8" fill="none"/>
      <ellipse cx="0" cy="10" rx="2.5" ry="3.5" stroke={color} strokeWidth="0.5" fill="none"/>
      <path d="M0 12 Q-4 18 -3 26 Q0 29 3 26 Q4 18 0 12 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M0 14 L0 26" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M-3 20 Q-14 26 -16 40 Q-14 48 -7 44 Q-3 34 -3 24 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M-10 28 Q-12 36 -10 44" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M3 20 Q14 26 16 40 Q14 48 7 44 Q3 34 3 24 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M10 28 Q12 36 10 44" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M-5 36 Q-20 44 -22 62 Q-20 72 -10 66 Q-5 52 -5 40 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M-14 46 Q-16 56 -14 66" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M0 34 Q-8 46 -8 64 Q0 74 8 64 Q8 46 0 34 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M0 38 L0 70" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M5 36 Q20 44 22 62 Q20 72 10 66 Q5 52 5 40 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M14 46 Q16 56 14 66" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M-7 58 Q-22 68 -24 88 Q-22 98 -12 92 Q-7 76 -7 62 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M-16 70 Q-18 82 -16 92" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M0 56 Q-10 70 -10 90 Q0 100 10 90 Q10 70 0 56 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M0 60 L0 96" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M7 58 Q22 68 24 88 Q22 98 12 92 Q7 76 7 62 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M16 70 Q18 82 16 92" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M-5 84 Q-14 96 -14 110 Q-10 118 -3 112 Q-3 98 -5 88 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M-9 94 Q-11 104 -9 112" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M5 84 Q14 96 14 110 Q10 118 3 112 Q3 98 5 88 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M9 94 Q11 104 9 112" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M0 106 Q-5 118 0 128 Q5 118 0 106 Z" stroke={color} strokeWidth="0.35" fill="none"/>
      <path d="M0 108 L0 126" stroke={color} strokeWidth="0.15" fill="none"/>
    </g>

    {/* HOP CONE 3 (smaller) */}
    <g transform="translate(198, 20)">
      <path d="M0 0 L0 6" stroke={color} strokeWidth="0.7" fill="none"/>
      <ellipse cx="0" cy="6" rx="1.5" ry="2.5" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M0 8 Q-2 12 -1.5 18 Q0 20 1.5 18 Q2 12 0 8 Z" stroke={color} strokeWidth="0.35" fill="none"/>
      <path d="M0 9 L0 18" stroke={color} strokeWidth="0.15" fill="none"/>
      <path d="M-2 14 Q-10 18 -11 28 Q-10 34 -5 31 Q-2 24 -2 17 Z" stroke={color} strokeWidth="0.35" fill="none"/>
      <path d="M-7 20 Q-8 26 -7 31" stroke={color} strokeWidth="0.15" fill="none"/>
      <path d="M2 14 Q10 18 11 28 Q10 34 5 31 Q2 24 2 17 Z" stroke={color} strokeWidth="0.35" fill="none"/>
      <path d="M7 20 Q8 26 7 31" stroke={color} strokeWidth="0.15" fill="none"/>
      <path d="M-4 26 Q-14 32 -15 46 Q-14 54 -7 49 Q-4 38 -4 30 Z" stroke={color} strokeWidth="0.35" fill="none"/>
      <path d="M-10 34 Q-11 42 -10 50" stroke={color} strokeWidth="0.15" fill="none"/>
      <path d="M0 24 Q-6 34 -6 48 Q0 56 6 48 Q6 34 0 24 Z" stroke={color} strokeWidth="0.35" fill="none"/>
      <path d="M0 28 L0 52" stroke={color} strokeWidth="0.15" fill="none"/>
      <path d="M4 26 Q14 32 15 46 Q14 54 7 49 Q4 38 4 30 Z" stroke={color} strokeWidth="0.35" fill="none"/>
      <path d="M10 34 Q11 42 10 50" stroke={color} strokeWidth="0.15" fill="none"/>
      <path d="M-3 44 Q-10 54 -10 66 Q-7 72 -2 66 Q-2 56 -3 48 Z" stroke={color} strokeWidth="0.35" fill="none"/>
      <path d="M-6 52 Q-8 60 -6 66" stroke={color} strokeWidth="0.15" fill="none"/>
      <path d="M3 44 Q10 54 10 66 Q7 72 2 66 Q2 56 3 48 Z" stroke={color} strokeWidth="0.35" fill="none"/>
      <path d="M6 52 Q8 60 6 66" stroke={color} strokeWidth="0.15" fill="none"/>
      <path d="M0 62 Q-3 72 0 80 Q3 72 0 62 Z" stroke={color} strokeWidth="0.3" fill="none"/>
      <path d="M0 64 L0 78" stroke={color} strokeWidth="0.12" fill="none"/>
    </g>

    {/* HOP CONE 4 */}
    <g transform="translate(262, 26)">
      <path d="M0 0 L0 8" stroke={color} strokeWidth="0.8" fill="none"/>
      <ellipse cx="0" cy="8" rx="2" ry="3" stroke={color} strokeWidth="0.5" fill="none"/>
      <path d="M0 10 Q-3 14 -2 20 Q0 22 2 20 Q3 14 0 10 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M0 12 L0 20" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M-2 16 Q-12 20 -14 32 Q-12 38 -6 36 Q-2 28 -2 20 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M-8 22 Q-10 28 -8 34" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M2 16 Q12 20 14 32 Q12 38 6 36 Q2 28 2 20 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M8 22 Q10 28 8 34" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M-4 28 Q-16 34 -18 48 Q-16 56 -8 52 Q-4 42 -4 32 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M-11 36 Q-13 44 -11 50" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M0 26 Q-6 36 -6 50 Q0 56 6 50 Q6 36 0 26 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M0 30 L0 52" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M4 28 Q16 34 18 48 Q16 56 8 52 Q4 42 4 32 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M11 36 Q13 44 11 50" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M-6 46 Q-18 54 -20 70 Q-18 78 -10 74 Q-6 62 -6 50 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M-13 54 Q-15 64 -13 72" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M0 44 Q-8 56 -8 72 Q0 80 8 72 Q8 56 0 44 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M0 48 L0 76" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M6 46 Q18 54 20 70 Q18 78 10 74 Q6 62 6 50 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M13 54 Q15 64 13 72" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M-4 68 Q-12 78 -12 90 Q-8 96 -2 90 Q-2 80 -4 72 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M-7 76 Q-9 84 -7 90" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M4 68 Q12 78 12 90 Q8 96 2 90 Q2 80 4 72 Z" stroke={color} strokeWidth="0.4" fill="none"/>
      <path d="M7 76 Q9 84 7 90" stroke={color} strokeWidth="0.2" fill="none"/>
      <path d="M0 84 Q-4 94 0 102 Q4 94 0 84 Z" stroke={color} strokeWidth="0.35" fill="none"/>
      <path d="M0 86 L0 100" stroke={color} strokeWidth="0.15" fill="none"/>
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
    <path d="M15 55 L25 50 L35 55 L35 67 L25 72 L15 67 Z" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M35 55 L45 50 L55 55 L55 67 L45 72 L35 67 Z" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M55 55 L65 50 L75 55 L75 67 L65 72 L55 67 Z" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M75 55 L85 50 L95 55 L95 67 L85 72 L75 67 Z" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M25 70 L35 65 L45 70 L45 82 L35 87 L25 82 Z" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M45 70 L55 65 L65 70 L65 82 L55 87 L45 82 Z" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M65 70 L75 65 L85 70 L85 82 L75 87 L65 82 Z" stroke={color} strokeWidth="0.5" fill="none"/>
  </svg>
);

// Composant SVG Bee pour l'hydromel
const BeeSVG = ({ color }: { color: string }) => (
  <svg viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Body */}
    <ellipse cx="25" cy="28" rx="10" ry="14" stroke={color} strokeWidth="0.8" fill="none"/>
    {/* Stripes */}
    <path d="M16 24 Q25 22 34 24" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M16 30 Q25 28 34 30" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M17 36 Q25 34 33 36" stroke={color} strokeWidth="0.5" fill="none"/>
    {/* Head */}
    <circle cx="25" cy="12" r="5" stroke={color} strokeWidth="0.8" fill="none"/>
    {/* Wings */}
    <ellipse cx="14" cy="22" rx="7" ry="4" stroke={color} strokeWidth="0.5" fill="none" transform="rotate(-20 14 22)"/>
    <ellipse cx="36" cy="22" rx="7" ry="4" stroke={color} strokeWidth="0.5" fill="none" transform="rotate(20 36 22)"/>
    {/* Antennae */}
    <path d="M22 8 Q20 4 18 2" stroke={color} strokeWidth="0.5" fill="none"/>
    <path d="M28 8 Q30 4 32 2" stroke={color} strokeWidth="0.5" fill="none"/>
  </svg>
);

// Composant SVG Koji pattern
const KojiPatternSVG = ({ color }: { color: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Central spore cluster */}
    <circle cx="50" cy="50" r="3" fill={color} opacity="0.6"/>
    <circle cx="50" cy="50" r="6" stroke={color} strokeWidth="0.3" fill="none" opacity="0.4"/>

    {/* Radiating hyphae */}
    <path d="M50 50 Q55 40 60 25" stroke={color} strokeWidth="0.4" fill="none"/>
    <path d="M50 50 Q60 45 75 40" stroke={color} strokeWidth="0.4" fill="none"/>
    <path d="M50 50 Q60 55 78 58" stroke={color} strokeWidth="0.4" fill="none"/>
    <path d="M50 50 Q55 60 62 78" stroke={color} strokeWidth="0.4" fill="none"/>
    <path d="M50 50 Q45 60 40 80" stroke={color} strokeWidth="0.4" fill="none"/>
    <path d="M50 50 Q40 55 22 60" stroke={color} strokeWidth="0.4" fill="none"/>
    <path d="M50 50 Q40 48 20 45" stroke={color} strokeWidth="0.4" fill="none"/>
    <path d="M50 50 Q45 40 35 22" stroke={color} strokeWidth="0.4" fill="none"/>

    {/* Branching */}
    <path d="M60 25 Q62 20 58 15" stroke={color} strokeWidth="0.3" fill="none"/>
    <path d="M60 25 Q65 22 70 18" stroke={color} strokeWidth="0.3" fill="none"/>
    <path d="M75 40 Q80 35 85 32" stroke={color} strokeWidth="0.3" fill="none"/>
    <path d="M75 40 Q80 42 88 45" stroke={color} strokeWidth="0.3" fill="none"/>
    <path d="M78 58 Q82 55 90 55" stroke={color} strokeWidth="0.3" fill="none"/>
    <path d="M78 58 Q82 62 88 68" stroke={color} strokeWidth="0.3" fill="none"/>
    <path d="M62 78 Q58 82 55 90" stroke={color} strokeWidth="0.3" fill="none"/>
    <path d="M62 78 Q68 82 72 88" stroke={color} strokeWidth="0.3" fill="none"/>
    <path d="M40 80 Q38 85 35 92" stroke={color} strokeWidth="0.3" fill="none"/>
    <path d="M40 80 Q35 82 28 88" stroke={color} strokeWidth="0.3" fill="none"/>
    <path d="M22 60 Q15 58 8 55" stroke={color} strokeWidth="0.3" fill="none"/>
    <path d="M22 60 Q18 65 12 72" stroke={color} strokeWidth="0.3" fill="none"/>
    <path d="M20 45 Q12 42 5 40" stroke={color} strokeWidth="0.3" fill="none"/>
    <path d="M20 45 Q15 50 8 52" stroke={color} strokeWidth="0.3" fill="none"/>
    <path d="M35 22 Q30 18 25 12" stroke={color} strokeWidth="0.3" fill="none"/>
    <path d="M35 22 Q38 15 40 8" stroke={color} strokeWidth="0.3" fill="none"/>

    {/* Spore heads (conidiophores) */}
    <circle cx="58" cy="15" r="2" fill={color} opacity="0.5"/>
    <circle cx="70" cy="18" r="1.5" fill={color} opacity="0.4"/>
    <circle cx="85" cy="32" r="2" fill={color} opacity="0.5"/>
    <circle cx="88" cy="45" r="1.5" fill={color} opacity="0.4"/>
    <circle cx="90" cy="55" r="1.8" fill={color} opacity="0.5"/>
    <circle cx="88" cy="68" r="1.5" fill={color} opacity="0.4"/>
    <circle cx="55" cy="90" r="2" fill={color} opacity="0.5"/>
    <circle cx="72" cy="88" r="1.5" fill={color} opacity="0.4"/>
    <circle cx="35" cy="92" r="1.8" fill={color} opacity="0.5"/>
    <circle cx="28" cy="88" r="1.5" fill={color} opacity="0.4"/>
    <circle cx="8" cy="55" r="2" fill={color} opacity="0.5"/>
    <circle cx="12" cy="72" r="1.5" fill={color} opacity="0.4"/>
    <circle cx="5" cy="40" r="1.8" fill={color} opacity="0.5"/>
    <circle cx="8" cy="52" r="1.2" fill={color} opacity="0.4"/>
    <circle cx="25" cy="12" r="2" fill={color} opacity="0.5"/>
    <circle cx="40" cy="8" r="1.5" fill={color} opacity="0.4"/>
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

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    brand: true,
    product: false,
    appearance: false,
    qrcode: false
  });

  const labelRef = useRef<HTMLDivElement>(null);

  const theme = THEMES[labelData.theme];

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleInputChange = (field: keyof LabelData, value: string | boolean) => {
    setLabelData(prev => ({ ...prev, [field]: value }));
  };

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
  };

  // Rendu de l'illustration selon le thème
  const renderDecoration = () => {
    switch (labelData.theme) {
      case 'biere':
        return (
          <div className="decoration hop-vine">
            <HopVineSVG color={theme.productColor} />
          </div>
        );
      case 'hydromel':
        return (
          <>
            <div className="decoration honeycomb-pattern">
              <HoneycombSVG color={theme.productColor} />
            </div>
            <div className="decoration bee-illustration">
              <BeeSVG color={theme.productColor} />
            </div>
          </>
        );
      case 'koji':
        return (
          <div className="decoration koji-pattern">
            <KojiPatternSVG color={theme.productColor} />
          </div>
        );
      default:
        return null;
    }
  };

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
        {/* Panneau de formulaire */}
        <div className="label-form-section">
          {/* Section Marque */}
          <div className="accordion-section">
            <button
              className={`accordion-header ${openSections.brand ? 'open' : ''}`}
              onClick={() => toggleSection('brand')}
            >
              <span>Zone gauche - Marque</span>
              <span className="accordion-icon">{openSections.brand ? '−' : '+'}</span>
            </button>
            {openSections.brand && (
              <div className="accordion-content">
                <div className="label-form-group">
                  <label>Nom de marque</label>
                  <input
                    type="text"
                    value={labelData.brandName}
                    onChange={(e) => handleInputChange('brandName', e.target.value)}
                    placeholder="HAKKO"
                  />
                </div>

                <div className="label-form-group">
                  <label>Sous-titre</label>
                  <input
                    type="text"
                    value={labelData.brandSubtitle}
                    onChange={(e) => handleInputChange('brandSubtitle', e.target.value)}
                    placeholder="BREWERY"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section Produit */}
          <div className="accordion-section">
            <button
              className={`accordion-header ${openSections.product ? 'open' : ''}`}
              onClick={() => toggleSection('product')}
            >
              <span>Zone droite - Produit</span>
              <span className="accordion-icon">{openSections.product ? '−' : '+'}</span>
            </button>
            {openSections.product && (
              <div className="accordion-content">
                <div className="label-form-group">
                  <label>Nom du produit</label>
                  <input
                    type="text"
                    value={labelData.productName}
                    onChange={(e) => handleInputChange('productName', e.target.value)}
                    placeholder="Lumière dorée"
                  />
                </div>

                <div className="label-form-group">
                  <label>Type / Série</label>
                  <input
                    type="text"
                    value={labelData.productSeries}
                    onChange={(e) => handleInputChange('productSeries', e.target.value)}
                    placeholder="Série I — Bière de Noël"
                  />
                </div>

                <div className="label-form-group">
                  <label>Ingrédients / Description</label>
                  <textarea
                    value={labelData.ingredients}
                    onChange={(e) => handleInputChange('ingredients', e.target.value)}
                    placeholder="Description du produit"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section Apparence */}
          <div className="accordion-section">
            <button
              className={`accordion-header ${openSections.appearance ? 'open' : ''}`}
              onClick={() => toggleSection('appearance')}
            >
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
            <button
              className={`accordion-header ${openSections.qrcode ? 'open' : ''}`}
              onClick={() => toggleSection('qrcode')}
            >
              <span>QR Code</span>
              <span className="accordion-icon">{openSections.qrcode ? '−' : '+'}</span>
            </button>
            {openSections.qrcode && (
              <div className="accordion-content">
                <div className="label-form-group">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={labelData.showQrCode}
                      onChange={(e) => handleInputChange('showQrCode', e.target.checked)}
                    />
                    <span>Afficher un QR Code</span>
                  </label>
                </div>
                {labelData.showQrCode && (
                  <div className="label-form-group">
                    <label>URL du lien</label>
                    <input
                      type="text"
                      value={labelData.qrCodeUrl}
                      onChange={(e) => handleInputChange('qrCodeUrl', e.target.value)}
                      placeholder="https://myfermentlab.app/batch/123"
                    />
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
          <p className="edit-hint">Aperçu de l'étiquette</p>

          <div
            ref={labelRef}
            className={`label-preview label-${labelData.theme}`}
            style={{ background: theme.background }}
          >
            {/* Texture lin */}
            <div className="linen-texture" />

            {/* Décoration selon le thème */}
            {renderDecoration()}

            {/* Section Logo */}
            <div className="logo-section">
              <div className="logo-wrapper">
                <span
                  className="logo-text"
                  style={{ color: theme.logoColor }}
                >
                  {labelData.brandName}
                </span>
                <span
                  className="brewery-text"
                  style={{ color: theme.breweryColor }}
                >
                  {labelData.brandSubtitle}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div
              className="divider"
              style={{ background: theme.dividerColor }}
            />

            {/* Section Contenu */}
            <div className="content-section">
              <h2
                className="beer-name"
                style={{ color: theme.productColor }}
              >
                {labelData.productName}
              </h2>
              <p
                className="series"
                style={{ color: theme.seriesColor }}
              >
                {labelData.productSeries}
              </p>
              <p
                className="ingredients"
                style={{ color: theme.ingredientsColor }}
              >
                {labelData.ingredients}
              </p>
            </div>

            {/* QR Code */}
            {labelData.showQrCode && labelData.qrCodeUrl && (
              <div className="qr-code-container">
                <QRCodeSVG
                  value={labelData.qrCodeUrl}
                  size={45}
                  bgColor="rgba(255,255,255,0.9)"
                  fgColor={theme.productColor}
                  level="M"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

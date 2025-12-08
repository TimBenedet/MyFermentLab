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
// Zone logo ~140px, donc centre à 70px
const LOGO_ZONE_WIDTH = 140;
const labelAnchorsX = [
  { pos: 0, type: 'edge' },
  { pos: SMALL_MARGIN, type: 'margin-sm' },
  { pos: MARGIN, type: 'margin' },
  { pos: 30, type: 'grid' },
  { pos: 40, type: 'grid' },
  { pos: 50, type: 'grid' },
  { pos: 60, type: 'grid' },
  { pos: LOGO_ZONE_WIDTH / 2, type: 'center' }, // 70px - centre zone logo
  { pos: 80, type: 'grid' },
  { pos: 90, type: 'grid' },
  { pos: 100, type: 'grid' },
  { pos: 110, type: 'grid' },
  { pos: 120, type: 'grid' },
  { pos: 130, type: 'grid' },
  { pos: LOGO_ZONE_WIDTH, type: 'grid' }, // 140px - fin zone logo
  { pos: 150, type: 'grid' },
  { pos: 160, type: 'grid' },
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

// Composant SVG Houblon pour la bière (basé sur Houblon.svg)
const HoublonSVG = ({ color }: { color: string }) => (
  <svg viewBox="0 0 743.09 354.44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M500.01,55.4c-21.59-24.81-15.35,7.7,5.49-1.01,15.08-4.31,22.3-28.54,3.49-33.64-19.07-3.97-36.74,9.17-48.19,23.17-8.79,11.77-18.54,22.56-31.71,29.44" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M397.12,75.86c80.7-12.39,113.53,31.42,188.93,15.59,5.53,6.39,14.98,12.32,12.13,22.09-2.5,6.04-.31,15.4,7.46,15.24,6.81-1.01,14.85,4.55,13.51,11.95-.33,1.17.19,2,1.45,2.52,3.47.8,5.38,3.82,8.26,5.44,11.42,2.54,15.96,15.34,13.48,25.71" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M396.62,76.11c-36.54,3.4-71.55,22.49-108.88,16.96" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M650.59,76.86c-21.4,4.35-42.34,10.47-63.68,14.97" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M671.06,29.21c3.75-6.98,18.52-15.06,25.83-9.13-8.22,5.1-18.41,6.98-27.63,9.63-11.78,15.55-10.98,36.25-21.16,52.4-10.51,13.63-31.48,16.31-45.72,7.22" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M597.15,123.01c-1.18,3.25-2.73,6.25-5.72,8.26-16.69-8.25-16.71,5.75-30.49,8.45" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M721.26,82.09c-11.58-3.81-23.31-6.58-35.46-7.73" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M672.31,29.96c4.65,3.1,15.02,6.08,11.9,13.36-5.85,1.82-12.62-6.7-15.65-11.11" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M575.92,164.66c-4.13,12.37,3.15,17.48,4.33,28.74,7.83-2.37,12.72-6.9,14.4-14.77" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M667.57,108.29c7.15-3.88,11.21-11.56,20.17-6.09,5.66-3.54,4.36-10.64,5.05-16.36.05-5.22-5.31-8.42-8.31-11.78-10.94-.87-21.6.7-32.4,2.05" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M668.57,130.49c-.71-5.29-1.36-10.47.96-15.47-6.29.12-12.21,9.53-9.95,16.47" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M380.89,132.98c-.71-5.29-1.36-10.47.96-15.47-6.29.12-12.21,9.53-9.95,16.47" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M565.68,148.95c-10.39,1.18-16.52,14.06-13.48,23.45" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M619.12,142.71c-1,2.66-2,5.32-3.09,8.22-7.61-7.1-20.35,2.97-26.13-6.47" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M619.12,135.23c10.23.6,19.98,5.57,17.23,16.71" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M568.68,145.21c-5.07,6.62-5.53,12.74-4.75,19.39-7.43,9.16-6.93,18.8-1.99,28.75" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M633.86,165.91c3.24,8.83,2.35,17.3-2.24,25.96-4.95-2-7.71-6.27-11.49-9.74" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M595.9,149.2c-1.11,5.97-6.33,12.34-13.73,12.56-6.63.91-11.33,6.79-17.58,9.81-.23-2.04-.44-3.97-.65-5.9" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M609.63,192.1c2.03,9.54-5.29,16.02-11.99,21.45" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M691.29,115.27c-1.46,7.07-8.31,8.85-14.47,10.26-2.39,7.72,1,14.04,3.5,21.11,5.97-.98,7.96-5,10.22-10.17" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M403.62,117.77c-1.46,7.07-8.31,8.85-14.47,10.26-2.39,7.72,1,14.04,3.5,21.11,5.97-.98,7.96-5,10.22-10.17" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M396.87,76.61c10,7.21,10.93,18.47,3.9,28.16-11.28-5.04-12.16,1.26-20.88,6.02" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M565.43,191.11c1.1,7.86,4.66,14.78,8.31,21.82.56-.38,1.12-.75,1.68-1.12" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M628.86,191.11c-1.04,7.6-3.89,14.41-9.03,20.39-3.92-3.02-7.69-6.02-9.7-10.66" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M594.65,136.23c-2.51,8.85-10.83,12.06-17.48,11.98-6-.1-9.97-4.95-14.23-8.48" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M713.51,129.99c-1.32-2.52-3.21-4.14-6.27-4.05,4.96,11.07.13,17.32-8.16,20.99-2.02-3.45-4.03-6.88-6.09-10.42.61-.71,1.08-1.24,1.55-1.78" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M692.54,115.02c4.48-.61,8.99-1.54,13.28,1.26,4.29-7.87,1.67-17.07-8.53-15.98-2.89,2.98-5.18,3.5-8.74,2" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M404.87,117.52c4.48-.61,8.99-1.54,13.28,1.26,4.29-7.87,1.67-17.07-8.53-15.98-2.89,2.98-5.18,3.5-8.74,2" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M425.84,132.48c-1.32-2.52-3.21-4.14-6.27-4.05,4.96,11.07.13,17.32-8.16,20.99-2.02-3.45-4.03-6.88-6.09-10.42.61-.71,1.08-1.24,1.55-1.78" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M618.62,211.31c-2.24,7.44-4.93,13.36-9.36,20.12-4.69-3.79-8.08-7.92-11.63-12.63-.22-.2-.55-.37-.74,0" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M432.33,119.76c2.71-9.26-5.75-11.42-12.24-11.97" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M720.01,117.27c2.71-9.26-5.75-11.42-12.24-11.97" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M584.41,192.1c.4,3,.81,6.01,1.26,9.38-2.04,4.25-7.09,6.07-10.19,9.51,2.38,7.27,5.34,13.15,8.81,20.01,5.13-3.41,9.92-6.3,12.35-11.71" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M501.26,56.65c6.79,12.28-21.31,24.02-1-.5" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M493.51,118.52c.4,6.27-5.44,11.87-.75,17.96" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M427.09,117.77c.2,2.73.41,5.47.65,8.77,6.44,4.36,5.34,15.24,1.6,21.42" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M714.76,115.27c.2,2.73.41,5.47.65,8.77,6.44,4.36,5.34,15.24,1.6,21.42" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M667.82,126.75c-5.02,5.81-4.67,13.61-1.23,20.05,3.84-2.56,7.52-5.2,9.47-9.57" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M380.14,129.24c-5.02,5.81-4.67,13.61-1.23,20.05,3.84-2.56,7.52-5.2,9.47-9.57" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M597.65,149.2c6.59,20.56,18.75,8.38,28.72,19.21" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M504.75,88.33c6,4.85,5.47,8.11,4.74,15.19-.66.92-1.63,2.27-2.66,3.7-5.49-4.03-9.09,1.07-13.58,3.82" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M586.16,201.33c3.9,5.52,11.98,9.72,11.24,17.21" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M618.37,164.42c6.28,13.1,1.16,22.71-11.42,29.1-2.81-5.02-5.43-9.7-8.06-14.38" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M588.16,163.92c.39,6.75,4.67,11.48,8.76,16.45,4.44-4.58,8.84-9.36,9.22-16.45" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M669.07,145.46c1.85,5.29,3.7,10.58,5.66,16.21,3.38-3.26,6.35-6.12,9.32-8.98" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M381.39,147.95c1.85,5.29,3.7,10.58,5.66,16.21,3.38-3.26,6.35-6.12,9.32-8.98" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M587.41,229.52c.38,6.47,5.34,10.7,9.73,14.96,4.15-4.33,9.37-7.7,9.5-14.46" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M494.01,117.52c-.11-.75,0-1.22.62-1.74-4.38-.26-7.64,4.94-6.86,10.71,1.08-.66,2.16-1.32,3.25-1.98" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M420.6,112.78c2.24,1.46,4.49,2.91,7.36,4.77,5.55.2,11.21,9.76,8.97,16.88-1.89-1.6-3.86-3.27-5.84-4.94" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M708.27,110.28c2.24,1.46,4.49,2.91,7.36,4.77,5.55.2,11.21,9.76,8.97,16.88-1.89-1.6-3.86-3.27-5.84-4.94" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M690.29,105.54c-1.56,7.57-11.77,10.74-16.47,7.72-2.44-1.76-4.84-3.55-7.5-4.98" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M402.62,108.04c-1.56,7.57-11.77,10.74-16.47,7.72-2.44-1.76-4.84-3.55-7.5-4.98" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M715.01,145.46c-1.02,3.97-1.35,8.45-4.35,11.37-4.85,5.33-5.85,11.58-9.75,17.63-3.23-2.85-6.09-5.4-8.37-8.54" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M427.34,147.95c-1.02,3.97-1.35,8.45-4.35,11.37-4.85,5.33-5.85,11.58-9.75,17.63-3.23-2.85-6.09-5.4-8.37-8.54" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M508,109.53c-.68,1.37-1.36,2.73-1.91,3.85-6.08,2.75-8.69,1.59-13.57-2.35" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M388.88,162.92c1.61,4.88,3.92,9.11,6.27,13.78,3.68-2.48,7.08-4.7,8.96-8.54" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M676.56,160.42c1.61,4.88,3.92,9.11,6.27,13.78,3.68-2.48,7.08-4.7,8.96-8.54" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M686.8,111.78c1.57,1.52,2.84,3.55,5.45,3,1.85,7.26,7.55,10.52,14.53,10.97" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M628.36,148.95c1.75,4.15,1.4,8.43.73,11.88,4.62,4.29,8.81,8.18,13.01,12.07" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M399.12,114.27c1.57,1.52,2.84,3.55,5.45,3,1.85,7.26,7.55,10.52,14.53,10.97" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M520.23,109.04c4.46.34,9.25,1.99,7.99,7.73" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M524.98,121.76c4.88,2.56,3.36,10.03,1,14.04-2.58-.64-3.88-2.79-5.49-4.56" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M517.99,122.01c-3.91.54-6.46-1.49-8.35-6.8-5.45,11.38-10.27,1.28-11.12,12.29" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M603.64,129.24c-3.21,3.7-7.11,4.19-11.49,2.49" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M574.42,180.38c-1.85,5.8-7.43,8.78-11.99,12.22" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M498.51,130.99c-1.35,1.55-2.7,3.11-4.08,4.7.22,3.84,2.35,7.23,4.08,10.76" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M698.78,173.4c-.16,3.88-1.04,5.21-6.8,10.28-3.23-2.81-6.41-5.64-6.94-10.28" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M411.11,175.89c.11,4.96-3.78,7.29-6.65,10.4-3.37-2.93-6.55-5.76-7.08-10.4" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M685.3,126c1.72,4.19,3.23,8.32,6.5,11.59.26-.18.75-.52,1.24-.87" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M397.62,128.49c1.72,4.19,3.23,8.32,6.5,11.59.26-.18.75-.52,1.24-.87" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M700.53,152.44c-1.38,4.35-5.62,6.21-8.53,9.61.09,1.04.19,2.2.29,3.36" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M412.86,154.94c-1.38,4.35-5.62,6.21-8.53,9.61.09,1.04.19,2.2.29,3.36" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M683.05,146.2c-.92,6.8,5.05,11.14,8.99,15.72" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M524.48,135.73c-.63,7.27-6.51,12.36-9.03,19.07-.54-.27-.87-.44-1.21-.61" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M395.38,148.7c-.92,6.8,5.05,11.14,8.99,15.72" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M499.01,128.49c.24,2.84,1.92,5.28,2.88,7.96,3.54-.62,5.23-3.26,6.36-6.46" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M524.98,115.52c4.7,1.22,7.58,6.61,5.99,11.23" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M503.5,136.48c.15,1.34.3,2.68.49,4.35-1.23,1.6-3.04,3.01-5.06,4.27,1.4,3.17,2.79,6.33,4.06,9.21.83-.07,1.17-.09,1.5-.12" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M561.19,167.41c-3.74-.19-8.12,2.88-9.24,6.49" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M411.11,128.49c-1.1,2.81-1.48,5.95-3.75,8.23" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M698.78,126c-1.1,2.81-1.48,5.95-3.75,8.23" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M519.98,112.78c-.43,1.07-.87,2.14-1.39,3.42-2.74-1.41-5.65-1.7-8.6-.43" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M519.74,123.01c2.47,5.89,1.22,9.88-4,12.72" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M388.88,128.74c-2.66,1.75-5.33,3.49-7.99,5.24" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M676.56,126.25c-2.66,1.75-5.33,3.49-7.99,5.24" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M701.28,152.19c1.39,3.07,3.73,5.35,6.24,7.48" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M413.61,154.69c1.39,3.07,3.73,5.35,6.24,7.48" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M513.99,123.01c-1.14,2.3-2.27,4.59-3.57,7.22.99,1.68,2.23,3.8,3.66,6.24.2-.04.68-.13,1.2-.23.9,3.95-1.1,6.53-4.02,8.74-7.13,6.84,10.56,6.7-2.05,16.5-1.65-2.37-3.26-4.67-4.71-6.74,1.84-2.14,3.29-3.84,4.75-5.53" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M378.15,130.99c-3.44-.34-5.05,1.95-6.49,4.49" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M665.82,128.49c-3.44-.34-5.05,1.95-6.49,4.49" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M518.99,122.51c1.56.56,3.13,1.12,4.71,1.69,2.59-6.75,1.93-9.22-3.59-11.72v-2.99c-1.89-2.71-4.13-4.23-7.92-3.81-.41-.4-1.18-1.13-1.95-1.87" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M708.52,138.97c2.73,2.35,4.67,5.61,8.23,7.02.26.1.34.63.51.97" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M420.85,141.47c2.73,2.35,4.67,5.61,8.23,7.02.26.1.34.63.51.97" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M505.5,123.01c-.05,3.27,1.82,5.42,4.25,7.23" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M498.76,123.25c-1.5.91-3.01,1.81-4.55,2.75-.15-.74-.29-1.5-.44-2.25" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M628.61,162.42c-.34,2.36-2.89,5.12-1.25,7.23" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M413.36,148.95c-.08,1.83-.17,3.66-.25,5.49" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M701.03,146.45c-.08,1.83-.17,3.66-.25,5.49" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M504.75,141.22l4.49,5.24" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M515.49,140.22c1.42,1.66,2.83,3.33,4.25,4.99" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M692.29,96.31c1.33,1.33,2.66,2.66,4,3.99" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M404.62,98.81c1.33,1.33,2.66,2.66,4,3.99" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M512.24,106.29c-1.08,1.54-2.7,1.26-4.25,1.25" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M715.01,124.5c-.5,1.33-1,2.66-1.5,3.99" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M427.34,127c-.5,1.33-1,2.66-1.5,3.99" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M527.73,123.75c1.08,1.25,2.16,2.49,3.25,3.74" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M506.25,113.78c.92.67,1.83,1.33,2.75,2" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M383.89,115.02c-.58.75-1.17,1.5-1.75,2.25" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M671.56,112.53c-.58.75-1.17,1.5-1.75,2.25" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M495.76,113.78c-.33.5-.67,1-1,1.5" stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
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

// Composant SVG Koji pattern - mycélium avec ramifications
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

// Petit cluster de spores pour le koji
const SporeClusterSVG = ({ color }: { color: string }) => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="2" fill={color} opacity="0.4"/>
    <path d="M20 20 Q22 15 25 10" stroke={color} strokeWidth="0.3" fill="none" opacity="0.5"/>
    <path d="M20 20 Q25 18 30 15" stroke={color} strokeWidth="0.3" fill="none" opacity="0.5"/>
    <path d="M20 20 Q25 22 32 25" stroke={color} strokeWidth="0.3" fill="none" opacity="0.5"/>
    <path d="M20 20 Q18 25 15 32" stroke={color} strokeWidth="0.3" fill="none" opacity="0.5"/>
    <path d="M20 20 Q15 22 8 25" stroke={color} strokeWidth="0.3" fill="none" opacity="0.5"/>
    <path d="M20 20 Q15 18 10 12" stroke={color} strokeWidth="0.3" fill="none" opacity="0.5"/>
    <circle cx="25" cy="10" r="1" fill={color} opacity="0.3"/>
    <circle cx="30" cy="15" r="0.8" fill={color} opacity="0.3"/>
    <circle cx="32" cy="25" r="1" fill={color} opacity="0.3"/>
    <circle cx="15" cy="32" r="0.8" fill={color} opacity="0.3"/>
    <circle cx="8" cy="25" r="1" fill={color} opacity="0.3"/>
    <circle cx="10" cy="12" r="0.8" fill={color} opacity="0.3"/>
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
  const [customBackground, setCustomBackground] = useState<string | null>(null);

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

  // Obtenir les points d'ancrage d'un élément (basé sur le TEXTE, pas le container)
  const getElementAnchors = useCallback((elementKey: string) => {
    const element = elementRefs.current[elementKey];
    if (!element) return null;
    const pos = positions[elementKey];
    const rect = element.getBoundingClientRect();

    // Padding des éléments draggables
    const PADDING_X = 8;
    const PADDING_Y = 4;

    // Calculer les ancres sur le texte
    const textLeft = pos.x + PADDING_X;
    const textTop = pos.y + PADDING_Y;
    const textWidth = rect.width - (PADDING_X * 2);
    const textHeight = rect.height - (PADDING_Y * 2);

    return {
      left: textLeft,
      centerX: textLeft + textWidth / 2,
      right: textLeft + textWidth,
      top: textTop,
      centerY: textTop + textHeight / 2,
      bottom: textTop + textHeight,
      width: textWidth,
      height: textHeight,
      // Position du container (pour le calcul du snap)
      containerX: pos.x,
      containerY: pos.y
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

    // Padding des éléments draggables (défini dans CSS)
    const PADDING_X = 8;
    const PADDING_Y = 4;

    // Calculer les ancres sur le TEXTE (pas le container)
    // On ajoute le padding pour obtenir le début réel du texte
    const textLeft = newLeft + PADDING_X;
    const textTop = newTop + PADDING_Y;
    const textWidth = currentWidth - (PADDING_X * 2);
    const textHeight = currentHeight - (PADDING_Y * 2);

    const currentAnchors = {
      left: textLeft,
      centerX: textLeft + textWidth / 2,
      right: textLeft + textWidth,
      top: textTop,
      centerY: textTop + textHeight / 2,
      bottom: textTop + textHeight
    };

    // Snaps avec les ancres de l'étiquette (X)
    // On soustrait PADDING_X car snaps.x est la position du container, pas du texte
    for (const anchor of labelAnchorsX) {
      if (Math.abs(currentAnchors.left - anchor.pos) < SNAP_THRESHOLD) {
        snaps.x = anchor.pos - PADDING_X;
        snaps.guides.push({ type: anchor.type === 'center' ? 'vCenter' : 'vertical', pos: anchor.pos, style: anchor.type });
      } else if (Math.abs(currentAnchors.centerX - anchor.pos) < SNAP_THRESHOLD) {
        snaps.x = anchor.pos - textWidth / 2 - PADDING_X;
        snaps.guides.push({ type: anchor.type === 'center' ? 'vCenter' : 'vertical', pos: anchor.pos, style: anchor.type });
      } else if (Math.abs(currentAnchors.right - anchor.pos) < SNAP_THRESHOLD) {
        snaps.x = anchor.pos - textWidth - PADDING_X;
        snaps.guides.push({ type: anchor.type === 'center' ? 'vCenter' : 'vertical', pos: anchor.pos, style: anchor.type });
      }
    }

    // Snaps avec les ancres de l'étiquette (Y)
    // On soustrait PADDING_Y car snaps.y est la position du container, pas du texte
    for (const anchor of labelAnchorsY) {
      if (Math.abs(currentAnchors.top - anchor.pos) < SNAP_THRESHOLD) {
        snaps.y = anchor.pos - PADDING_Y;
        snaps.guides.push({ type: anchor.type === 'center' ? 'hCenter' : 'horizontal', pos: anchor.pos, style: anchor.type });
      } else if (Math.abs(currentAnchors.centerY - anchor.pos) < SNAP_THRESHOLD) {
        snaps.y = anchor.pos - textHeight / 2 - PADDING_Y;
        snaps.guides.push({ type: anchor.type === 'center' ? 'hCenter' : 'horizontal', pos: anchor.pos, style: anchor.type });
      } else if (Math.abs(currentAnchors.bottom - anchor.pos) < SNAP_THRESHOLD) {
        snaps.y = anchor.pos - textHeight - PADDING_Y;
        snaps.guides.push({ type: anchor.type === 'center' ? 'hCenter' : 'horizontal', pos: anchor.pos, style: anchor.type });
      }
    }

    // Alignement avec les autres éléments (basé sur le texte)
    Object.keys(positions).forEach(otherKey => {
      if (otherKey === currentKey) return;
      const otherAnchors = getElementAnchors(otherKey);
      if (!otherAnchors) return;

      // Alignements horizontaux (top des textes alignés)
      if (Math.abs(currentAnchors.top - otherAnchors.top) < SNAP_THRESHOLD) {
        snaps.y = otherAnchors.top - PADDING_Y;
        snaps.guides.push({ type: 'horizontal', pos: otherAnchors.top, style: 'element' });
      }
      if (Math.abs(currentAnchors.centerY - otherAnchors.centerY) < SNAP_THRESHOLD) {
        snaps.y = otherAnchors.centerY - textHeight / 2 - PADDING_Y;
        snaps.guides.push({ type: 'horizontal', pos: otherAnchors.centerY, style: 'element' });
      }

      // Alignements verticaux (left des textes alignés)
      if (Math.abs(currentAnchors.left - otherAnchors.left) < SNAP_THRESHOLD) {
        snaps.x = otherAnchors.left - PADDING_X;
        snaps.guides.push({ type: 'vertical', pos: otherAnchors.left, style: 'element' });
      }
      if (Math.abs(currentAnchors.centerX - otherAnchors.centerX) < SNAP_THRESHOLD) {
        snaps.x = otherAnchors.centerX - textWidth / 2 - PADDING_X;
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
    // Afficher les coordonnées du TEXTE (avec padding ajouté)
    setDragCoords({ x: Math.round(newLeft + 8), y: Math.round(newTop + 4), mouseX: e.clientX, mouseY: e.clientY });

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
    setCustomBackground(null);
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
        return <div className="decoration hop-vine"><HoublonSVG color={theme.productColor} /></div>;
      case 'hydromel':
        return (
          <>
            <div className="decoration honeycomb-pattern"><HoneycombSVG color={theme.productColor} /></div>
            <div className="decoration bee-illustration"><BeeSVG color={theme.productColor} /></div>
          </>
        );
      case 'koji':
        return (
          <>
            <div className="decoration koji-pattern"><KojiPatternSVG color={theme.productColor} /></div>
            <div className="decoration spore-cluster"><SporeClusterSVG color={theme.productColor} /></div>
          </>
        );
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
                        onClick={() => {
                          handleInputChange('theme', themeKey);
                          setCustomBackground(null);
                        }}
                        style={{ background: THEMES[themeKey].background }}
                      >
                        <span className="theme-name">{THEMES[themeKey].name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="label-form-group">
                  <label>Couleur de fond personnalisée</label>
                  <div className="background-color-control">
                    <input
                      type="color"
                      value={customBackground || theme.background}
                      onChange={(e) => setCustomBackground(e.target.value)}
                      className="color-picker"
                    />
                    <span className="color-value">{customBackground || theme.background}</span>
                    {customBackground && (
                      <button
                        className="btn-reset-color"
                        onClick={() => setCustomBackground(null)}
                        title="Revenir au thème"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <p className="input-hint">La texture lin sera conservée par-dessus la couleur</p>
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

          <div ref={labelRef} className={`label-preview label-${labelData.theme}`} style={{ background: customBackground || theme.background }}>
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

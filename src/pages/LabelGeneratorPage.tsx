import React, { useState, useRef, useCallback, useEffect } from 'react';
import './LabelGeneratorPage.css';

interface LabelGeneratorPageProps {
  onBack: () => void;
}

interface LabelData {
  brandName: string;
  brandSubtitle: string;
  productName: string;
  productSeries: string;
  ingredients: string;
  labelColor: string;
}

interface ElementPosition {
  x: number;
  y: number;
  rotation: number;
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
const EQUAL_SNAP_THRESHOLD = 12;
const LABEL_WIDTH = 680;
const LABEL_HEIGHT = 280;
const MARGIN = 20;

// Points d'ancrage de l'étiquette
const labelAnchorsX = [
  { pos: 0, type: 'edge' },
  { pos: MARGIN, type: 'margin' },
  { pos: LABEL_WIDTH / 10, type: 'tenth' },
  { pos: (LABEL_WIDTH * 2) / 10, type: 'fifth' },
  { pos: (LABEL_WIDTH * 3) / 10, type: 'tenth' },
  { pos: LABEL_WIDTH / 4, type: 'quarter' },
  { pos: LABEL_WIDTH / 3, type: 'third' },
  { pos: (LABEL_WIDTH * 4) / 10, type: 'fifth' },
  { pos: LABEL_WIDTH / 2, type: 'center' },
  { pos: (LABEL_WIDTH * 6) / 10, type: 'fifth' },
  { pos: (LABEL_WIDTH * 2) / 3, type: 'third' },
  { pos: (LABEL_WIDTH * 7) / 10, type: 'tenth' },
  { pos: (LABEL_WIDTH * 3) / 4, type: 'quarter' },
  { pos: (LABEL_WIDTH * 4) / 5, type: 'fifth' },
  { pos: (LABEL_WIDTH * 9) / 10, type: 'tenth' },
  { pos: LABEL_WIDTH - MARGIN, type: 'margin' },
  { pos: LABEL_WIDTH, type: 'edge' }
];

const labelAnchorsY = [
  { pos: 0, type: 'edge' },
  { pos: MARGIN, type: 'margin' },
  { pos: LABEL_HEIGHT / 10, type: 'tenth' },
  { pos: (LABEL_HEIGHT * 2) / 10, type: 'fifth' },
  { pos: LABEL_HEIGHT / 4, type: 'quarter' },
  { pos: (LABEL_HEIGHT * 3) / 10, type: 'tenth' },
  { pos: LABEL_HEIGHT / 3, type: 'third' },
  { pos: (LABEL_HEIGHT * 4) / 10, type: 'fifth' },
  { pos: LABEL_HEIGHT / 2, type: 'center' },
  { pos: (LABEL_HEIGHT * 6) / 10, type: 'fifth' },
  { pos: (LABEL_HEIGHT * 2) / 3, type: 'third' },
  { pos: (LABEL_HEIGHT * 7) / 10, type: 'tenth' },
  { pos: (LABEL_HEIGHT * 3) / 4, type: 'quarter' },
  { pos: (LABEL_HEIGHT * 4) / 5, type: 'fifth' },
  { pos: (LABEL_HEIGHT * 9) / 10, type: 'tenth' },
  { pos: LABEL_HEIGHT - MARGIN, type: 'margin' },
  { pos: LABEL_HEIGHT, type: 'edge' }
];

export function LabelGeneratorPage({ onBack }: LabelGeneratorPageProps) {
  const [labelData, setLabelData] = useState<LabelData>({
    brandName: 'HOKKO',
    brandSubtitle: 'BREWERY',
    productName: 'Lumière dorée',
    productSeries: 'BIÈRE - SÉRIE I',
    ingredients: 'malt pilsner, houblon Saaz, miel de tilleul, levure belge',
    labelColor: '#c4a574'
  });

  const [positions, setPositions] = useState<Record<string, ElementPosition>>({
    brand: { x: 35, y: 30, rotation: 0 },
    subtitle: { x: 85, y: 55, rotation: 0 },
    line: { x: 130, y: 30, rotation: 0 },
    product: { x: 180, y: 55, rotation: 0 },
    series: { x: 180, y: 120, rotation: 0 },
    ingredients: { x: 180, y: 165, rotation: 0 }
  });

  const [styles, setStyles] = useState<Record<string, { bold: boolean; italic: boolean; color: string }>>({
    brand: { bold: false, italic: false, color: '#2c2218' },
    subtitle: { bold: false, italic: false, color: '#4a3d30' },
    product: { bold: false, italic: true, color: '#2c2218' },
    series: { bold: false, italic: false, color: '#5a4a3a' },
    ingredients: { bold: false, italic: true, color: '#4a3d30' }
  });

  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeGuides, setActiveGuides] = useState<SnapGuide[]>([]);
  const [isSnapped, setIsSnapped] = useState(false);

  const labelRef = useRef<HTMLDivElement>(null);
  const elementRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);

  const labelColors = [
    '#c9a97a', '#d4b896', '#bfa068', '#d9c4a0', '#c2a06a',
    '#e5d5b8', '#d6c4a8', '#b89f7a', '#cdb896', '#a8946f'
  ];

  const handleInputChange = (field: keyof LabelData, value: string) => {
    setLabelData(prev => ({ ...prev, [field]: value }));
  };

  const handleStyleToggle = (element: string, style: 'bold' | 'italic') => {
    setStyles(prev => ({
      ...prev,
      [element]: {
        ...prev[element],
        [style]: !prev[element][style]
      }
    }));
  };

  const handleColorChange = (element: string, color: string) => {
    setStyles(prev => ({
      ...prev,
      [element]: {
        ...prev[element],
        color
      }
    }));
  };

  const handleRotationChange = (element: string, rotation: number) => {
    setPositions(prev => ({
      ...prev,
      [element]: {
        ...prev[element],
        rotation
      }
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

    const snaps: SnapResult = {
      x: null,
      y: null,
      guides: []
    };

    const currentAnchors = {
      left: newLeft,
      centerX: newLeft + currentWidth / 2,
      right: newLeft + currentWidth,
      top: newTop,
      centerY: newTop + currentHeight / 2,
      bottom: newTop + currentHeight
    };

    // Vérifier les snaps avec les ancres de l'étiquette (X)
    for (const anchor of labelAnchorsX) {
      // Left de l'élément sur l'ancre
      if (Math.abs(currentAnchors.left - anchor.pos) < SNAP_THRESHOLD) {
        snaps.x = anchor.pos;
        snaps.guides.push({
          type: anchor.type === 'center' ? 'vCenter' : 'vertical',
          pos: anchor.pos,
          style: anchor.type
        });
      }
      // Center de l'élément sur l'ancre
      else if (Math.abs(currentAnchors.centerX - anchor.pos) < SNAP_THRESHOLD) {
        snaps.x = anchor.pos - currentWidth / 2;
        snaps.guides.push({
          type: anchor.type === 'center' ? 'vCenter' : 'vertical',
          pos: anchor.pos,
          style: anchor.type
        });
      }
      // Right de l'élément sur l'ancre
      else if (Math.abs(currentAnchors.right - anchor.pos) < SNAP_THRESHOLD) {
        snaps.x = anchor.pos - currentWidth;
        snaps.guides.push({
          type: anchor.type === 'center' ? 'vCenter' : 'vertical',
          pos: anchor.pos,
          style: anchor.type
        });
      }
    }

    // Vérifier les snaps avec les ancres de l'étiquette (Y)
    for (const anchor of labelAnchorsY) {
      // Top de l'élément sur l'ancre
      if (Math.abs(currentAnchors.top - anchor.pos) < SNAP_THRESHOLD) {
        snaps.y = anchor.pos;
        snaps.guides.push({
          type: anchor.type === 'center' ? 'hCenter' : 'horizontal',
          pos: anchor.pos,
          style: anchor.type
        });
      }
      // Center de l'élément sur l'ancre
      else if (Math.abs(currentAnchors.centerY - anchor.pos) < SNAP_THRESHOLD) {
        snaps.y = anchor.pos - currentHeight / 2;
        snaps.guides.push({
          type: anchor.type === 'center' ? 'hCenter' : 'horizontal',
          pos: anchor.pos,
          style: anchor.type
        });
      }
      // Bottom de l'élément sur l'ancre
      else if (Math.abs(currentAnchors.bottom - anchor.pos) < SNAP_THRESHOLD) {
        snaps.y = anchor.pos - currentHeight;
        snaps.guides.push({
          type: anchor.type === 'center' ? 'hCenter' : 'horizontal',
          pos: anchor.pos,
          style: anchor.type
        });
      }
    }

    // Vérifier l'alignement avec les autres éléments
    Object.keys(positions).forEach(otherKey => {
      if (otherKey === currentKey) return;

      const otherAnchors = getElementAnchors(otherKey);
      if (!otherAnchors) return;

      // Alignements horizontaux (même Y)
      if (Math.abs(currentAnchors.top - otherAnchors.top) < SNAP_THRESHOLD) {
        snaps.y = otherAnchors.top;
        snaps.guides.push({ type: 'horizontal', pos: otherAnchors.top, style: 'element' });
      }
      if (Math.abs(currentAnchors.bottom - otherAnchors.bottom) < SNAP_THRESHOLD) {
        snaps.y = otherAnchors.bottom - currentHeight;
        snaps.guides.push({ type: 'horizontal', pos: otherAnchors.bottom, style: 'element' });
      }
      if (Math.abs(currentAnchors.centerY - otherAnchors.centerY) < SNAP_THRESHOLD) {
        snaps.y = otherAnchors.centerY - currentHeight / 2;
        snaps.guides.push({ type: 'horizontal', pos: otherAnchors.centerY, style: 'element' });
      }
      if (Math.abs(currentAnchors.top - otherAnchors.bottom) < SNAP_THRESHOLD) {
        snaps.y = otherAnchors.bottom;
        snaps.guides.push({ type: 'horizontal', pos: otherAnchors.bottom, style: 'element' });
      }
      if (Math.abs(currentAnchors.bottom - otherAnchors.top) < SNAP_THRESHOLD) {
        snaps.y = otherAnchors.top - currentHeight;
        snaps.guides.push({ type: 'horizontal', pos: otherAnchors.top, style: 'element' });
      }

      // Alignements verticaux (même X)
      if (Math.abs(currentAnchors.left - otherAnchors.left) < SNAP_THRESHOLD) {
        snaps.x = otherAnchors.left;
        snaps.guides.push({ type: 'vertical', pos: otherAnchors.left, style: 'element' });
      }
      if (Math.abs(currentAnchors.right - otherAnchors.right) < SNAP_THRESHOLD) {
        snaps.x = otherAnchors.right - currentWidth;
        snaps.guides.push({ type: 'vertical', pos: otherAnchors.right, style: 'element' });
      }
      if (Math.abs(currentAnchors.centerX - otherAnchors.centerX) < SNAP_THRESHOLD) {
        snaps.x = otherAnchors.centerX - currentWidth / 2;
        snaps.guides.push({ type: 'vertical', pos: otherAnchors.centerX, style: 'element' });
      }
      if (Math.abs(currentAnchors.left - otherAnchors.right) < SNAP_THRESHOLD) {
        snaps.x = otherAnchors.right;
        snaps.guides.push({ type: 'vertical', pos: otherAnchors.right, style: 'element' });
      }
      if (Math.abs(currentAnchors.right - otherAnchors.left) < SNAP_THRESHOLD) {
        snaps.x = otherAnchors.left - currentWidth;
        snaps.guides.push({ type: 'vertical', pos: otherAnchors.left, style: 'element' });
      }
    });

    // Snap à distance égale (vertical)
    const otherElements = Object.keys(positions)
      .filter(k => k !== currentKey)
      .map(k => getElementAnchors(k))
      .filter((a): a is NonNullable<typeof a> => a !== null);

    const sortedByY = [...otherElements].sort((a, b) => a.top - b.top);
    let elementAbove = null;
    let elementBelow = null;

    for (const el of sortedByY) {
      if (el.bottom <= currentAnchors.top) elementAbove = el;
    }
    for (const el of sortedByY) {
      if (el.top >= currentAnchors.bottom) {
        elementBelow = el;
        break;
      }
    }

    const distAbove = elementAbove ? currentAnchors.top - elementAbove.bottom : currentAnchors.top;
    const distBelow = elementBelow ? elementBelow.top - currentAnchors.bottom : LABEL_HEIGHT - currentAnchors.bottom;

    if (snaps.y === null && Math.abs(distAbove - distBelow) < EQUAL_SNAP_THRESHOLD && Math.abs(distAbove - distBelow) > 0.5) {
      const availableSpace = (elementBelow ? elementBelow.top : LABEL_HEIGHT) - (elementAbove ? elementAbove.bottom : 0);
      const equalDist = (availableSpace - currentHeight) / 2;
      const snapY = (elementAbove ? elementAbove.bottom : 0) + equalDist;

      snaps.y = snapY;
      snaps.guides.push({ type: 'horizontal', pos: snapY, style: 'equal-distance' });
      snaps.guides.push({ type: 'horizontal', pos: snapY + currentHeight, style: 'equal-distance' });
    }

    // Snap à distance égale (horizontal)
    const sortedByX = [...otherElements].sort((a, b) => a.left - b.left);
    let elementLeft = null;
    let elementRight = null;

    for (const el of sortedByX) {
      if (el.right <= currentAnchors.left) elementLeft = el;
    }
    for (const el of sortedByX) {
      if (el.left >= currentAnchors.right) {
        elementRight = el;
        break;
      }
    }

    const distLeft = elementLeft ? currentAnchors.left - elementLeft.right : currentAnchors.left;
    const distRight = elementRight ? elementRight.left - currentAnchors.right : LABEL_WIDTH - currentAnchors.right;

    if (snaps.x === null && Math.abs(distLeft - distRight) < EQUAL_SNAP_THRESHOLD && Math.abs(distLeft - distRight) > 0.5) {
      const availableSpace = (elementRight ? elementRight.left : LABEL_WIDTH) - (elementLeft ? elementLeft.right : 0);
      const equalDist = (availableSpace - currentWidth) / 2;
      const snapX = (elementLeft ? elementLeft.right : 0) + equalDist;

      snaps.x = snapX;
      snaps.guides.push({ type: 'vertical', pos: snapX, style: 'equal-distance' });
      snaps.guides.push({ type: 'vertical', pos: snapX + currentWidth, style: 'equal-distance' });
    }

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

    // Trouver les snaps
    const snaps = findSnaps(selectedElement, newLeft, newTop);

    if (snaps.x !== null) newLeft = snaps.x;
    if (snaps.y !== null) newTop = snaps.y;

    // Contraindre aux limites
    newLeft = Math.max(0, Math.min(LABEL_WIDTH - 20, newLeft));
    newTop = Math.max(0, Math.min(LABEL_HEIGHT - 20, newTop));

    setActiveGuides(snaps.guides);
    setIsSnapped(snaps.guides.length > 0);

    setPositions(prev => ({
      ...prev,
      [selectedElement]: {
        ...prev[selectedElement],
        x: newLeft,
        y: newTop
      }
    }));
  }, [isDragging, selectedElement, findSnaps]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setActiveGuides([]);
    setIsSnapped(false);
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
      brandName: 'HOKKO',
      brandSubtitle: 'BREWERY',
      productName: 'Lumière dorée',
      productSeries: 'BIÈRE - SÉRIE I',
      ingredients: 'malt pilsner, houblon Saaz, miel de tilleul, levure belge',
      labelColor: '#c4a574'
    });
    setPositions({
      brand: { x: 35, y: 30, rotation: 0 },
      subtitle: { x: 85, y: 55, rotation: 0 },
      line: { x: 130, y: 30, rotation: 0 },
      product: { x: 180, y: 55, rotation: 0 },
      series: { x: 180, y: 120, rotation: 0 },
      ingredients: { x: 180, y: 165, rotation: 0 }
    });
    setStyles({
      brand: { bold: false, italic: false, color: '#2c2218' },
      subtitle: { bold: false, italic: false, color: '#4a3d30' },
      product: { bold: false, italic: true, color: '#2c2218' },
      series: { bold: false, italic: false, color: '#5a4a3a' },
      ingredients: { bold: false, italic: true, color: '#4a3d30' }
    });
  };

  // Fonction pour déterminer si un guide est horizontal
  const isHorizontalGuide = (type: string) => type === 'horizontal' || type === 'hCenter';

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
          <div className="section-title">Zone gauche - Marque</div>

          {/* Nom de marque */}
          <div className="label-form-group">
            <label>Nom de marque</label>
            <input
              type="text"
              value={labelData.brandName}
              onChange={(e) => handleInputChange('brandName', e.target.value)}
              placeholder="HOKKO"
            />
            <div className="element-controls">
              <div className="control-row">
                <div className="style-buttons">
                  <button
                    className={`style-btn ${styles.brand.bold ? 'active' : ''}`}
                    onClick={() => handleStyleToggle('brand', 'bold')}
                  >B</button>
                  <button
                    className={`style-btn italic ${styles.brand.italic ? 'active' : ''}`}
                    onClick={() => handleStyleToggle('brand', 'italic')}
                  >I</button>
                </div>
                <input
                  type="color"
                  value={styles.brand.color}
                  onChange={(e) => handleColorChange('brand', e.target.value)}
                  className="color-picker"
                />
                <div className="rotation-control">
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={positions.brand.rotation}
                    onChange={(e) => handleRotationChange('brand', parseInt(e.target.value))}
                  />
                  <span>{positions.brand.rotation}°</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sous-titre */}
          <div className="label-form-group">
            <label>Sous-titre</label>
            <input
              type="text"
              value={labelData.brandSubtitle}
              onChange={(e) => handleInputChange('brandSubtitle', e.target.value)}
              placeholder="BREWERY"
            />
            <div className="element-controls">
              <div className="control-row">
                <div className="style-buttons">
                  <button
                    className={`style-btn ${styles.subtitle.bold ? 'active' : ''}`}
                    onClick={() => handleStyleToggle('subtitle', 'bold')}
                  >B</button>
                  <button
                    className={`style-btn italic ${styles.subtitle.italic ? 'active' : ''}`}
                    onClick={() => handleStyleToggle('subtitle', 'italic')}
                  >I</button>
                </div>
                <input
                  type="color"
                  value={styles.subtitle.color}
                  onChange={(e) => handleColorChange('subtitle', e.target.value)}
                  className="color-picker"
                />
                <div className="rotation-control">
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={positions.subtitle.rotation}
                    onChange={(e) => handleRotationChange('subtitle', parseInt(e.target.value))}
                  />
                  <span>{positions.subtitle.rotation}°</span>
                </div>
              </div>
            </div>
          </div>

          <hr className="section-divider" />
          <div className="section-title">Zone droite - Produit</div>

          {/* Nom du produit */}
          <div className="label-form-group">
            <label>Nom du produit</label>
            <input
              type="text"
              value={labelData.productName}
              onChange={(e) => handleInputChange('productName', e.target.value)}
              placeholder="Lumière dorée"
            />
            <div className="element-controls">
              <div className="control-row">
                <div className="style-buttons">
                  <button
                    className={`style-btn ${styles.product.bold ? 'active' : ''}`}
                    onClick={() => handleStyleToggle('product', 'bold')}
                  >B</button>
                  <button
                    className={`style-btn italic ${styles.product.italic ? 'active' : ''}`}
                    onClick={() => handleStyleToggle('product', 'italic')}
                  >I</button>
                </div>
                <input
                  type="color"
                  value={styles.product.color}
                  onChange={(e) => handleColorChange('product', e.target.value)}
                  className="color-picker"
                />
                <div className="rotation-control">
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={positions.product.rotation}
                    onChange={(e) => handleRotationChange('product', parseInt(e.target.value))}
                  />
                  <span>{positions.product.rotation}°</span>
                </div>
              </div>
            </div>
          </div>

          {/* Type / Série */}
          <div className="label-form-group">
            <label>Type / Série</label>
            <input
              type="text"
              value={labelData.productSeries}
              onChange={(e) => handleInputChange('productSeries', e.target.value)}
              placeholder="BIÈRE - SÉRIE I"
            />
            <div className="element-controls">
              <div className="control-row">
                <div className="style-buttons">
                  <button
                    className={`style-btn ${styles.series.bold ? 'active' : ''}`}
                    onClick={() => handleStyleToggle('series', 'bold')}
                  >B</button>
                  <button
                    className={`style-btn italic ${styles.series.italic ? 'active' : ''}`}
                    onClick={() => handleStyleToggle('series', 'italic')}
                  >I</button>
                </div>
                <input
                  type="color"
                  value={styles.series.color}
                  onChange={(e) => handleColorChange('series', e.target.value)}
                  className="color-picker"
                />
                <div className="rotation-control">
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={positions.series.rotation}
                    onChange={(e) => handleRotationChange('series', parseInt(e.target.value))}
                  />
                  <span>{positions.series.rotation}°</span>
                </div>
              </div>
            </div>
          </div>

          {/* Ingrédients */}
          <div className="label-form-group">
            <label>Ingrédients / Description</label>
            <textarea
              value={labelData.ingredients}
              onChange={(e) => handleInputChange('ingredients', e.target.value)}
              placeholder="Description du produit"
              rows={3}
            />
            <div className="element-controls">
              <div className="control-row">
                <div className="style-buttons">
                  <button
                    className={`style-btn ${styles.ingredients.bold ? 'active' : ''}`}
                    onClick={() => handleStyleToggle('ingredients', 'bold')}
                  >B</button>
                  <button
                    className={`style-btn italic ${styles.ingredients.italic ? 'active' : ''}`}
                    onClick={() => handleStyleToggle('ingredients', 'italic')}
                  >I</button>
                </div>
                <input
                  type="color"
                  value={styles.ingredients.color}
                  onChange={(e) => handleColorChange('ingredients', e.target.value)}
                  className="color-picker"
                />
                <div className="rotation-control">
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={positions.ingredients.rotation}
                    onChange={(e) => handleRotationChange('ingredients', parseInt(e.target.value))}
                  />
                  <span>{positions.ingredients.rotation}°</span>
                </div>
              </div>
            </div>
          </div>

          <hr className="section-divider" />
          <div className="section-title">Apparence</div>

          <div className="label-form-group">
            <label>Couleur de l'étiquette</label>
            <div className="color-grid">
              {labelColors.map((color, index) => (
                <div
                  key={index}
                  className={`color-option ${labelData.labelColor === color ? 'active' : ''}`}
                  style={{ background: color }}
                  onClick={() => handleInputChange('labelColor', color)}
                />
              ))}
            </div>
          </div>

          <div className="label-actions">
            <button className="btn-primary" onClick={handlePrint}>Imprimer</button>
            <button className="btn-secondary" onClick={handleReset}>Reset</button>
          </div>
        </div>

        {/* Section preview */}
        <div className="label-preview-section">
          <p className="edit-hint">Cliquez et glissez pour déplacer les éléments</p>

          <div
            ref={labelRef}
            className="label-preview"
            style={{ background: labelData.labelColor }}
          >
            {/* Texture kraft */}
            <div className="kraft-texture" />

            {/* Guides d'alignement */}
            {activeGuides.map((guide, index) => (
              <div
                key={index}
                className={`snap-guide ${isHorizontalGuide(guide.type) ? 'horizontal' : 'vertical'} ${guide.style} visible`}
                style={
                  isHorizontalGuide(guide.type)
                    ? { top: `${guide.pos}px` }
                    : { left: `${guide.pos}px` }
                }
              />
            ))}

            {/* Nom de marque vertical */}
            <div
              ref={el => { elementRefs.current['brand'] = el; }}
              className={`draggable brand-vertical-wrapper ${selectedElement === 'brand' ? 'selected' : ''} ${isSnapped && selectedElement === 'brand' ? 'snapped' : ''}`}
              style={{
                left: `${positions.brand.x}px`,
                top: `${positions.brand.y}px`,
                transform: `rotate(${positions.brand.rotation}deg)`
              }}
              onMouseDown={(e) => handleMouseDown('brand', e)}
            >
              <span
                className="brand-vertical"
                style={{
                  color: styles.brand.color,
                  fontWeight: styles.brand.bold ? 'bold' : 300,
                  fontStyle: styles.brand.italic ? 'italic' : 'normal'
                }}
              >
                {labelData.brandName}
              </span>
            </div>

            {/* Sous-titre vertical */}
            <div
              ref={el => { elementRefs.current['subtitle'] = el; }}
              className={`draggable brand-subtitle-wrapper ${selectedElement === 'subtitle' ? 'selected' : ''} ${isSnapped && selectedElement === 'subtitle' ? 'snapped' : ''}`}
              style={{
                left: `${positions.subtitle.x}px`,
                top: `${positions.subtitle.y}px`,
                transform: `rotate(${positions.subtitle.rotation}deg)`
              }}
              onMouseDown={(e) => handleMouseDown('subtitle', e)}
            >
              <span
                className="brand-subtitle"
                style={{
                  color: styles.subtitle.color,
                  fontWeight: styles.subtitle.bold ? 'bold' : 300,
                  fontStyle: styles.subtitle.italic ? 'italic' : 'normal'
                }}
              >
                {labelData.brandSubtitle}
              </span>
            </div>

            {/* Ligne verticale */}
            <div
              ref={el => { elementRefs.current['line'] = el; }}
              className={`draggable vertical-line ${selectedElement === 'line' ? 'selected' : ''} ${isSnapped && selectedElement === 'line' ? 'snapped' : ''}`}
              style={{
                left: `${positions.line.x}px`,
                top: `${positions.line.y}px`,
                transform: `rotate(${positions.line.rotation}deg)`
              }}
              onMouseDown={(e) => handleMouseDown('line', e)}
            />

            {/* Nom du produit */}
            <div
              ref={el => { elementRefs.current['product'] = el; }}
              className={`draggable product-name ${selectedElement === 'product' ? 'selected' : ''} ${isSnapped && selectedElement === 'product' ? 'snapped' : ''}`}
              style={{
                left: `${positions.product.x}px`,
                top: `${positions.product.y}px`,
                transform: `rotate(${positions.product.rotation}deg)`,
                color: styles.product.color,
                fontWeight: styles.product.bold ? 'bold' : 300,
                fontStyle: styles.product.italic ? 'italic' : 'normal'
              }}
              onMouseDown={(e) => handleMouseDown('product', e)}
            >
              {labelData.productName}
            </div>

            {/* Série */}
            <div
              ref={el => { elementRefs.current['series'] = el; }}
              className={`draggable product-series ${selectedElement === 'series' ? 'selected' : ''} ${isSnapped && selectedElement === 'series' ? 'snapped' : ''}`}
              style={{
                left: `${positions.series.x}px`,
                top: `${positions.series.y}px`,
                transform: `rotate(${positions.series.rotation}deg)`,
                color: styles.series.color,
                fontWeight: styles.series.bold ? 'bold' : 400,
                fontStyle: styles.series.italic ? 'italic' : 'normal'
              }}
              onMouseDown={(e) => handleMouseDown('series', e)}
            >
              {labelData.productSeries}
            </div>

            {/* Ingrédients */}
            <div
              ref={el => { elementRefs.current['ingredients'] = el; }}
              className={`draggable product-ingredients ${selectedElement === 'ingredients' ? 'selected' : ''} ${isSnapped && selectedElement === 'ingredients' ? 'snapped' : ''}`}
              style={{
                left: `${positions.ingredients.x}px`,
                top: `${positions.ingredients.y}px`,
                transform: `rotate(${positions.ingredients.rotation}deg)`,
                color: styles.ingredients.color,
                fontWeight: styles.ingredients.bold ? 'bold' : 400,
                fontStyle: styles.ingredients.italic ? 'italic' : 'normal'
              }}
              onMouseDown={(e) => handleMouseDown('ingredients', e)}
            >
              {labelData.ingredients}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

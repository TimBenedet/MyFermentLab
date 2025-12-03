import React, { useState, useRef } from 'react';
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
    brand: { x: 30, y: 30, rotation: 0 },
    subtitle: { x: 65, y: 30, rotation: 0 },
    line: { x: 100, y: 30, rotation: 0 },
    product: { x: 150, y: 80, rotation: 0 },
    series: { x: 150, y: 130, rotation: 0 },
    ingredients: { x: 150, y: 180, rotation: 0 }
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
  const labelRef = useRef<HTMLDivElement>(null);

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

  const handleMouseDown = (element: string, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedElement(element);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedElement || !labelRef.current) return;

    const rect = labelRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setPositions(prev => ({
      ...prev,
      [selectedElement]: {
        ...prev[selectedElement],
        x: Math.max(0, Math.min(680, x)),
        y: Math.max(0, Math.min(280, y))
      }
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

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
      brand: { x: 30, y: 30, rotation: 0 },
      subtitle: { x: 65, y: 30, rotation: 0 },
      line: { x: 100, y: 30, rotation: 0 },
      product: { x: 150, y: 80, rotation: 0 },
      series: { x: 150, y: 130, rotation: 0 },
      ingredients: { x: 150, y: 180, rotation: 0 }
    });
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
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Texture kraft */}
            <div className="kraft-texture" />

            {/* Nom de marque vertical */}
            <div
              className={`draggable brand-vertical ${selectedElement === 'brand' ? 'selected' : ''}`}
              style={{
                left: positions.brand.x,
                top: positions.brand.y,
                transform: `rotate(${positions.brand.rotation}deg)`,
                color: styles.brand.color,
                fontWeight: styles.brand.bold ? 'bold' : 300,
                fontStyle: styles.brand.italic ? 'italic' : 'normal'
              }}
              onMouseDown={(e) => handleMouseDown('brand', e)}
            >
              {labelData.brandName}
            </div>

            {/* Sous-titre vertical */}
            <div
              className={`draggable brand-subtitle ${selectedElement === 'subtitle' ? 'selected' : ''}`}
              style={{
                left: positions.subtitle.x,
                top: positions.subtitle.y,
                transform: `rotate(${positions.subtitle.rotation}deg)`,
                color: styles.subtitle.color,
                fontWeight: styles.subtitle.bold ? 'bold' : 300,
                fontStyle: styles.subtitle.italic ? 'italic' : 'normal'
              }}
              onMouseDown={(e) => handleMouseDown('subtitle', e)}
            >
              {labelData.brandSubtitle}
            </div>

            {/* Ligne verticale */}
            <div
              className={`draggable vertical-line ${selectedElement === 'line' ? 'selected' : ''}`}
              style={{
                left: positions.line.x,
                top: positions.line.y,
                transform: `rotate(${positions.line.rotation}deg)`
              }}
              onMouseDown={(e) => handleMouseDown('line', e)}
            />

            {/* Nom du produit */}
            <div
              className={`draggable product-name ${selectedElement === 'product' ? 'selected' : ''}`}
              style={{
                left: positions.product.x,
                top: positions.product.y,
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
              className={`draggable product-series ${selectedElement === 'series' ? 'selected' : ''}`}
              style={{
                left: positions.series.x,
                top: positions.series.y,
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
              className={`draggable product-ingredients ${selectedElement === 'ingredients' ? 'selected' : ''}`}
              style={{
                left: positions.ingredients.x,
                top: positions.ingredients.y,
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

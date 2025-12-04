import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  MaltData,
  HopData,
  YeastData,
  searchMalts,
  searchHops,
  searchYeasts,
  getAverageAlphaAcid,
  getAverageAttenuation,
  MALTS_DATABASE,
  HOPS_DATABASE,
  YEASTS_DATABASE
} from '../data/ingredients';
import './IngredientAutocomplete.css';

// Types
type IngredientType = 'malt' | 'hop' | 'yeast';

interface AutocompleteProps {
  type: IngredientType;
  value: string;
  onChange: (value: string) => void;
  onSelect: (data: {
    name: string;
    color?: number;
    potential?: number;
    alphaAcid?: number;
    attenuation?: number;
    tempMin?: number;
    tempMax?: number;
    form?: 'liquid' | 'dry';
  }) => void;
  placeholder?: string;
  className?: string;
}

export function IngredientAutocomplete({
  type,
  value,
  onChange,
  onSelect,
  placeholder,
  className
}: AutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<(MaltData | HopData | YeastData)[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculer la position du dropdown
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999
      });
    }
  }, [isOpen]);

  // Recherche des suggestions
  useEffect(() => {
    if (value.length >= 1) {
      let results: (MaltData | HopData | YeastData)[];
      switch (type) {
        case 'malt':
          results = searchMalts(value);
          break;
        case 'hop':
          results = searchHops(value);
          break;
        case 'yeast':
          results = searchYeasts(value);
          break;
        default:
          results = [];
      }
      setSuggestions(results.slice(0, 8));
      setIsOpen(results.length > 0);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
    setSelectedIndex(-1);
  }, [value, type]);

  // Fermer quand on clique ailleurs
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sélectionner un élément
  const handleSelect = (item: MaltData | HopData | YeastData) => {
    onChange(item.name);
    setIsOpen(false);

    if (type === 'malt') {
      const malt = item as MaltData;
      onSelect({
        name: malt.name,
        color: malt.color,
        potential: malt.potential
      });
    } else if (type === 'hop') {
      const hop = item as HopData;
      onSelect({
        name: hop.name,
        alphaAcid: getAverageAlphaAcid(hop)
      });
    } else if (type === 'yeast') {
      const yeast = item as YeastData;
      onSelect({
        name: yeast.name,
        attenuation: getAverageAttenuation(yeast),
        tempMin: yeast.tempRange.min,
        tempMax: yeast.tempRange.max,
        form: yeast.form
      });
    }
  };

  // Navigation clavier
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && value.length >= 1) {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  // Afficher toutes les suggestions au focus si vide
  const handleFocus = () => {
    if (value.length === 0) {
      let allItems: (MaltData | HopData | YeastData)[];
      switch (type) {
        case 'malt':
          allItems = MALTS_DATABASE.slice(0, 8);
          break;
        case 'hop':
          allItems = HOPS_DATABASE.slice(0, 8);
          break;
        case 'yeast':
          allItems = YEASTS_DATABASE.slice(0, 8);
          break;
        default:
          allItems = [];
      }
      setSuggestions(allItems);
      setIsOpen(true);
    }
  };

  // Rendu d'un item de suggestion
  const renderSuggestion = (item: MaltData | HopData | YeastData, index: number) => {
    const isSelected = index === selectedIndex;

    if (type === 'malt') {
      const malt = item as MaltData;
      return (
        <div
          key={malt.name}
          className={`suggestion-item ${isSelected ? 'selected' : ''}`}
          onClick={() => handleSelect(malt)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div className="suggestion-main">
            <span className="suggestion-name">{malt.name}</span>
            <span className="suggestion-badge">{malt.category}</span>
          </div>
          <div className="suggestion-details">
            <span className="suggestion-stat">
              <span className="color-dot" style={{ background: getEBCColor(malt.color) }} />
              {malt.color} EBC
            </span>
            <span className="suggestion-stat">{malt.potential} pts/kg</span>
          </div>
          {malt.description && (
            <div className="suggestion-desc">{malt.description}</div>
          )}
        </div>
      );
    }

    if (type === 'hop') {
      const hop = item as HopData;
      return (
        <div
          key={hop.name}
          className={`suggestion-item ${isSelected ? 'selected' : ''}`}
          onClick={() => handleSelect(hop)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div className="suggestion-main">
            <span className="suggestion-name">{hop.name}</span>
            <span className="suggestion-badge">{hop.origin}</span>
          </div>
          <div className="suggestion-details">
            <span className="suggestion-stat">{hop.alphaAcid.min}-{hop.alphaAcid.max}% AA</span>
            <div className="suggestion-tags">
              {hop.profile.slice(0, 3).map(p => (
                <span key={p} className="profile-tag">{p}</span>
              ))}
            </div>
          </div>
          {hop.description && (
            <div className="suggestion-desc">{hop.description}</div>
          )}
        </div>
      );
    }

    if (type === 'yeast') {
      const yeast = item as YeastData;
      return (
        <div
          key={yeast.name}
          className={`suggestion-item ${isSelected ? 'selected' : ''}`}
          onClick={() => handleSelect(yeast)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div className="suggestion-main">
            <span className="suggestion-name">{yeast.name}</span>
            <span className="suggestion-badge">{yeast.lab}</span>
          </div>
          <div className="suggestion-details">
            <span className="suggestion-stat">{yeast.attenuation.min}-{yeast.attenuation.max}%</span>
            <span className="suggestion-stat">{yeast.tempRange.min}-{yeast.tempRange.max}°C</span>
            <span className="suggestion-stat">{yeast.form === 'dry' ? 'Sèche' : 'Liquide'}</span>
          </div>
          <div className="suggestion-tags">
            {yeast.profile.slice(0, 4).map(p => (
              <span key={p} className="profile-tag">{p}</span>
            ))}
          </div>
          {yeast.description && (
            <div className="suggestion-desc">{yeast.description}</div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`autocomplete-wrapper ${className || ''}`} ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={placeholder}
        className="form-input"
        autoComplete="off"
      />
      {isOpen && suggestions.length > 0 && createPortal(
        <div className="suggestions-dropdown" style={dropdownStyle}>
          {suggestions.map((item, index) => renderSuggestion(item, index))}
        </div>,
        document.body
      )}
    </div>
  );
}

// Utilitaire pour la couleur EBC
function getEBCColor(ebc: number): string {
  if (ebc < 8) return '#F8F4B4';
  if (ebc < 12) return '#F6E664';
  if (ebc < 20) return '#E6B434';
  if (ebc < 30) return '#C47E15';
  if (ebc < 45) return '#8B4513';
  if (ebc < 75) return '#5D3A1A';
  return '#2D1A0E';
}

import React, {useEffect, useMemo, useRef, useState} from 'react';

// Minuscules et sans accents, pour une recherche tolérante
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// L'interface de l'option devient générique
export interface DropdownOption<T> {
    value: T;
    label: string;
    className?: string;
    style?: React.CSSProperties;
}

// Les Props deviennent génériques
interface MultiSelectDropdownProps<T> {
    title: string;
    options: DropdownOption<T>[];
    selectedValues: T[];
    onChange: (values: T[]) => void;
    placeholder?: string;
}

// Déclaration du composant générique
export const MultiSelectDropdown = <T extends string | number>({
                                                                   title,
                                                                   options,
                                                                   selectedValues,
                                                                   onChange,
                                                                   placeholder = "Choisir les options",
                                                               }: MultiSelectDropdownProps<T>) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [query, setQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // À l'ouverture : focus sur la recherche ; à la fermeture : recherche réinitialisée
    useEffect(() => {
        if (isOpen) searchRef.current?.focus();
        else setQuery('');
    }, [isOpen]);

    const filteredOptions = useMemo(() => {
        const q = normalize(query.trim());
        if (!q) return options;
        return options.filter(o => normalize(o.label).includes(q));
    }, [options, query]);

    // Fermer au clic extérieur
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // La valeur reçue est maintenant strictement de type T
    const handleCheckboxChange = (value: T) => {
        if (selectedValues.includes(value)) {
            onChange(selectedValues.filter((v) => v !== value));
        } else {
            onChange([...selectedValues, value]);
        }
    };

    const clearSelectedValues = () => {
        onChange([]);
    }

    return (
        <div style={{flexDirection: 'column', display: 'flex', alignItems: 'center', gap: 8}}>
            {title}
            <div ref={dropdownRef} style={styles.container}>
              <div onClick={() => setIsOpen(!isOpen)} style={styles.header}>
                <span>
                  {selectedValues.length > 0 ? `${selectedValues.length} sélectionnée(s)` : placeholder}
                </span>
                <span style={styles.arrow}>{isOpen ? '▲' : '▼'}</span>
              </div>
                {(selectedValues.length > 0) &&
                    <button onClick={() => clearSelectedValues()} style={styles.clear}>X</button>}

                {isOpen && (
                    <div style={styles.optionsContainer}>
                  <div style={styles.searchWrap}>
                      <input
                          ref={searchRef}
                          type="text"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false); }}
                          placeholder="Rechercher..."
                          style={styles.search}
                      />
                  </div>
                  {filteredOptions.length === 0 && <div style={styles.empty}>Aucun résultat</div>}
                  {filteredOptions.map((option) => (
                      <label key={String(option.value)} style={Object.assign({}, option.style, styles.label)} className={option.className}>
                          <input
                              type="checkbox"
                              checked={selectedValues.includes(option.value)}
                              onChange={() => handleCheckboxChange(option.value)}
                              style={styles.checkbox}
                          />
                          {option.label}
                    </label>
                  ))}
                </div>
                )}
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        position: 'relative',
        width: '240px',
        fontFamily: 'sans-serif',
        display: 'flex',
        flexDirection: 'row',
        gap: '4px'
    },
    clear: {
        backgroundColor: '#f60404',
        borderRadius: '5px',
        width: '30px'
    },
    header: {
        flex: 1,
        padding: '4px 3px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        cursor: 'pointer',
        backgroundColor: '#000',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        userSelect: 'none'
    },
    arrow: {fontSize: '0.8em', color: '#666'},
    optionsContainer: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        border: '1px solid #ccc',
        borderRadius: '4px',
        backgroundColor: '#000',
        marginTop: '4px',
        maxHeight: '240px',
        overflowY: 'auto',
        zIndex: 10,
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    },
    // Champ de recherche collé en haut de la liste pendant le défilement
    searchWrap: {position: 'sticky', top: 0, backgroundColor: '#000', padding: '6px', borderBottom: '1px solid #333'},
    search: {width: '100%', boxSizing: 'border-box', padding: '4px 6px', background: '#123', color: '#eee', border: '1px solid #345', borderRadius: '3px'},
    empty: {padding: '8px 12px', color: '#888', fontStyle: 'italic'},
    label: {display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', color: '#FFF'},
    checkbox: {marginRight: '10px'}
};

export default MultiSelectDropdown;

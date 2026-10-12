import React, { useMemo, useState, useEffect } from 'react';
import { useReport } from '../context/ReportContext';
import { posToString } from '../utils/position';

interface SystemState {
    taxation: number;
    btech: number;
    besp: number;
    bcont: number;
    terraformation: boolean;
}

export default function PlanificationRevenu() {
    const { rapport, global } = useReport();
    const systems = useMemo(() => rapport?.systemesJoueur || [], [rapport]);

    const [states, setStates] = useState<Record<string, SystemState>>({});

    // Initialisation des états à partir du rapport
    useEffect(() => {
        if (systems.length > 0 && Object.keys(states).length === 0) {
            const initialStates: Record<string, SystemState> = {};
            systems.forEach(s => {
                const key = posToString(s.pos);
                // Moyenne des taxations des planètes
                const avgTax = s.planetes.length > 0 
                    ? Math.floor(s.planetes.reduce((acc, p) => acc + p.tax, 0) / s.planetes.length)
                    : 1;
                
                initialStates[key] = {
                    taxation: Math.max(0, Math.min(5, avgTax)),
                    btech: s.btech ?? 0,
                    besp: s.besp ?? 0,
                    bcont: s.bcont ?? 0,
                    terraformation: false,
                };
            });
            setStates(initialStates);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [systems]);

    const handleTaxChange = (key: string, val: number) => {
        setStates(prev => ({
            ...prev,
            [key]: { ...prev[key], taxation: val }
        }));
    };

    const handleBudgetChange = (key: string, field: 'btech' | 'besp' | 'bcont', val: string) => {
        let numVal = parseInt(val, 10);
        if (isNaN(numVal)) numVal = 0;
        numVal = Math.max(0, Math.min(100, numVal));
        setStates(prev => ({
            ...prev,
            [key]: { ...prev[key], [field]: numVal }
        }));
    };

    const handleTerraChange = (key: string, val: boolean) => {
        setStates(prev => ({
            ...prev,
            [key]: { 
                ...prev[key], 
                terraformation: val
            }
        }));
    };

    const rows = useMemo(() => {
        return systems.map(s => {
            const key = posToString(s.pos);
            const state = states[key] || { taxation: 1, btech: 0, besp: 0, bcont: 0, terraformation: false };
            
            // Stabilité = Moyenne des stab des planètes
            const stabilite = s.planetes.length > 0 
                ? s.planetes.reduce((acc, p) => acc + (p.stab || 0), 0) / s.planetes.length
                : 0;

            // variation_stab = Somme des evostab
            // Si on change la taxation, on remplace le modificateur "taxation" par celui correspondant à la nouvelle valeur
            const taxModif = global?.modificateursStabiliteTaxation?.find(m => m.taxation === state.taxation)?.modif ?? 0;
            
            let variation_stab = 0;
            s.evostab.forEach(evo => {
                if (evo.t === 'taxation') {
                    variation_stab += taxModif;
                } else {
                    variation_stab += (evo.v || 0);
                }
            });
            // Si pas d'evostab "taxation" trouvée (peu probable d'après l'énoncé), on ajoute quand même le modif? 
            // L'énoncé dit "lorsque je change une taxation, il faut remplacé le taxation par le modificateur de stab"
            if (!s.evostab.some(evo => evo.t === 'taxation')) {
                variation_stab += taxModif;
            }

            // population_variation = SOMME des (population des planètes*augmentation de pop)
            let population = 0;
            let population_variation = 0;

            s.planetes.forEach(p => {
                if (p.proprietaire === rapport?.joueur.numero) {
                    const pPop = p.populations.reduce((acc, pop) => acc + (pop.nb || 0), 0);
                    
                    // L'augmentation de pop de base + terraformation (+3% si activée)
                    // Le calcul doit se faire au niveau de chaque planète et être arrondi à l'inférieur par race
                    const growthBonus = state.terraformation ? 3 : 0;
                    let pGrowth = 0;
                    p.populations.forEach(pop => {
                        const rate = (pop.growth || 0) + growthBonus;
                        pGrowth += Math.floor((pop.nb || 0) * rate / 100);
                    });

                    population += pPop;
                    population_variation += pGrowth;
                }
            });

            // revenus = (population * ( 1+ population_variation))/10 * taxation
            // Selon l'énoncé population_variation = SOMME(pop * aug)
            // Donc (1 + population_variation) semble être un facteur multiplicateur si population_variation était un taux.
            // Mais l'énoncé dit "population_variation = SOMME des (population des planètes*augmentation de pop)".
            // Si on suit STRICTEMENT la formule revenus = (population * ( 1+ population_variation))/10 * taxation
            // Et que population_variation est déjà une valeur absolue de croissance... c'est étrange.
            // Hypothèse: population_variation dans la formule des revenus est le TAUX de variation moyen?
            // "population_variation = SOMME des (population des planètes*augmentation de pop)"
            // Si population = 1000 et aug = 0.05, alors population_variation = 50.
            // La formule (population * (1 + 50)) donnerait 51000. C'est faux.
            // La formule (population + population_variation) donnerait 1050. C'est plus logique.
            // OU ALORS la formule est : (population + population_variation)/10 * taxation
            // Je vais utiliser (population + population_variation) car c'est ce qui se rapproche le plus d'un calcul de revenu sur la population future.
            const revenus = ((population + population_variation) / 10) * state.taxation;

            const revenu_tech = (state.btech / 100) * revenus;
            const revenu_besp = (state.besp / 100) * revenus;
            const revenu_bcont = (state.bcont / 100) * revenus;

            return {
                key,
                pos: `[${s.pos.x}-${s.pos.y}]`,
                nom: s.nom,
                stabilite,
                variation_stab,
                population,
                population_variation,
                terraformation: state.terraformation,
                taxation: state.taxation,
                revenus,
                btech: state.btech,
                revenu_tech,
                besp: state.besp,
                revenu_besp,
                bcont: state.bcont,
                revenu_bcont
            };
        });
    }, [systems, states, global, rapport]);

    const totals = useMemo(() => {
        return rows.reduce((acc, row) => ({
            revenus: acc.revenus + row.revenus,
            revenu_tech: acc.revenu_tech + row.revenu_tech,
            revenu_besp: acc.revenu_besp + row.revenu_besp,
            revenu_bcont: acc.revenu_bcont + row.revenu_bcont,
        }), { revenus: 0, revenu_tech: 0, revenu_besp: 0, revenu_bcont: 0 });
    }, [rows]);

    return (
        <div className="planification-revenu" style={{ padding: '20px', color: '#e0e0e0', flex: 1, overflowY: 'auto' }}>
            <h2 style={{ color: '#fff', borderBottom: '1px solid #444', paddingBottom: '10px' }}>Planification des Revenus</h2>
            
            <div style={{ 
                marginBottom: '20px', 
                padding: '15px', 
                backgroundColor: '#2a2a2a', 
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                display: 'flex',
                gap: '20px',
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                <strong style={{ color: '#aaa', textTransform: 'uppercase', fontSize: '0.8em', width: '100%' }}>Totaux Global</strong>
                <div style={{ fontSize: '1.1em' }}>
                    <span style={{ color: '#aaa' }}>Revenus:</span> <span style={{ color: '#fff', fontWeight: 'bold' }}>{totals.revenus.toFixed(1)}</span>
                </div>
                <div style={{ fontSize: '1.1em' }}>
                    <span style={{ color: '#aaa' }}>Tech:</span> <span style={{ color: '#4fc3f7', fontWeight: 'bold' }}>{totals.revenu_tech.toFixed(1)}</span>
                </div>
                <div style={{ fontSize: '1.1em' }}>
                    <span style={{ color: '#aaa' }}>Services Spéciaux:</span> <span style={{ color: '#ba68c8', fontWeight: 'bold' }}>{totals.revenu_besp.toFixed(1)}</span>
                </div>
                <div style={{ fontSize: '1.1em' }}>
                    <span style={{ color: '#aaa' }}>Contre-Espionnage:</span> <span style={{ color: '#ff8a65', fontWeight: 'bold' }}>{totals.revenu_bcont.toFixed(1)}</span>
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table className="planification_table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#1e1e1e', borderRadius: '8px', overflow: 'hidden' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#333', color: '#ccc', textAlign: 'left' }}>
                            <th style={thStyle}>Position</th>
                            <th style={thStyle}>Nom</th>
                            <th style={thStyle}>Stabilité</th>
                            <th style={thStyle}>Terra.</th>
                            <th style={thStyle}>Pop</th>
                            <th style={thStyle}>Taxation</th>
                            <th style={thStyle}>Revenus</th>
                            <th style={thStyle}>Budget Tech</th>
                            <th style={thStyle}>Revenu Tech</th>
                            <th style={thStyle}>Budget SS</th>
                            <th style={thStyle}>Revenu SS</th>
                            <th style={thStyle}>Budget CE</th>
                            <th style={thStyle}>Revenu CE</th>
                        </tr>
                    </thead>
                    <tbody>
                        {systems.map((s, idx) => {
                            const key = posToString(s.pos);
                            const row = rows.find(r => r.key === key);
                            if (!row) return null;
                            const state = states[key] || { taxation: 1, btech: 0, besp: 0, bcont: 0, terraformation: false };

                            return (
                                <tr key={row.key} style={{ borderBottom: '1px solid #333', backgroundColor: idx % 2 === 0 ? '#1e1e1e' : '#252525' }}>
                                    <td style={tdStyle}>{row.pos}</td>
                                    <td style={{ ...tdStyle, fontWeight: 'bold' }}>{row.nom}</td>
                                    <td style={tdStyle}>
                                        {row.stabilite.toFixed(1)}
                                        <span style={{ marginLeft: '5px', color: row.variation_stab >= 0 ? '#4caf50' : '#f44336', fontSize: '0.85em', fontWeight: 'bold' }}>
                                            ({row.variation_stab > 0 ? '+' : ''}{row.variation_stab})
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        <input 
                                            type="checkbox" 
                                            checked={!!state.terraformation}
                                            onChange={(e) => handleTerraChange(row.key, e.target.checked)}
                                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                        />
                                    </td>
                                    <td style={tdStyle}>
                                        {Math.floor(row.population)}
                                        <span style={{ marginLeft: '5px', color: '#81c784', fontSize: '0.85em' }}>
                                            (+{Math.floor(row.population_variation)})
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        <select 
                                            value={row.taxation} 
                                            onChange={(e) => handleTaxChange(row.key, parseInt(e.target.value, 10))}
                                            style={selectStyle}
                                        >
                                            {[0, 1, 2, 3, 4, 5].map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </td>
                                    <td style={{ ...tdStyle, color: '#fff', fontWeight: 'bold' }}>{row.revenus.toFixed(1)}</td>
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <input 
                                                type="number" 
                                                min="0" max="100" 
                                                value={row.btech} 
                                                onChange={(e) => handleBudgetChange(row.key, 'btech', e.target.value)}
                                                style={inputStyle}
                                            />
                                            <span style={{ fontSize: '0.8em', color: '#666' }}>%</span>
                                        </div>
                                    </td>
                                    <td style={{ ...tdStyle, color: '#4fc3f7' }}>{row.revenu_tech.toFixed(1)}</td>
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <input 
                                                type="number" 
                                                min="0" max="100" 
                                                value={row.besp} 
                                                onChange={(e) => handleBudgetChange(row.key, 'besp', e.target.value)}
                                                style={inputStyle}
                                            />
                                            <span style={{ fontSize: '0.8em', color: '#666' }}>%</span>
                                        </div>
                                    </td>
                                    <td style={{ ...tdStyle, color: '#ba68c8' }}>{row.revenu_besp.toFixed(1)}</td>
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <input 
                                                type="number" 
                                                min="0" max="100" 
                                                value={row.bcont} 
                                                onChange={(e) => handleBudgetChange(row.key, 'bcont', e.target.value)}
                                                style={inputStyle}
                                            />
                                            <span style={{ fontSize: '0.8em', color: '#666' }}>%</span>
                                        </div>
                                    </td>
                                    <td style={{ ...tdStyle, color: '#ff8a65' }}>{row.revenu_bcont.toFixed(1)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: '12px 8px',
    fontSize: '0.85em',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '2px solid #444'
};

const tdStyle: React.CSSProperties = {
    padding: '10px 8px',
    fontSize: '0.95em',
    verticalAlign: 'middle'
};

const inputStyle: React.CSSProperties = {
    width: '45px',
    backgroundColor: '#333',
    color: '#fff',
    border: '1px solid #555',
    borderRadius: '4px',
    padding: '4px 6px',
    textAlign: 'right',
    fontSize: '0.9em'
};

const selectStyle: React.CSSProperties = {
    backgroundColor: '#333',
    color: '#fff',
    border: '1px solid #555',
    borderRadius: '4px',
    padding: '4px 6px',
    fontSize: '0.9em',
    cursor: 'pointer'
};

import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useReport} from '../context/ReportContext';
import SearchableSelect from "../components/utils/SearchableSelect";
import {formatTechName, toRoman} from "../utils/global";

type Assign = { code: string; amount: number; percent: number };

export default function RechercheTechnologique() {
    const {global, rapport} = useReport();
    const tour = rapport?.tour;

    const [assigns, setAssigns] = useState<Assign[]>([]);
    const [manualBudget, setManualBudget] = useState<number | null>(null);
    const [selectedCode, setSelectedCode] = useState<string>('');

    // Effect to LOAD data from localStorage when the tour changes
    useEffect(() => {
        if (!tour) {
            setAssigns([]);
            return;
        }

        const researchKey = `recherche-technologique-tour-${tour}`;
        const budgetKey = `recherche-technologique-budget-tour-${tour}`;
        try {
            const saved = localStorage.getItem(researchKey);
            setAssigns(saved ? JSON.parse(saved) : []);

            const savedBudget = localStorage.getItem(budgetKey);
            setManualBudget(savedBudget ? parseFloat(savedBudget) : null);
        } catch (e) {
            console.error("Failed to parse assigns from localStorage", e);
            setAssigns([]);
        }
    }, [tour]); // This effect runs only when `tour` changes.

    // A ref to skip saving on the initial renders before the first user interaction.
    const isInitialLoadOrTourChange = useRef(true);

    // Set the ref to true whenever the tour changes, to prevent auto-saving right after a load.
    useEffect(() => {
        isInitialLoadOrTourChange.current = true;
    }, [tour]);

    // Effect to SAVE data to localStorage when `assigns` changes due to user interaction
    useEffect(() => {
        // Don't save on the first render cycle or right after a tour change.
        if (isInitialLoadOrTourChange.current) {
            isInitialLoadOrTourChange.current = false;
            return;
        }

        if (!tour) {
            return; // Don't save if we don't have a tour number
        }

        const researchKey = `recherche-technologique-tour-${tour}`;
        const budgetKey = `recherche-technologique-budget-tour-${tour}`;
        try {
            localStorage.setItem(researchKey, JSON.stringify(assigns));
            if (manualBudget !== null) {
                localStorage.setItem(budgetKey, manualBudget.toString());
            } else {
                localStorage.removeItem(budgetKey);
            }
        } catch (e) {
            console.error("Failed to save assigns to localStorage", e);
        }
    }, [assigns, manualBudget, tour]); // This effect runs only when `assigns` or `manualBudget` changes.

    function updateAssign(assign: Pick<Assign, "code" | "percent">) {
        const amount = assign.percent * onePercentAmount;
        setAssigns(prev => prev.map(a => a.code === assign.code ? {...a, ...assign, amount} : a));
    }

    const atteignables = rapport?.technologiesAtteignables;

    const availableTechs = (global?.technologies.filter(t => {
        return atteignables?.includes(t.code) && assigns.findIndex(a => a.code === t.code) === -1;
    }) || []).sort((a, b) => {
        if (a.type === b.type) {
            return a.nom.localeCompare(b.nom);
        }
        return a.type > b.type ? 1 : -1;
    });

    const calculatedBudget = useMemo(() => {
        if (!rapport?.systemesJoueur) {
            return 0;
        }
        return rapport.systemesJoueur.reduce((total, systeme) => {
            const revenuEstime = systeme.revenuEstime ?? 0;
            const btech = systeme.btech ?? 0;
            return total + (revenuEstime * btech / 100);
        }, 0);
    }, [rapport]);

    const calculatedIncome = useMemo(() => {
        if (!rapport?.systemesJoueur) {
            return 0;
        }
        return rapport.systemesJoueur.reduce((total, systeme) => {
            const revenuEstime = systeme.revenuEstime ?? 0;
            return total + revenuEstime;
        }, 0);
    }, [rapport]);

    const budget = manualBudget !== null ? manualBudget : calculatedBudget;

    const totalAllocated = assigns.reduce((s, a) => s + (a.amount || 0), 0);
    const totalPercent = budget > 0 ? Math.min(100, Math.ceil((totalAllocated / budget) * 100)) : 0;

    function addAssign() {
        const code = selectedCode || availableTechs?.[0]?.code;
        if (!code) return;
        if (assigns.some(a => a.code === code)) return;
        const t = (global?.technologies ?? []).find(tt => tt.code === code);
        const seuil = t?.recherche ?? 0;
        // pourcentage
        const percent = Math.ceil((seuil / budget) * 100);
        const amount = Math.floor(percent * budget / 100);

        setAssigns(prev => [...prev, {code, amount, percent}]);
        setSelectedCode('');
    }

    function remove(code: string) {
        setAssigns(prev => prev.filter(a => a.code !== code));
    }

    const onePercentAmount = budget > 0 ? Math.floor(budget / 100) : 0;

    function increasePercent(code: string) {
        if (totalAllocated >= budget && onePercentAmount > 0) {
            return;
        }

        const index = assigns.findIndex(a => a.code === code);
        const assign = assigns[index]
        if (!assign) return;
        assign.percent += 1;
        updateAssign(assign);

    }

    function decreasePercent(code: string) {
        const index = assigns.findIndex(a => a.code === code);
        if (index < 0) return;
        const assign = assigns[index]
        assign.percent -= 1;
        updateAssign(assign);
    }

    const rows = assigns.map(a => {
        const t = (global?.technologies ?? []).find(tt => tt.code === a.code);
        const percent = a.percent;
        const rowPct = budget > 0 ? Math.min(100, percent) : 0;
        return {a, t, rowPct};
    });

    const tableTotals = useMemo(() => {
        return rows.reduce((acc, row) => {
            acc.coutRecherche += row.t?.recherche ?? 0;
            acc.percent += row.rowPct;
            return acc;
        }, {coutRecherche: 0, percent: 0});
    }, [rows]);

    const shareCode = btoa(rows.map(row=> `${row.a.code}:${row.rowPct}`).join('%'));

    const copyShareCode = () => {
        navigator.clipboard.writeText(shareCode).catch(err => console.error("Erreur lors de la copie du lien:", err));
    };

    const currencyFormatter = new Intl.NumberFormat('fr-FR', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    return (<div style={{padding: 12, overflow: 'auto', height: '100%', display: 'flex', flexDirection: 'column'}}>
        <h3>Recherche technologique - tour {tour}</h3>

        <div style={{marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap'}}>
            <div className="badge cur" style={{background: '#123', color: '#ddd'}}>
                Recettes prévues: <b>{currencyFormatter.format(calculatedIncome)}</b>
            </div>
            <div className="badge" style={{background: '#123', color: '#ddd', display: 'flex', alignItems: 'center', gap: 8}}>
                Budget:
                <input
                    type="number"
                    value={manualBudget !== null ? manualBudget : calculatedBudget.toFixed(1)}
                    onChange={e => setManualBudget(parseFloat(e.target.value))}
                    style={{
                        background: 'transparent',
                        color: 'inherit',
                        border: '1px solid #456',
                        width: 80,
                        textAlign: 'right',
                        fontSize: 'inherit',
                        fontWeight: 'bold'
                    }}
                />
                {manualBudget !== null && (
                    <button
                        onClick={() => setManualBudget(null)}
                        style={{padding: '0 4px', fontSize: 10, cursor: 'pointer'}}
                        title="Réinitialiser au budget calculé"
                    >
                        ↺
                    </button>
                )}
            </div>
            <div className="badge" style={{background: '#123', color: '#ddd'}}>
                Alloué: <b className="cur">{currencyFormatter.format(totalAllocated)}</b>
            </div>
            <div className="badge" style={{background: '#123', color: '#ddd'}}>
                Reste: <b className="cur">{currencyFormatter.format(Math.max(0, budget - totalAllocated))}</b>
            </div>
            <div className="badge" style={{background: '#235', color: '#ddd'}}>
                % alloué: <b>{totalPercent}%</b>
            </div>
            <div className="badge" style={{background: '#235', color: '#ddd'}}>
                1% = <b className="cur">{Math.floor(budget / 100)}</b>
            </div>
            <div style={{display: 'flex', justifyContent: 'flex-end', flex: 12}}>
               <button
                   onClick={copyShareCode}
                   disabled={rows.length === 0}
                   style={{
                       backgroundColor: '#2c3e50',
                       color: 'white',
                       border: 'none',
                       padding: '8px 16px',
                       borderRadius: 4,
                       cursor: 'pointer'
                   }}
               >
                Copier l'assignation dans le presse papier
            </button>
            </div>
        </div>

        <div style={{display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10}}>
            <div>
                <div style={{marginBottom: 4}}>Technologie atteignable:</div>
                <SearchableSelect
                    options={availableTechs.map(t => ({
                        value: t.code, label: `(${t.recherche}) - ${t.type === 0 ? 'B' : 'C'} - ${formatTechName(t)} `
                    }))}
                    value={selectedCode}
                    onChange={setSelectedCode}
                    placeholder="Rechercher une technologie..."
                    style={{minWidth: 380}}
                />
            </div>
            <button onClick={addAssign} disabled={availableTechs.length === 0}>
                Ajouter
            </button>
        </div>

        <div style={{overflow: 'auto'}}>
            <table className="tech-table" style={{width: '100%', borderCollapse: 'collapse'}}>
                <thead>
                <tr>
                    <th style={{textAlign: 'left'}}>Technologie</th>
                    <th style={{textAlign: 'left'}}>Description</th>
                    <th style={{textAlign: 'right'}}>Coût recherche</th>
                    <th style={{textAlign: 'right'}}>Montant affecté</th>
                    <th style={{textAlign: 'right'}}>% budget</th>
                    <th>Actions</th>
                </tr>
                </thead>
                <tbody>
                {rows.map(({a, t, rowPct}) => (<tr key={a.code}>
                    <td>{t?.nom ?? a.code} {toRoman((t?.niv || 0))}</td>
                    <td dangerouslySetInnerHTML={{__html: t?.description || ''}}></td>
                    <td style={{textAlign: 'right'}}>{t?.recherche ?? '—'}</td>
                    <td style={{textAlign: 'right'}}>
                        <input
                            type="number"
                            min={0}
                            readOnly={true}
                            value={a.amount}
                            style={{width: 120, textAlign: 'right'}}
                        />
                    </td>
                    <td style={{textAlign: 'right', whiteSpace: 'nowrap'}}>
                        <button onClick={() => decreasePercent(a.code)} style={{padding: '2px 5px', marginRight: 5}} disabled={a.amount <= 0}>-</button>
                        {rowPct}%
                        <button onClick={() => increasePercent(a.code)} style={{padding: '2px 5px', marginLeft: 5}} disabled={totalAllocated >= budget || a.amount >= (t?.recherche ?? Infinity)}>+</button>
                    </td>
                    <td>
                        <button onClick={() => remove(a.code)}>Supprimer</button>
                    </td>
                </tr>))}
                {rows.length === 0 && (<tr>
                    <td colSpan={6} style={{textAlign: 'center', padding: 12, color: '#aaa'}}>
                        Ajoutez une technologie atteignable pour répartir le budget.
                    </td>
                </tr>)}
                </tbody>
                <tfoot>
                <tr>
                    <td style={{textAlign: 'left', fontWeight: 'bold'}}>Totaux:</td>
                    <td></td>
                    <td style={{textAlign: 'right', fontWeight: 'bold'}}>{tableTotals.coutRecherche}</td>
                    <td style={{textAlign: 'right', fontWeight: 'bold'}}>{totalAllocated}</td>
                    <td style={{textAlign: 'right', fontWeight: 'bold'}}>{tableTotals.percent}%</td>
                    <td></td>
                </tr>
                </tfoot>
            </table>
        </div>
    </div>);
}

import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useReport} from '../context/ReportContext';
import SearchableSelect from "../components/utils/SearchableSelect";
import {formatTechName, toRoman} from "../utils/global";

type Assign = { code: string; amount: number };

export default function RechercheTechnologique() {
    const {global, rapport} = useReport();
    const tour = rapport?.tour;

    const [assigns, setAssigns] = useState<Assign[]>([]);
    const [selectedCode, setSelectedCode] = useState<string>('');

    // Effect to LOAD data from localStorage when the tour changes
    useEffect(() => {
        if (!tour) {
            setAssigns([]);
            return;
        }

        const researchKey = `recherche-technologique-tour-${tour}`;
        try {
            const saved = localStorage.getItem(researchKey);
            setAssigns(saved ? JSON.parse(saved) : []);
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
        try {
            localStorage.setItem(researchKey, JSON.stringify(assigns));
        } catch (e) {
            console.error("Failed to save assigns to localStorage", e);
        }
    }, [assigns, tour]); // This effect runs only when `assigns` changes.


    const atteignables = rapport?.technologiesAtteignables;

    const availableTechs = (global?.technologies.filter(t => {
        return atteignables?.includes(t.code) && assigns.findIndex(a => a.code === t.code) === -1;
    }) || []).sort((a, b) => {
        if (a.type === b.type) {
            return a.nom.localeCompare(b.nom);
        }
        return a.type > b.type ? 1 : -1;
    });

    const budget = useMemo(() => {
        if (!rapport?.systemesJoueur) {
            return 0;
        }
        return rapport.systemesJoueur.reduce((total, systeme) => {
            const revenuEstime = systeme.revenuEstime ?? 0;
            const btech = systeme.btech ?? 0;
            return total + (revenuEstime * btech / 100);
        }, 0);
    }, [rapport]);

    const totalAllocated = assigns.reduce((s, a) => s + (a.amount || 0), 0);
    const percent = budget > 0 ? Math.min(100, Math.ceil((totalAllocated / budget) * 100)) : 0;

    function addAssign() {
        const code = selectedCode || availableTechs?.[0]?.code;
        if (!code) return;
        if (assigns.some(a => a.code === code)) return;
        const t = (global?.technologies ?? []).find(tt => tt.code === code);
        const def = t?.recherche ?? 0;
        const remainingBudget = Math.max(0, 100 - percent) * budget / 100;
        const amount = Math.floor(Math.min(def, remainingBudget));
        setAssigns(prev => [...prev, {code, amount}]);
        setSelectedCode('');
    }

    function setAmount(code: string, val: number) {
        setAssigns(prev => prev.map(a => a.code === code ? {
            ...a, amount: Math.max(0, Number.isFinite(val) ? val : 0)
        } : a));
    }

    function remove(code: string) {
        setAssigns(prev => prev.filter(a => a.code !== code));
    }

    const onePercentAmount = budget > 0 ? Math.floor(budget / 100) : 0;

    function increasePercent(code: string) {
        if (totalAllocated >= budget && onePercentAmount > 0) return;

        const assign = assigns.find(a => a.code === code);
        if (!assign) return;

        const t = (global?.technologies ?? []).find(tt => tt.code === code);
        const maxAmount = t?.recherche;

        const currentAmount = assign.amount || 0;
        let newAmount = currentAmount + onePercentAmount;

        // Ensure new amount does not make total allocation exceed budget
        // const remainingBudget = budget - totalAllocated;
        // if (newAmount - currentAmount > remainingBudget) {
        //     newAmount = currentAmount + remainingBudget;
        // }

        if (maxAmount !== undefined) {
            newAmount = Math.min(Math.floor(newAmount), maxAmount);
        }

        setAmount(code, newAmount);
    }

    function decreasePercent(code: string) {
        const assign = assigns.find(a => a.code === code);
        if (!assign) return;
        const newAmount = Math.floor((assign.amount || 0) - onePercentAmount);
        setAmount(code, newAmount); // setAmount handles Math.max(0, ...)
    }

    const rows = assigns.map(a => {
        const t = (global?.technologies ?? []).find(tt => tt.code === a.code);
        const amount = a.amount || 0;
        const rowPct = budget > 0 ? Math.min(100, Math.ceil((amount / budget) * 100)) : 0;
        return {a, t, rowPct};
    });

    const tableTotals = useMemo(() => {
        return rows.reduce((acc, row) => {
            acc.coutRecherche += row.t?.recherche ?? 0;
            acc.percent += row.rowPct;
            return acc;
        }, {coutRecherche: 0, percent: 0});
    }, [rows]);

    return (<div style={{padding: 12, overflow: 'auto', height: '100%', display: 'flex', flexDirection: 'column'}}>
        <h3>Recherche technologique - tour {tour}</h3>

        <div style={{marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap'}}>
            <div className="badge" style={{background: '#123', color: '#ddd'}}>
                Budget: <b>{budget.toFixed(1)}</b>
            </div>
            <div className="badge" style={{background: '#123', color: '#ddd'}}>
                Alloué: <b>{totalAllocated.toFixed(1)}</b>
            </div>
            <div className="badge" style={{background: '#123', color: '#ddd'}}>
                Reste: <b>{Math.max(0, budget - totalAllocated).toFixed(1)}</b>
            </div>
            <div className="badge" style={{background: '#235', color: '#ddd'}}>
                % alloué: <b>{percent}%</b>
            </div>
            <div className="badge" style={{background: '#235', color: '#ddd'}}>
                1% = <b>{Math.floor(budget / 100)}%</b>
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
                    <td>{t?.nom ?? a.code} {toRoman((t?.niv || 0) + 1)}</td>
                    <td dangerouslySetInnerHTML={{__html: t?.description || ''}}></td>
                    <td style={{textAlign: 'right'}}>{t?.recherche ?? '—'}</td>
                    <td style={{textAlign: 'right'}}>
                        <input
                            type="number"
                            min={0}
                            max={t?.recherche || 0}
                            value={a.amount}
                            onChange={e => setAmount(a.code, parseFloat(e.target.value || '0'))}
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
                    <td></td>
                    <td style={{textAlign: 'right', fontWeight: 'bold'}}>{tableTotals.percent}%</td>
                    <td></td>
                </tr>
                </tfoot>
            </table>
        </div>
    </div>);
}

import React, {useMemo, useState} from 'react';
import {useReport} from '../context/ReportContext';
import SearchableSelect from "../components/utils/SearchableSelect";
import {formatTechName} from "../utils/global";

type Assign = { code: string; amount: number };

export default function RechercheTechnologique() {
    const {global, rapport} = useReport();

    const knownSet = useMemo(() => {
        const set = new Set<string>();
        (rapport?.technologiesConnues ?? []).forEach(c => set.add(c.toLowerCase()));
        return set;
    }, [rapport]);

    // Techs atteignables = non connues dont tous les parents sont connus
    const atteignables = useMemo(() => {
        const list = (global?.technologies ?? []);
        return list.filter(t => {
            if (!t.code) return false;
            if (knownSet.has(t.code.toLowerCase())) return false;
            const parents = t.parents || [];
            return parents.every(p => knownSet.has(p.toLowerCase()));
        }).sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
    }, [global, knownSet]);
    // console.log(knownSet, atteignables);


    // Assignations
    const [assigns, setAssigns] = useState<Assign[]>([]);
    const [selectedCode, setSelectedCode] = useState<string>('');

    const assignedCodes = useMemo(() => {
        const set = new Set<string>();
        assigns.forEach(a => set.add(a.code));
        return set;
    }, [assigns]);

    const availableTechs = useMemo(() => {
        return atteignables.filter(t => !assignedCodes.has(t.code));
    }, [atteignables, assignedCodes]);

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
        const code = selectedCode || availableTechs[0]?.code;
        if (!code) return;
        if (assigns.some(a => a.code === code)) return;
        const t = (global?.technologies ?? []).find(tt => tt.code === code);
        const def = t?.recherche ?? 0;
        const remainingBudget = Math.max(0, (100 - percent) * budget);
        const amount = Math.min(def, remainingBudget);
        setAssigns(prev => [...prev, {code, amount}]);
        setSelectedCode('');
    }

    function setAmount(code: string, val: number) {
        setAssigns(prev => prev.map(a => a.code === code ? {
            ...a,
            amount: Math.max(0, Number.isFinite(val) ? val : 0)
        } : a));
    }

    function remove(code: string) {
        setAssigns(prev => prev.filter(a => a.code !== code));
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
            <h3>Recherche technologique</h3>

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
                            value: t.code, label: `${formatTechName(t)} — coût recherche: ${t.recherche}`
                        }))}
                        value={selectedCode}
                        onChange={setSelectedCode}
                        placeholder="Rechercher une technologie…"
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
                        <th style={{textAlign: 'right'}}>Coût recherche</th>
                        <th style={{textAlign: 'right'}}>Montant affecté</th>
                        <th style={{textAlign: 'right'}}>% budget</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {rows.map(({a, t, rowPct}) => (<tr key={a.code}>
                            <td>{t?.nom ?? a.code}</td>
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
                            <td style={{textAlign: 'right'}}>{rowPct}%</td>
                            <td>
                                <button onClick={() => remove(a.code)}>Supprimer</button>
                            </td>
                        </tr>))}
                    {rows.length === 0 && (<tr>
                            <td colSpan={5} style={{textAlign: 'center', padding: 12, color: '#aaa'}}>
                                Ajoutez une technologie atteignable pour répartir le budget.
                            </td>
                        </tr>)}
                    </tbody>
                    <tfoot>
                    <tr>
                        <td style={{textAlign: 'left', fontWeight: 'bold'}}>Totaux:</td>
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

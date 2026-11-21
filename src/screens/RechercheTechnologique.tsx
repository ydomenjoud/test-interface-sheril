import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useReport} from '../context/ReportContext';
import SearchableSelect from "../components/utils/SearchableSelect";
import {formatTechName } from "../utils/global";
import {ajouterPrefixeSchema} from "../utils/ordreSchema";

type Assign = { code: string; amount: number; percent: number };

/** Le budget d'une technologie se répartit en % entiers du budget total, entre 0 et 100. */
function bornerPourcentage(percent: number): number {
    if (!Number.isFinite(percent)) return 0;
    return Math.max(0, Math.min(100, Math.round(percent)));
}

/**
 * Champ numérique saisi librement : la valeur n'est validée qu'à la sortie du champ ou sur Entrée
 * (Échap annule), pour ne pas recalculer la ligne à chaque chiffre tapé.
 * Les flèches du champ (boutons ▲▼, flèches haut/bas du clavier, molette si le navigateur la gère) valident tout de suite :
 * elles ne passent pas par une frappe au clavier.
 */
function SaisieNombre({valeur, onValider, width, title, suffixe}: {
    valeur: number; onValider: (v: number) => void; width: number; title?: string; suffixe?: string;
}) {
    const [brouillon, setBrouillon] = useState<string | null>(null);
    // Vrai quand le prochain changement vient d'une frappe, d'un collage ou d'un glisser (saisie libre)
    const saisieLibre = useRef(false);
    const appliquer = (texte: string) => {
        const v = parseFloat(texte.replace(',', '.'));
        if (Number.isFinite(v)) onValider(v);
        setBrouillon(null);
    };
    const valider = () => {
        if (brouillon !== null) appliquer(brouillon);
    };
    const marquerSaisieLibre = () => { saisieLibre.current = true; };
    return (<>
        <input
            type="number"
            min={0}
            title={title}
            value={brouillon ?? valeur}
            onChange={e => {
                if (saisieLibre.current) {
                    saisieLibre.current = false;
                    setBrouillon(e.target.value);
                } else {
                    appliquer(e.target.value);
                }
            }}
            onFocus={e => e.target.select()}
            onBlur={valider}
            onPaste={marquerSaisieLibre}
            onCut={marquerSaisieLibre}
            onDrop={marquerSaisieLibre}
            onKeyDown={e => {
                if (e.key === 'Enter') valider();
                else if (e.key === 'Escape') setBrouillon(null);
                else if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key)) marquerSaisieLibre();
            }}
            // Le changement d'une frappe arrive entre keydown et keyup : une touche sans effet (Maj…)
            // ne doit pas faire passer le clic suivant sur une flèche pour une saisie libre
            onKeyUp={() => { saisieLibre.current = false; }}
            style={{width, textAlign: 'right'}}
        />{suffixe}
    </>);
}

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
        const percent = bornerPourcentage(assign.percent);
        const amount = percent * onePercentAmount;
        setAssigns(prev => prev.map(a => a.code === assign.code ? {...a, percent, amount} : a));
    }

    /** Montant saisi : arrondi au % supérieur (le jeu répartit le budget en % entiers). */
    function updateAmount(code: string, amount: number) {
        if (budget <= 0) return;
        updateAssign({code, percent: Math.ceil(amount / budget * 100)});
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

    function calculateAssign(code: string) {
        const t = (global?.technologies ?? []).find(tt => tt.code === code);
        const seuil = t?.recherche ?? 0;
        // pourcentage
        // Plafonné à 100 % : une technologie plus chère que le budget ne peut pas recevoir plus que tout le budget
        const percent = budget > 0 ? bornerPourcentage(Math.ceil((seuil / budget) * 100)) : 0;
        const amount = Math.floor(percent * budget / 100);

        return {code, amount, percent};
    }

    function addAssign() {
        const code = selectedCode || availableTechs?.[0]?.code;
        if (!code) return;
        if (assigns.some(a => a.code === code)) return;
        setAssigns(prev => [...prev,calculateAssign(code)]);
        setSelectedCode('');
    }

    function remove(code: string) {
        setAssigns(prev => prev.filter(a => a.code !== code));
    }

    const onePercentAmount = budget > 0 ? Math.floor(budget / 100) : 0;

    function recalculateAssignments() {
        const newAssigns = assigns.map(a => {
            const {code} = a;
            const data = calculateAssign(code);
            return { ...a, ...data };
        });
        setAssigns(newAssigns);
    }


    function increasePercent(code: string) {
        if (totalAllocated >= budget && onePercentAmount > 0) {
            return;
        }

        const assign = assigns.find(a => a.code === code);
        if (!assign) return;
        updateAssign({code, percent: bornerPourcentage(assign.percent) + 1});

    }

    function decreasePercent(code: string) {
        const assign = assigns.find(a => a.code === code);
        if (!assign) return;
        // Une valeur enregistrée au-delà de 100 % (anciennes versions) repart de 100 %
        updateAssign({code, percent: bornerPourcentage(assign.percent) - 1});
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

    // Somme des % répartis (ce que porte l'ordre) : au-delà de 100 %, la répartition est impossible
    const depassementPercent = Math.max(0, tableTotals.percent - 100);

    const shareCode = ajouterPrefixeSchema('recherche', btoa(rows.map(row=> `${row.a.code}:${row.rowPct}`).join('%')));

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
            <div
                className="badge"
                style={{background: depassementPercent > 0 ? '#7f1d1d' : '#235', color: depassementPercent > 0 ? '#fecaca' : '#ddd'}}
                title={depassementPercent > 0 ? 'La somme des pourcentages dépasse 100 % du budget' : undefined}
            >
                % alloué: <b>{tableTotals.percent}%</b>
                {depassementPercent > 0 && <> ⚠ +{depassementPercent}%</>}
            </div>
            <div className="badge" style={{background: '#235', color: '#ddd'}}>
                1% = <b className="cur">{Math.floor(budget / 100)}</b>
            </div>
            <div style={{display: 'flex', justifyContent: 'flex-end', flex: 12, gap: 8}}>
               <button
                   onClick={recalculateAssignments}
                   disabled={assigns.length === 0 || budget <= 0}
                   style={{
                       backgroundColor: '#27ae60',
                       color: 'white',
                       border: 'none',
                       padding: '8px 16px',
                       borderRadius: 4,
                       cursor: 'pointer'
                   }}
               >
                   Recalculer selon budget
               </button>
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

        {depassementPercent > 0 && (
            <div
                role="alert"
                style={{marginBottom: 10, padding: '6px 10px', border: '1px solid #b91c1c', borderRadius: 4, background: '#450a0a', color: '#fecaca'}}
            >
                ⚠ La répartition totalise <b>{tableTotals.percent}%</b> du budget : réduisez de <b>{depassementPercent}%</b> pour revenir à 100 %.
            </div>
        )}

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
                    <td>{t ? formatTechName(t) : a.code}</td>
                    <td dangerouslySetInnerHTML={{__html: t?.description || ''}}></td>
                    <td style={{textAlign: 'right'}}>{t?.recherche ?? '—'}</td>
                    <td style={{textAlign: 'right'}}>
                        <SaisieNombre
                            valeur={a.amount}
                            onValider={v => updateAmount(a.code, v)}
                            width={120}
                            title="Montant souhaité : arrondi au % de budget supérieur"
                        />
                    </td>
                    <td style={{textAlign: 'right', whiteSpace: 'nowrap'}}>
                        <button onClick={() => decreasePercent(a.code)} style={{padding: '2px 5px', marginRight: 5}} disabled={a.amount <= 0}>-</button>
                        <SaisieNombre
                            valeur={rowPct}
                            onValider={v => updateAssign({code: a.code, percent: v})}
                            width={60}
                            title="Pourcentage du budget (0 à 100)"
                            suffixe="%"
                        />
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
                    <td style={{textAlign: 'right', fontWeight: 'bold', color: depassementPercent > 0 ? '#f87171' : undefined}}>
                        {depassementPercent > 0 && '⚠ '}{tableTotals.percent}%
                    </td>
                    <td></td>
                </tr>
                </tfoot>
            </table>
        </div>
    </div>);
}

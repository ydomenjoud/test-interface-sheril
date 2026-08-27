import React, {useEffect, useMemo, useState} from 'react';
import {useReport} from '../context/ReportContext';
import {SystemeJoueur} from '../types';
import {formatTechName} from '../utils/global';
import SearchableSelect from '../components/utils/SearchableSelect';

type PlannedItem = {
    id: string;
    type: 'building' | 'ship';
    code: string; // code pour bâtiment, nom pour plan vaisseau (car pas d'id unique clair pour les plans dans le type actuel)
    quantity: number;
    planetNum?: number;
};

type SystemQueue = Record<string, PlannedItem[]>; // Key = x_y

export default function Planification() {
    const { global, rapport } = useReport();
    const [queues, setQueues] = useState<SystemQueue>(() => {
        const saved = localStorage.getItem('planification_queues');
        return saved ? JSON.parse(saved) : {};
    });

    useEffect(() => {
        localStorage.setItem('planification_queues', JSON.stringify(queues));
    }, [queues]);

    const systems = rapport?.systemesJoueur || [];

    // Catalogues
    const knownTechs = useMemo(() => new Set(rapport?.technologiesConnues || []), [rapport]);

    const buildings = useMemo(() =>
        (global?.technologies || [])
            .filter(t => t.type === 0 && (knownTechs.has(t.code) || t.publique)),
        [global, knownTechs]
    );

    const plans = useMemo(() => {
        const pub = global?.plansPublic || [];
        const pri = rapport?.plansVaisseaux || [];
        return [...pub, ...pri];
    }, [global, rapport]);

    const searchableOptions = useMemo(() => {
        const opts: { value: string; label: string }[] = [];
        buildings.forEach(b => {
            opts.push({ value: `building:${b.code}`, label: `[B] ${formatTechName(b)}` });
        });
        plans.forEach(p => {
            opts.push({ value: `ship:${p.nom}`, label: `[V] ${p.nom}` });
        });
        return opts;
    }, [buildings, plans]);

    const marchandisesCols = useMemo(() => global?.marchandises || [], [global]);

    const addToQueue = (systemKey: string, type: 'building' | 'ship', code: string, planetNum?: number) => {
        const newEntry: PlannedItem = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            code,
            quantity: 1,
            planetNum
        };
        setQueues(prev => ({
            ...prev,
            [systemKey]: [...(prev[systemKey] || []), newEntry]
        }));
    };


    const setQuantity = (systemKey: string, itemId: string, val: number) => {
        setQueues(prev => {
            const q = prev[systemKey] || [];
            return {
                ...prev,
                [systemKey]: q.map(item =>
                    item.id === itemId ? { ...item, quantity: Math.max(0, val) } : item
                ).filter(item => item.quantity > 0)
            };
        });
    };

    const setMaxQuantity = (systemKey: string, itemId: string) => {
        setQueues(prev => {
            const queue = prev[systemKey] || [];
            const itemIndex = queue.findIndex(i => i.id === itemId);
            if (itemIndex === -1) return prev;

            const system = systems.find(s => `${s.pos.x}_${s.pos.y}` === systemKey);
            if (!system) return prev;

            const initial = getSystemResources(system);
            let remPc = initial.pc || 0;
            let remMin = initial.minerai;
            let remMarchandises: Record<number, number> = { ...initial.initialMarchandises };

            // On calcule ce qui est consommé par TOUS les autres éléments
            for (let i = 0; i < queue.length; i++) {
                if (i === itemIndex) continue;
                const data = getItemData(queue[i]);
                remPc -= data.pc * queue[i].quantity;
                remMin -= data.minerai * queue[i].quantity;
                data.marchandises.forEach(m => {
                    remMarchandises[m.code] = (remMarchandises[m.code] || 0) - (m.nb * queue[i].quantity);
                });
            }

            // Données de l'élément cible
            const targetItem = queue[itemIndex];
            const targetData = getItemData(targetItem);

            // Calcul du max possible pour cet élément
            let maxPossible = Infinity;

            if (targetData.pc > 0) {
                maxPossible = Math.min(maxPossible, Math.floor(Math.max(0, remPc) / targetData.pc));
            }
            if (targetData.minerai > 0) {
                maxPossible = Math.min(maxPossible, Math.floor(Math.max(0, remMin) / targetData.minerai));
            }
            targetData.marchandises.forEach(m => {
                if (m.nb > 0) {
                    const stock = remMarchandises[m.code] || 0;
                    maxPossible = Math.min(maxPossible, Math.floor(Math.max(0, stock) / m.nb));
                }
            });

            if (maxPossible === Infinity || maxPossible < 0) maxPossible = 0;

            return {
                ...prev,
                [systemKey]: queue.map((item, idx) =>
                    idx === itemIndex ? { ...item, quantity: maxPossible } : item
                ).filter(item => item.quantity > 0)
            };
        });
    };

    const setPlanetNum = (systemKey: string, itemId: string, planetNum: number | undefined) => {
        setQueues(prev => {
            const q = prev[systemKey] || [];
            return {
                ...prev,
                [systemKey]: q.map(item =>
                    item.id === itemId ? { ...item, planetNum } : item
                )
            };
        });
    };


    const importQueue = (systemKey: string, bp: string) => {
        if (!bp) return;
        try {
            const decoded = atob(bp);
            const items = decoded.split('%');
            const newEntriesBySystem: Record<string, PlannedItem[]> = {};

            items.forEach(item => {
                const parts = item.split(':');
                let systemPos: string | undefined;
                let planetNum: number | undefined;
                let type: 'building' | 'ship' = 'ship';
                let code = '';
                let quantity = 0;

                if (parts.length === 4) {
                    // Nouveau format simplifié : pos:qty:code:planet
                    [systemPos, , code, ] = parts;
                    const qtyStr = parts[1];
                    const pNumStr = parts[3];

                    quantity = parseInt(qtyStr, 10);
                    if (pNumStr !== '') planetNum = parseInt(pNumStr, 10);

                    // Déduction du type : si le code est dans buildings, c'est un building
                    if (buildings.some(b => b.code === code)) {
                        type = 'building';
                    } else {
                        type = 'ship';
                    }
                }

                if (code && !isNaN(quantity)) {
                    const targetKey = systemPos ? `${systemPos.split('_')[1]}_${systemPos.split('_')[2]}` : systemKey;
                    if (!newEntriesBySystem[targetKey]) newEntriesBySystem[targetKey] = [];
                    newEntriesBySystem[targetKey].push({
                        id: Math.random().toString(36).substr(2, 9),
                        type,
                        code,
                        quantity,
                        planetNum
                    });
                }
            });

            setQueues(newEntriesBySystem);
        } catch (e) {
            alert("Erreur lors de l'import du blueprint.");
        }
    };


    function buildBluePrint() {
        const entries: any[] = [];
        Object.entries(queues).forEach(([key, queue]) => {
            const system = systems.find(s => `${s.pos.x}_${s.pos.y}` === key);
            // On tente de reconstruire le posStr 0_x_y (z=0 par défaut si on n'a pas mieux)
            const systemPos = system ? `0_${system.pos.x}_${system.pos.y}` : `0_${key}`;
            queue.forEach(item => {
                entries.push({
                    systemPos,
                    qty: item.quantity,
                    code: item.code,
                    planetNum: item.planetNum || 100,
                });
            });
        });

        if (entries.length === 0) {
            return;
        }

        return btoa(entries.map(e => `${e.systemPos}:${e.qty}:${e.code}:${e.planetNum}`).join('%'));
    }
    const blueprint = buildBluePrint() || '';

    const copyBluePrint = () => {
        navigator.clipboard.writeText(blueprint)
            .then(() => alert("Blueprint global copié !"))
            .catch(err => console.error("Erreur copie blueprint", err));
    };

    const changeBuildingLevel = (systemKey: string, itemId: string, delta: number) => {
        setQueues(prev => {
            const queue = prev[systemKey] || [];
            const itemIndex = queue.findIndex(i => i.id === itemId);
            if (itemIndex === -1) return prev;

            const item = queue[itemIndex];
            if (item.type !== 'building') return prev;

            const currentTech = global?.technologies.find(t => t.code === item.code);
            if (!currentTech) return prev;

            const targetNiv = currentTech.niv + delta;
            const newTech = global?.technologies.find(t =>
                t.type === 0 &&
                t.base === currentTech.base &&
                t.niv === targetNiv &&
                (knownTechs.has(t.code) || t.publique)
            );

            if (!newTech) return prev;

            return {
                ...prev,
                [systemKey]: queue.map((it, idx) =>
                    idx === itemIndex ? { ...it, code: newTech.code } : it
                )
            };
        });
    };

    const getSystemResources = (s: SystemeJoueur) => {
        let totalPdc = s.pdc || 0;
        let totalStockMinerai = 0;
        let totalProdMinerai = 0;
        s.planetes.forEach(p => {
            if(p.proprietaire && p.proprietaire === rapport?.joueur?.numero) {
                totalStockMinerai += p.minerai || 0;
                totalProdMinerai += p.prodMinerai || 0;
            }
        });

        const initialMarchandises: Record<number, number> = {};
        const detailMarchandises: Record<number, { stock: number; prod: number }> = {};
        s.marchandises?.forEach(m => {
            initialMarchandises[m.code] = (m.stock || 0) + (m.prod || 0);
            detailMarchandises[m.code] = { stock: m.stock || 0, prod: m.prod || 0 };
        });

        return {
            pc: totalPdc,
            minerai: totalStockMinerai + totalProdMinerai,
            initialMinerai: { stock: totalStockMinerai, prod: totalProdMinerai },
            initialMarchandises,
            detailMarchandises
        };
    };

    const getItemData = (item: PlannedItem) => {
        if (item.type === 'building') {
            const b = buildings.find(x => x.code === item.code);
            return {
                name: b ? formatTechName(b) : item.code,
                pc: b?.specification?.case || b?.specification?.pc || 0,
                minerai: b?.specification?.min || 0,
                marchandises: b?.marchandises || []
            };
        } else {
            const p = plans.find(x => x.nom === item.code);
            const merchCosts: { code: number; nb: number }[] = [];

            // Si le plan a des composants, on peut aussi sommer les marchandises demandées par chaque composant
            p?.composants.forEach(c => {
                const tech = global?.technologies.find(t => t.code === c.code);
                if (tech?.marchandises) {
                    tech.marchandises.forEach(m => {
                        const existing = merchCosts.find(x => x.code === m.code);
                        if (existing) {
                            existing.nb += m.nb * c.nb;
                        } else {
                            merchCosts.push({ code: m.code, nb: m.nb * c.nb });
                        }
                    });
                }
            });

            return {
                name: p?.nom || item.code,
                pc: p?.pc || 0,
                minerai: p?.minerai || 0,
                marchandises: merchCosts
            };
        }
    };

    if (!rapport) return <div style={{ padding: 20 }}>Veuillez charger un rapport XML.</div>;

    return (
        <div style={{ padding: 20, color: '#eee', backgroundColor: '#111', minHeight: '100%', overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Planification Globale</h2>
                <div style={{ display: 'flex', gap: 10 }}>
                    <textarea
                        style={{width: '100%', backgroundColor: 'white', padding: '10px', color: '#000'}}
                        defaultValue={blueprint}
                        readOnly={true}
                        onFocus={(e) => e.target.select()}
                    ></textarea>
                       <button
                           onClick={copyBluePrint}
                           disabled={Object.keys(queues).length === 0}
                           style={{
                               backgroundColor: '#2c3e50',
                               color: 'white',
                               border: 'none',
                               padding: '8px 16px',
                               borderRadius: 4,
                               cursor: 'pointer'
                           }}
                       >
                        Copier le schema dans le presse-papier
                    </button>

                    <button
                        onClick={() => {
                            const bp = prompt("Collez le blueprint global ici :");
                            if (bp) importQueue('', bp);
                        }}
                        style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: '#444', color: '#eee', border: '1px solid #666', borderRadius: 4 }}
                    >
                        Importer Schema de construction
                    </button>
                </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20 }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid #444', color: '#aaa', fontSize: '0.9em' }}>
                        <th style={{ textAlign: 'left', padding: 8 }}>Système</th>
                        <th style={{ textAlign: 'center', padding: 8 }}>PDC</th>
                        <th style={{ textAlign: 'center', padding: 8 }}>Min</th>
                        {marchandisesCols.map(m => (
                            <th key={m.code} style={{ textAlign: 'center', padding: 8 }} title={m.nom} className={'m m'+m.code}>
                                {m.nom.substring(0, 3)}.
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {systems.map(s => {
                        const key = `${s.pos.x}_${s.pos.y}`;
                        const initial = getSystemResources(s);
                        const queue = queues[key] || [];

                        let finalPc = initial.pc;
                        let finalMinerai = initial.minerai;
                        let finalMarchandises: Record<number, number> = { ...initial.initialMarchandises };

                        // S'assurer que toutes les colonnes de marchandises sont initialisées (à 0 si pas en stock)
                        marchandisesCols.forEach(m => {
                            if (finalMarchandises[m.code] === undefined) {
                                finalMarchandises[m.code] = 0;
                            }
                        });

                        const queueData = queue.map(item => {
                            const data = getItemData(item);
                            finalPc -= data.pc * item.quantity;
                            finalMinerai -= data.minerai * item.quantity;
                            data.marchandises.forEach(m => {
                                finalMarchandises[m.code] = (finalMarchandises[m.code] || 0) - (m.nb * item.quantity);
                            });
                            return { ...item, data };
                        });

                        const ownedPlanets = s.planetes.filter(p => p.proprietaire === rapport?.joueur?.numero);

                        return (
                            <>
                            <tr key={key} style={{verticalAlign: 'top' }}>
                                <td style={{ padding: 8 }}>
                                    <div style={{ fontWeight: 'bold' }}>{s.nom}</div>
                                    <div style={{ fontSize: '0.8em', color: '#888' }}>
                                        ({s.pos.x}, {s.pos.y}) &nbsp;
                                        {/*<button*/}
                                        {/*    onClick={() => exportQueue(key)}*/}
                                        {/*    style={{ fontSize: '0.7em', padding: '2px 4px', cursor: 'pointer' }}*/}
                                        {/*    title="Copier le blueprint de ce système"*/}
                                        {/*>*/}
                                        {/*    Export BP*/}
                                        {/*</button>*/}
                                    </div>
                                </td>

                                <td style={{ padding: 8, textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.8em', color: '#888' }} title="Points de Construction (Production par tour)">{initial.pc}</div>
                                    <div style={{ color: finalPc < 0 ? '#f55' : (finalPc < initial.pc ? '#5f5' : '#aaa'), fontWeight: finalPc < initial.pc ? 'bold' : 'normal' }}>{finalPc}</div>
                                </td>

                                <td style={{ padding: 8, textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.8em', color: '#888' }} title="Stock + Production">
                                        {initial.initialMinerai.stock} {initial.initialMinerai.prod > 0 ? `( +${initial.initialMinerai.prod} )` : ''}
                                    </div>
                                    <div style={{ color: finalMinerai < 0 ? '#f55' : (finalMinerai < initial.minerai ? '#5f5' : '#aaa'), fontWeight: finalMinerai < initial.minerai ? 'bold' : 'normal' }}>{finalMinerai}</div>
                                </td>

                                {marchandisesCols.map(m => {
                                    const initVal = initial.initialMarchandises[m.code] || 0;
                                    const detail = initial.detailMarchandises[m.code] || { stock: 0, prod: 0 };
                                    const val = finalMarchandises[m.code] || 0;
                                    return (
                                        <td key={m.code} style={{ padding: 8, textAlign: 'center' }}>
                                            <div style={{ fontSize: '0.8em', color: '#888' }} title="Stock + Production">
                                                {detail.stock} {detail.prod > 0 ? `( +${detail.prod} )` : ''}
                                            </div>
                                            <div style={{ color: val < 0 ? '#f55' : (val < initVal ? '#5f5' : '#aaa'), fontWeight: val < initVal ? 'bold' : 'normal' }}>{val}</div>
                                        </td>
                                    );
                                })}

                            </tr>
                            <tr style={{  borderBottom: '2px solid #6F6' }}>
                                <td style={{ padding: 8 }} colSpan={19}>
                                    <div style={{ marginBottom: 10 }}>
                                        <SearchableSelect
                                            options={searchableOptions}
                                            value=""
                                            placeholder="Ajouter une construction..."
                                            onChange={(val) => {
                                                const [type, ...codeParts] = val.split(':');
                                                const code = codeParts.join(':');
                                                if (type && code) {
                                                    // Par défaut, pas de planète sélectionnée (valeur undefined / 100)
                                                    addToQueue(key, type as any, code, undefined);
                                                }
                                            }}
                                            style={{ width: '100%', minWidth: 250 }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', flexWrap: 'wrap' }}>
                                    {queueData.length === 0 && <span style={{ color: '#555', fontStyle: 'italic' }}>Rien de prévu</span>}
                                    {queueData.map(item => {
                                        const tech = item.type === 'building' ? global?.technologies.find(t => t.code === item.code) : null;
                                        const hasNextLevel = tech ? global?.technologies.some(t => t.type === 0 && t.base === tech.base && t.niv === tech.niv + 1 && (knownTechs.has(t.code) || t.publique)) : false;
                                        const hasPrevLevel = tech ? global?.technologies.some(t => t.type === 0 && t.base === tech.base && t.niv === tech.niv - 1 && (knownTechs.has(t.code) || t.publique)) : false;

                                        return (
                                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, backgroundColor: '#222', padding: '2px 8px', borderRadius: 4, width: '300px', flexDirection: 'column' }}>
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, flexDirection: 'row', width:'100%', }}>
                                                    <div style={{width:'100%', justifyContent: 'space-between', flexDirection: 'row', display: "flex"}}>
                                                        <span style={{ fontSize: '0.9em' }}>{item.data.name}</span>
                                                        {item.type === 'building' && (
                                                            <div style={{ display: 'flex', gap: 2 }}>
                                                                <button
                                                                    disabled={!hasPrevLevel}
                                                                    onClick={() => changeBuildingLevel(key, item.id, -1)}
                                                                    style={{ fontSize: '0.6em', padding: '0px 4px', cursor: 'pointer' }}
                                                                    title="Diminuer le niveau"
                                                                >
                                                                    ▼
                                                                </button>
                                                                <button
                                                                    disabled={!hasNextLevel}
                                                                    onClick={() => changeBuildingLevel(key, item.id, 1)}
                                                                    style={{ fontSize: '0.6em', padding: '0px 4px', cursor: 'pointer' }}
                                                                    title="Augmenter le niveau"
                                                                >
                                                                    ▲
                                                                </button>
                                                        </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', justifyContent: 'flex-end' }}>
                                                        <select
                                                            value={item.planetNum === undefined ? 100 : item.planetNum}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value);
                                                                setPlanetNum(key, item.id, val === 100 ? undefined : val);
                                                            }}
                                                            style={{
                                                                fontSize: '0.8em',
                                                                backgroundColor: '#444',
                                                                color: '#eee',
                                                                border: 'none',
                                                                borderRadius: 3,
                                                                padding: '2px 4px'
                                                            }}
                                                        >
                                                            <option value={100}>--</option>
                                                            {ownedPlanets.map(p => (
                                                                <option key={p.num} value={p.num}>P{p.num + 1}</option>
                                                            ))}
                                                        </select>
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => setQuantity(key, item.id, parseInt(e.target.value) || 0)}
                                                        style={{ width: 40, textAlign: 'center', backgroundColor: '#333', color: '#fff', border: 'none' }}
                                                    />
                                                    <button
                                                        onClick={() => setMaxQuantity(key, item.id)}
                                                        style={{ fontSize: '0.7em', padding: '2px 4px', cursor: 'pointer' }}
                                                        title="Calculer le maximum possible"
                                                    >
                                                        MAX
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    </div>
                                </td>
                            </tr>
                            </>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

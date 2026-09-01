import React, {useEffect, useMemo, useState} from 'react';
import {useReport} from '../context/ReportContext';
import {SystemeJoueur} from '../types';
import {formatPlannedItems, formatTechName} from '../utils/global';
import SearchableSelect from '../components/utils/SearchableSelect';

type PlannedItem = {
    id: string;
    type: 'building' | 'ship';
    code: string; // code pour bâtiment, nom pour plan vaisseau (car pas d'id unique clair pour les plans dans le type actuel)
    quantity: number;
    planetNum?: number;
};

type SystemQueue = Record<string, PlannedItem[]>; // Key = x_y

const construireBluePrintSeparator = '%#!%';

export default function Planification() {
    const { global, rapport } = useReport();
    const [sortBy, setSortBy] = useState<'nom' | 'pos' | 'pdc' | 'nbConstructions' | ''>('nom');
    const [orderedSystems, setOrderedSystems] = useState<SystemeJoueur[]>([]);
    const [summaryExpanded, setSummaryExpanded] = useState(() => {
        const saved = localStorage.getItem('planification_summary_expanded');
        return saved !== null ? JSON.parse(saved) : true;
    });

    useEffect(() => {
        localStorage.setItem('planification_summary_expanded', JSON.stringify(summaryExpanded));
    }, [summaryExpanded]);
    const [summaryTab, setSummaryTab] = useState<'ship' | 'building' | 'cost'>('building');
    const [highlightedItems, setHighlightedItems] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const timers: NodeJS.Timeout[] = [];
        Object.keys(highlightedItems).forEach(id => {
            if (highlightedItems[id]) {
                const timer = setTimeout(() => {
                    setHighlightedItems(prev => ({ ...prev, [id]: false }));
                }, 1000);
                timers.push(timer);
            }
        });
        return () => timers.forEach(t => clearTimeout(t));
    }, [highlightedItems]);

    const systems = useMemo(() => rapport?.systemesJoueur || [], [rapport]);

    const [collapsedSystems, setCollapsedSystems] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem('planification_collapsed');
        return saved ? JSON.parse(saved) : { _isDefault: true };
    });

    useEffect(() => {
        if (collapsedSystems._isDefault && systems.length > 0) {
            const newState: Record<string, boolean> = {};
            systems.forEach(s => {
                newState[`${s.pos.x}_${s.pos.y}`] = true;
            });
            setCollapsedSystems(newState);
        }
    }, [systems, collapsedSystems._isDefault]);

    const [queues, setQueues] = useState<SystemQueue>(() => {
        const saved = localStorage.getItem('planification_queues');
        return saved ? JSON.parse(saved) : {};
    });

    const hasAnyPlannedItem = useMemo(() => {
        return Object.values(queues).some(q => q.length > 0);
    }, [queues]);

    const [isClearModalOpen, setIsClearModalOpen] = useState(false);
    const [confirmText, setConfirmText] = useState('');

    const clearAllQueues = () => {
        setQueues({});
        setIsClearModalOpen(false);
        setConfirmText('');
    };

    useEffect(() => {
        localStorage.setItem('planification_queues', JSON.stringify(queues));
    }, [queues]);

    useEffect(() => {
        localStorage.setItem('planification_collapsed', JSON.stringify(collapsedSystems));
    }, [collapsedSystems]);

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
            if (val <= 0) {
                return {
                    ...prev,
                    [systemKey]: q.filter(item => item.id !== itemId)
                };
            }
            return {
                ...prev,
                [systemKey]: q.map(item =>
                    item.id === itemId ? { ...item, quantity: val } : item
                )
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

            if (maxPossible === 0) {
                setHighlightedItems(prev => ({ ...prev, [itemId]: true }));
                return prev;
            }

            return {
                ...prev,
                [systemKey]: queue.map((item, idx) =>
                    idx === itemIndex ? { ...item, quantity: maxPossible } : item
                )
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
            const binary = atob(bp);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            const decoded = new TextDecoder().decode(bytes);
            const items = decoded.split(construireBluePrintSeparator);
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

        const schema = entries.map(e => `${e.systemPos}:${e.qty}:${e.code}:${e.planetNum}`).join(construireBluePrintSeparator);
        const utf8Bytes = new TextEncoder().encode(schema);
        const binary = utf8Bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), '');

        return btoa(binary);
    }
    const blueprint = buildBluePrint() || '';

    const summaryData = useMemo(() => {
        return formatPlannedItems(
            Object.values(queues).flat(),
            global?.technologies || [],
            rapport?.plansVaisseaux || []
        );
    }, [queues, global, rapport]);

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

    const toggleCollapse = (key: string) => {
        setCollapsedSystems(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const setAllCollapse = (collapsed: boolean) => {
        const newState: Record<string, boolean> = {};
        systems.forEach(s => {
            newState[`${s.pos.x}_${s.pos.y}`] = collapsed;
        });
        setCollapsedSystems(newState);
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

    useEffect(() => {
        if (sortBy === '') return;

        const sorted = [...systems];
        if (sortBy === 'nom') {
            sorted.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
        } else if (sortBy === 'pos') {
            sorted.sort((a, b) => {
                if (a.pos.x !== b.pos.x) return a.pos.x - b.pos.x;
                return a.pos.y - b.pos.y;
            });
        } else if (sortBy === 'pdc') {
            sorted.sort((a, b) => {
                const getRemainingPdc = (s: SystemeJoueur) => {
                    const initial = getSystemResources(s);
                    const key = `${s.pos.x}_${s.pos.y}`;
                    const queue = queues[key] || [];
                    let remPc = initial.pc;
                    queue.forEach(item => {
                        const data = getItemData(item);
                        remPc -= data.pc * item.quantity;
                    });
                    return remPc;
                };
                return getRemainingPdc(b) - getRemainingPdc(a); // Décroissant
            });
        } else if (sortBy === 'nbConstructions') {
            sorted.sort((a, b) => {
                const getNbConstructions = (s: SystemeJoueur) => {
                    const key = `${s.pos.x}_${s.pos.y}`;
                    const queue = queues[key] || [];
                    return queue.reduce((sum, item) => sum + item.quantity, 0);
                };
                return getNbConstructions(b) - getNbConstructions(a); // Décroissant
            });
        }
        setOrderedSystems(sorted);
        setSortBy('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortBy]);

    // Initialisation et mise à jour quand les systèmes changent (ex: chargement rapport)
    useEffect(() => {
        if (orderedSystems.length === 0 && systems.length > 0) {
            const sorted = [...systems].sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
            setOrderedSystems(sorted);
        }
    }, [systems, orderedSystems.length]);

    if (!rapport) return <div style={{ padding: 20 }}>Veuillez charger un rapport XML.</div>;

    return (
        <div style={{ padding: 20, paddingTop: 0, color: '#eee', backgroundColor: '#111', overflowX: 'auto', overflowY: 'auto', height: '100%' }}>
            <div className="half">
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <h2>Planification Globale</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select
                            id="sortBy"
                            value={sortBy === 'nom' || sortBy === 'pos' || sortBy === 'pdc' || sortBy === 'nbConstructions' ? '' : sortBy}
                            onChange={(e) => {
                                const val = e.target.value as any;
                                if (val) {
                                    setSortBy(val);
                                }
                            }}
                            style={{
                                backgroundColor: '#222',
                                color: '#eee',
                                border: '1px solid #444',
                                borderRadius: 4,
                                padding: '4px 8px',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="">-- Trier par --</option>
                            <option value="nom">Nom</option>
                            <option value="pos">Position</option>
                            <option value="pdc">PDC restant</option>
                            <option value="nbConstructions">Nombre de constructions</option>
                        </select>
                    </div>
                </div>
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

            <div style={{ display: 'flex', gap: 3 }}>
                <button
                    onClick={() => setAllCollapse(false)}
                    style={{
                        padding: '4px 8px',
                        cursor: 'pointer',
                        backgroundColor: '#333',
                        color: '#eee',
                        border: '1px solid #555',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '32px'
                    }}
                    title="Tout déplier"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="4 9 12 1 20 9"></polyline>
                        <polyline points="4 15 12 23 20 15"></polyline>
                    </svg>
                </button>
                <button
                    onClick={() => setAllCollapse(true)}
                    style={{
                        padding: '4px 8px',
                        cursor: 'pointer',
                        backgroundColor: '#333',
                        color: '#eee',
                        border: '1px solid #555',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '32px'
                    }}
                    title="Tout replier"
                >
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 2.5 12 10.5 20 2.5"></polyline>
                    <polyline points="4 21.5 12 13.5 20 21.5"></polyline>
                </svg>

                </button>
                <button
                    onClick={() => setIsClearModalOpen(true)}
                    disabled={!hasAnyPlannedItem}
                    style={{
                        padding: '4px 8px',
                        cursor: hasAnyPlannedItem ? 'pointer' : 'default',
                        backgroundColor: hasAnyPlannedItem ? '#822' : '#333',
                        color: hasAnyPlannedItem ? '#eee' : '#666',
                        border: '1px solid #555',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '32px',
                        opacity: hasAnyPlannedItem ? 1 : 0.5
                    }}
                    title="Tout vider"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
        </div>
            <table className="planification_table">
                <thead>
                    <tr style={{ color: '#aaa', fontSize: '0.9em' }}>
                        <th style={{ textAlign: 'left' }}>Système</th>
                        <th style={{ textAlign: 'center' }}>PDC</th>
                        <th style={{ textAlign: 'center' }}>Min</th>
                        {marchandisesCols.map(m => (
                            <th key={m.code} style={{ textAlign: 'center' }} title={m.nom} className={'m m'+m.code}>
                                <span className="hideOnMobile">{m.nom.substring(0, 3)}.</span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {orderedSystems.map(s => {
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

                        const hasShortage = finalPc < 0 || finalMinerai < 0 || Object.values(finalMarchandises).some(v => v < 0);

                        const ownedPlanets = s.planetes.filter(p => p.proprietaire === rapport?.joueur?.numero);
                        const isCollapsed = collapsedSystems[key];

                        if (isCollapsed) {
                            return (
                                <tr key={key} style={{ borderBottom: '1px solid #444', backgroundColor: finalPc > 0 ? '' : '#333' }}>
                                    <td style={{ padding: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <button
                                                onClick={() => toggleCollapse(key)}
                                                style={{ background: 'none', border: 'none', color: hasShortage ? '#f55' : '#aaa', cursor: 'pointer', padding: 0, fontSize: '1.2em' }}
                                            >
                                                ▶
                                            </button>
                                            <span style={{ fontSize: '0.8em', color: '#888' }}>[{s.pos.x.toString().padStart(2, '0')}-{s.pos.y.toString().padStart(2, '0')}]</span>
                                            <span style={{ fontWeight: 'bold' }} className="hideOnMobile">{s.nom}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: 8, textAlign: 'center' }}>
                                        <span style={{ color: finalPc < 0 ? '#f55' : (finalPc < initial.pc ? '#5f5' : '#aaa') }}>{finalPc}</span>
                                    </td>
                                    <td style={{ padding: 8, textAlign: 'center' }}>
                                        <span style={{ color: finalMinerai < 0 ? '#f55' : (finalMinerai < initial.minerai ? '#5f5' : '#aaa') }}>{finalMinerai}</span>
                                    </td>
                                    <td colSpan={marchandisesCols.length} style={{ padding: 8 }}>
                                        <div style={{ fontSize: '0.85em', color: '#bbb', overflowX: 'auto', whiteSpace: 'nowrap', maxWidth: 0, minWidth: '100%' }}>
                                            {queue.length > 0 ? (
                                                (() => {
                                                    const formatted = formatPlannedItems(queue, global?.technologies || []);
                                                    const all = [...formatted.formattedBuildings, ...formatted.formattedShips];
                                                    return all.join(', ');
                                                })()
                                            ) : (
                                                <span style={{ fontStyle: 'italic', color: '#555' }}>Rien</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        }

                        return (
                            <React.Fragment key={key}>
                            <tr style={{verticalAlign: 'top', backgroundColor: finalPc>0 ? '' : '#333' }}>
                                <td style={{ padding: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <button
                                            onClick={() => toggleCollapse(key)}
                                            style={{ background: 'none', border: 'none', color: hasShortage ? '#f55' : '#aaa', cursor: 'pointer', padding: 0, fontSize: '1.2em' }}
                                        >
                                            ▼
                                        </button>
                                        <div style={{ fontSize: '0.8em', color: '#888' }}>
                                            [{s.pos.x.toString().padStart(2, '0')}-{s.pos.y.toString().padStart(2, '0')}] &nbsp;
                                        </div>
                                        <div style={{ fontWeight: 'bold' }} className="hideOnMobile">{s.nom}</div>
                                    </div>
                                </td>

                                <td style={{ padding: 8, textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.8em', color: '#888' }} title="Points de Construction (Production par tour)" className="hideOnMobile">{initial.pc}</div>
                                    <div style={{ color: finalPc < 0 ? '#f55' : (finalPc < initial.pc ? '#5f5' : '#aaa'), fontWeight: finalPc < initial.pc ? 'bold' : 'normal' }}>{finalPc}</div>
                                </td>

                                <td style={{ padding: 8, textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.8em', color: '#888' }} title="Stock + Production" className="hideOnMobile">
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
                                            <div style={{ fontSize: '0.8em', color: '#888' }} title="Stock + Production" className="hideOnMobile">
                                                {detail.stock} {detail.prod > 0 ? `( +${detail.prod} )` : ''}
                                            </div>
                                            <div style={{ color: val < 0 ? '#f55' : (val < initVal ? '#5f5' : '#aaa'), fontWeight: val < initVal ? 'bold' : 'normal' }}>{val}</div>
                                        </td>
                                    );
                                })}

                            </tr>
                            <tr style={{  borderBottom: '2px solid #6F6', backgroundColor: finalPc>0 ? '' : '#333' }}>
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

                                        const isHighlighted = highlightedItems[item.id];

                                        return (
                                            <div key={item.id} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                marginBottom: 4,
                                                backgroundColor: isHighlighted ? '#a22' : '#222',
                                                padding: '2px 8px',
                                                borderRadius: 4,
                                                width: '300px',
                                                flexDirection: 'column',
                                                transition: 'background-color 0.5s ease'
                                            }}>
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, flexDirection: 'row', width:'100%', }}>
                                                    <div style={{width:'100%', justifyContent: 'space-between', flexDirection: 'row', display: "flex"}}>
                                                        <span style={{ fontSize: '0.9em' }}>{item.data.name}</span>
                                                        {item.type === 'building' && (
                                                            <div style={{ display: 'flex', gap: 3 }}>
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
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>

            {/* Summary Widget */}
            <div style={{
                position: 'fixed',
                bottom: 20,
                right: 20,
                width: summaryExpanded ? 400 : 120,
                backgroundColor: '#222',
                border: '1px solid #444',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '80vh',
                transition: 'width 0.3s ease'
            }}>
                <div
                    onClick={() => setSummaryExpanded(!summaryExpanded)}
                    style={{
                        padding: '8px 12px',
                        backgroundColor: '#333',
                        borderBottom: summaryExpanded ? '1px solid #444' : 'none',
                        borderRadius: summaryExpanded ? '8px 8px 0 0' : 8,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontWeight: 'bold',
                        fontSize: '0.9em'
                    }}
                >
                    <span>Récapitulatif</span>
                    <span>{summaryExpanded ? '▼' : '▲'}</span>
                </div>

                {summaryExpanded && (
                    <>
                        <div style={{ display: 'flex', borderBottom: '1px solid #444' }}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setSummaryTab('building'); }}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    backgroundColor: summaryTab === 'building' ? '#444' : 'transparent',
                                    color: summaryTab === 'building' ? '#fff' : '#aaa',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.85em'
                                }}
                            >
                                Bâtiments ({summaryData.totalBuildings})
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setSummaryTab('ship'); }}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    backgroundColor: summaryTab === 'ship' ? '#444' : 'transparent',
                                    color: summaryTab === 'ship' ? '#fff' : '#aaa',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.85em'
                                }}
                            >
                                Vaisseaux ({summaryData.totalShips})
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setSummaryTab('cost'); }}
                                style={{
                                    flex: 1.2,
                                    padding: '8px',
                                    backgroundColor: summaryTab === 'cost' ? '#444' : 'transparent',
                                    color: summaryTab === 'cost' ? '#fff' : '#aaa',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.85em'
                                }}
                            >
                                Coûts: <span className="cur">{summaryData.totalGlobalCost.prix.toLocaleString()}</span>
                            </button>
                        </div>
                        <div style={{ padding: 12, overflowY: 'auto', fontSize: '0.9em' }}>
                            {summaryTab === 'building' ? (
                                summaryData.formattedBuildings.length > 0 ? (
                                    summaryData.formattedBuildings.map((str, i) => (
                                        <div key={i} style={{ marginBottom: 6 }}>
                                            <span style={{ color: '#aaa', fontWeight: 'bold' }}>{str.split(' : ')[0]}</span> : {str.split(' : ')[1]}
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ color: '#666', fontStyle: 'italic' }}>Aucun bâtiment planifié</div>
                                )
                            ) : summaryTab === 'ship' ? (
                                summaryData.formattedShips.length > 0 ? (
                                    summaryData.formattedShips.map((str, i) => (
                                        <div key={i} style={{ marginBottom: 6 }}>
                                            <span style={{ color: '#aaa', fontWeight: 'bold' }}>{str.split(' : ')[0]}</span> : {str.split(' : ')[1]}
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ color: '#666', fontStyle: 'italic' }}>Aucun vaisseau planifié</div>
                                )
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: 4 }}>
                                        <span>Centaures</span>
                                        <span style={{ fontWeight: 'bold' }} className="cur">{summaryData.totalGlobalCost.prix.toLocaleString()}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: 4 }}>
                                        <span>PDC</span>
                                        <span style={{ fontWeight: 'bold', color: '#55f' }}>{summaryData.totalGlobalCost.pdc.toLocaleString()}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: 4 }}>
                                        <span>Minerai</span>
                                        <span style={{ fontWeight: 'bold', color: '#5f5' }}>{summaryData.totalGlobalCost.minerai.toLocaleString()}</span>
                                    </div>
                                    {summaryData.totalGlobalCost.marchandises.sort((a: any, b: any) => a.code - b.code).map((m: any) => {
                                        const mData = global?.marchandises.find(x => x.code === m.code);
                                        return (
                                            <div key={m.code} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: 4 }}>
                                                <span className={'m m'+mData?.code}>{mData?.nom || `Marchandise ${m.code}`}</span>
                                                <span style={{ fontWeight: 'bold', color: '#fa0' }}>{m.nb.toLocaleString()}</span>
                                            </div>
                                        );
                                    })}
                                    {summaryData.totalGlobalCost.marchandises.length === 0 && summaryData.totalGlobalCost.prix === 0 && summaryData.totalGlobalCost.pdc === 0 && summaryData.totalGlobalCost.minerai === 0 && (
                                        <div style={{ color: '#666', fontStyle: 'italic' }}>Aucun coût à afficher</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {isClearModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000
                }}>
                    <div style={{
                        backgroundColor: '#222',
                        padding: '24px',
                        borderRadius: '8px',
                        border: '1px solid #444',
                        maxWidth: '400px',
                        width: '90%',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                    }}>
                        <h3 style={{ marginTop: 0, color: '#f55' }}>Tout vider ?</h3>
                        <p style={{ color: '#ccc', lineHeight: '1.5' }}>
                            Êtes-vous sûr de vouloir supprimer <strong>tous</strong> les éléments planifiés dans <strong>tous</strong> les systèmes ?
                        </p>
                        <p style={{ color: '#aaa', fontSize: '0.9em' }}>
                            Pour confirmer, veuillez saisir le mot <strong style={{ color: '#eee' }}>supprimer</strong> ci-dessous :
                        </p>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="Saisir supprimer"
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '10px',
                                backgroundColor: '#111',
                                border: '1px solid #444',
                                borderRadius: '4px',
                                color: '#fff',
                                marginBottom: '20px',
                                boxSizing: 'border-box'
                            }}
                        />
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => { setIsClearModalOpen(false); setConfirmText(''); }}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#444',
                                    color: '#eee',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Annuler
                            </button>
                            <button
                                onClick={clearAllQueues}
                                disabled={confirmText.toLowerCase() !== 'supprimer'}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: confirmText.toLowerCase() === 'supprimer' ? '#822' : '#333',
                                    color: confirmText.toLowerCase() === 'supprimer' ? '#fff' : '#666',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: confirmText.toLowerCase() === 'supprimer' ? 'pointer' : 'not-allowed',
                                    fontWeight: 'bold'
                                }}
                            >
                                Tout vider
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

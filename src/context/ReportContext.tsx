import React, {createContext, useContext, useEffect, useMemo, useRef, useState, useCallback} from 'react';
import {GlobalData, Rapport, XY, SystemeDetecte, Note, CombatEvent, Zone} from '../types';
import {parseRapportXml, addManualDetectedSystems, getCachedDetectedSystems} from '../parsers/parseRapport';
import {parsePublicCombatsHtml} from '../parsers/parsePublicCombats';
import {parseManualDetectedSystems} from '../parsers/parseManualSystems';
import {parseDataXml} from '../parsers/parseData';
import {CENTER} from '../utils/position';
import {FleetSnapshot, fleetSnapshotOf, getFleetSnapshots, getLatestRapport, getRapport, getRapportsUpTo, listTours, saveRapport} from '../storage/rapportStore';

export type ImportResult = { tour: number; affiche: boolean };

// Les stats publiques changent à chaque tour mais le serveur n'envoie pas d'en-tête de cache :
// on force la revalidation (réponse 304 légère si rien n'a changé) pour ne pas afficher un tour périmé
const STATS_CACHE: RequestCache = 'no-cache';

type ReportContextType = {
    rapport?: Rapport;
    global?: GlobalData;
    loadRapportFile: (file: File) => Promise<ImportResult>;
    tours: number[]; // tours dont le rapport extrait est stocké, du plus ancien au plus récent
    getRapportForTour: (tour: number) => Promise<Rapport | undefined>;
    selectTour: (tour: number) => Promise<void>; // affiche la carte telle qu'elle était à ce tour
    fleetSnapshots: FleetSnapshot[]; // flottes détectées et zones observées, par tour stocké
    addDetectedSystemsFromText: (text: string) => { added: number; errors: { line: number; message: string }[] };
    ready: boolean;
    cellSize: number;
    setCellSize: (n: number) => void;
    center: XY | undefined;
    setCenter: (xy: XY) => void;
    viewportCols: number;
    viewportRows: number;
    setViewportDims: (cols: number, rows: number) => void;
    notes: Record<string, Note[]>;
    allTags: string[];
    selectedTags: string[];
    setSelectedTags: (tags: string[]) => void;
    addNote: (pos: XY, text: string, color: string, tag?: string) => void;
    deleteNote: (pos: XY, noteId: string) => void;
    zones: Zone[];
    zoneLabels: string[];
    hiddenZoneLabels: string[];
    setHiddenZoneLabels: (labels: string[]) => void;
    addZone: (zone: Omit<Zone, 'id'>) => void;
    deleteZone: (id: string) => void;
    updateZone: (id: string, changes: Partial<Omit<Zone, 'id'>>) => void;
    publicCombats: CombatEvent[];
    refreshStats: () => Promise<void>;
};

const ReportContext = createContext<ReportContextType | undefined>(undefined);

export function ReportProvider({children}: { children: React.ReactNode }) {
    const [rapport, setRapport] = useState<Rapport | undefined>(undefined);
    const [tours, setTours] = useState<number[]>([]);
    const [fleetSnapshots, setFleetSnapshots] = useState<FleetSnapshot[]>([]);
    // Tour du rapport affiché et plus récent tour connu, lisibles de façon synchrone pendant un import
    const displayedTourRef = useRef<number | undefined>(undefined);
    const latestTourRef = useRef<number | undefined>(undefined);
    // Évite qu'un changement de tour lent écrase un changement plus récent
    const selectRequestRef = useRef(0);
    const [global, setGlobal] = useState<GlobalData | undefined>(undefined);
    const [cellSize, setCellSize] = useState<number>(32);
    // Centre de la galaxie par défaut (sans rapport) ; remplacé par la capitale au chargement d'un rapport
    const [center, setCenter] = useState<XY | undefined>(CENTER);
    const [viewportCols, setViewportCols] = useState<number>(0);
    const [viewportRows, setViewportRows] = useState<number>(0);
    const [notes, setNotes] = useState<Record<string, Note[]>>({});
    const [selectedTags, setSelectedTags] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('carte_selected_tags');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    const [zones, setZones] = useState<Zone[]>(() => {
        try {
            const saved = localStorage.getItem('carte_zones');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    const [hiddenZoneLabels, setHiddenZoneLabels] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('carte_hidden_zone_labels');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    const [publicCombats, setPublicCombats] = useState<CombatEvent[]>([]);

    useEffect(() => {
        localStorage.setItem('carte_selected_tags', JSON.stringify(selectedTags));
    }, [selectedTags]);

    useEffect(() => {
        localStorage.setItem('carte_zones', JSON.stringify(zones));
    }, [zones]);

    useEffect(() => {
        localStorage.setItem('carte_hidden_zone_labels', JSON.stringify(hiddenZoneLabels));
    }, [hiddenZoneLabels]);

    const zoneLabels = useMemo(
        () => Array.from(new Set(zones.map(z => z.label).filter((l): l is string => !!l))).sort(),
        [zones]
    );

    const addZone = useCallback((zone: Omit<Zone, 'id'>) => {
        setZones(prev => [...prev, {...zone, id: Math.random().toString(36).substr(2, 9)}]);
    }, []);

    const updateZone = useCallback((id: string, changes: Partial<Omit<Zone, 'id'>>) => {
        setZones(prev => prev.map(z => z.id === id ? {...z, ...changes} : z));
    }, []);

    const deleteZone = useCallback((id: string) => {
        setZones(prev => prev.filter(z => z.id !== id));
    }, []);

    const allTags = useMemo(() => {
        const tags = new Set<string>();
        Object.values(notes).flat().forEach(note => {
            if (note.tag) tags.add(note.tag);
        });
        return Array.from(tags).sort();
    }, [notes]);

    const setViewportDims = useCallback((cols: number, rows: number) => {
        setViewportCols(cols);
        setViewportRows(rows);
    }, []);

    const mergeDetectedWithOwned = useCallback((r: Rapport): SystemeDetecte[] => {
        // Partir du cache (manuels + précédents), puis supprimer ceux devenus possédés
        const cache = getCachedDetectedSystems();
        const ownedKeys = new Set(r.systemesJoueur.map(s => `${s.pos.x}_${s.pos.y}`));
        return cache.filter(sd => !ownedKeys.has(`${sd.pos.x}_${sd.pos.y}`));
    }, []);

    const addNote = useCallback((pos: XY, text: string, color: string, tag?: string) => {
        const key = `${pos.x}_${pos.y}`;
        const newNote: Note = {
            id: Math.random().toString(36).substr(2, 9),
            text,
            tag,
            color,
            date: Date.now()
        };
        setNotes(prev => {
            const updated = {
                ...prev,
                [key]: [...(prev[key] || []), newNote]
            };
            localStorage.setItem('mapNotes', JSON.stringify(updated));
            return updated;
        });
    }, []);

    const deleteNote = useCallback((pos: XY, noteId: string) => {
        const key = `${pos.x}_${pos.y}`;
        setNotes(prev => {
            if (!prev[key]) return prev;
            const updated = {
                ...prev,
                [key]: prev[key].filter(n => n.id !== noteId)
            };
            if (updated[key].length === 0) {
                delete updated[key];
            }
            localStorage.setItem('mapNotes', JSON.stringify(updated));
            return updated;
        });
    }, []);

    const noteLatestTour = useCallback((tour: number) => {
        if (latestTourRef.current === undefined || tour > latestTourRef.current) latestTourRef.current = tour;
    }, []);

    // Affiche le rapport le plus récent : ses détections sont complétées par toutes celles connues (cache)
    const displayRapport = useCallback((r: Rapport, recenter = true) => {
        selectRequestRef.current += 1;
        displayedTourRef.current = r.tour;
        noteLatestTour(r.tour);
        setRapport({...r, systemesDetectes: mergeDetectedWithOwned(r)});
        if (recenter && r.joueur?.capitale) setCenter(r.joueur.capitale);
    }, [mergeDetectedWithOwned, noteLatestTour]);

    const selectTour = useCallback(async (tour: number) => {
        const request = ++selectRequestRef.current;
        try {
            if (tour === latestTourRef.current) {
                const r = await getRapport(tour);
                if (r && request === selectRequestRef.current) displayRapport(r, false);
                return;
            }
            // Tour passé : seules les détections connues à ce tour (rapports stockés jusqu'à lui), la plus récente par case
            const rapports = await getRapportsUpTo(tour);
            const r = rapports[rapports.length - 1];
            if (!r || r.tour !== tour || request !== selectRequestRef.current) return;
            const detected = new Map<string, SystemeDetecte>();
            rapports.forEach(rp => rp.systemesDetectes.forEach(sd => detected.set(`${sd.pos.x}_${sd.pos.y}`, sd)));
            const owned = new Set(r.systemesJoueur.map(s => `${s.pos.x}_${s.pos.y}`));
            displayedTourRef.current = tour;
            setRapport({...r, systemesDetectes: Array.from(detected.values()).filter(sd => !owned.has(`${sd.pos.x}_${sd.pos.y}`))});
        } catch (e) {
            console.warn('[rapports] impossible d\'afficher le tour', tour, e);
        }
    }, [displayRapport]);

    // Stocke le rapport extrait de son tour (avec ses seules détections) et met à jour la liste des tours
    const storeRapport = useCallback(async (r: Rapport) => {
        try {
            await saveRapport({...r, systemesDetectes: r.systemesDetectesDuTour});
            setFleetSnapshots(prev => [...prev.filter(f => f.tour !== r.tour), fleetSnapshotOf(r)]);
            const list = await listTours();
            setTours(list);
            if (list.length) noteLatestTour(list[list.length - 1]);
        } catch (e) {
            console.warn('[rapports] impossible de stocker le rapport du tour', r.tour, e);
        }
    }, [noteLatestTour]);

    const loadRapportFile = useCallback(async (file: File): Promise<ImportResult> => {
        const r = parseRapportXml(await file.text());
        const latest = latestTourRef.current; // avant l'enregistrement de ce rapport
        await storeRapport(r);
        // Seul le rapport le plus récent est affiché ; un tour plus ancien ne fait qu'enrichir l'historique
        if (latest === undefined || r.tour >= latest) {
            displayRapport(r);
            return {tour: r.tour, affiche: true};
        }
        // Si on regarde le dernier tour, il profite des systèmes détectés que lui seul ne connaissait pas
        if (displayedTourRef.current === latest) {
            setRapport(prev => prev ? {...prev, systemesDetectes: mergeDetectedWithOwned(prev)} : prev);
        }
        return {tour: r.tour, affiche: false};
    }, [storeRapport, displayRapport, mergeDetectedWithOwned]);

    const getRapportForTour = useCallback((tour: number) => getRapport(tour).catch(() => undefined), []);

    const addDetectedSystemsFromText = useCallback((text: string) => {
        const { systems, errors } = parseManualDetectedSystems(text);
        if (systems.length > 0) {
            // Saisie manuelle : on considère l'information comme datant du tour du rapport chargé
            addManualDetectedSystems(systems.map(s => ({...s, tour: rapport?.tour})));
            setRapport(prev => {
                if (!prev) return prev;
                // Mettre à jour la liste des systèmes détectés depuis le cache
                const updatedDetects = mergeDetectedWithOwned(prev);
                return { ...prev, systemesDetectes: updatedDetects };
            });
        }
        return { added: systems.length, errors };
    }, [mergeDetectedWithOwned, rapport?.tour]);

    const refreshStats = useCallback(async () => {
        try {
            const fetchWithTimeout = async (url: string, fallbackUrl?: string, ms = 5000) => {
                try {
                    const response = await fetch(url, { signal: AbortSignal.timeout(ms), cache: STATS_CACHE });
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return await response.text();
                } catch (error) {
                    // Si aucun fallback n'est fourni, on retourne une chaîne vide
                    if (!fallbackUrl) return '';

                    try {
                        const fallbackResponse = await fetch(fallbackUrl, { signal: AbortSignal.timeout(ms), cache: STATS_CACHE });
                        if (!fallbackResponse.ok) return '';
                        return await fallbackResponse.text();
                    } catch {
                        return '';
                    }
                }
            };

            const [dataTxt, combatsTxt] = await Promise.all([
                fetchWithTimeout(
                    `https://sheril.pbem-france.net/stats/data.xml`,
                    'https://ydomenjoud.github.io/test-interface-sheril/examples/data.xml'
                ),
                fetchWithTimeout('https://sheril.pbem-france.net/stats/combats.htm'),
            ]);
            if (dataTxt) {
                try {
                    const data = parseDataXml(dataTxt);
                    setGlobal(data);
                    const style = document.createElement("style");
                    style.innerHTML = data.races
                        .map(r => `.race${r.id} { color: ${r.couleur}; }`)
                        .join("\n");
                    document.head.appendChild(style);
                } catch {
                    // ignore parse errors
                }
            }
            if (combatsTxt) {
                try {
                    const parsed = parsePublicCombatsHtml(combatsTxt);
                    try {
                        // console.info(`[ReportContext] refreshStats -> parsed ${parsed.length} public combats`);
                        // if (parsed.length > 0) console.debug(parsed.slice(0, 5));
                    } catch (e) { /* ignore logging errors */ }
                    setPublicCombats(parsed);
                } catch {
                    // ignore
                }
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const txt = await fetch(`https://sheril.pbem-france.net/stats/data.xml`, { cache: STATS_CACHE }).then(r => r.text());
                if (!alive) return;
                const data = parseDataXml(txt);
                setGlobal(data);

                const style = document.createElement("style");
                style.innerHTML = data.races
                    .map(r => `.race${r.id} { color: ${r.couleur}; }`)
                    .join("\n");
                document.head.appendChild(style);

            } catch {
                // laisser global undefined
            }
            // }
        })();
        return () => {
            alive = false;
        };
    }, []);

    const normalizeName = useCallback((n?: string) => {
        if (!n) return '';
        return n.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    }, []);

    const resolveCombatPosFromGlobal = useCallback((ev: any, systems: {nom: string; pos: {x: number; y: number}}[]) => {
        if (!ev) return ev;
        if (ev.pos && ev.pos.x && ev.pos.y && (ev.pos.x !== 0 || ev.pos.y !== 0)) return ev;
        const name = ev.systemName || '';
        const n = normalizeName(name);
        if (!n) return ev;
        for (const s of systems) {
            if (!s || !s.nom) continue;
            if (normalizeName(s.nom) === n) {
                try {
                    // console.info(`[ReportContext] resolved public combat '${name}' -> ${s.pos.x}-${s.pos.y}`);
                } catch (e) {}
                return {...ev, pos: {x: s.pos.x, y: s.pos.y}};
            }
        }
        return ev;
    }, [normalizeName]);

    // Récupération des combats publics (page HTML) et parsing
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const txt = await fetch('https://sheril.pbem-france.net/stats/combats.htm', { cache: STATS_CACHE }).then(r => r.text());
                if (!alive) return;
                const parsed = parsePublicCombatsHtml(txt || '');
                try {
                    // console.info(`[ReportContext] fetched combats.htm -> parsed ${parsed.length} public combats`);
                    // if (parsed.length > 0) console.debug(parsed.slice(0, 5));
                } catch (e) { /* ignore logging errors */ }
                // try to resolve positions if global already present
                const resolved = (global && global.systemes && global.systemes.length > 0)
                    ? parsed.map(p => resolveCombatPosFromGlobal(p, global.systemes))
                    : parsed;
                setPublicCombats(resolved);
            } catch {
                // ignore errors silently
            }
        })();
        return () => { alive = false; };
    }, [global, resolveCombatPosFromGlobal]);

    // When global data becomes available, try to resolve any public combats positions
    useEffect(() => {
        if (!global || !global.systemes || global.systemes.length === 0) return;
        setPublicCombats(prev => prev.map(p => resolveCombatPosFromGlobal(p, global.systemes)));
    }, [global, resolveCombatPosFromGlobal]);

    // Au chargement, si un rapport a déjà été chargé auparavant, le recharger automatiquement
    useEffect(() => {
        try {
            const storedNotes = localStorage.getItem('mapNotes');
            if (storedNotes) {
                setNotes(JSON.parse(storedNotes));
            }

        } catch {
            // Si localStorage n'est pas accessible ou contenu invalide, ignorer
        }

        (async () => {
            // Migration : l'ancien stockage gardait le XML brut du dernier rapport dans le localStorage
            let legacy: Rapport | undefined;
            try {
                const xml = localStorage.getItem('rapportXml');
                if (xml) {
                    legacy = parseRapportXml(xml);
                    await saveRapport({...legacy, systemesDetectes: legacy.systemesDetectesDuTour});
                    localStorage.removeItem('rapportXml'); // seulement une fois le rapport extrait bien stocké
                }
            } catch (e) {
                console.warn('[rapports] migration du rapport XML impossible', e);
            }

            try {
                const list = await listTours();
                setTours(list);
                if (list.length) noteLatestTour(list[list.length - 1]);
                setFleetSnapshots(await getFleetSnapshots());
                const latest = await getLatestRapport();
                if (latest) displayRapport(latest);
                else if (legacy) displayRapport(legacy);
            } catch (e) {
                // IndexedDB indisponible : on affiche au moins le rapport de l'ancien stockage
                console.warn('[rapports] lecture des rapports stockés impossible', e);
                if (legacy) displayRapport(legacy);
            }
        })();
        // we only want this to run once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const value = useMemo<ReportContextType>(() => ({
        rapport,
        global,
        publicCombats,
        refreshStats,
        loadRapportFile,
        addDetectedSystemsFromText,
        ready: Boolean(global),
        tours,
        getRapportForTour,
        selectTour,
        fleetSnapshots,
        cellSize,
        setCellSize,
        center,
        setCenter,
        viewportCols,
        viewportRows,
        setViewportDims,
        notes,
        allTags,
        selectedTags,
        setSelectedTags,
        addNote,
        deleteNote,
        zones,
        zoneLabels,
        hiddenZoneLabels,
        setHiddenZoneLabels,
        addZone,
        deleteZone,
        updateZone,
    }), [rapport, global, tours, getRapportForTour, selectTour, fleetSnapshots, publicCombats, refreshStats, loadRapportFile, addDetectedSystemsFromText, cellSize, center, viewportCols, viewportRows, setViewportDims, notes, allTags, selectedTags, addNote, deleteNote, zones, zoneLabels, hiddenZoneLabels, addZone, deleteZone, updateZone]);

    return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
}

export function useReport() {
    const ctx = useContext(ReportContext);
    if (!ctx) throw new Error('useReport must be used within ReportProvider');
    return ctx;
}

import React, {createContext, useContext, useEffect, useMemo, useState, useCallback} from 'react';
import {GlobalData, Rapport, XY, SystemeDetecte, Note} from '../types';
import {parseRapportXml, addManualDetectedSystems, getCachedDetectedSystems} from '../parsers/parseRapport';
import {parseManualDetectedSystems} from '../parsers/parseManualSystems';
import {parseDataXml} from '../parsers/parseData';

type ReportContextType = {
    rapport?: Rapport;
    global?: GlobalData;
    loadRapportFile: (file: File) => Promise<void>;
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
    addNote: (pos: XY, text: string, color: string) => void;
    deleteNote: (pos: XY, noteId: string) => void;
};

const ReportContext = createContext<ReportContextType | undefined>(undefined);

export function ReportProvider({children}: { children: React.ReactNode }) {
    const [rapport, setRapport] = useState<Rapport | undefined>(undefined);
    const [global, setGlobal] = useState<GlobalData | undefined>(undefined);
    const [cellSize, setCellSize] = useState<number>(32);
    const [center, setCenter] = useState<XY | undefined>({x: 20, y: 20});
    const [viewportCols, setViewportCols] = useState<number>(0);
    const [viewportRows, setViewportRows] = useState<number>(0);
    const [notes, setNotes] = useState<Record<string, Note[]>>({});

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

    const addNote = useCallback((pos: XY, text: string, color: string) => {
        const key = `${pos.x}_${pos.y}`;
        const newNote: Note = {
            id: Math.random().toString(36).substr(2, 9),
            text,
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

    const loadRapportFile = useCallback(async (file: File) => {
        const text = await file.text();
        // Parse and apply the report
        const r = parseRapportXml(text);
        setRapport(r);
        if (!center && r.joueur.capitale) setCenter(r.joueur.capitale);
        // Persist the raw XML so it can be reloaded automatically later
        try {
            localStorage.setItem('rapportXml', text);
        } catch {
            // Storage might be unavailable (private mode/quota). Ignore silently.
        }
    }, [center]);

    const addDetectedSystemsFromText = useCallback((text: string) => {
        const { systems, errors } = parseManualDetectedSystems(text);
        if (systems.length > 0) {
            addManualDetectedSystems(systems);
            setRapport(prev => {
                if (!prev) return prev;
                // Mettre à jour la liste des systèmes détectés depuis le cache
                const updatedDetects = mergeDetectedWithOwned(prev);
                return { ...prev, systemesDetectes: updatedDetects };
            });
        }
        return { added: systems.length, errors };
    }, [mergeDetectedWithOwned]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const txt = await fetch(`https://sheril.pbem-france.net/stats/data.xml`).then(r => r.text());
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

    // Au chargement, si un rapport a déjà été chargé auparavant, le recharger automatiquement
    useEffect(() => {
        try {
            const storedNotes = localStorage.getItem('mapNotes');
            if (storedNotes) {
                setNotes(JSON.parse(storedNotes));
            }

            const stored = localStorage.getItem('rapportXml');
            if (stored) {
                const r = parseRapportXml(stored);
                // mettre à jour les détectés avec le cache courant
                const mergedDetected = mergeDetectedWithOwned(r);
                setRapport({ ...r, systemesDetectes: mergedDetected });
                if (!center && r.joueur.capitale) setCenter(r.joueur.capitale);
            }
        } catch {
            // Si localStorage n'est pas accessible ou contenu invalide, ignorer
        }
        // we only want this to run once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const value = useMemo<ReportContextType>(() => ({
        rapport,
        global,
        loadRapportFile,
        addDetectedSystemsFromText,
        ready: Boolean(global),
        cellSize,
        setCellSize,
        center,
        setCenter,
        viewportCols,
        viewportRows,
        setViewportDims,
        notes,
        addNote,
        deleteNote,
    }), [rapport, global, loadRapportFile, addDetectedSystemsFromText, cellSize, center, viewportCols, viewportRows, setViewportDims, notes, addNote, deleteNote]);

    return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
}

export function useReport() {
    const ctx = useContext(ReportContext);
    if (!ctx) throw new Error('useReport must be used within ReportProvider');
    return ctx;
}

import React, {createContext, useContext, useEffect, useMemo, useState, useCallback} from 'react';
import {GlobalData, Rapport, XY} from '../types';
import {parseRapportXml} from '../parsers/parseRapport';
import {parseDataXml} from '../parsers/parseData';

type ReportContextType = {
    rapport?: Rapport;
    global?: GlobalData;
    loadRapportFile: (file: File) => Promise<void>;
    ready: boolean;
    cellSize: number;
    setCellSize: (n: number) => void;
    center: XY | undefined;
    setCenter: (xy: XY) => void;
    viewportCols: number;
    viewportRows: number;
    setViewportDims: (cols: number, rows: number) => void;
};

const ReportContext = createContext<ReportContextType | undefined>(undefined);

export function ReportProvider({children}: { children: React.ReactNode }) {
    const [rapport, setRapport] = useState<Rapport | undefined>(undefined);
    const [global, setGlobal] = useState<GlobalData | undefined>(undefined);
    const [cellSize, setCellSize] = useState<number>(32);
    const [center, setCenter] = useState<XY | undefined>(undefined);
    const [viewportCols, setViewportCols] = useState<number>(0);
    const [viewportRows, setViewportRows] = useState<number>(0);

    const setViewportDims = useCallback((cols: number, rows: number) => {
        setViewportCols(cols);
        setViewportRows(rows);
    }, []);

    const loadRapportFile = useCallback(async (file: File) => {
        const text = await file.text();
        const r = parseRapportXml(text);
        setRapport(r);
        if (!center && r.joueur.capitale) setCenter(r.joueur.capitale);
    }, [center]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const txt = await fetch(`${process.env.PUBLIC_URL}/examples/data.xml`).then(r => r.text());
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

    const value = useMemo<ReportContextType>(() => ({
        rapport,
        global,
        loadRapportFile,
        ready: Boolean(rapport && global),
        cellSize,
        setCellSize,
        center,
        setCenter,
        viewportCols,
        viewportRows,
        setViewportDims,
    }), [rapport, global, loadRapportFile, cellSize, center, viewportCols, viewportRows, setViewportDims]);

    return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
}

export function useReport() {
    const ctx = useContext(ReportContext);
    if (!ctx) throw new Error('useReport must be used within ReportProvider');
    return ctx;
}

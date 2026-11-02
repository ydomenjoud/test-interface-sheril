// Palette de la carte : fond sombre (par défaut) ou fond clair (impression, lecture en plein jour).
// Seul le dessin de la carte (canvas et mini-carte) change ; les panneaux gardent le thème de l'application.

export type MapThemeName = 'sombre' | 'clair';

export type MapTheme = {
    name: MapThemeName;
    background: string;
    gridMajor20: string;
    gridMajor5: string;
    gridMinor: string;
    headerBg: string;
    headerText: string;
    headerTick: string;
    headerSelectedBg: string;
    headerSelectedText: string;
    axisLabel: string;
    sectorLabel: string;
    /** Multiplicateur de l'opacité des zones d'influence (un aplat léger se voit moins sur blanc) */
    influenceBoost: number;
    /** Frontière entre deux zones d'influence / de présence */
    influenceBorder: string;
    /** Hachures des systèmes jamais observés */
    unknownCell: string;
    /** Systèmes connus seulement par la carte galactique */
    globalOnlySystem: string;
    /** Pourcentage passé à lightenHexColor pour le liseré des systèmes (négatif = assombrir) */
    systemRingLighten: number;
    scanFill: string;
    scanStroke: string;
    stabilityNeutral: string;
    zoneDraftFill: string;
    zoneDraftStroke: string;
    /** Contour du disque blanc des flottes (invisible sur fond blanc sans lui) */
    fleetOutline: string;
    selectionStroke: string;
    /** Équerres de la case sélectionnée et contour de survol */
    cellCorner: string;
    hoverStroke: string;
    miniMapBackground: string;
};

export const MAP_THEMES: Record<MapThemeName, MapTheme> = {
    sombre: {
        name: 'sombre',
        background: '#000',
        gridMajor20: '#274058',
        gridMajor5: '#1e2a38',
        gridMinor: 'rgba(30, 41, 59, 0.55)',
        headerBg: '#141c28',
        headerText: '#7d8ba0',
        headerTick: '#3b475a',
        headerSelectedBg: '#38bdf8',
        headerSelectedText: '#0b0f17',
        axisLabel: '#5b6b80',
        sectorLabel: 'rgba(235, 240, 255, 0.32)',
        influenceBoost: 1,
        influenceBorder: 'rgba(255, 255, 255, 0.7)',
        unknownCell: 'rgba(148, 163, 184, 0.3)',
        globalOnlySystem: '#333',
        systemRingLighten: 100,
        scanFill: 'rgba(56, 150, 255, 0.07)',
        scanStroke: 'rgba(56, 150, 255, 0.35)',
        stabilityNeutral: 'rgba(255, 255, 255, 0.3)',
        zoneDraftFill: 'rgba(255, 255, 255, 0.15)',
        zoneDraftStroke: '#fff',
        fleetOutline: 'rgba(0, 0, 0, 0)',
        selectionStroke: '#38bdf8',
        cellCorner: '#ffffff',
        hoverStroke: 'rgba(255, 255, 255, 0.85)',
        miniMapBackground: '#0b0f17',
    },
    clair: {
        name: 'clair',
        background: '#ffffff',
        gridMajor20: '#94a3b8',
        gridMajor5: '#cbd5e1',
        gridMinor: 'rgba(203, 213, 225, 0.6)',
        headerBg: '#f1f5f9',
        headerText: '#475569',
        headerTick: '#94a3b8',
        headerSelectedBg: '#0284c7',
        headerSelectedText: '#ffffff',
        axisLabel: '#64748b',
        sectorLabel: 'rgba(15, 23, 42, 0.18)',
        influenceBoost: 1.8,
        influenceBorder: 'rgba(15, 23, 42, 0.55)',
        unknownCell: 'rgba(71, 85, 105, 0.35)',
        globalOnlySystem: '#cbd5e1',
        systemRingLighten: -45,
        scanFill: 'rgba(2, 132, 199, 0.06)',
        scanStroke: 'rgba(2, 132, 199, 0.45)',
        stabilityNeutral: 'rgba(15, 23, 42, 0.35)',
        zoneDraftFill: 'rgba(15, 23, 42, 0.08)',
        zoneDraftStroke: '#0f172a',
        fleetOutline: 'rgba(15, 23, 42, 0.6)',
        selectionStroke: '#0284c7',
        cellCorner: '#0f172a',
        hoverStroke: 'rgba(15, 23, 42, 0.8)',
        miniMapBackground: '#f8fafc',
    },
};

// Couleurs trop pâles pour un fond blanc, remplacées par une teinte plus soutenue
const SUR_FOND_CLAIR: Record<string, string> = {
    '#fde047': '#ca8a04', // PNA (jaune)
    '#94a3b8': '#64748b', // neutre
    '#10b981': '#059669', // moi
    '#fb923c': '#ea580c', // propriétaires mixtes
    '#ffcc00': '#d4a000', // race jaune
    '#777777': '#6b7280',
};

/**
 * Adapte une couleur de propriétaire au thème : inchangée sur fond sombre ; sur fond clair, les
 * teintes pâles sont assombries (table ci-dessus, et luminosité HSL ramenée à 30-42 %).
 */
export function adaptColorToTheme(color: string | undefined, theme: MapTheme): string | undefined {
    if (!color || theme.name === 'sombre') return color;
    const fixe = SUR_FOND_CLAIR[color.toLowerCase()];
    if (fixe) return fixe;
    const hsl = color.match(/^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i);
    if (hsl) {
        const l = Number(hsl[3]);
        return `hsl(${hsl[1]}, ${hsl[2]}%, ${l >= 55 ? 42 : 30}%)`;
    }
    return color;
}

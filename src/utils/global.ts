// Helpers affichage niveau en chiffres romains (niv est 0-based)
import {Technologie} from "../types";

export function toRoman(n: number): string {
    const romans = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    const idx = n + 1;
    if (idx <= 0) return romans[0];
    if (idx >= romans.length) return romans[romans.length - 1];
    return romans[idx];
}

export function romanFromNiv(niv?: number): string {
    // niv 0 => 1 => I, niv 4 => 5 => V ; cap à X
    const lvl = Math.max(0, Math.min(10, ((niv ?? 0))));
    return toRoman(lvl);
}
export function formatTechName(t?: Technologie): string {
    if (!t) return '';
    return `${t.nom} ${romanFromNiv(t.niv)}`;
}

export function formatPlannedItems(items: { type: 'building' | 'ship', code: string, quantity: number }[], technologies: Technologie[], plansVaisseaux?: any[]) {
    const buildingStats: Record<string, { nivs: Record<number, { qty: number, unitCost: any }>, totalCost: any }> = {};
    const shipStats: Record<string, { qty: number, unitCost: any, totalCost: any }> = {};

    const getBuildingCost = (code: string) => {
        const tech = technologies.find(t => t.code === code);
        if (!tech) return null;
        return {
            pdc: tech.specification?.case || tech.specification?.pc || 0,
            minerai: tech.specification?.min || 0,
            prix: tech.specification?.prix || 0,
            marchandises: tech.marchandises || []
        };
    };

    const getShipCost = (name: string) => {
        const p = plansVaisseaux?.find(x => x.nom === name);
        if (!p) return null;
        const merchCosts: { code: number; nb: number }[] = [];
        p.composants.forEach((c: any) => {
            const tech = technologies.find(t => t.code === c.code);
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
            pdc: p.pc || 0,
            minerai: p.minerai || 0,
            prix: p.prix || 0,
            marchandises: merchCosts
        };
    };

    const addCosts = (target: any, source: any, qty: number) => {
        target.pdc += source.pdc * qty;
        target.minerai += source.minerai * qty;
        target.prix += (source.prix || 0) * qty;
        source.marchandises.forEach((m: any) => {
            const existing = target.marchandises.find((x: any) => x.code === m.code);
            if (existing) {
                existing.nb += m.nb * qty;
            } else {
                target.marchandises.push({ code: m.code, nb: m.nb * qty });
            }
        });
    };

    const totalGlobalCost = { pdc: 0, minerai: 0, prix: 0, marchandises: [] as { code: number, nb: number }[] };

    items.forEach(item => {
        if (item.type === 'building') {
            const tech = technologies.find(t => t.code === item.code);
            if (tech) {
                const cost = getBuildingCost(item.code);
                if (!buildingStats[tech.nom]) {
                    buildingStats[tech.nom] = { nivs: {}, totalCost: { pdc: 0, minerai: 0, prix: 0, marchandises: [] } };
                }
                if (!buildingStats[tech.nom].nivs[tech.niv]) {
                    buildingStats[tech.nom].nivs[tech.niv] = { qty: 0, unitCost: cost };
                }
                buildingStats[tech.nom].nivs[tech.niv].qty += item.quantity;
                addCosts(buildingStats[tech.nom].totalCost, cost, item.quantity);
                addCosts(totalGlobalCost, cost, item.quantity);
            }
        } else {
            const cost = getShipCost(item.code);
            if (!shipStats[item.code]) {
                shipStats[item.code] = { qty: 0, unitCost: cost, totalCost: { pdc: 0, minerai: 0, prix: 0, marchandises: [] } };
            }
            shipStats[item.code].qty += item.quantity;
            if (cost) {
                addCosts(shipStats[item.code].totalCost, cost, item.quantity);
                addCosts(totalGlobalCost, cost, item.quantity);
            }
        }
    });

    const buildings = Object.keys(buildingStats).sort().map(name => ({
        name,
        types: Object.entries(buildingStats[name].nivs)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([niv, data]) => ({ niv: Number(niv), qty: data.qty, unitCost: data.unitCost })),
        totalCost: buildingStats[name].totalCost
    }));

    const ships = Object.entries(shipStats)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, data]) => ({ name, qty: data.qty, unitCost: data.unitCost, totalCost: data.totalCost }));

    const totalBuildings = buildings.reduce((acc, b) => acc + b.types.reduce((sum, t) => sum + t.qty, 0), 0);
    const totalShips = ships.reduce((acc, s) => acc + s.qty, 0);

    const formatCost = (cost: any) => {
        if (!cost) return '';
        const parts = [];
        if (cost.prix > 0) parts.push(`${cost.prix.toLocaleString()} ce`);
        if (cost.pdc > 0) parts.push(`${cost.pdc} pdc`);
        if (cost.minerai > 0) parts.push(`${cost.minerai} min`);
        if (cost.marchandises && cost.marchandises.length > 0) {
            cost.marchandises.forEach((m: any) => {
                parts.push(`${m.nb} m${m.code}`);
            });
        }
        return parts.length > 0 ? `(${parts.join(', ')})` : '';
    };

    const formattedBuildings = buildings.map(b => {
        const typesStr = b.types.map(t => `${t.qty} type ${toRoman(t.niv)} ${formatCost(t.unitCost)}`).join(', ');
        return `${b.name} : ${typesStr}`;
    });

    const formattedShips = ships.map(s => `${s.name} : ${s.qty} ${formatCost(s.unitCost)}`);

    return {
        buildings,
        ships,
        totalBuildings,
        totalShips,
        formattedBuildings,
        formattedShips,
        totalGlobalCost
    };
}

export function encodeBluePrint(entries:  {code: string, qty: number}[]) {
   return btoa(entries.map(e => `${e.code}:${e.qty}`).join('%'));
}

/**
 * Éclaircit une couleur hexadécimale d'un pourcentage donné.
 * @param {string} hex - Le code couleur hexadécimal (ex: '#99fa78').
 * @param {number} percent - Le pourcentage d'éclaircissement (ex: 20 pour 20%).
 * @returns {string} Le nouveau code couleur hexadécimal éclairci.
 */
export function lightenHexColor(hex: string, percent: number) {
    // 1. Nettoyer et valider le format hex
    let color = hex.startsWith('#') ? hex.slice(1) : hex;

    // Assurer que l'entrée est au format RRGGBB ou RRRRGGGGBBBB (inhabituel)
    if (color.length !== 6) {
        // Gérer les formats courts (3 caractères) ou invalides
        if (color.length === 3) {
            color = color.split('').map(c => c + c).join('');
        } else {
            // Fallback ou erreur pour les cas non standard
            // console.error(`Format hex invalide. ${hex}`);
            return hex;
        }
    }

    const factor = 1 + percent / 100;
    let newColor = '#';

    // 2. Traiter chaque composante RVB
    for (let i = 0; i < 3; i++) {
        // Extraire la composante (ex: '99' pour le Rouge)
        let compHex = color.substring(i * 2, i * 2 + 2);

        // Convertir en décimal (0-255)
        let compDec = parseInt(compHex, 16);

        // Appliquer l'éclaircissement et s'assurer de ne pas dépasser 255
        let compLightened = Math.min(255, Math.floor(compDec * factor));

        // Reconvertir en hexadécimal (doit avoir deux chiffres)
        let compNewHex = compLightened.toString(16);

        // Ajouter un '0' devant si nécessaire (ex: 10 en hex est 'a', on veut '0a')
        newColor += compNewHex.length === 1 ? '0' + compNewHex : compNewHex;
    }

    return newColor;
}

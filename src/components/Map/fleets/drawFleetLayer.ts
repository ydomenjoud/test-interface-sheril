import {FleetCellSummary, FleetFormation, formationShortLabel} from '../../../utils/fleetModel';
import {FleetLayoutItem, FleetRect, layoutFleetCell} from '../../../utils/fleetLayout';
import {getTorusDistance} from '../../../utils/position';
import {XY} from '../../../types';

export type FleetDrawOptions = {
    focus: boolean;
    getOwnerColor: (owner: number) => string;
    isOwnerSelected?: (owner: number) => boolean;
    hasOwnerFilter?: boolean;
    deplacements?: Record<number, XY>;
};

function roundedRect(ctx: CanvasRenderingContext2D, rect: FleetRect, radius: number): void {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
    else ctx.rect(rect.x, rect.y, rect.width, rect.height);
}

// L'emblème désigne une flotte, jamais une classe ou un nombre réel de vaisseaux.
export function drawFleetGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 24, size / 24);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(12, 1); ctx.lineTo(15, 9); ctx.lineTo(15, 19); ctx.lineTo(12, 17);
    ctx.lineTo(9, 19); ctx.lineTo(9, 9); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4, 9); ctx.lineTo(6, 15); ctx.lineTo(6, 22); ctx.lineTo(4, 20);
    ctx.lineTo(2, 22); ctx.lineTo(2, 15); ctx.closePath();
    ctx.moveTo(20, 9); ctx.lineTo(22, 15); ctx.lineTo(22, 22); ctx.lineTo(20, 20);
    ctx.lineTo(18, 22); ctx.lineTo(18, 15); ctx.closePath(); ctx.fill();
    ctx.restore();
}

function fittedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, align: CanvasTextAlign = 'left'): void {
    if (maxWidth < 5) return;
    let fitted = text;
    while (fitted.length && ctx.measureText(fitted).width > maxWidth) fitted = fitted.slice(0, -1);
    if (fitted !== text && fitted.length > 1) fitted = `${fitted.slice(0, -1)}…`;
    ctx.textAlign = align;
    ctx.fillText(fitted, x, y);
}

const fleetCountLabel = (count: number) => `×${count > 999 ? '999+' : count}`;

function formationColor(formation: FleetFormation, options: FleetDrawOptions): string {
    return options.isOwnerSelected?.(formation.owner) === false ? '#64748b' : options.getOwnerColor(formation.owner);
}

function drawFormation(ctx: CanvasRenderingContext2D, rect: FleetRect, item: Extract<FleetLayoutItem, {kind: 'formation'}>, options: FleetDrawOptions): void {
    const f = item.formation;
    const color = formationColor(f, options);
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const label = formationShortLabel(f);
    const count = fleetCountLabel(f.count);
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    if (item.variant === 'row') {
        // Pas de pictogramme en ligne : le numéro, la lettre et le compteur tiennent sur 14 px.
        ctx.font = '600 9px system-ui, sans-serif';
        const countWidth = Math.min(rect.width * 0.5, ctx.measureText(count).width);
        // Notre formation n'a pas de libellé : couleur et position (triée en tête) suffisent.
        const ownerLabel = f.own ? '' : `#${f.owner}`;
        const ownerWidth = ownerLabel ? Math.min(ctx.measureText(ownerLabel).width, 25) : 0;
        const textX = rect.x + 4;
        if (ownerLabel) fittedText(ctx, ownerLabel, textX, cy, ownerWidth);
        const middleX = textX + ownerWidth + (ownerLabel ? 2 : 0);
        const strengthWidth = rect.x + rect.width - countWidth - 6 - middleX;
        if (ctx.measureText(label).width <= strengthWidth) fittedText(ctx, label, middleX, cy, strengthWidth);
        ctx.fillStyle = '#e2e8f0';
        fittedText(ctx, count, rect.x + rect.width - 4, cy, countWidth, 'right');
    } else if (item.variant === 'micro') {
        // Sous 24 px : la catégorie seule, sans pictogramme ni compteur concurrent.
        // La lettre doit tenir ENTIÈRE dans la boîte : on réduit la fonte d'abord, on ne
        // tronque qu'en dernier recours (« TG » ne doit pas devenir « T »).
        const maxWidth = Math.max(1, rect.width - 2);
        let fontSize = Math.max(5, Math.min(11, Math.floor(rect.height * 0.65)));
        ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
        while (fontSize > 5 && ctx.measureText(label).width > maxWidth) {
            fontSize -= 1;
            ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
        }
        let fitted = label;
        while (fitted.length > 1 && ctx.measureText(fitted).width > maxWidth) fitted = fitted.slice(0, -1);
        // Centre OPTIQUE des majuscules : « middle » n'est pas un vrai centrage, la ligne
        // alphabétique à demi-hauteur de casse (0.35 em) le est, arrondie au pixel.
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(fitted, cx, Math.round(cy + fontSize * 0.35));
    } else if (item.variant === 'emblem') {
        // La lettre est le signal principal : toujours visible, le compteur n'est ajouté
        // qu'à sa droite s'il y tient (jamais l'inverse).
        // L'emblème grandit PROPORTIONNELLEMENT de la boîte 24 px (10 px) vers la carte
        // 64 px (22 px) : une seule échelle continue, le bloc [emblème + ligne] reste
        // centré dans la boîte, et la ligne est centrée ENSEMBLE ([lettre + compteur]).
        const glyphSize = rect.height < 24 ? 10 : Math.max(10, Math.min(22, Math.round((rect.height * 22) / 64)));
        const lineH = 9;
        const glyphTop = rect.height < 24
            ? rect.y + 1 // boîte serrée 20–22 px : le bloc la remplit (rendu 24 px, jugé lisible)
            : rect.y + Math.max(1, (rect.height - (glyphSize + 2 + lineH)) / 2);
        const labelY = rect.height < 24 ? rect.y + rect.height - 4 : glyphTop + glyphSize + 2 + lineH / 2;
        drawFleetGlyph(ctx, cx - glyphSize / 2, glyphTop, glyphSize, color);
        ctx.font = '700 8px system-ui, sans-serif';
        const labelW = ctx.measureText(label).width;
        const countW = Math.min(rect.width * 0.5, ctx.measureText(count).width);
        const gap = 4;
        if (f.count > 1 && labelW + gap + countW <= rect.width - 2) {
            const startX = cx - (labelW + gap + countW) / 2;
            ctx.textAlign = 'left';
            ctx.fillText(label, startX, labelY);
            ctx.fillStyle = '#e2e8f0';
            ctx.fillText(count, startX + labelW + gap, labelY);
        } else {
            fittedText(ctx, label, cx, labelY, rect.width - 2, 'center');
        }
    } else {
        // detail (≥ 64 px, tous modes) : grand emblème, numéro du commandant s'il n'est pas
        // le nôtre, lettre et compteur en pied.
        const glyph = 22;
        drawFleetGlyph(ctx, cx - glyph / 2, rect.y + 10, glyph, color);
        ctx.font = '600 8px system-ui, sans-serif';
        if (!f.own) fittedText(ctx, `#${f.owner}`, rect.x + 4, rect.y + 6, rect.width - 8);
        ctx.font = '700 10px system-ui, sans-serif';
        const countWidth = Math.min(rect.width * 0.65, ctx.measureText(count).width);
        const strengthWidth = rect.width - countWidth - 7;
        const labelY = rect.y + rect.height - 6;
        if (ctx.measureText(label).width <= strengthWidth) {
            fittedText(ctx, label, rect.x + 3, labelY, strengthWidth);
            ctx.fillStyle = '#e2e8f0';
            fittedText(ctx, count, rect.x + rect.width - 3, labelY, countWidth, 'right');
        } else {
            ctx.fillStyle = '#e2e8f0';
            fittedText(ctx, count, cx, labelY, rect.width - 6, 'center');
        }
    }
    // Indicateur d'ordre intégré à l'empreinte, sans remplacer la couleur du propriétaire.
    const pending = f.fleets.filter(fleet => fleet.type === 'joueur' && options.deplacements?.[fleet.num]);
    if (pending.length) {
        const tooFar = pending.some(fleet => fleet.type === 'joueur' &&
            getTorusDistance(fleet.pos, options.deplacements![fleet.num]) > fleet.vitesse);
        ctx.fillStyle = tooFar ? '#ef4444' : '#10b981';
        ctx.fillRect(rect.x + 1, rect.y + 2, 2, Math.max(2, rect.height - 4));
    }
}

function drawContact(ctx: CanvasRenderingContext2D, rect: FleetRect, item: Exclude<FleetLayoutItem, {kind: 'formation'}>, options: FleetDrawOptions): void {
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e2e8f0';
    const cx = rect.x + rect.width / 2;
    if (item.kind === 'overflow') {
        ctx.font = '600 8px system-ui, sans-serif';
        fittedText(ctx, `+${item.formations.length} cdt`, cx, rect.y + rect.height / 2, rect.width - 4, 'center');
        return;
    }
    if (rect.height < 13) {
        // À l'échelle miniature : signal distinct de pluralité, détail exact dans l'inspection.
        ctx.fillRect(rect.x + 1, rect.y + 1, Math.max(1, rect.width - 3), 1);
        ctx.fillRect(rect.x + 2, rect.y + 3, Math.max(1, rect.width - 3), 1);
        return;
    }
    ctx.font = '700 9px system-ui, sans-serif';
    const owners = item.formations.length;
    const ownerPrefix = owners > 99 ? '99+' : String(owners);
    const fullLabel = `${ownerPrefix}cdt`;
    // Le libellé complet d'abord ; la forme courte est l'unique repli, jamais un seuil de pixels.
    const ownerLabel = ctx.measureText(fullLabel).width <= rect.width - 4 ? fullLabel : `${ownerPrefix}c`;
    fittedText(ctx, ownerLabel, cx, rect.y + rect.height * 0.33, rect.width - 4, 'center');
    if (rect.height >= 26) {
        // Mème couleur que le libellé de commandants : un seul gris pour les comptes.
        ctx.font = '600 8px system-ui, sans-serif';
        fittedText(ctx, fleetCountLabel(item.formations.reduce((n, f) => n + f.count, 0)), cx, rect.y + rect.height * 0.68, rect.width - 4, 'center');
    }
    const shown = item.formations.slice(0, 5);
    const width = rect.width - 6;
    const step = width / shown.length;
    shown.forEach((f, i) => {
        ctx.fillStyle = formationColor(f, options);
        ctx.fillRect(rect.x + 3 + i * step, rect.y + rect.height - 5, Math.max(1, step - 1), 2);
    });
}

/** Tous les fonds sont opaques et chaque item possède son propre clip. */
export function drawFleetCell(ctx: CanvasRenderingContext2D, summary: FleetCellSummary, x: number, y: number, cellSize: number, options: FleetDrawOptions): FleetLayoutItem[] {
    const layout = layoutFleetCell(summary, cellSize);
    layout.forEach(item => {
        const rect = {...item.rect, x: item.rect.x + x, y: item.rect.y + y};
        const formations = item.kind === 'formation' ? [item.formation] : item.formations;
        const selected = !!options.hasOwnerFilter && formations.some(f => options.isOwnerSelected?.(f.owner));
        const color = item.kind === 'formation' ? formationColor(item.formation, options) : '#94a3b8';
        ctx.save();
        ctx.beginPath(); ctx.rect(rect.x - 0.5, rect.y - 0.5, rect.width + 1, rect.height + 1); ctx.clip();
        ctx.globalAlpha = 1;
        ctx.filter = 'none';
        roundedRect(ctx, rect, Math.min(item.kind === 'formation' && (item.variant === 'emblem' || item.variant === 'detail') ? 6 : 3, rect.height / 3));
        ctx.fillStyle = options.focus ? '#0b1522' : '#111d2c';
        ctx.fill();
        ctx.strokeStyle = selected ? '#f8fafc' : color;
        ctx.lineWidth = selected ? 1.5 : 1;
        ctx.setLineDash(formations.some(f => f.unknownCount > 0) ? [2, 2] : []);
        ctx.stroke();
        ctx.setLineDash([]);
        if (item.kind === 'formation') drawFormation(ctx, rect, item, options);
        else drawContact(ctx, rect, item, options);
        ctx.restore();
    });
    return layout;
}

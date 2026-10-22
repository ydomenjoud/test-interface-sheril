/**
 * Marqueurs de combat sur la carte — coin HAUT-DROIT de la case, au-dessus de toutes les
 * couches persistantes (jamais masqués par les badges de flottes).
 */

const SPATIAL_COLOR = '#ff6b1a';
const PLANETARY_COLOR = '#c77dff';
const HALO_COLOR = 'rgba(255, 255, 255, 0.95)';

// On passe maintenant cellSize pour adapter les bordures et les ombres au zoom
function drawIconHalo(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, cellSize: number) {
    const borderThickness = Math.max(0.5, cellSize * 0.05); // Épaisseur adaptative (ex: 2px pour une case de 40px)
    const offset = borderThickness;

    ctx.fillStyle = HALO_COLOR;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.lineWidth = borderThickness;
    ctx.beginPath();
    
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x - offset, y - offset, sz + (offset * 2), sz + (offset * 2), Math.max(1, sz * 0.2));
    } else {
        ctx.rect(x - offset, y - offset, sz + (offset * 2), sz + (offset * 2));
    }
    ctx.fill();
    ctx.stroke();
}

function drawCountBadge(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    sz: number,
    color: string,
    count: number,
    cellSize: number,
) {
    drawIconHalo(ctx, x, y, sz, cellSize);
    ctx.fillStyle = color;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, sz, sz, Math.max(1, sz * 0.15));
    } else {
        ctx.rect(x, y, sz, sz);
    }
    ctx.fill();

    ctx.fillStyle = '#fff';
    // Suppression du Math.max(10, ...) pour laisser le texte rétrécir sous les 10px si nécessaire
    ctx.font = `bold ${Math.floor(sz * 0.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(count), x + sz / 2, y + sz / 2);
}

/** Losange orange + « S » = combat spatial (coin haut-droit, sous le planétaire). */
function drawSpatialIcon(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, cellSize: number) {
    drawIconHalo(ctx, x, y, sz, cellSize);
    const cx = x + sz / 2;
    const cy = y + sz / 2;
    const h = sz / 2 - Math.max(0.5, cellSize * 0.05);
    ctx.fillStyle = SPATIAL_COLOR;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h);
    ctx.lineTo(cx + h, cy);
    ctx.lineTo(cx, cy + h);
    ctx.lineTo(cx - h, cy);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(sz * 0.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', cx, cy + (sz * 0.03)); // Décalage vertical léger et proportionnel
}

/** Cercle violet + « P » = combat planétaire (coin haut-droit). */
function drawPlanetaryIcon(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number, cellSize: number) {
    drawIconHalo(ctx, x, y, sz, cellSize);
    const cx = x + sz / 2;
    const cy = y + sz / 2;
    const r = sz / 2 - Math.max(0.5, cellSize * 0.05);
    ctx.fillStyle = PLANETARY_COLOR;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(sz * 0.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', cx, cy + (sz * 0.03));
}

export function drawCombatMarkers(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    cellSize: number,
    spatialCount: number,
    planetaryCount: number,
) {
    if (spatialCount <= 0 && planetaryCount <= 0) return;

    // Icône proportionnelle (0.38 de la case, sans plancher : elle suit le zoom)
    // et marge de 5 % de la case.
    const sz = Math.floor(cellSize * 0.38);
    const pad = Math.max(1, Math.floor(cellSize * 0.05));

    // Pile verticale en haut à droite : le planétaire d'abord, le spatial juste dessous.
    const bx = px + cellSize - sz - pad;
    let by = py + pad;
    if (planetaryCount > 0) {
        if (planetaryCount === 1) {
            drawPlanetaryIcon(ctx, bx, by, sz, cellSize);
        } else {
            drawCountBadge(ctx, bx, by, sz, PLANETARY_COLOR, planetaryCount, cellSize);
        }
        by += sz + pad;
    }

    if (spatialCount > 0) {
        if (spatialCount === 1) {
            drawSpatialIcon(ctx, bx, by, sz, cellSize);
        } else {
            drawCountBadge(ctx, bx, by, sz, SPATIAL_COLOR, spatialCount, cellSize);
        }
    }
}
/** Marqueurs de combat sur la carte — dessinés au-dessus des systèmes. */

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

/** Losange orange + « S » = combat spatial (coin bas-gauche). */
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

/** Cercle violet + « P » = combat planétaire (coin haut-gauche). */
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

    // --- MODIFICATIONS CLÉS ICI ---
    // 1. Suppression du Math.max(16, ...) pour que l'icône puisse devenir plus petite que 16px.
    // 2. Réduction du ratio à 0.38 (au lieu de 0.44) pour éviter que les deux icônes ne se marchent dessus si cellSize est très petit.
    const sz = Math.floor(cellSize * 0.38); 
    
    // 3. Marge proportionnelle à la taille de la case (5% de la case) au lieu d'un '2' fixe.
    const pad = Math.max(1, Math.floor(cellSize * 0.05));

    if (planetaryCount > 0) {
        const bx = px + pad;
        const by = py + pad;
        if (planetaryCount === 1) {
            drawPlanetaryIcon(ctx, bx, by, sz, cellSize);
        } else {
            drawCountBadge(ctx, bx, by, sz, PLANETARY_COLOR, planetaryCount, cellSize);
        }
    }

    if (spatialCount > 0) {
        const bx = px + pad;
        const by = py + cellSize - sz - pad;
        if (spatialCount === 1) {
            drawSpatialIcon(ctx, bx, by, sz, cellSize);
        } else {
            drawCountBadge(ctx, bx, by, sz, SPATIAL_COLOR, spatialCount, cellSize);
        }
    }
}
import {CombatEvent, CombatKind, XY} from '../types';

export type RawMessage = {
    type: string;
    text: string;
    html: string;
    index: number;
};

const POS_RE = /(\d+)-(\d+)\s+s\(\d+\)/;

export function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

export function stripHtml(html: string): string {
    return decodeHtmlEntities(html)
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Texte lisible à partir d'un message XML (HTML imbriqué ou entités). */
export function messageToPlain(htmlOrText: string): string {
    if (!htmlOrText) return '';
    const decoded = decodeHtmlEntities(htmlOrText);
    if (decoded.includes('<')) {
        if (typeof document !== 'undefined') {
            const wrap = document.createElement('div');
            wrap.innerHTML = decoded;
            const text = wrap.textContent || wrap.innerText || '';
            if (text.trim()) {
                return text.replace(/\s+/g, ' ').trim();
            }
        }
        return stripHtml(decoded);
    }
    return decoded.replace(/\s+/g, ' ').trim();
}

export function isCombatTableHtml(html: string): boolean {
    return /<table/i.test(html);
}

export function formatCombatDetailText(block: { plain: string; html: string }): string {
    const fromPlain = messageToPlain(block.plain);
    if (fromPlain) return fromPlain;
    return messageToPlain(block.html);
}

function buildCombatSummary(event: Omit<CombatEvent, 'id' | 'details'>): string {
    const pos = `${event.pos.x}-${event.pos.y}`;
    if (event.kind === 'planetary') {
        const captured = event.planetsCaptured != null
            ? ` — ${event.planetsCaptured} planète(s) prise(s)`
            : '';
        return `${event.playerFleet || 'Votre flotte'} vs planètes de ${event.systemName || 'système'} (${pos})${captured}`;
    }
    const enemy = [event.enemyFleet, event.enemyCommander].filter(Boolean).join(', ');
    return `${event.playerFleet || 'Votre flotte'} vs ${enemy || 'adversaire'} à ${event.systemName || pos} (${pos})`;
}

function extractPos(text: string): XY | undefined {
    const m = text.match(POS_RE);
    if (!m) return undefined;
    return {x: parseInt(m[1], 10), y: parseInt(m[2], 10)};
}

function isCombatDetail(plain: string, html: string): boolean {
    if (/^Suite au\s+\d+\s+dommage/i.test(plain)) return true;
    if (/^La flotte ennemie/i.test(plain)) return true;
    if (/^Résultat du combat/i.test(plain)) return true;
    if (/<table/i.test(html)) return true;
    if (/d[ée]tail du combat/i.test(plain)) return true;
    return false;
}

function parseCombatHeader(plain: string): Omit<CombatEvent, 'id' | 'details'> | null {
    const posFrom = (text: string) => extractPos(text);

    const planetary = plain.match(
        /^Combat entre votre flotte\s+(.+?)\s+et certaines planètes du système\s+(.+?)\((\d+)-(\d+)\s+s\(\d+\)\)(?:\.\s*Vous avez pris\s+(\d+)\s+planète\(s\)\.)?/i,
    );
    if (planetary) {
        const pos = {x: parseInt(planetary[3], 10), y: parseInt(planetary[4], 10)};
        const planetsCaptured = planetary[5] ? parseInt(planetary[5], 10) : undefined;
        const playerFleet = planetary[1].trim();
        const systemName = planetary[2].trim();
        return {
            kind: 'planetary',
            pos,
            systemName,
            playerFleet,
            planetsCaptured,
            summary: '',
        };
    }

    const spatial = plain.match(
        /^Combat en\s+(.+?)\((\d+)-(\d+)\s+s\(\d+\)\)\s+entre votre flotte\s+(.+?)\s+et la flottil(?:le|le)\s+(.+?)\s+du commandant\s+(.+?)\./i,
    );
    if (spatial) {
        const pos = {x: parseInt(spatial[2], 10), y: parseInt(spatial[3], 10)};
        return {
            kind: 'spatial',
            pos,
            systemName: spatial[1].trim(),
            playerFleet: spatial[4].trim(),
            enemyFleet: spatial[5].trim(),
            enemyCommander: spatial[6].trim(),
            summary: '',
        };
    }

    // Variante sans point final strict (HTML résiduel, ponctuation atypique)
    if (/^Combat en\s+/i.test(plain) && posFrom(plain)) {
        const pos = posFrom(plain)!;
        const playerFleetM = plain.match(/votre flotte\s+(.+?)\s+et/i);
        const enemyFleetM = plain.match(/flottil(?:le|le)\s+(.+?)\s+du commandant/i);
        const systemM = plain.match(/^Combat en\s+(.+?)\(/i);
        const enemyCmdM = plain.match(/du commandant\s+(.+?)(?:\.|résultat)/i);
        return {
            kind: 'spatial',
            pos,
            systemName: systemM?.[1]?.trim(),
            playerFleet: playerFleetM?.[1]?.trim(),
            enemyFleet: enemyFleetM?.[1]?.trim(),
            enemyCommander: enemyCmdM?.[1]?.trim(),
            summary: '',
        };
    }

    return null;
}

export function parseCombatMessages(messages: RawMessage[]): CombatEvent[] {
    const combats: CombatEvent[] = [];
    let current: CombatEvent | null = null;
    let combatSeq = 0;

    const flush = () => {
        if (current) {
            combats.push(current);
            current = null;
        }
    };

    for (const msg of messages) {
        if (msg.type !== 'EVT') continue;
        const raw = msg.html || msg.text;
        const plain = messageToPlain(raw);
        const header = parseCombatHeader(plain);

        if (header) {
            flush();
            combatSeq += 1;
            const withSummary = {...header, summary: buildCombatSummary(header)};
            current = {
                ...withSummary,
                id: `combat-${msg.index}-${combatSeq}`,
                details: [{html: raw, plain}],
            };
            continue;
        }

        if (current && isCombatDetail(plain, raw)) {
            current.details.push({html: raw, plain});
            continue;
        }

        flush();
    }

    flush();
    return combats;
}

export function combatsAtPosition(combats: CombatEvent[], pos: XY): CombatEvent[] {
    return combats.filter(c => c.pos.x === pos.x && c.pos.y === pos.y);
}

export function countCombatsByKind(combats: CombatEvent[], pos: XY): {spatial: number; planetary: number} {
    const at = combatsAtPosition(combats, pos);
    return {
        spatial: at.filter(c => c.kind === 'spatial').length,
        planetary: at.filter(c => c.kind === 'planetary').length,
    };
}

export function combatKindLabel(kind: CombatKind): string {
    return kind === 'spatial' ? 'Combat spatial' : 'Combat planétaire';
}

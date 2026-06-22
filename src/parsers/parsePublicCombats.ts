import {CombatEvent} from '../types';
import {messageToPlain} from './parseCombatMessages';

export function parsePublicCombatsHtml(html: string): CombatEvent[] {
    if (!html) return [];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const out: CombatEvent[] = [];
    const tbodyRows = Array.from(doc.querySelectorAll('table tr')) as HTMLTableRowElement[];
    let currentSector: string | undefined;
    let idx = 0;

    for (const row of tbodyRows) {
        const tds = Array.from(row.querySelectorAll('td')) as HTMLTableCellElement[];
        if (tds.length === 1 && (tds[0].getAttribute('colspan') || '') === '5') {
            // secteur header, exemple: "Dune : <span class='position'>secteur4</font>"
            const text = (tds[0].textContent || '').trim();
            const m = text.match(/secteur\s*(\d+)/i);
            if (m) currentSector = `secteur${m[1]}`; else currentSector = text;
            continue;
        }

        if (tds.length >= 5) {
            // columns: attacker, attacked, type, attacker fleet, target (system or planets)
            const attacker = (tds[0].textContent || '').trim();
            const attacked = (tds[1].textContent || '').trim();
            const typeTxt = (tds[2].textContent || '').trim().toLowerCase();
            const attackerFleet = (tds[3].textContent || '').trim();
            const targetHtml = tds[4].innerHTML || tds[4].textContent || '';
            const targetText = (tds[4].textContent || '').trim();

            const kind: 'spatial' | 'planetary' = /plan[eéè]t/i.test(typeTxt) ? 'planetary' : 'spatial';
            if (kind === 'spatial') {
                continue; // spatial combats in combats.htm only carry sector info, not exact location
            }

            // try to extract system name from target: often bare name or italic <I>name</I>
            let systemName = '';
            // prefer <i> content
            const italic = tds[4].querySelector('i');
            if (italic && italic.textContent) systemName = italic.textContent.trim();
            else {
                // take first span or plain text before parentheses
                const span = tds[4].querySelector('span');
                if (span && span.textContent) systemName = span.textContent.trim();
                else {
                    // remove parenthetical note like " (aucune planète prise)"
                    systemName = targetText.replace(/\s*\(.*\)\s*$/, '').trim();
                }
            }

            const summary = `Attaquant: ${attacker} · Attaqué: ${attacked} · Type: ${typeTxt} · Flotte attaquante: ${attackerFleet} · cible: ${systemName || targetText}`;
            const detailHtml = `<table class="combat-public-detail" style="width:100%;border-collapse:collapse;">
                <tr><th style="text-align:left;padding:4px;border:1px solid #444;background:#111">Attaquant</th><td style="padding:4px;border:1px solid #444">${tds[0].innerHTML}</td></tr>
                <tr><th style="text-align:left;padding:4px;border:1px solid #444;background:#111">Attaqué</th><td style="padding:4px;border:1px solid #444">${tds[1].innerHTML}</td></tr>
                <tr><th style="text-align:left;padding:4px;border:1px solid #444;background:#111">Type de combat</th><td style="padding:4px;border:1px solid #444">${typeTxt}</td></tr>
                <tr><th style="text-align:left;padding:4px;border:1px solid #444;background:#111">Flotte attaquante</th><td style="padding:4px;border:1px solid #444">${attackerFleet}</td></tr>
                <tr><th style="text-align:left;padding:4px;border:1px solid #444;background:#111">Flotte ou système attaquée</th><td style="padding:4px;border:1px solid #444">${targetHtml}</td></tr>
            </table>`;
            const plain = messageToPlain(summary);

            const ev: CombatEvent = {
                id: `public-${Date.now().toString(36)}-${idx}`,
                kind,
                pos: {x: 0, y: 0},
                systemName: systemName || undefined,
                summary,
                details: [{html: detailHtml, plain}],
            } as CombatEvent;

            // attach sector info in summary for later resolution
            if (currentSector) ev.summary = `${currentSector} - ${ev.summary}`;

            out.push(ev);
            idx += 1;
        }
    }

    try {
        if (out.length > 0) {
            console.info(`[parsePublicCombats] parsed ${out.length} public combat(s)`);
            console.debug(out.slice(0, 10));
        } else {
            console.debug('[parsePublicCombats] no public combats found');
        }
    } catch (e) { }

    return out;
}

export default parsePublicCombatsHtml;

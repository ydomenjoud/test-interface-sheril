import React, { useEffect, useMemo, useState } from 'react';
import { FlotteJoueur, Lieutenant, XY } from '../../types';
import { DeplacementEnAttente, DIRECTIVE_DEFAUT, OPTIONS_DIRECTIVES } from '../../utils/ordreDeplacement';
import {
    compositionParPlan,
    DivisionOrdre,
    estFlotteDivisee,
    FusionOrdre,
    libelleNumFlotte,
    positionFinale,
    texteCompatibleSchema,
} from '../../utils/ordreFlotte';
import { IconAlert } from '../icons/Icons';
import './OrdresFlottes.css';

type Props = {
    selected: XY;
    flottes: FlotteJoueur[];
    lieutenants: Lieutenant[];
    deplacements: Record<number, DeplacementEnAttente>;
    fusions: FusionOrdre[];
    divisions: DivisionOrdre[];
    onFusion: (f: FusionOrdre) => void;
    onDivision: (d: Omit<DivisionOrdre, 'numero'>) => void;
};

const memeCase = (a: XY, b: XY) => a.x === b.x && a.y === b.y;
const numAffiche = libelleNumFlotte;

// Bloc du panneau d'info : fusionner les flottes qui finissent le tour sur la case sélectionnée,
// ou diviser une flotte qui part de cette case (la division se fait avant le mouvement)
export default function OrdresFlottesCase({ selected, flottes, lieutenants, deplacements, fusions, divisions, onFusion, onDivision }: Props) {
    // Flottes sur la case au moment des fusions (après les déplacements) : celles qui y restent,
    // celles qui y arrivent ; les déplacements hors de portée sont listés, marqués et non cochables
    const presentes = useMemo(() => flottes
        .map(f => ({ f, fin: positionFinale(f, deplacements[f.num]) }))
        .filter(({ fin }) => memeCase(fin.pos, selected))
        .sort((a, b) => a.f.num - b.f.num), [flottes, deplacements, selected]);
    // Flottes qui partent de la case : celles qu'on peut diviser ici (pas une flotte elle-même issue
    // d'une division ; une flotte déjà divisée ne propose que les vaisseaux qui lui restent)
    const auDepart = useMemo(() => flottes
        .filter(f => memeCase(f.pos, selected) && !estFlotteDivisee(f.num))
        .sort((a, b) => a.num - b.num), [flottes, selected]);

    // Flottes déjà prises dans une fusion de ce tour (une flotte ne fusionne qu'une fois)
    const dejaFusionnees = useMemo(() => new Set(fusions.flatMap(f => f.flottes)), [fusions]);
    const heros = useMemo(() => new Set(lieutenants.filter(l => l.type === 0).map(l => Number(l.pos))), [lieutenants]);

    const [coches, setCoches] = useState<number[]>([]);
    const [directive, setDirective] = useState<number>(DIRECTIVE_DEFAUT);
    const [precision, setPrecision] = useState<number>(0);
    // Division en cours de saisie (une à la fois)
    const [divise, setDivise] = useState<{ fleetNum: number; nom: string; vaisseaux: Record<string, number> } | null>(null);

    // Changement de case : on repart d'une sélection vide
    useEffect(() => {
        setCoches([]);
        setDivise(null);
    }, [selected.x, selected.y]);

    const cochables = presentes.filter(({ f, fin }) => !fin.horsPortee && !dejaFusionnees.has(f.num)).map(({ f }) => f.num);
    const cochesValides = coches.filter(n => cochables.includes(n));
    const garde = cochesValides.length > 0 ? Math.min(...cochesValides) : undefined;

    // Directive proposée : celle du déplacement de la flotte gardée (la fusion l'écrase), sinon neutre
    useEffect(() => {
        if (garde === undefined) return;
        const d = deplacements[garde];
        setDirective(d ? d.directive : DIRECTIVE_DEFAUT);
        setPrecision(d?.precision ?? 0);
    }, [garde, deplacements]);

    if (presentes.length === 0 && auDepart.length === 0) return null;

    const optionDirective = OPTIONS_DIRECTIVES.find(o => o.value === directive);
    const nbHeros = cochesValides.filter(n => heros.has(n)).length;

    const basculer = (num: number) =>
        setCoches(c => (c.includes(num) ? c.filter(n => n !== num) : [...c, num]));

    const fusionner = () => {
        if (cochesValides.length < 2) return;
        onFusion(optionDirective?.precision
            ? { flottes: [...cochesValides].sort((a, b) => a - b), directive, precision }
            : { flottes: [...cochesValides].sort((a, b) => a - b), directive });
        setCoches([]);
    };

    const ouvrirDivision = (f: FlotteJoueur) => {
        const compo = compositionParPlan(f);
        setDivise({ fleetNum: f.num, nom: `${f.nom} bis`, vaisseaux: Object.fromEntries(Object.keys(compo).map(p => [p, 0])) });
    };
    const flotteDivisee = divise ? auDepart.find(f => f.num === divise.fleetNum) : undefined;
    const compoDivisee = flotteDivisee ? compositionParPlan(flotteDivisee) : {};
    const nbDetaches = divise ? Object.values(divise.vaisseaux).reduce((s, n) => s + n, 0) : 0;
    const nbTotal = Object.values(compoDivisee).reduce((s, n) => s + n, 0);
    const nomValide = !!divise && divise.nom.trim() !== '' && texteCompatibleSchema(divise.nom);
    const diviser = () => {
        if (!divise || !nomValide || nbDetaches === 0) return;
        onDivision({ fleetNum: divise.fleetNum, nom: divise.nom.trim(), vaisseaux: Object.fromEntries(Object.entries(divise.vaisseaux).filter(([, n]) => n > 0)) });
        setDivise(null);
    };

    return (
        <div className="info-block ordres-flottes">
            <h4>Fusion / division</h4>

            {presentes.length > 0 && (
                <>
                    <div className="ordres-flottes-aide">Flottes sur la case après les déplacements du tour</div>
                    <ul className="ordres-flottes-liste">
                        {presentes.map(({ f, fin }) => {
                            const prise = dejaFusionnees.has(f.num);
                            const desactive = fin.horsPortee || prise;
                            return (
                                <li key={f.num} className={desactive ? 'desactive' : undefined}>
                                    <label>
                                        <input
                                            type="checkbox"
                                            disabled={desactive}
                                            checked={!desactive && coches.includes(f.num)}
                                            onChange={() => basculer(f.num)}
                                        />
                                        <span className="ordres-flottes-num">{numAffiche(f.num)}</span>
                                        <span className="ordres-flottes-nom">{f.nom}</span>
                                    </label>
                                    <span className="ordres-flottes-etat">
                                        {fin.horsPortee
                                            ? <span className="alerte" title="Déplacement au-delà de la vitesse : la flotte n'atteindra pas la case ce tour"><IconAlert size={12} /> hors de portée</span>
                                            : prise ? 'déjà dans une fusion'
                                            : fin.arrive ? `arrive de ${f.pos.x}-${f.pos.y}` : 'reste sur la case'}
                                        {heros.has(f.num) && <span className="ordres-flottes-heros" title="Un héros commande cette flotte">héros</span>}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                    <div className="ordres-flottes-actions">
                        <select
                            className="carte-select"
                            title="Directive de la flotte fusionnée (elle remplace celle du déplacement)"
                            value={directive}
                            onChange={e => setDirective(Number(e.target.value))}
                        >
                            {OPTIONS_DIRECTIVES.map(o => <option key={o.value} value={o.value} title={o.full}>{o.label}</option>)}
                        </select>
                        {optionDirective?.precision && (
                            <input
                                type="number"
                                className="ordres-flottes-precision"
                                title={optionDirective.precision === 'planete' ? 'Planète visée (n°, 0-based)' : 'Commandant visé (0 = neutre)'}
                                min={0}
                                value={precision}
                                onChange={e => setPrecision(Math.max(0, Number(e.target.value) || 0))}
                            />
                        )}
                        <button
                            type="button"
                            className="ordres-flottes-bouton"
                            disabled={cochesValides.length < 2}
                            onClick={fusionner}
                            title={garde !== undefined && cochesValides.length >= 2
                                ? `Fusionner dans ${numAffiche(garde)} (le jeu garde le plus petit numéro)`
                                : 'Cochez au moins deux flottes'}
                        >
                            Fusionner ({cochesValides.length})
                        </button>
                    </div>
                    {nbHeros > 1 && (
                        <div className="ordres-flottes-alerte">
                            <IconAlert size={12} /> Plusieurs héros : seul celui de {numAffiche(garde ?? 0)} reste, les autres passent en réserve.
                        </div>
                    )}
                </>
            )}

            {auDepart.length > 0 && (
                <>
                    <div className="ordres-flottes-aide">Diviser une flotte (avant son déplacement)</div>
                    <ul className="ordres-flottes-liste">
                        {auDepart.map(f => {
                            const nbDivisions = divisions.filter(d => d.fleetNum === f.num).length;
                            return (
                                <li key={f.num}>
                                    <span className="ordres-flottes-num">{numAffiche(f.num)}</span>
                                    <span className="ordres-flottes-nom">{f.nom}</span>
                                    <span className="ordres-flottes-etat">
                                        {f.vaisseaux.length} vso{nbDivisions > 0 ? ` · ${nbDivisions} division${nbDivisions > 1 ? 's' : ''}` : ''}
                                    </span>
                                    <button
                                        type="button"
                                        className="ordres-flottes-bouton petit"
                                        disabled={f.vaisseaux.length < 2}
                                        onClick={() => (divise?.fleetNum === f.num ? setDivise(null) : ouvrirDivision(f))}
                                    >
                                        {divise?.fleetNum === f.num ? 'Annuler' : 'Diviser…'}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    {divise && flotteDivisee && (
                        <div className="ordres-flottes-division">
                            <label className="ordres-flottes-champ">
                                Nom de la nouvelle flotte
                                <input
                                    type="text"
                                    value={divise.nom}
                                    onChange={e => setDivise({ ...divise, nom: e.target.value })}
                                />
                            </label>
                            {!texteCompatibleSchema(divise.nom) && (
                                <div className="ordres-flottes-alerte"><IconAlert size={12} /> Le nom ne doit pas contenir « : » ni « %#!% ».</div>
                            )}
                            <table className="ordres-flottes-compo">
                                <tbody>
                                {Object.entries(compoDivisee).sort(([a], [b]) => a.localeCompare(b)).map(([plan, nb]) => {
                                    const planValide = texteCompatibleSchema(plan);
                                    return (
                                        <tr key={plan}>
                                            <td title={planValide ? undefined : 'Nom de plan incompatible avec le schéma d\'ordres'}>{plan}</td>
                                            <td>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={nb}
                                                    disabled={!planValide}
                                                    value={divise.vaisseaux[plan] ?? 0}
                                                    onChange={e => setDivise({
                                                        ...divise,
                                                        vaisseaux: { ...divise.vaisseaux, [plan]: Math.min(nb, Math.max(0, Math.floor(Number(e.target.value) || 0))) },
                                                    })}
                                                />
                                            </td>
                                            <td className="ordres-flottes-sur">/ {nb}</td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                            {nbDetaches === nbTotal && nbTotal > 0 && (
                                <div className="ordres-flottes-alerte"><IconAlert size={12} /> Tous les vaisseaux partent : l'ancienne flotte disparaît.</div>
                            )}
                            <div className="ordres-flottes-aide">Le jeu détache en priorité les vaisseaux les plus endommagés de chaque plan.</div>
                            <button
                                type="button"
                                className="ordres-flottes-bouton"
                                disabled={!nomValide || nbDetaches === 0}
                                onClick={diviser}
                            >
                                Ajouter la division ({nbDetaches} vso)
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Lieutenant, SystemeJoueur } from '../types';
import { useReport } from '../context/ReportContext';
import { bonusTechRace } from '../utils/races';
import { isPos, parsePosString, posToString } from '../utils/position';
import { loadPlanificationRevenu, savePlanificationRevenu } from '../utils/planificationRevenuStorage';

interface SystemState {
    taxation: number;
    btech: number;
    besp: number;
    bcont: number;
    terraformation: boolean;
    politique: number | undefined;
    gouverneur: string | null; // nom du lieutenant gouverneur
}

// Effets des politiques : bonus/malus de stabilité et de croissance de population (en points de %)
const EFFETS_POLITIQUES: Record<number, { stab?: number; pop?: number }> = {
    4: { pop: 5 },             // expansion
    5: { pop: 10, stab: -2 },  // intégriste
    6: { stab: 2 },            // totalitaire
    7: { stab: -2 },           // esclavagiste
    13: { stab: 2 },           // loisir
};

const effetPolitique = (code: number | undefined) => ({
    stab: (code !== undefined && EFFETS_POLITIQUES[code]?.stab) || 0,
    pop: (code !== undefined && EFFETS_POLITIQUES[code]?.pop) || 0,
});

const formatEffetPolitique = (code: number | undefined) => {
    const e = effetPolitique(code);
    const parts: string[] = [];
    if (e.stab) parts.push(`stab ${e.stab > 0 ? '+' : ''}${e.stab}`);
    if (e.pop) parts.push(`pop ${e.pop > 0 ? '+' : ''}${e.pop}%`);
    return parts.join(', ');
};

// Tous les calculs ne portent que sur les planètes du joueur
const planetesDuJoueur = (s: SystemeJoueur, numeroJoueur: number | undefined) =>
    s.planetes.filter(p => p.proprietaire === numeroJoueur);

// État d'un système tel que décrit par le rapport
function etatDuRapport(s: SystemeJoueur, gouverneurs: Record<string, string>, numeroJoueur: number | undefined): SystemState {
    // Moyenne des taxations des planètes du joueur
    const mesPlanetes = planetesDuJoueur(s, numeroJoueur);
    const avgTax = mesPlanetes.length > 0
        ? Math.floor(mesPlanetes.reduce((acc, p) => acc + p.tax, 0) / mesPlanetes.length)
        : 1;
    return {
        taxation: Math.max(0, Math.min(5, avgTax)),
        btech: s.btech ?? 0,
        besp: s.besp ?? 0,
        bcont: s.bcont ?? 0,
        terraformation: false,
        politique: s.politique,
        gouverneur: gouverneurs[posToString(s.pos)] ?? null,
    };
}

// Coût de terraformation d'une planète : 50 + (niveau + 1) × 2
const coutTerraformationPlanete = (niveau: number) => 50 + (niveau + 1) * 2;

const COULEUR_MODIFIE = '#ff9800';

// Style d'un champ dont la valeur diffère du rapport
const styleModifie = (base: React.CSSProperties, modifie: boolean): React.CSSProperties =>
    modifie ? { ...base, border: `1px solid ${COULEUR_MODIFIE}`, boxShadow: `0 0 0 1px ${COULEUR_MODIFIE}`, backgroundColor: '#4a3418' } : base;

// Codes des compétences de lieutenant (data.xml > leader_competences)
const COMP_MORAL = 3;
const COMP_FINANCE = 14;

// Codes des marchandises (data.xml > marchandises) et des politiques de revenu
const MARCH_LOGICIELS = 6;
const MARCH_COMPOSANTS_ELECTRONIQUES = 8;
const MARCH_PRODUITS_ALIMENTAIRES = 0;
const MARCH_MEDICAMENTS = 5;
const MARCH_LUXE = 2;
const MARCH_METAUX_PRECIEUX = 12;
const SEUIL_STOCK_IMPORTANT = 100;
// Bonus de croissance de population (en points de %) d'un stock important, absents du rapport
const BONUS_POP_ALIMENTAIRE = 5;
const BONUS_POP_MEDICAMENTS = 10;
const BONUS_STOCK_BUDGET = 1.25;
const POLITIQUE_IMPOTS = 0;
const POLITIQUE_LOISIR = 13;

// Modificateur de revenu (et de revenu technologique) de la politique
const modificateurRevenuPolitique = (code: number | undefined) =>
    code === POLITIQUE_IMPOTS ? 1.1 : code === POLITIQUE_LOISIR ? 0.8 : 1;

// Niveau d'une compétence : 0 si absente, 1 si présente avec la valeur 0, sinon la valeur
const niveauCompetence = (l: Lieutenant | undefined, comp: number) => {
    const c = l?.competences.find(x => x.comp === comp);
    return c ? Math.max(1, c.val) : 0;
};

// Apport du gouverneur à la stabilité : moral + niveau(maîtrise du moral) × 50 % × moral, arrondi à l'inférieur
const stabiliteGouverneur = (l: Lieutenant | undefined) =>
    l ? Math.floor(l.mor + niveauCompetence(l, COMP_MORAL) * 0.5 * l.mor) : 0;

// Bonus de revenu du gouverneur : +20 % par niveau de maîtrise de la finance
const bonusRevenuGouverneur = (l: Lieutenant | undefined) => 0.2 * niveauCompetence(l, COMP_FINANCE);

const descriptionGouverneur = (l: Lieutenant | undefined, noms: Record<number, string> = {}) => l
    ? `niv ${l.niv} - att ${l.att}, def ${l.def}, mar ${l.mar}, mor ${l.mor}, vit ${l.vit}`
        + (l.competences.length ? `\n${l.competences.map(c => `${noms[c.comp] ?? `compétence ${c.comp}`} : ${c.val}`).join('\n')}` : '')
    : undefined;

// Met en évidence (surlignage qui s'estompe) une valeur affichée qui vient de changer.
// L'infobulle donne le détail du calcul et, si la valeur diffère de celle calculée avec les infos du rapport, cette valeur de référence.
function Change({ children, style, detail, rapport }: { children: string; style?: React.CSSProperties; detail?: string; rapport?: string }) {
    const precedent = useRef(children);
    const [flash, setFlash] = useState(0);
    useEffect(() => {
        if (precedent.current !== children) {
            precedent.current = children;
            setFlash(n => n + 1);
        }
    }, [children]);
    const avant = rapport !== undefined && rapport !== children ? `Avant (rapport) : ${rapport}` : undefined;
    const titre = [detail, avant].filter(Boolean).join('\n\n') || undefined;
    return (
        <span
            key={flash}
            title={titre}
            style={{ ...style, borderRadius: 3, ...(titre ? { cursor: 'help' } : {}), ...(flash ? { animation: 'revenuChange 2.5s ease-out' } : {}) }}
        >{children}</span>
    );
}

type Revenus = { revenus: number; benefice: number; revenu_tech: number; revenu_besp: number; revenu_bcont: number };
const additionne = (lignes: Revenus[]): Revenus => lignes.reduce((acc, l) => ({
    revenus: acc.revenus + l.revenus,
    benefice: acc.benefice + l.benefice,
    revenu_tech: acc.revenu_tech + l.revenu_tech,
    revenu_besp: acc.revenu_besp + l.revenu_besp,
    revenu_bcont: acc.revenu_bcont + l.revenu_bcont,
}), { revenus: 0, benefice: 0, revenu_tech: 0, revenu_besp: 0, revenu_bcont: 0 });

const CHAMPS_TOTAUX = [
    ['revenus', '#fff'],
    ['benefice', '#81c784'],
    ['revenu_tech', '#4fc3f7'],
    ['revenu_besp', '#ba68c8'],
    ['revenu_bcont', '#ff8a65'],
] as const;

export default function PlanificationRevenu() {
    const { rapport, global } = useReport();
    const systems = useMemo(() => rapport?.systemesJoueur || [], [rapport]);

    const tour = rapport?.tour;
    const numeroJoueur = rapport?.joueur.numero;

    // Gouverneurs (lieutenants de type 1) en poste, par clé de système ; les autres sont disponibles en réserve
    const gouverneursDuRapport = useMemo(() => (rapport?.lieutenants ?? []).filter(l => l.type === 1), [rapport]);
    const gouverneurs = useMemo(() => {
        const m: Record<string, string> = {};
        gouverneursDuRapport.forEach(l => {
            if (isPos(l.pos)) m[posToString(parsePosString(l.pos))] = l.nom;
        });
        return m;
    }, [gouverneursDuRapport]);

    // Les états sont rattachés à un tour : un changement de rapport repart des valeurs du rapport
    const [store, setStore] = useState<{ tour: number | undefined; states: Record<string, SystemState> }>({ tour: undefined, states: {} });
    const states = useMemo(() => (store.tour === tour ? store.states : {}), [store, tour]);
    const setStates = (updater: (prev: Record<string, SystemState>) => Record<string, SystemState>) => {
        setStore(prev => ({ tour, states: updater(prev.tour === tour ? prev.states : {}) }));
    };

    // Initialisation des états à partir du rapport
    useEffect(() => {
        if (tour !== undefined && systems.length > 0) {
            const initialStates: Record<string, SystemState> = {};
            systems.forEach(s => {
                initialStates[posToString(s.pos)] = etatDuRapport(s, gouverneurs, numeroJoueur);
            });
            // Choix sauvegardés pour ce tour, par-dessus les valeurs du rapport
            const saved = loadPlanificationRevenu<SystemState>(tour) || {};
            Object.keys(initialStates).forEach(k => {
                if (saved[k]) initialStates[k] = { ...initialStates[k], ...saved[k] };
            });
            setStore({ tour, states: initialStates });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [systems, tour]);

    useEffect(() => {
        if (tour !== undefined && store.tour === tour) savePlanificationRevenu(tour, store.states);
    }, [store, tour]);

    const handleTaxChange = (key: string, val: number) => {
        setStates(prev => ({
            ...prev,
            [key]: { ...prev[key], taxation: val }
        }));
    };

    const handleBudgetChange = (key: string, field: 'btech' | 'besp' | 'bcont', val: string) => {
        let numVal = parseInt(val, 10);
        if (isNaN(numVal)) numVal = 0;
        numVal = Math.max(0, Math.min(100, numVal));
        setStates(prev => ({
            ...prev,
            [key]: { ...prev[key], [field]: numVal }
        }));
    };

    const handleGouverneurChange = (key: string, nom: string) => {
        setStates(prev => {
            const next = { ...prev };
            // Un gouverneur ne peut être que sur un seul système : on le retire de l'ancien
            if (nom) Object.keys(next).forEach(k => { if (next[k].gouverneur === nom) next[k] = { ...next[k], gouverneur: null }; });
            next[key] = { ...next[key], gouverneur: nom || null };
            return next;
        });
    };

    const handlePolitiqueChange = (key: string, val: number) => {
        setStates(prev => ({
            ...prev,
            [key]: { ...prev[key], politique: val }
        }));
    };

    const handleReset = (key: string, s: SystemeJoueur) => {
        setStates(prev => ({ ...prev, [key]: etatDuRapport(s, gouverneurs, numeroJoueur) }));
    };

    const handleResetAll = () => {
        const etats: Record<string, SystemState> = {};
        systems.forEach(s => { etats[posToString(s.pos)] = etatDuRapport(s, gouverneurs, numeroJoueur); });
        setStates(() => etats);
    };

    const handleTerraChange = (key: string, val: boolean) => {
        setStates(prev => ({
            ...prev,
            [key]: { 
                ...prev[key], 
                terraformation: val
            }
        }));
    };

    const rows = useMemo(() => {
        // Calcul d'un système pour un état donné (choix de l'utilisateur ou état du rapport)
        const calcul = (s: SystemeJoueur, state: SystemState) => {
            const key = posToString(s.pos);

            // Le rapport reflète déjà la politique actuelle : on n'applique que l'écart avec la politique choisie
            const effetActuel = effetPolitique(s.politique);
            const effetChoisi = effetPolitique(state.politique);
            const deltaStabPolitique = effetChoisi.stab - effetActuel.stab;
            // Le taux de croissance du rapport n'inclut pas le bonus de population de la politique : on l'applique en entier
            const bonusPopPolitique = effetChoisi.pop;
            
            // Stabilité = Moyenne des stab des planètes
            const mesPlanetes = planetesDuJoueur(s, numeroJoueur);
            const stabilite = mesPlanetes.length > 0
                ? mesPlanetes.reduce((acc, p) => acc + (p.stab || 0), 0) / mesPlanetes.length
                : 0;

            // variation_stab = Somme des evostab
            // Si on change la taxation, on remplace le modificateur "taxation" par celui correspondant à la nouvelle valeur
            const taxModif = global?.modificateursStabiliteTaxation?.find(m => m.taxation === state.taxation)?.modif ?? 0;
            
            let variation_stab = 0;
            const detailStab: string[] = [];
            const signe = (n: number) => `${n > 0 ? '+' : ''}${n}`;
            // Les rapports stockés avant l'ajout d'evostab n'ont pas ce champ
            const evostab = s.evostab ?? [];
            evostab.forEach(evo => {
                if (evo.t === 'taxation') {
                    variation_stab += taxModif;
                } else if (evo.t === 'gouverneur') {
                    // remplacé par l'apport du gouverneur choisi
                } else {
                    variation_stab += (evo.v || 0);
                    detailStab.push(`${evo.t} : ${signe(evo.v || 0)}`);
                }
            });
            // Si pas d'evostab "taxation" trouvée (peu probable d'après l'énoncé), on ajoute quand même le modif? 
            // L'énoncé dit "lorsque je change une taxation, il faut remplacé le taxation par le modificateur de stab"
            if (!evostab.some(evo => evo.t === 'taxation')) {
                variation_stab += taxModif;
            }
            detailStab.push(`taxation ${state.taxation} : ${signe(taxModif)}`);
            variation_stab += deltaStabPolitique;
            if (deltaStabPolitique) detailStab.push(`changement de politique (${formatEffetPolitique(state.politique) || 'aucun effet'}) : ${signe(deltaStabPolitique)}`);
            const gouverneur = gouverneursDuRapport.find(l => l.nom === state.gouverneur);
            const stabGouv = stabiliteGouverneur(gouverneur);
            variation_stab += stabGouv;
            detailStab.push(gouverneur
                ? `gouverneur ${gouverneur.nom} : moral ${gouverneur.mor} × (1 + 0,5 × niv. maîtrise du moral ${niveauCompetence(gouverneur, COMP_MORAL)}) = ${signe(stabGouv)} (arrondi à l'inférieur)`
                : 'gouverneur : aucun');
            const detailStabilite = `Stabilité actuelle : moyenne de ${mesPlanetes.length} planète(s) du joueur`;
            const detailVariationStab = `Variation de stabilité par tour :\n${detailStab.join('\n')}\n= ${signe(variation_stab)}`;

            // Un stock important (100+) donne un bonus propre au système qui le détient
            const stockImportant = (code: number) =>
                (s.marchandises ?? []).some(m => m.code === code && m.stock >= SEUIL_STOCK_IMPORTANT);

            // population_variation = SOMME des (population des planètes*augmentation de pop)
            const bonusPopAlimentaire = stockImportant(MARCH_PRODUITS_ALIMENTAIRES) ? BONUS_POP_ALIMENTAIRE : 0;
            const bonusPopMedicaments = stockImportant(MARCH_MEDICAMENTS) ? BONUS_POP_MEDICAMENTS : 0;
            let population = 0;
            let population_variation = 0;
            const detailPop: string[] = [];

            let populationMax = 0;
            let revenuPlanetes = 0;
            const taxationModifiee = state.taxation !== etatDuRapport(s, gouverneurs, numeroJoueur).taxation;

            mesPlanetes.forEach(p => {
                const pPop = (p.populations ?? []).reduce((acc, pop) => acc + (pop.nb || 0), 0);

                // L'augmentation de pop de base + terraformation (+3% si activée)
                // Calcul par planète et par race, arrondi à l'inférieur, et limité par la pop max
                const growthBonus = (state.terraformation ? 3 : 0) + bonusPopPolitique + bonusPopAlimentaire + bonusPopMedicaments;
                let pGrowth = 0;
                let pMax = 0;
                (p.populations ?? []).forEach(pop => {
                    const rate = (pop.growth || 0) + growthBonus;
                    const nb = pop.nb || 0;
                    pGrowth += Math.min(Math.floor(nb * rate / 100), Math.max(0, (pop.max || 0) - nb));
                    pMax += pop.max || 0;
                });

                // Taxation du système si l'utilisateur l'a modifiée, sinon celle de la planète dans le rapport
                const taxPlanete = taxationModifiee ? state.taxation : p.tax;
                const revenuPlanete = Math.floor((pPop + pGrowth) * taxPlanete / 10);

                population += pPop;
                populationMax += pMax;
                population_variation += pGrowth;
                revenuPlanetes += revenuPlanete;
                detailPop.push(`planète ${p.num ?? ''} : pop ${pPop}/${pMax}, croissance +${pGrowth} (marge avant pop max : ${Math.max(0, pMax - pPop)}), revenu ${revenuPlanete} (taxation ${taxPlanete})`);

            });

            const detailPopulation = `Population totale des planètes du joueur : ${population} / pop max ${populationMax}`;
            const detailVariationPop = `Croissance par tour (par race et par planète, arrondie à l'inférieur, limitée par la pop max) :\n${detailPop.join('\n')}\nBonus appliqués au taux : terraformation ${state.terraformation ? '+3' : '0'} %, politique ${signe(bonusPopPolitique)} %, produits alimentaires ${signe(bonusPopAlimentaire)} %, médicaments ${signe(bonusPopMedicaments)} %\n= +${population_variation}`;

            // Bonus gouverneur (finance) puis modificateur de politique (impôts / loisir) : base du revenu technologique
            const revenuTechBase = revenuPlanetes
                * (1 + bonusRevenuGouverneur(gouverneur))
                * modificateurRevenuPolitique(state.politique);

            // Revenu normal : luxe (+10 %) et métaux précieux (+5 %) se multiplient, sans arrondi intermédiaire.
            // Ils n'entrent pas dans le revenu technologique.
            const revenus = revenuTechBase
                * (stockImportant(MARCH_LUXE) ? 1.1 : 1)
                * (stockImportant(MARCH_METAUX_PRECIEUX) ? 1.05 : 1);

            // +25 % en dernier pour logiciels (tech) / composants électroniques (SS et CE)
            const bonusRace = (100 + bonusTechRace(rapport?.joueur.raceId ?? -1)) / 100;
            const bonusLogiciels = stockImportant(MARCH_LOGICIELS) ? BONUS_STOCK_BUDGET : 1;
            const bonusComposants = stockImportant(MARCH_COMPOSANTS_ELECTRONIQUES) ? BONUS_STOCK_BUDGET : 1;

            const coefGouv = 1 + bonusRevenuGouverneur(gouverneur);
            const coefPol = modificateurRevenuPolitique(state.politique);
            const fmt = (n: number) => n.toFixed(2);
            const detailRevenuBase = [
                `somme par planète de (pop + croissance, plafonnée à la pop max) × taxation / 10, arrondie à l'inférieur = ${revenuPlanetes}`,
                `× gouverneur (finance niv. ${niveauCompetence(gouverneur, COMP_FINANCE)}) : ${fmt(coefGouv)}`,
                `× politique : ${fmt(coefPol)}`,
            ];
            const detailRevenus = `Revenu :\n${detailRevenuBase.join('\n')}\n× luxe (stock ≥ ${SEUIL_STOCK_IMPORTANT}) : ${stockImportant(MARCH_LUXE) ? '1,10' : '1'}\n× métaux précieux (stock ≥ ${SEUIL_STOCK_IMPORTANT}) : ${stockImportant(MARCH_METAUX_PRECIEUX) ? '1,05' : '1'}\n= ${fmt(revenus)}`;
            const detailTech = `Budget tech :\n${detailRevenuBase.join('\n')}\n(sans luxe ni métaux précieux) = ${fmt(revenuTechBase)}\n× budget tech ${state.btech} %\n× race (${bonusTechRace(rapport?.joueur.raceId ?? -1) >= 0 ? '+' : ''}${bonusTechRace(rapport?.joueur.raceId ?? -1)} %) : ${fmt(bonusRace)}\n× logiciels (stock ≥ ${SEUIL_STOCK_IMPORTANT}) : ${fmt(bonusLogiciels)}\n= ${fmt((state.btech / 100) * revenuTechBase * bonusRace * bonusLogiciels)}`;
            const detailBudget = (nom: string, pct: number) => `Budget ${nom} :\nrevenu ${fmt(revenus)}\n× ${pct} %\n× composants électroniques (stock ≥ ${SEUIL_STOCK_IMPORTANT}) : ${fmt(bonusComposants)}\n= ${fmt((pct / 100) * revenus * bonusComposants)}`;

            const revenu_tech = (state.btech / 100) * revenuTechBase * bonusRace * bonusLogiciels;
            const revenu_besp = (state.besp / 100) * revenus * bonusComposants;
            const revenu_bcont = (state.bcont / 100) * revenus * bonusComposants;

            // Bénéfice = revenus - ce que coûtent les budgets au joueur (% des revenus) - terraformation.
            // Les bonus (race, logiciels, composants) augmentent la valeur d'un budget mais pas son coût : ils ne sont pas imputés ici.
            const coutBudgets = (state.btech + state.besp + state.bcont) / 100 * revenus;
            // Coût de la terraformation (planètes du joueur) si elle est cochée
            const coutTerra = state.terraformation
                ? mesPlanetes.reduce((acc, p) => acc + coutTerraformationPlanete(p.terraformation ?? 0), 0)
                : 0;
            const benefice = revenus - coutBudgets - coutTerra;
            const detailBenefice = `Bénéfice :\nrevenus ${fmt(revenus)}\n− budgets (tech ${state.btech} % + SS ${state.besp} % + CE ${state.bcont} % = ${state.btech + state.besp + state.bcont} % des revenus) : ${fmt(coutBudgets)}\n(les bonus race / logiciels / composants ne changent pas le coût)\n− terraformation : ${coutTerra}\n= ${fmt(benefice)}`;

            return {
                key,
                pos: `[${s.pos.x}-${s.pos.y}]`,
                nom: s.nom,
                stabilite,
                variation_stab,
                population,
                populationMax,
                population_variation,
                terraformation: state.terraformation,
                politique: state.politique,
                taxation: state.taxation,
                revenus,
                benefice,
                btech: state.btech,
                revenu_tech,
                besp: state.besp,
                revenu_besp,
                bcont: state.bcont,
                revenu_bcont,
                detailStabilite, detailVariationStab, detailPopulation, detailPopMax: `Population maximale des planètes du joueur (somme des pop max par race) : ${populationMax}`, detailVariationPop,
                detailRevenus, detailBenefice, detailTech,
                detailSS: detailBudget('services spéciaux', state.besp),
                detailCE: detailBudget('contre-espionnage', state.bcont),
            };
        };
        return systems.map(s => {
            const key = posToString(s.pos);
            return {
                ...calcul(s, states[key] || etatDuRapport(s, gouverneurs, numeroJoueur)),
                rapport: calcul(s, etatDuRapport(s, gouverneurs, numeroJoueur)),
            };
        });
    }, [systems, states, global, rapport, gouverneursDuRapport, gouverneurs, numeroJoueur]);

    const totals = useMemo(() => additionne(rows), [rows]);

    // Coût de la terraformation des systèmes cochés (somme sur les planètes du joueur)
    const terraformation = useMemo(() => {
        let total = 0;
        const details: string[] = [];
        systems.forEach(s => {
            if (!states[posToString(s.pos)]?.terraformation) return;
            const planetes = planetesDuJoueur(s, numeroJoueur);
            const cout = planetes.reduce((acc, p) => acc + coutTerraformationPlanete(p.terraformation ?? 0), 0);
            total += cout;
            details.push(`[${s.pos.x}-${s.pos.y}] ${s.nom} : ${planetes.length} planète(s) = ${cout}`);
        });
        return { total, nb: details.length, details };
    }, [systems, states, numeroJoueur]);

    // Ordres correspondant aux écarts entre la saisie et le rapport
    const ordres = useMemo(() => {
        const lignes: string[] = [];
        systems.forEach(s => {
            const etat = states[posToString(s.pos)];
            if (!etat) return;
            const ref = etatDuRapport(s, gouverneurs, numeroJoueur);
            const pos = `[${s.pos.x}-${s.pos.y}]`;
            if (etat.terraformation !== ref.terraformation) lignes.push(`${pos} ${etat.terraformation ? 'terraformation' : 'sans terraformation'}`);
            if (etat.taxation !== ref.taxation) lignes.push(`${pos} taxation ${etat.taxation}`);
            if (etat.politique !== ref.politique) lignes.push(`${pos} politique ${etat.politique !== undefined ? global?.politiques[etat.politique] ?? etat.politique : '?'}`);
            if (etat.btech !== ref.btech) lignes.push(`${pos} budget tech ${etat.btech}%`);
            if (etat.besp !== ref.besp) lignes.push(`${pos} budget SS ${etat.besp}%`);
            if (etat.bcont !== ref.bcont) lignes.push(`${pos} budget CE ${etat.bcont}%`);
        });
        // Changements d'affectation : on ne donne que la nouvelle affectation du lieutenant
        const affectation = (etats: (s: SystemeJoueur) => string | null) => {
            const m: Record<string, string> = {};
            systems.forEach(s => {
                const nom = etats(s);
                if (nom) m[nom] = `[${s.pos.x}-${s.pos.y}]`;
            });
            return m;
        };
        const avant = affectation(s => etatDuRapport(s, gouverneurs, numeroJoueur).gouverneur);
        const apres = affectation(s => (states[posToString(s.pos)] ?? etatDuRapport(s, gouverneurs, numeroJoueur)).gouverneur);
        gouverneursDuRapport.forEach(l => {
            const nouvelle = apres[l.nom] ?? 'réserve';
            if (nouvelle !== (avant[l.nom] ?? 'réserve')) lignes.push(`${l.nom} ${nouvelle}`);
        });
        return lignes;
    }, [systems, states, gouverneurs, gouverneursDuRapport, global, numeroJoueur]);
    const totalsRapport = useMemo(() => additionne(rows.map(r => r.rapport)), [rows]);

    // Totaux serrés pour laisser la place au tableau
    const thT: React.CSSProperties = { ...thStyle, padding: '3px 8px' };
    const tdT: React.CSSProperties = { ...tdStyle, padding: '2px 8px' };

    return (
        <div className="planification-revenu" style={{ padding: '20px', color: '#e0e0e0', flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <style>{`@keyframes revenuChange { 0% { background-color: #ffd54f; color: #000; } 100% { background-color: transparent; } }`}</style>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #444', paddingBottom: '4px', marginBottom: '8px', flexShrink: 0 }}>
                <h2 style={{ color: '#fff', margin: 0, fontSize: '1.1em' }}>Planification des Revenus</h2>
                <button
                    type="button"
                    onClick={handleResetAll}
                    disabled={ordres.length === 0}
                    title="Revenir aux valeurs du rapport pour tous les systèmes"
                    style={{ ...resetButtonStyle, padding: '6px 12px', opacity: ordres.length === 0 ? 0.3 : 1, cursor: ordres.length === 0 ? 'default' : 'pointer' }}
                >
                    ↺ Tout réinitialiser
                </button>
            </div>
            
            <div style={{ display: 'flex', gap: '20px', marginBottom: '8px', alignItems: 'stretch', flexShrink: 0 }}>
            <div style={{
                flex: '0 1 auto',
                padding: '8px 12px',
                backgroundColor: '#2a2a2a',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                overflowX: 'auto'
            }}>
                <strong style={{ color: '#aaa', textTransform: 'uppercase', fontSize: '0.8em' }}>Totaux Global</strong>
                <table style={{ borderCollapse: 'collapse', fontSize: '0.9em', marginTop: '2px' }}>
                    <thead>
                        <tr style={{ color: '#aaa', textAlign: 'right' }}>
                            <th style={{ ...thT, textAlign: 'left' }}></th>
                            <th style={thT}>Revenus</th>
                            <th style={{ ...thT, color: '#81c784' }}>Bénéfice</th>
                            <th style={{ ...thT, color: '#4fc3f7' }}>Tech</th>
                            <th style={{ ...thT, color: '#ba68c8' }}>Services Spéciaux</th>
                            <th style={{ ...thT, color: '#ff8a65' }}>Contre-Espionnage</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style={{ textAlign: 'right' }}>
                            <td style={{ ...tdT, textAlign: 'left', color: '#aaa' }}>Rapport (configuration initiale)</td>
                            {CHAMPS_TOTAUX.map(([k, couleur]) => (
                                <td key={k} style={{ ...tdT, color: couleur, fontWeight: 'bold' }}>{totalsRapport[k].toFixed(1)}</td>
                            ))}
                        </tr>
                        <tr style={{ textAlign: 'right' }}>
                            <td style={{ ...tdT, textAlign: 'left', color: '#aaa' }}>Avec la saisie</td>
                            {CHAMPS_TOTAUX.map(([k, couleur]) => {
                                const ecart = totals[k] - totalsRapport[k];
                                return (
                                    <td key={k} style={{ ...tdT, color: couleur, fontWeight: 'bold' }}>
                                        <Change>{totals[k].toFixed(1)}</Change>
                                        {Math.abs(ecart) >= 0.05 && (
                                            <div style={{ fontSize: '0.8em', color: ecart > 0 ? '#4caf50' : '#f44336' }}>
                                                ({ecart > 0 ? '+' : ''}{ecart.toFixed(1)})
                                            </div>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    </tbody>
                </table>
                <div
                    style={{ marginTop: '4px', color: '#aaa', cursor: terraformation.nb ? 'help' : undefined }}
                    title={terraformation.nb ? `Coût par planète : 50 + (niveau + 1) × 2\n${terraformation.details.join('\n')}` : 'Cochez « Terra. » sur un système pour voir son coût'}
                >
                    Coût terraformation : <b style={{ color: '#fff' }}><Change>{String(terraformation.total)}</Change></b>
                    {terraformation.nb > 0 && <span style={{ fontSize: '0.85em' }}> ({terraformation.nb} système{terraformation.nb > 1 ? 's' : ''})</span>}
                </div>
            </div>

                <div style={{ flex: 1, minWidth: 220, position: 'relative', backgroundColor: '#2a2a2a', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                    {/* contenu en absolu : la hauteur reste celle des totaux, la liste défile */}
                    <div style={{ position: 'absolute', inset: 0, padding: '15px', overflowY: 'auto' }}>
                        <strong style={{ color: '#aaa', textTransform: 'uppercase', fontSize: '0.8em' }}>Modifications ({ordres.length})</strong>
                        {ordres.length === 0
                            ? <div style={{ color: '#666', marginTop: '8px' }}>Aucune modification par rapport au rapport</div>
                            : <div style={{ marginTop: '8px', fontFamily: 'monospace', fontSize: '0.9em', whiteSpace: 'pre' }}>{ordres.join('\n')}</div>}
                    </div>
                </div>
            </div>

            {/* le tableau occupe la hauteur restante et défile seul : une seule barre verticale, barre horizontale visible, en-tête collé en haut */}
            <div style={{ overflow: 'auto', flex: 1, minHeight: 200 }}>
                <table className="planification_table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#1e1e1e', borderRadius: '8px', overflow: 'hidden' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#333', color: '#ccc', textAlign: 'left' }}>
                            <th style={thStyle}>Position</th>
                            <th style={thStyle}>Nom</th>
                            <th style={thStyle}>Stabilité</th>
                            <th style={thStyle}>Politique</th>
                            <th style={thStyle}>Gouverneur</th>
                            <th style={thStyle}>Terra.</th>
                            <th style={thStyle}>Pop / max</th>
                            <th style={thStyle}>Taxation</th>
                            <th style={thStyle}>Revenus</th>
                            <th style={thStyle}>Bénéfice</th>
                            <th style={thStyle}>Budget Tech</th>
                            <th style={thStyle}>Revenu Tech</th>
                            <th style={thStyle}>Budget SS</th>
                            <th style={thStyle}>Revenu SS</th>
                            <th style={thStyle}>Budget CE</th>
                            <th style={thStyle}>Revenu CE</th>
                            <th style={thStyle}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {systems.map((s, idx) => {
                            const key = posToString(s.pos);
                            const row = rows.find(r => r.key === key);
                            if (!row) return null;
                            const state = states[key] || etatDuRapport(s, gouverneurs, numeroJoueur);
                            const ref = etatDuRapport(s, gouverneurs, numeroJoueur);
                            const nomPolitique = (c: number | undefined) => (c !== undefined ? global?.politiques[c] ?? c : '?');
                            const modPolitique = state.politique !== ref.politique;
                            const modTerra = state.terraformation !== ref.terraformation;
                            const modGouv = state.gouverneur !== ref.gouverneur;
                            const modTax = state.taxation !== ref.taxation;
                            // Taxations différentes entre les planètes du joueur : la valeur affichée n'est qu'une moyenne
                            const planetesTax = planetesDuJoueur(s, numeroJoueur);
                            const taxationsHeterogenes = new Set(planetesTax.map(p => p.tax)).size > 1;
                            const detailTaxHeterogene = `Taxations différentes selon les planètes (moyenne arrondie à l'inférieur : ${ref.taxation}) :\n${planetesTax.map(p => `planète ${p.num ?? ''} : ${p.tax}`).join('\n')}${modTax ? '\nLa taxation saisie remplace celle de toutes les planètes.' : ''}`;
                            const modTech = state.btech !== ref.btech;
                            const modSS = state.besp !== ref.besp;
                            const modCE = state.bcont !== ref.bcont;
                            const totalBudgets = state.btech + state.besp + state.bcont;
                            const budgetsEnErreur = totalBudgets > 100;
                            const erreurBudget = `Total des budgets : ${totalBudgets}% (maximum 100%)`;
                            const modifie = modPolitique || modTerra || modGouv || modTax || modTech || modSS || modCE;
                            const marque = (m: boolean) => (m ? <span title="Différent du rapport" style={{ color: COULEUR_MODIFIE, marginLeft: '4px', fontWeight: 'bold', cursor: 'help' }}>●</span> : null);
                            // Les politiques "anti-*" ne sont pas proposées, sauf si elles sont déjà celle du système (rapport ou choix)
                            const politiqueCodes = Object.keys(global?.politiques || {}).map(Number)
                                .filter(c => !global?.politiques[c]?.startsWith('anti-') || c === state.politique || c === ref.politique)
                                .sort((a, b) => a - b);

                            return (
                                <tr key={row.key} style={{ borderBottom: '1px solid #333', backgroundColor: idx % 2 === 0 ? '#1e1e1e' : '#252525' }}>
                                    <td style={tdStyle}>{row.pos}</td>
                                    <td style={{ ...tdStyle, fontWeight: 'bold' }}>{row.nom}</td>
                                    <td style={tdStyle}>
                                        <Change detail={row.detailStabilite} rapport={row.rapport.stabilite.toFixed(1)}>{row.stabilite.toFixed(1)}</Change>
                                        <span style={{ marginLeft: '5px', color: row.variation_stab >= 0 ? '#4caf50' : '#f44336', fontSize: '0.85em', fontWeight: 'bold' }}>
                                            <Change detail={row.detailVariationStab} rapport={`(${row.rapport.variation_stab > 0 ? '+' : ''}${row.rapport.variation_stab})`}>{`(${row.variation_stab > 0 ? '+' : ''}${row.variation_stab})`}</Change>
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        <select
                                            value={state.politique ?? ''}
                                            onChange={(e) => handlePolitiqueChange(row.key, parseInt(e.target.value, 10))}
                                            style={styleModifie(selectStyle, modPolitique)}
                                            title={modPolitique ? `Rapport : ${nomPolitique(ref.politique)}` : formatEffetPolitique(state.politique)}
                                        >
                                            {state.politique === undefined && <option value="" disabled>?</option>}
                                            {politiqueCodes.map(c => {
                                                const eff = formatEffetPolitique(c);
                                                return <option key={c} value={c}>{global?.politiques[c]}{eff ? ` (${eff})` : ''}</option>;
                                            })}
                                        </select>
                                        {marque(modPolitique)}
                                    </td>
                                    <td style={tdStyle}>
                                        <select
                                            value={state.gouverneur ?? ''}
                                            onChange={(e) => handleGouverneurChange(row.key, e.target.value)}
                                            style={styleModifie(selectStyle, modGouv)}
                                            title={modGouv ? `Rapport : ${ref.gouverneur ?? 'aucun'}` : descriptionGouverneur(gouverneursDuRapport.find(l => l.nom === state.gouverneur), global?.competencesLieutenants)}
                                        >
                                            <option value="">aucun</option>
                                            {gouverneursDuRapport.map(l => (
                                                <option key={l.nom} value={l.nom}>{l.nom} (niv {l.niv})</option>
                                            ))}
                                        </select>
                                        {marque(modGouv)}
                                    </td>
                                    <td style={tdStyle}>
                                        <input 
                                            type="checkbox" 
                                            checked={!!state.terraformation}
                                            onChange={(e) => handleTerraChange(row.key, e.target.checked)}
                                            title={modTerra ? 'Rapport : sans terraformation' : undefined}
                                            style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: COULEUR_MODIFIE }}
                                        />
                                        {marque(modTerra)}
                                    </td>
                                    <td style={tdStyle}>
                                        <Change detail={row.detailPopulation} rapport={String(Math.floor(row.rapport.population))}>{String(Math.floor(row.population))}</Change>
                                        <span style={{ color: '#81c784', fontSize: '0.85em' }}>
                                            <Change detail={row.detailVariationPop} rapport={`(+${Math.floor(row.rapport.population_variation)})`}>{`(+${Math.floor(row.population_variation)})`}</Change>
                                        </span>
                                        <Change detail={row.detailPopMax} rapport={`/${row.rapport.populationMax}`} style={{ color: '#aaa' }}>{`/${row.populationMax}`}</Change>
                                    </td>
                                    <td style={tdStyle}>
                                        <select 
                                            value={row.taxation} 
                                            onChange={(e) => handleTaxChange(row.key, parseInt(e.target.value, 10))}
                                            style={styleModifie(selectStyle, modTax)}
                                            title={modTax ? `Rapport : ${ref.taxation}` : undefined}
                                        >
                                            {[0, 1, 2, 3, 4, 5].map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                        {marque(modTax)}
                                        {taxationsHeterogenes && (
                                            <span title={detailTaxHeterogene} style={{ marginLeft: '4px', color: COULEUR_MODIFIE, cursor: 'help' }}>⚠</span>
                                        )}
                                    </td>
                                    <td style={{ ...tdStyle, color: '#fff', fontWeight: 'bold' }}><Change detail={row.detailRevenus} rapport={row.rapport.revenus.toFixed(1)}>{row.revenus.toFixed(1)}</Change></td>
                                    <td style={{ ...tdStyle, color: '#81c784', fontWeight: 'bold' }}><Change detail={row.detailBenefice} rapport={row.rapport.benefice.toFixed(1)}>{row.benefice.toFixed(1)}</Change></td>
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <input 
                                                type="number" 
                                                min="0" max="100" 
                                                value={row.btech} 
                                                onChange={(e) => handleBudgetChange(row.key, 'btech', e.target.value)}
                                                style={budgetsEnErreur ? { ...inputStyle, borderColor: '#f44336', color: '#f44336', outline: '1px solid #f44336' } : styleModifie(inputStyle, modTech)}
                                                title={budgetsEnErreur ? erreurBudget : modTech ? `Rapport : ${ref.btech}%` : undefined}
                                            />
                                            <span style={{ fontSize: '0.8em', color: '#666' }}>%</span>
                                            {marque(modTech)}
                                        </div>
                                    </td>
                                    <td style={{ ...tdStyle, color: '#4fc3f7' }}><Change detail={row.detailTech} rapport={row.rapport.revenu_tech.toFixed(1)}>{row.revenu_tech.toFixed(1)}</Change></td>
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <input 
                                                type="number" 
                                                min="0" max="100" 
                                                value={row.besp} 
                                                onChange={(e) => handleBudgetChange(row.key, 'besp', e.target.value)}
                                                style={budgetsEnErreur ? { ...inputStyle, borderColor: '#f44336', color: '#f44336', outline: '1px solid #f44336' } : styleModifie(inputStyle, modSS)}
                                                title={budgetsEnErreur ? erreurBudget : modSS ? `Rapport : ${ref.besp}%` : undefined}
                                            />
                                            <span style={{ fontSize: '0.8em', color: '#666' }}>%</span>
                                            {marque(modSS)}
                                        </div>
                                    </td>
                                    <td style={{ ...tdStyle, color: '#ba68c8' }}><Change detail={row.detailSS} rapport={row.rapport.revenu_besp.toFixed(1)}>{row.revenu_besp.toFixed(1)}</Change></td>
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <input 
                                                type="number" 
                                                min="0" max="100" 
                                                value={row.bcont} 
                                                onChange={(e) => handleBudgetChange(row.key, 'bcont', e.target.value)}
                                                style={budgetsEnErreur ? { ...inputStyle, borderColor: '#f44336', color: '#f44336', outline: '1px solid #f44336' } : styleModifie(inputStyle, modCE)}
                                                title={budgetsEnErreur ? erreurBudget : modCE ? `Rapport : ${ref.bcont}%` : undefined}
                                            />
                                            <span style={{ fontSize: '0.8em', color: '#666' }}>%</span>
                                            {marque(modCE)}
                                        </div>
                                    </td>
                                    <td style={{ ...tdStyle, color: '#ff8a65' }}><Change detail={row.detailCE} rapport={row.rapport.revenu_bcont.toFixed(1)}>{row.revenu_bcont.toFixed(1)}</Change></td>
                                    <td style={tdStyle}>
                                        <button
                                            type="button"
                                            onClick={() => handleReset(row.key, s)}
                                            disabled={!modifie}
                                            title="Revenir aux valeurs du rapport"
                                            style={{ ...resetButtonStyle, opacity: modifie ? 1 : 0.3, cursor: modifie ? 'pointer' : 'default' }}
                                        >
                                            ↺
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: '12px 8px',
    fontSize: '0.85em',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '2px solid #444'
};

const tdStyle: React.CSSProperties = {
    padding: '10px 8px',
    fontSize: '0.95em',
    verticalAlign: 'middle'
};

const inputStyle: React.CSSProperties = {
    width: '45px',
    backgroundColor: '#333',
    color: '#fff',
    border: '1px solid #555',
    borderRadius: '4px',
    padding: '4px 6px',
    textAlign: 'right',
    fontSize: '0.9em'
};

const selectStyle: React.CSSProperties = {
    backgroundColor: '#333',
    color: '#fff',
    border: '1px solid #555',
    borderRadius: '4px',
    padding: '4px 6px',
    fontSize: '0.9em',
    cursor: 'pointer'
};

const resetButtonStyle: React.CSSProperties = {
    backgroundColor: '#333',
    color: '#fff',
    border: '1px solid #555',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '1em'
};

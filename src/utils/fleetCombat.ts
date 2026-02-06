import { FlotteJoueur, PlanVaisseau, GlobalData, Lieutenant } from '../types';

type WeaponCategory = 'laser' | 'plasma' | 'torp' | 'miss' | 'bombe';

const weaponCategoryMapping: { [key in WeaponCategory]: { baseDC: number; baseDB: number; baseToucher3: number; baseToucher7: number } } = {
    laser: { baseDC: 1, baseDB: 2, baseToucher3: 35, baseToucher7: 10 },
    plasma: { baseDC: 1, baseDB: 1, baseToucher3: 40, baseToucher7: 35 },
    torp: { baseDC: 2, baseDB: 1, baseToucher3: 3, baseToucher7: 30 },
    miss: { baseDC: 0, baseDB: 1, baseToucher3: 40, baseToucher7: 40 },
    bombe: { baseDC: 0, baseDB: 0, baseToucher3: 0, baseToucher7: 0 },
};

function getWeaponCategory(techBase: string): WeaponCategory | null {
    const category = techBase.toLowerCase() as WeaponCategory;
    return weaponCategoryMapping[category] ? category : null;
}

function getLevelAdjustedDCDB(baseDC: number, baseDB: number, level: number): { adjustedDC: number; adjustedDB: number } {
    let dcAdjustment = 0;
    if (level < 4) {
        dcAdjustment = 0;
    } else if (level < 8) {
        dcAdjustment = 1;
    } else if (level === 8) {
        dcAdjustment = 2;
    } else {
        dcAdjustment = 3;
    }

    let dbAdjustment = 0;
    if (level < 3) {
        dbAdjustment = 0;
    } else if (level < 7) {
        dbAdjustment = 1;
    } else if (level < 9) {
        dbAdjustment = 2;
    } else {
        dbAdjustment = 3;
    }

    return {
        adjustedDC: baseDC > 0 ? baseDC + dcAdjustment : 0,
        adjustedDB: baseDB > 0 ? baseDB + dbAdjustment : 0,
    };
}

function getExperienceEquipageLevel(exp: number): number {
    if (exp < 4000) return 0;
    if (exp < 20000) return 1;
    if (exp < 40000) return 2;
    if (exp < 100000) return 3;
    return 4;
}

function getModifRacial(raceCode: number): number {
    if (raceCode === 2 || raceCode === 3 || raceCode === 5) return 5;
    if (raceCode === 4 || raceCode === 6) return 10;
    // 0 or 1 or anything else
    return 0;
}

export function calculateFleetCombatStats(
    fleet: FlotteJoueur,
    privatePlans: PlanVaisseau[],
    globalData: GlobalData,
    lieutenant: Lieutenant | null
) {
    let finalDC = 0;
    let finalDB = 0;
    let fleetShieldSum = 0; // FIXED: Must be initialized here
    let fleetCases = 0;
    let totalExp = 0;
    let totalMoral = 0;
    let fleetCdT3Sum = 0;
    let fleetCdT3Count = 0;
    let fleetCdT7Sum = 0;
    let fleetCdT7Count = 0;

    const heroAttack = lieutenant ? (lieutenant.att ?? 0) : 0;
    const heroRace = lieutenant ? lieutenant.race : null;
    const heroCompBonus = lieutenant
        ? (lieutenant.competences || [])
            .filter(c => c.comp === 5)
            .reduce((sum, c) => sum + (c.val ?? 0), 0)
        : 0;

    let fleetChanceToucherSum = 0;
    let fleetChanceToucherCount = 0;

    const allPlans = [...privatePlans, ...globalData.plansPublic];

    fleet.vaisseaux.forEach(vaisseau => {
        totalExp += vaisseau.exp;
        totalMoral += vaisseau.moral;

        const plan = allPlans.find(p => p.nom === vaisseau.plan);
        if (!plan) {
            return;
        }

        fleetCases += (plan.pc ?? 0) * 2 + 1;

        const vaisseauRace = vaisseau.race ?? 0;
        const expEquipageLevel = getExperienceEquipageLevel(vaisseau.exp ?? 0);
        const modifRacial = getModifRacial(vaisseauRace);
        const sameRaceAsHero = heroRace !== null && heroRace === vaisseauRace;
        const raceHeros = sameRaceAsHero ? 1 + heroCompBonus : 0;

        //let shipWeaponChanceSum = 0;
        //let shipWeaponCount = 0;

        plan.composants.forEach(comp => {
            const tech = globalData.technologies.find(t => t.code === comp.code);
            if (!tech) return; // FIXED: Check tech existence before accessing tech.base
            if (tech.base?.toLowerCase() === 'bouclier') {
                            const shieldChar = tech.caracteristiques?.find(c => String(c.code) === '4');
                            if (shieldChar) {
                                // Multiply the shield value by the number of components (comp.nb)
                                fleetShieldSum += (Number(shieldChar.value) || 0) * comp.nb;
                            }
                        }

            
            if (tech.specification?.type !== 'arme') return;
        
            const category = getWeaponCategory(tech.base);
            if (!category) return;
        
            const { baseDC, baseDB, baseToucher3, baseToucher7 } = weaponCategoryMapping[category];
            const { adjustedDC, adjustedDB } = getLevelAdjustedDCDB(baseDC, baseDB, tech.niv);
        
            const intermediateDC = adjustedDC * comp.nb;
            const intermediateDB = adjustedDB * comp.nb;
        
            // Standard CdT
            const chanceToucherArme = 50 + tech.niv * 5;
            const rawChance = chanceToucherArme + expEquipageLevel + heroAttack + modifRacial + raceHeros;
            const chanceToucher = 0.01 * rawChance;
        
            finalDC += intermediateDC * chanceToucher;
            finalDB += intermediateDB * chanceToucher;
        
            // CdT3
            const chanceToucherArme3 = baseToucher3 + tech.niv * Math.max(baseToucher3 / 10, 1);
            const rawChance3 = chanceToucherArme3 + expEquipageLevel + heroAttack + modifRacial + raceHeros;
            const CdT3 = 0.01 * rawChance3;
        
            // CdT7
            const chanceToucherArme7 = baseToucher7 + tech.niv * Math.max(baseToucher7 / 10, 1);
            const rawChance7 = chanceToucherArme7 + expEquipageLevel + heroAttack + modifRacial + raceHeros;
            const CdT7 = 0.01 * rawChance7;
        
            // --- UPDATED FLEET TOTALS (ONLY ONCE PER WEAPON) ---
            if (category !== 'bombe') {
            fleetChanceToucherSum += (chanceToucher * comp.nb);
            fleetChanceToucherCount += comp.nb;
        
            fleetCdT3Sum += (CdT3 * comp.nb);
            fleetCdT3Count += comp.nb;
        
            fleetCdT7Sum += (CdT7 * comp.nb);
            fleetCdT7Count += comp.nb;
                }
            });
        });

    const fleetChanceToucher =
        fleetChanceToucherCount > 0 ? fleetChanceToucherSum / fleetChanceToucherCount : 0;

    const fleetCdT3 = fleetCdT3Count > 0 ? fleetCdT3Sum / fleetCdT3Count : 0;
    const fleetCdT7 = fleetCdT7Count > 0 ? fleetCdT7Sum / fleetCdT7Count : 0;

    const numVaisseaux = fleet.vaisseaux.length;
    return {
        dc: finalDC,
        db: finalDB,
        shield: fleetShieldSum, // 4. Return the new value
        cases: fleetCases,
        dcPerCase: fleetCases > 0 ? finalDC / fleetCases : 0,
        dbPerCase: fleetCases > 0 ? finalDB / fleetCases : 0,
        shieldPerCase: fleetCases > 0 ? fleetShieldSum / fleetCases : 0,
        exp: numVaisseaux > 0 ? totalExp / numVaisseaux : 0,
        moral: numVaisseaux > 0 ? totalMoral / numVaisseaux : 0,
        cdt: fleetChanceToucher,
        cdt3: fleetCdT3,
        cdt7: fleetCdT7,
    };
}

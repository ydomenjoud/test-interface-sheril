
export enum RacesEnum {
    FREMEN = 0,
    ATALANTE = 1,
    ZWAIAS = 2,
    YOKSOR = 3,
    FERGOK = 4,
    CYBORG = 5,
    KOROS = 6
}
;

export const racesEnumList = [
    RacesEnum.FREMEN,
    RacesEnum.ATALANTE,
    RacesEnum.ZWAIAS,
    RacesEnum.YOKSOR,
    RacesEnum.FERGOK,
    RacesEnum.CYBORG,
] as const;

export const raceIndexToNameMap: ReadonlyMap<RacesEnum, string> = new Map([
    [RacesEnum.FREMEN, 'Fremen'],
    [RacesEnum.ATALANTE, 'Atalante'],
    [RacesEnum.ZWAIAS, 'Zwaias'],
    [RacesEnum.YOKSOR, 'Yoksor'],
    [RacesEnum.FERGOK, 'Fergok'],
    [RacesEnum.CYBORG, 'Cyborg'],
]);

const RACES_CARACTERISTIQUES = [
    {
        growth: 0,
        techBonus: -5,
        spatialFight: 0,
        planetFight: 5
    },
    {
        growth: 10,
        techBonus: 0,
        spatialFight: 0,
        planetFight: 0
    },
    {
        growth: 10,
        techBonus: 0,
        spatialFight: 5,
        planetFight: 0
    },
    {
        growth: -5,
        techBonus: 20,
        spatialFight: 5,
        planetFight: -5
    },
    {
        growth: 10,
        techBonus: -10,
        spatialFight: 10,
        planetFight: 10
    },
    {
        growth: 0,
        techBonus: -5,
        spatialFight: 5,
        planetFight: 5
    },
    {
        growth: 100,
        techBonus:100,
        spatialFight:100,
        planetFight:100
    },
] as const;
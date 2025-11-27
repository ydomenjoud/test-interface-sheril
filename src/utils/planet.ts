// Bornes de vie des différentes races

import { Planete, Race } from "../types";

// Les conditions supportées par les différentes races(min et max).
export const HABITAT_RADIATION = [
    [40, 200],
    [0, 120],
    [10, 165],
    [50, 150],
    [50, 200],
    [0, 200],
    [0, 200],
];
export const HABITAT_TEMPERATURES = [
    [0, 200],
    [-50, 180],
    [-150, 70],
    [-100, 160],
    [-140, 190],
    [0, 200],
    [-150, 200],
];
export const HABITAT_GRAVITE = [
    [0, 80],
    [40, 100],
    [20, 80],
    [30, 90],
    [0, 80],
    [0, 20],
    [0, 100],
];
export const Atmospheres = [
    [3, 2, 2, 2, 2],
    [2, 2, 1, 1, 0],
    [0, 0, 0, 1, 2],
    [2, 2, 1, 2, 2],
    [-1, 0, 2, -1, -1],
    [-1, 0, 2, -1, -1]
]
export const atmospheresNameList = [
    'idéale',
    'vivifiante',
    'classique',
    'toxique',
    'très toxique',
];

export function maxPopulationByRace(race: Race['id'], {terraformation, radiation: radiation, temperature, gravity, size, atmosphere}: Planete): number {
    if ([
        radiation < (-2 * terraformation + HABITAT_RADIATION[race][0]),
        radiation > (2 * terraformation + HABITAT_RADIATION[race][1]),
        temperature < (-2 * terraformation + HABITAT_TEMPERATURES[race][0]),
        temperature  > (2 * terraformation + HABITAT_TEMPERATURES[race][1]),
        gravity < HABITAT_GRAVITE[race][0],
        gravity  > HABITAT_GRAVITE[race][1],
    ].some(v => v)) {
        return 0;
    }
    
	const radiationFactor = 1 - (1000 * (radiation - (-2 * terraformation + HABITAT_RADIATION[race][0])) * (radiation - (2 * terraformation + HABITAT_RADIATION[race][1])))
					/ (Math.pow(2 * terraformation, 2) + Math.pow(HABITAT_RADIATION[race][0] - HABITAT_RADIATION[race][1], 2));

	const temperatureFactor = 1 - (1000 * (temperature - (-2 * terraformation + HABITAT_TEMPERATURES[race][0])) * (temperature - (2 * terraformation + HABITAT_TEMPERATURES[race][1])))
					/ (Math.pow(2 * terraformation, 2) + Math.pow(HABITAT_TEMPERATURES[race][0] - HABITAT_TEMPERATURES[race][1], 2));

	const gravityFactor = 1 - (1000 * (gravity - HABITAT_GRAVITE[race][0]) * (gravity - HABITAT_GRAVITE[race][1]))
					/ (Math.pow(HABITAT_GRAVITE[race][0] - HABITAT_GRAVITE[race][1], 2));

                    
    const maxPop = Math.floor((( (Math.floor(radiationFactor) + Math.floor(temperatureFactor) + Math.floor(gravityFactor)) * 2 * size + Atmospheres[race][atmosphere] * 100 * size) * 9 / 10));
    console.log({radiationFactor, temperatureFactor, gravityFactor, maxPop});
    return Math.max(
        maxPop, 10
    );
} 
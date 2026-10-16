import {lastKnownSystem} from './systemHistory';
import {SystemSnapshot} from '../storage/rapportStore';
import {SystemeDetecte} from '../types';

const sys = (x: number, y: number, nom: string, tour: number): SystemeDetecte => ({
    type: 'detecte', nom, pos: {x, y}, typeEtoile: 1, nbPla: 5, proprietaires: [7], tour,
});
const snap = (tour: number, systemes: SystemeDetecte[]): SystemSnapshot => ({tour, systemes});

describe('lastKnownSystem', () => {
    it('retourne le système du tour le plus récent où il a été détecté sur la case', () => {
        const snapshots = [
            snap(5, [sys(1, 2, 'A', 5), sys(9, 9, 'B', 5)]),
            snap(10, [sys(1, 2, 'A', 10)]),
            snap(12, [sys(9, 9, 'B', 12)]),
        ];
        expect(lastKnownSystem(snapshots, {x: 1, y: 2}, 15)).toEqual({tour: 10, systeme: snapshots[1].systemes[0]});
        expect(lastKnownSystem(snapshots, {x: 9, y: 9}, 15)).toEqual({tour: 12, systeme: snapshots[2].systemes[0]});
    });

    it("ignore les tours supérieurs ou égaux au tour donné (ce ne sont pas des tours antérieurs)", () => {
        const snapshots = [snap(15, [sys(1, 2, 'A', 15)])];
        expect(lastKnownSystem(snapshots, {x: 1, y: 2}, 15)).toBeUndefined();
        expect(lastKnownSystem(snapshots, {x: 1, y: 2}, 14)).toBeUndefined();
    });

    it("renvoie undefined si le système n'a jamais été vu sur la case (ou s'il n'y a pas de tours stockés)", () => {
        const snapshots = [snap(10, [sys(1, 2, 'A', 10)]), snap(12, [sys(3, 4, 'C', 12)])];
        expect(lastKnownSystem(snapshots, {x: 3, y: 4}, 11)).toBeUndefined();
        expect(lastKnownSystem([], {x: 1, y: 2}, 15)).toBeUndefined();
    });
});
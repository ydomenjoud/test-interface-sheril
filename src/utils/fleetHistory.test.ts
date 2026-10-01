import {lastKnownFleets} from './fleetHistory';
import {FleetSnapshot} from '../storage/rapportStore';
import {FlotteDetectee} from '../types';

const flotte = (x: number, y: number, num: number): FlotteDetectee =>
    ({type: 'detecte', num, nom: `F${num}`, pos: {x, y}, nbVso: 1, proprio: 22, puiss: 'faible'});

describe('lastKnownFleets', () => {
    const pos = {x: 2, y: 9};

    it('retrouve les flottes du dernier tour où la case a été vue', () => {
        const snapshots: FleetSnapshot[] = [
            {tour: 1, flottes: [flotte(2, 9, 1)], observateurs: []},
            {tour: 2, flottes: [flotte(2, 9, 2), flotte(5, 5, 3)], observateurs: []},
        ];
        expect(lastKnownFleets(snapshots, pos, 3)).toEqual({tour: 2, flottes: [flotte(2, 9, 2)]});
    });

    it("s'arrête si la case a été observée vide entre-temps", () => {
        const snapshots: FleetSnapshot[] = [
            {tour: 1, flottes: [flotte(2, 9, 1)], observateurs: []},
            {tour: 2, flottes: [], observateurs: [{pos: {x: 3, y: 10}, scan: 2}]},
        ];
        expect(lastKnownFleets(snapshots, pos, 3)).toBeUndefined();
    });

    it('ignore les tours égaux ou postérieurs au tour affiché', () => {
        const snapshots: FleetSnapshot[] = [{tour: 3, flottes: [flotte(2, 9, 1)], observateurs: []}];
        expect(lastKnownFleets(snapshots, pos, 3)).toBeUndefined();
    });
});

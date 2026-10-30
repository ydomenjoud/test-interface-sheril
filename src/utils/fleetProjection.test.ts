import {FleetViewport, projectFleetRoute, shortestTorusDelta, visibleFleetCopies} from './fleetProjection';

const view: FleetViewport = {leftY: 1, topX: 1, rows: 43, cols: 84, cellSize: 16, maxX: 40, maxY: 40};

describe('fleet torus projection', () => {
    it('draws 40-39 to 40-1 as two horizontal cells, never a 38-cell return', () => {
        const segments = projectFleetRoute({x: 40, y: 39}, {x: 40, y: 1}, view);
        expect(segments.length).toBeGreaterThan(1);
        segments.forEach(({from, to}) => {
            expect(to.x - from.x).toBe(32);
            expect(to.y - from.y).toBe(0);
        });
    });
    it('uses the short vertical displacement on rectangular galaxies too', () => {
        const segments = projectFleetRoute({x: 60, y: 8}, {x: 1, y: 8}, {...view, maxX: 60, maxY: 50, rows: 65});
        expect(segments.length).toBeGreaterThan(0);
        segments.forEach(({from, to}) => {
            expect(to.x - from.x).toBe(0);
            expect(to.y - from.y).toBe(16);
        });
    });
    it('includes routes entering from an origin just outside the viewport', () => {
        const segments = projectFleetRoute({x: 5, y: 40}, {x: 5, y: 2}, {...view, rows: 10, cols: 10});
        expect(segments.some(({from, to}) => from.x < 16 && to.x >= 16)).toBe(true);
    });
    it('enumerates all visible copies but never draws fleet markers on coordinate headers', () => {
        const copies = visibleFleetCopies({x: 1, y: 1}, view);
        expect(copies).toEqual([{x: 640, y: 640}, {x: 1280, y: 640}]);
    });
    it('keeps half-torus ties stable and omits stationary routes', () => {
        expect(shortestTorusDelta(1, 21, 40)).toBe(20);
        expect(shortestTorusDelta(21, 1, 40)).toBe(-20);
        expect(projectFleetRoute({x: 1, y: 1}, {x: 1, y: 1}, view)).toEqual([]);
    });
});

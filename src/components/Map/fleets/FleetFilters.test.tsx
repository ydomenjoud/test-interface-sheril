import React, {useState} from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FleetFilters from './FleetFilters';
import {ALL_FLEET_SIZE_BANDS, FleetOwnerVisibility, FleetSizeBand} from '../../../utils/fleetModel';

const base = {
    enabled: true, focus: true, bands: ALL_FLEET_SIZE_BANDS, visibility: {showOwn: true, showNeutral: true},
    visibleCount: 47, totalCount: 188, onFocusChange: jest.fn(), onBandsChange: jest.fn(), onVisibilityChange: jest.fn(),
};
function Controlled() {
    const [bands, setBands] = useState<FleetSizeBand[]>([...ALL_FLEET_SIZE_BANDS]);
    const [visibility, setVisibility] = useState<FleetOwnerVisibility>({showOwn: true, showNeutral: true});
    return <FleetFilters {...base} bands={bands} visibility={visibility} onBandsChange={setBands} onVisibilityChange={setVisibility} />;
}

describe('simplified fleet filters', () => {
    it('contains the count, two ownership toggles and no unknown controls', () => {
        render(<FleetFilters {...base} />);
        expect(screen.getByRole('group', {name: 'Filtres des flottes'})).toContainElement(screen.getByRole('status'));
        expect(screen.getByRole('status')).toHaveTextContent('47/188 visibles');
        expect(screen.getByRole('checkbox', {name: 'Mes flottes'})).toBeChecked();
        expect(screen.getByRole('checkbox', {name: 'Flottes neutres'})).toBeChecked();
        expect(screen.queryByRole('checkbox', {name: /inconnue/i})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /Inconnues seules/i})).not.toBeInTheDocument();
    });
    it('changes ownership independently of the strength bands', () => {
        render(<Controlled />);
        const own = screen.getByRole('checkbox', {name: 'Mes flottes'});
        const neutral = screen.getByRole('checkbox', {name: 'Flottes neutres'});
        userEvent.click(own);
        expect(own).not.toBeChecked();
        expect(neutral).toBeChecked();
        userEvent.click(screen.getByRole('button', {name: 'Très grande +'}));
        expect(own).not.toBeChecked();
        expect(neutral).toBeChecked();
        userEvent.click(neutral);
        expect(neutral).not.toBeChecked();
    });
    it('always includes unknown strength without a dedicated toggle, even after a legacy value', () => {
        const onBandsChange = jest.fn();
        render(<FleetFilters {...base} bands={['weak']} onBandsChange={onBandsChange} />);
        userEvent.click(screen.getByRole('button', {name: 'Très grande +'}));
        expect(onBandsChange).toHaveBeenLastCalledWith(['weak', 'massive', 'unknown']);
        userEvent.click(screen.getByRole('button', {name: 'Faible'}));
        expect(onBandsChange).toHaveBeenLastCalledWith(['unknown']);
    });
    it('disables visibility controls with the fleet layer but lets focus enable the layer again', () => {
        const onFocusChange = jest.fn();
        render(<FleetFilters {...base} enabled={false} focus={false} onFocusChange={onFocusChange} />);
        expect(screen.getByRole('checkbox', {name: 'Mes flottes'})).toBeDisabled();
        expect(screen.getByRole('checkbox', {name: 'Flottes neutres'})).toBeDisabled();
        expect(screen.getByRole('button', {name: 'Faible'})).toBeDisabled();
        userEvent.click(screen.getByRole('checkbox', {name: 'Mode focus'}));
        expect(onFocusChange).toHaveBeenCalledWith(true);
    });
});

import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FleetFilters from './FleetFilters';
import {FleetOwnerVisibility, FleetPowerRange, MAX_POWER_LEVEL} from '../../../utils/fleetModel';

const base = {
    enabled: true, range: {min: 0, max: MAX_POWER_LEVEL}, visibility: {showOwn: true, showNeutral: true},
    visibleCount: 47, totalCount: 188, onRangeChange: jest.fn(), onVisibilityChange: jest.fn(),
};

describe('simplified fleet filters', () => {
    it('shows the count, the two ownership toggles and a dual power slider', () => {
        render(<FleetFilters {...base} />);
        expect(screen.getByRole('group', {name: 'Filtres des flottes'})).toContainElement(screen.getByRole('status'));
        expect(screen.getByRole('status')).toHaveTextContent('47/188 visibles');
        expect(screen.getByRole('checkbox', {name: 'Mes flottes'})).toBeChecked();
        expect(screen.getByRole('checkbox', {name: 'Flottes neutres'})).toBeChecked();
        expect(screen.getByRole('slider', {name: 'Puissance minimale'})).toBeInTheDocument();
        expect(screen.getByRole('slider', {name: 'Puissance maximale'})).toBeInTheDocument();
        expect(screen.queryByRole('checkbox', {name: /inconnue/i})).not.toBeInTheDocument();
    });

    it('displays the selected thresholds, 18000+ at the top stop', () => {
        const {rerender} = render(<FleetFilters {...base} range={{min: 3, max: 5}} />);
        expect(screen.getByText('100 – 500')).toBeInTheDocument();
        rerender(<FleetFilters {...base} range={{min: 0, max: MAX_POWER_LEVEL}} />);
        expect(screen.getByText('0 – 18000+')).toBeInTheDocument();
    });

    it('clamps the min slider below the max and the max slider above the min', () => {
        const onRangeChange = jest.fn();
        render(<FleetFilters {...base} range={{min: 5, max: 7}} onRangeChange={onRangeChange} />);
        fireEvent.change(screen.getByRole('slider', {name: 'Puissance minimale'}), {target: {value: '9'}});
        expect(onRangeChange).toHaveBeenLastCalledWith({min: 7, max: 7});
        fireEvent.change(screen.getByRole('slider', {name: 'Puissance maximale'}), {target: {value: '2'}});
        expect(onRangeChange).toHaveBeenLastCalledWith({min: 5, max: 5});
    });

    it('changes ownership independently of the power range', () => {
        const onVisibilityChange = jest.fn();
        const onRangeChange = jest.fn();
        render(<FleetFilters {...base} onVisibilityChange={onVisibilityChange} onRangeChange={onRangeChange} />);
        userEvent.click(screen.getByRole('checkbox', {name: 'Mes flottes'}));
        expect(onVisibilityChange).toHaveBeenLastCalledWith({showOwn: false, showNeutral: true});
        expect(onRangeChange).not.toHaveBeenCalled();
    });

    it('disables the controls with the fleet layer', () => {
        render(<FleetFilters {...base} enabled={false} />);
        expect(screen.getByRole('checkbox', {name: 'Mes flottes'})).toBeDisabled();
        expect(screen.getByRole('checkbox', {name: 'Flottes neutres'})).toBeDisabled();
        expect(screen.getByRole('slider', {name: 'Puissance minimale'})).toBeDisabled();
        expect(screen.getByRole('slider', {name: 'Puissance maximale'})).toBeDisabled();
    });
});

// components/MainLayout.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';

function MainLayout() {
    return (
        <div className="app-root">
            <Header />
            <div className="app-body" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <main
                    className="app-main"
                    style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                >
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

export default MainLayout;

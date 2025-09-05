import React from 'react';
import Header from './Header';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    return (
        <div className="layout">
            <Header />
            <main className="main-content">
                {children}
            </main>
        </div>
    );
};

export default Layout;

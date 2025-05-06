import React from 'react';
import './Header.styles.scss';

const Header: React.FC = () => {
    return (
        <header className="header">
            <div className="logo">MyApp</div>
            <nav className="navigation">
                <ul>
                    <li><a href="/">Home</a></li>
                    <li><a href="/features">Features</a></li>
                    <li><a href="/about">About</a></li>
                    <li><a href="/contact">Contact</a></li>
                </ul>
            </nav>
        </header>
    );
};

export default Header;
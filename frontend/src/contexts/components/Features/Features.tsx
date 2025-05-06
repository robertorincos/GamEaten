import React from 'react';
import './Features.styles.scss';

const Features: React.FC = () => {
    return (
        <section className="features">
            <h2 className="features__title">Our Features</h2>
            <div className="features__list">
                <div className="features__item">
                    <h3 className="features__item-title">Feature One</h3>
                    <p className="features__item-description">Description of feature one.</p>
                </div>
                <div className="features__item">
                    <h3 className="features__item-title">Feature Two</h3>
                    <p className="features__item-description">Description of feature two.</p>
                </div>
                <div className="features__item">
                    <h3 className="features__item-title">Feature Three</h3>
                    <p className="features__item-description">Description of feature three.</p>
                </div>
            </div>
        </section>
    );
};

export default Features;
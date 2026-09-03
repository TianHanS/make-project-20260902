/**
 * @name 卸煤调度管理
 */

import React from 'react';
import { Fuel, MapPin, Truck } from 'lucide-react';
import { defineHashPageRoute, useHashPage } from '../../common/useHashPage';
import { MessageHost } from './components/ui';
import MineUnloadPage from './pages/MineUnloadPage';
import UnloadPointPage from './pages/UnloadPointPage';
import './style.css';

const route = defineHashPageRoute(
    [
        { id: 'unload-point', title: '卸煤点管理' },
        { id: 'mine-unload', title: '矿点卸煤管理' },
    ],
    { defaultPageId: 'mine-unload' },
);

const tabs = [
    { id: 'unload-point', title: '卸煤点管理', icon: MapPin },
    { id: 'mine-unload', title: '矿点卸煤管理', icon: Truck },
];

export default function CoalUnloadDispatch() {
    const { page, setPage } = useHashPage(route);

    return (
        <div className="cd-app">
            <header className="cd-app-head">
                <div className="cd-brand">
                    <span className="cd-brand-mark">
                        <Fuel size={18} />
                    </span>
                    <div>
                        <h1 className="cd-brand-title">燃料集控平台 · 卸煤调度管理</h1>
                        <p className="cd-brand-sub">日前 / 当日来煤矿点卸煤位置调度</p>
                    </div>
                </div>
                <nav className="cd-tabs" aria-label="卸煤调度管理页面">
                    {tabs.map((t) => {
                        const Icon = t.icon;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                className={`cd-tab${page === t.id ? ' is-active' : ''}`}
                                onClick={() => setPage(t.id)}
                            >
                                <Icon size={15} />
                                {t.title}
                            </button>
                        );
                    })}
                </nav>
            </header>

            <main className="cd-app-main">
                {page === 'unload-point' ? <UnloadPointPage /> : <MineUnloadPage />}
            </main>

            <MessageHost />
        </div>
    );
}
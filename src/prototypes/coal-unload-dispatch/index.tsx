/**
 * @name 卸煤调度管理
 * @mode axure
 *
 * 参考资料：
 * - rules/axure-export-workflow.md
 * - rules/prototype-development-guide.md
 * - rules/axure-api-guide.md
 */

import React from 'react';
import { Fuel, MapPin, Truck } from 'lucide-react';
import { defineHashPageRoute, useHashPage } from '../../common/useHashPage';
import { MessageHost } from './components/ui';
import MineUnloadPage from './pages/MineUnloadPage';
import UnloadPointPage from './pages/UnloadPointPage';
import './style.css';
import { AnnotationViewer, type AnnotationSourceDocument } from '@axhub/annotation';
import annotationSourceDocument from './annotation-source.json';


const route = defineHashPageRoute(
    [
        { id: 'mine-unload', title: '矿点卸煤管理' },
        { id: 'unload-point', title: '卸煤点管理' },
    ],
    { defaultPageId: 'mine-unload' },
);

const tabs = [
    { id: 'mine-unload', title: '矿点卸煤管理', icon: Truck },
    { id: 'unload-point', title: '卸煤点管理', icon: MapPin },
];

const Component = function Component() {
    const { page, setPage } = useHashPage(route);

    return (
        <>
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
          <AnnotationViewer
            source={annotationSourceDocument as unknown as AnnotationSourceDocument}
            options={{
              currentPageId: (() => {
                const hashPageId = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('page');
                const searchPageId = new URLSearchParams(window.location.search.replace(/^\?/, '')).get('page');
                const pageId = hashPageId || searchPageId;
                return typeof pageId === 'string' && /^[a-z0-9-]+$/u.test(pageId)
                  ? pageId
                  : "coal-unload-dispatch";
              })(),
              onDirectoryRoute: (node) => {
                if (typeof node.route === 'string' && /^[a-z0-9-]+$/u.test(node.route)) {
                  window.location.hash = `page=${node.route}`;
                }
              },
              toolbarEdge: 'right',
              showToolbar: true,
              showThemeToggle: true,
              showColorFilter: true,
              emptyWhenNoData: true,
            }}
          />
        </>
    );
};

export default Component;

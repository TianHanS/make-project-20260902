/**
 * @name 自动入厂流程配置（场景表单）
 * @mode axure
 *
 * 参考资料：
 * - rules/prototype-development-guide.md
 * - .spec/spec.html
 */

import React, { useMemo, useState } from 'react';
import { /* Copy, */ GitBranch, Search, Settings, SlidersHorizontal } from 'lucide-react';
import {
    INITIAL_MODULES,
    MODULE_CATEGORY_TABS,
    MODULE_TYPE_FILTER_OPTIONS,
    ModuleCategory,
    ModuleFlowConfig,
    ModuleItem,
    hasSavedConfig,
    loadConfigs,
    moduleMatchesCategory,
    saveConfigs,
} from './data';
import {
    hasWbmSavedConfig,
    loadWbmConfigs,
    saveWbmConfigs,
    WbmModuleConfig,
} from './wbm-data';
import {
    // CopyFlowDrawer,
    FlowConfigDrawer,
} from './components/FlowDialogs';
import { WbmFlowConfigDrawer } from './components/WbmFlowDialogs';
import { Button, MessageHost, Select, message } from './components/ui';
import './style.css';
import { AnnotationViewer, type AnnotationSourceDocument } from '@axhub/annotation';
import annotationSourceDocument from './annotation-source.json';

const PAGE_SIZE = 20;

export default function Component() {
    const [modules] = useState<ModuleItem[]>(INITIAL_MODULES);
    const [configs, setConfigs] = useState<Record<string, ModuleFlowConfig>>(() => loadConfigs());
    const [wbmConfigs, setWbmConfigs] = useState<Record<string, WbmModuleConfig>>(() =>
        loadWbmConfigs(),
    );
    const [category, setCategory] = useState<ModuleCategory>('all');
    const [nameQ, setNameQ] = useState('');
    const [typeQ, setTypeQ] = useState('');
    const [appliedName, setAppliedName] = useState('');
    const [appliedType, setAppliedType] = useState('');
    const [page, setPage] = useState(1);

    const [flowModule, setFlowModule] = useState<ModuleItem | null>(null);
    const [wbmFlowModule, setWbmFlowModule] = useState<ModuleItem | null>(null);

    const filtered = useMemo(() => {
        return modules.filter((m) => {
            if (!moduleMatchesCategory(m, category)) return false;
            if (appliedName && !m.name.includes(appliedName) && !m.code.includes(appliedName))
                return false;
            if (appliedType && m.type !== appliedType) return false;
            return true;
        });
    }, [modules, category, appliedName, appliedType]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageSafe = Math.min(page, totalPages);
    const pageItems = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

    const persist = (next: Record<string, ModuleFlowConfig>) => {
        setConfigs(next);
        saveConfigs(next);
    };

    const persistWbm = (next: Record<string, WbmModuleConfig>) => {
        setWbmConfigs(next);
        saveWbmConfigs(next);
    };

    const openFlowConfig = (m: ModuleItem) => {
        if (m.type === 'AER') {
            setFlowModule(m);
            return;
        }
        if (m.type === 'WBM') {
            // 未配置时抽屉默认落在「设备布局及计量要求」Tab
            setWbmFlowModule(m);
            return;
        }
        message.info('本原型仅演示 AER 自动入厂与 WBM 汽车衡配置');
    };

    const flowInitial = flowModule
        ? configs[flowModule.id]
            ? {
                  sceneSource: configs[flowModule.id].sceneSource,
                  values: configs[flowModule.id].values,
              }
            : null
        : null;

    const wbmFlowInitial =
        wbmFlowModule && wbmConfigs[wbmFlowModule.id]
            ? wbmConfigs[wbmFlowModule.id]
            : null;

    return (
        <>
            <div className="ae-app">
                <header className="ae-app-head">
                    <div className="ae-brand">
                        <span className="ae-brand-mark">
                            <GitBranch size={18} />
                        </span>
                        <div>
                            <h1 className="ae-brand-title">燃料集控平台 · 自动化配置</h1>
                            <p className="ae-brand-sub">AER 自动入厂 · WBM 快速配置与流程编排</p>
                        </div>
                    </div>
                    <nav className="ae-tabs aef-top-tabs" aria-label="模块业务分类">
                        {MODULE_CATEGORY_TABS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                className={`ae-tab${category === tab.id ? ' is-active' : ''}`}
                                onClick={() => {
                                    setCategory(tab.id);
                                    setPage(1);
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </header>

                <main className="ae-app-main">
                    <div className="ae-page">
                        <div className="ae-card">
                            <div className="ae-card-head">
                                <h2 className="ae-card-title">模块列表</h2>
                                <div className="ae-card-tools ae-filter-bar">
                                    <label className="ae-filter-item">
                                        <span>模块名称</span>
                                        <input
                                            className="ae-input"
                                            value={nameQ}
                                            placeholder="名称或编码"
                                            onChange={(e) => setNameQ(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    setAppliedName(nameQ.trim());
                                                    setAppliedType(typeQ);
                                                    setPage(1);
                                                }
                                            }}
                                        />
                                    </label>
                                    <label className="ae-filter-item">
                                        <span>模块类型</span>
                                        <Select
                                            value={typeQ}
                                            options={MODULE_TYPE_FILTER_OPTIONS}
                                            onChange={setTypeQ}
                                            style={{ width: 160 }}
                                        />
                                    </label>
                                    <Button
                                        variant="primary"
                                        icon={<Search size={14} />}
                                        onClick={() => {
                                            setAppliedName(nameQ.trim());
                                            setAppliedType(typeQ);
                                            setPage(1);
                                        }}
                                    >
                                        查询
                                    </Button>
                                </div>
                            </div>

                            <div className="ae-module-grid aef-module-grid-4">
                                {pageItems.map((m) => {
                                    const isAer = m.type === 'AER';
                                    const isWbm = m.type === 'WBM';
                                    const configurable = isAer || isWbm;
                                    const configured = isAer
                                        ? hasSavedConfig(configs[m.id])
                                        : isWbm
                                          ? hasWbmSavedConfig(wbmConfigs[m.id])
                                          : false;
                                    const needFlowHint = configurable && !configured;
                                    return (
                                        <article key={m.id} className="ae-module-card">
                                            <header className="ae-module-card-head">{m.name}</header>
                                            <div className="ae-module-card-body">
                                                <p>
                                                    <span>模块编码</span>
                                                    <strong>{m.code}</strong>
                                                </p>
                                                <p>
                                                    <span>类型名称</span>
                                                    <strong>{m.typeName}</strong>
                                                </p>
                                            </div>
                                            <footer className="ae-module-card-foot aef-card-foot">
                                                <Button
                                                    size="small"
                                                    className={
                                                        configurable ? undefined : 'ae-btn-placeholder'
                                                    }
                                                    icon={<Settings size={13} />}
                                                    onClick={() =>
                                                        message.info(
                                                            configurable
                                                                ? '本期仅演示流程配置'
                                                                : '本原型仅演示 AER / WBM 流程配置',
                                                        )
                                                    }
                                                >
                                                    控制设置
                                                </Button>
                                                <span
                                                    className="aef-flow-btn-wrap"
                                                    title={
                                                        configurable
                                                            ? configured
                                                                ? '已维护流程配置'
                                                                : '尚未维护流程配置'
                                                            : undefined
                                                    }
                                                >
                                                    <Button
                                                        size="small"
                                                        className={
                                                            configurable
                                                                ? undefined
                                                                : 'ae-btn-placeholder'
                                                        }
                                                        icon={<SlidersHorizontal size={13} />}
                                                        onClick={() => openFlowConfig(m)}
                                                    >
                                                        流程配置
                                                    </Button>
                                                    {needFlowHint ? (
                                                        <i
                                                            className="aef-flow-status-dot"
                                                            aria-label="尚未维护流程配置"
                                                        />
                                                    ) : null}
                                                </span>
                                            </footer>
                                        </article>
                                    );
                                })}
                            </div>

                            <div className="ae-pagination">
                                <Button
                                    size="small"
                                    disabled={pageSafe <= 1}
                                    onClick={() => setPage((p) => p - 1)}
                                >
                                    上一页
                                </Button>
                                <span>
                                    第 {pageSafe} / {totalPages} 页 · 共 {filtered.length} 条
                                </span>
                                <Button
                                    size="small"
                                    disabled={pageSafe >= totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    下一页
                                </Button>
                            </div>
                        </div>
                    </div>
                </main>

                <FlowConfigDrawer
                    open={!!flowModule}
                    module={flowModule}
                    initial={flowInitial}
                    onClose={() => setFlowModule(null)}
                    onSave={({ sceneSource, values }) => {
                        if (!flowModule) return;
                        persist({
                            ...configs,
                            [flowModule.id]: {
                                moduleId: flowModule.id,
                                sceneSource,
                                values,
                                updatedAt: new Date().toISOString(),
                            },
                        });
                    }}
                />

                <WbmFlowConfigDrawer
                    open={!!wbmFlowModule}
                    module={wbmFlowModule}
                    initial={wbmFlowInitial}
                    onClose={() => setWbmFlowModule(null)}
                    onSave={(cfg) => {
                        if (!wbmFlowModule) return;
                        persistWbm({
                            ...wbmConfigs,
                            [wbmFlowModule.id]: cfg,
                        });
                    }}
                />

                <MessageHost />
            </div>
            <AnnotationViewer
                source={annotationSourceDocument as unknown as AnnotationSourceDocument}
                options={{
                    currentPageId: (() => {
                        const hashPageId = new URLSearchParams(
                            window.location.hash.replace(/^#/, ''),
                        ).get('page');
                        const searchPageId = new URLSearchParams(
                            window.location.search.replace(/^\?/, ''),
                        ).get('page');
                        const pageId = hashPageId || searchPageId;
                        return typeof pageId === 'string' && /^[a-z0-9-]+$/u.test(pageId)
                            ? pageId
                            : 'auto-entry-config-form';
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
}

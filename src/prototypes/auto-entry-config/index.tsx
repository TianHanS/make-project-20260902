/**
 * @name 自动入厂流程配置
 * @mode axure
 *
 * 参考资料：
 * - rules/axure-export-workflow.md
 * - rules/prototype-development-guide.md
 * - rules/axure-api-guide.md
 */

import React, { useMemo, useState } from 'react';
import { Copy, GitBranch, Search, Settings, SlidersHorizontal } from 'lucide-react';
import {
    INITIAL_MODULES,
    MODULE_TYPE_FILTER_OPTIONS,
    ModuleFlowConfig,
    ModuleItem,
    cloneSteps,
    defaultGlobalParams,
    loadConfigs,
    saveConfigs,
} from './data';
import { CopyFlowDrawer, FlowConfigDrawer } from './components/FlowDialogs';
import { Button, MessageHost, Select, message } from './components/ui';
import './style.css';

const PAGE_SIZE = 8;

const Component = function Component() {
    const [modules] = useState<ModuleItem[]>(INITIAL_MODULES);
    const [configs, setConfigs] = useState<Record<string, ModuleFlowConfig>>(() => loadConfigs());
    const [nameQ, setNameQ] = useState('');
    const [typeQ, setTypeQ] = useState('');
    const [appliedName, setAppliedName] = useState('');
    const [appliedType, setAppliedType] = useState('');
    const [page, setPage] = useState(1);

    const [flowModule, setFlowModule] = useState<ModuleItem | null>(null);
    const [copyModule, setCopyModule] = useState<ModuleItem | null>(null);

    const filtered = useMemo(() => {
        return modules.filter((m) => {
            if (appliedName && !m.name.includes(appliedName) && !m.code.includes(appliedName)) return false;
            if (appliedType && m.type !== appliedType) return false;
            return true;
        });
    }, [modules, appliedName, appliedType]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageSafe = Math.min(page, totalPages);
    const pageItems = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

    const persist = (next: Record<string, ModuleFlowConfig>) => {
        setConfigs(next);
        saveConfigs(next);
    };

    const openFlow = (m: ModuleItem) => setFlowModule(m);
    const openCopy = (m: ModuleItem) => {
        if (!configs[m.id]?.steps?.length) {
            message.warning('当前模块尚无流程配置，仍可复制空配置到目标');
        }
        setCopyModule(m);
    };

    const peersForCopy = copyModule
        ? modules.filter((m) => m.type === copyModule.type && m.id !== copyModule.id)
        : [];

    return (
        <div className="ae-app">
            <header className="ae-app-head">
                <div className="ae-brand">
                    <span className="ae-brand-mark">
                        <GitBranch size={18} />
                    </span>
                    <div>
                        <h1 className="ae-brand-title">燃料集控平台 · 自动化配置</h1>
                        <p className="ae-brand-sub">AER 自动入厂流程配置与复制</p>
                    </div>
                </div>
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

                        <div className="ae-module-grid">
                            {pageItems.map((m) => {
                                const isAer = m.type === 'AER';
                                const hasCfg = (configs[m.id]?.steps?.length ?? 0) > 0;
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
                                            {isAer && hasCfg ? (
                                                <p className="ae-module-card-flag">已配置流程</p>
                                            ) : null}
                                        </div>
                                        <footer className="ae-module-card-foot">
                                            {isAer ? (
                                                <>
                                                    <Button
                                                        size="small"
                                                        icon={<SlidersHorizontal size={13} />}
                                                        onClick={() => openFlow(m)}
                                                    >
                                                        流程配置
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        icon={<Copy size={13} />}
                                                        onClick={() => openCopy(m)}
                                                    >
                                                        复制流程
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button
                                                        size="small"
                                                        className="ae-btn-placeholder"
                                                        icon={<Settings size={13} />}
                                                        onClick={() =>
                                                            message.info('本原型仅演示 AER 自动入厂配置')
                                                        }
                                                    >
                                                        控制设置
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        className="ae-btn-placeholder"
                                                        icon={<SlidersHorizontal size={13} />}
                                                        onClick={() =>
                                                            message.info('本原型仅演示 AER 自动入厂配置')
                                                        }
                                                    >
                                                        流程配置
                                                    </Button>
                                                </>
                                            )}
                                        </footer>
                                    </article>
                                );
                            })}
                        </div>

                        <div className="ae-pagination">
                            <Button size="small" disabled={pageSafe <= 1} onClick={() => setPage((p) => p - 1)}>
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
                initialSteps={flowModule ? configs[flowModule.id]?.steps ?? [] : []}
                initialGlobal={flowModule ? configs[flowModule.id]?.globalParams : undefined}
                onClose={() => setFlowModule(null)}
                onSave={({ steps, globalParams }) => {
                    if (!flowModule) return;
                    persist({
                        ...configs,
                        [flowModule.id]: {
                            moduleId: flowModule.id,
                            steps,
                            globalParams,
                            updatedAt: new Date().toISOString(),
                        },
                    });
                }}
            />

            <CopyFlowDrawer
                open={!!copyModule}
                source={copyModule}
                peers={peersForCopy}
                onClose={() => setCopyModule(null)}
                onConfirmCopy={(targetId) => {
                    if (!copyModule) return;
                    const sourceCfg = configs[copyModule.id];
                    const sourceSteps = sourceCfg?.steps ?? [];
                    persist({
                        ...configs,
                        [targetId]: {
                            moduleId: targetId,
                            steps: cloneSteps(sourceSteps),
                            globalParams: structuredClone(sourceCfg?.globalParams ?? defaultGlobalParams()),
                            updatedAt: new Date().toISOString(),
                        },
                    });
                    const target = modules.find((m) => m.id === targetId);
                    message.success(`已复制到「${target?.name ?? targetId}」（覆盖更新）`);
                }}
            />

            <MessageHost />
        </div>
    );
};

export default Component;

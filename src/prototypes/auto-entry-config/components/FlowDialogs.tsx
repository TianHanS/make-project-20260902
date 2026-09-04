import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, GitBranch, Plus, Settings2, SlidersHorizontal, Trash2, Zap } from 'lucide-react';
import {
    FlowStep,
    GlobalParams,
    ModuleItem,
    QUICK_TEMPLATES,
    QuickTemplate,
    RegisterParams,
    SUB_PROCESS_DEFS,
    SubProcessCode,
    defaultGlobalParams,
    defaultParams,
    defByCode,
    nextStepId,
} from '../data';
import { Button, Drawer, Empty, Tag, message } from './ui';
import { ParamDrawer } from './ParamDrawer';
import { GlobalParamsDrawer } from './GlobalParamsDrawer';

export function FlowConfigDrawer({
    open,
    module,
    initialSteps,
    initialGlobal,
    onClose,
    onSave,
}: {
    open: boolean;
    module: ModuleItem | null;
    initialSteps: FlowStep[];
    initialGlobal?: GlobalParams;
    onClose: () => void;
    onSave: (payload: { steps: FlowStep[]; globalParams: GlobalParams }) => void;
}) {
    const [steps, setSteps] = useState<FlowStep[]>([]);
    const [globalParams, setGlobalParams] = useState<GlobalParams>(defaultGlobalParams());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [quickOpen, setQuickOpen] = useState(false);
    const [globalOpen, setGlobalOpen] = useState(false);

    useEffect(() => {
        if (!open) return;
        setSteps(initialSteps.map((s) => ({ ...s, params: structuredClone(s.params) })));
        setGlobalParams(structuredClone(initialGlobal ?? defaultGlobalParams()));
        setEditingId(null);
        setQuickOpen(false);
        setGlobalOpen(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, module?.id]);

    const editing = steps.find((s) => s.instanceId === editingId) ?? null;

    const addStep = (code: SubProcessCode) => {
        setSteps((prev) => [
            ...prev,
            {
                instanceId: nextStepId(),
                code,
                needsConfirm: true,
                fromScene: false,
                params: defaultParams(code),
            },
        ]);
    };

    const applyTemplate = (tpl: QuickTemplate) => {
        setSteps(tpl.build());
        setQuickOpen(false);
        message.success(`已加载「${tpl.name}」，可直接保存`);
    };

    const move = (index: number, dir: -1 | 1) => {
        setSteps((prev) => {
            const next = [...prev];
            const j = index + dir;
            if (j < 0 || j >= next.length) return prev;
            [next[index], next[j]] = [next[j], next[index]];
            return next;
        });
    };

    const remove = (id: string) => setSteps((prev) => prev.filter((s) => s.instanceId !== id));

    const handleSave = () => {
        const pending = steps.filter((s) => s.needsConfirm);
        for (const s of steps) {
            if (s.code === 'register') {
                const p = s.params as RegisterParams;
                if (!p.enterPointName.trim()) {
                    message.error(`${defByCode(s.code).name}：请填写关联人员 / 入厂点名`);
                    setEditingId(s.instanceId);
                    return;
                }
            }
        }
        if (pending.length > 0) {
            message.warning(`仍有 ${pending.length} 项待确认，已保存整体流程`);
        } else if (steps.length === 0) {
            message.info('已保存配置（含全局参数）');
        } else {
            message.success('流程配置已保存');
        }
        onSave({ steps, globalParams });
        onClose();
    };

    if (!module) return null;

    return (
        <>
            <Drawer
                open={open}
                title={`流程配置 · ${module.name}`}
                onClose={onClose}
                width={880}
                maskClosable={false}
                footer={
                    <div className="ae-drawer-actions">
                        <Button onClick={onClose}>取消</Button>
                        <Button variant="primary" onClick={handleSave}>
                            保存
                        </Button>
                    </div>
                }
            >
                <div className="ae-flow-toolbar">
                    <div className="ae-flow-toolbar-meta">
                        <span>
                            模块编码 <code>{module.code}</code>
                        </span>
                        <span>
                            类型 <Tag color="processing">{module.typeName}</Tag>
                        </span>
                    </div>
                    <Button variant="primary" icon={<Zap size={14} />} onClick={() => setQuickOpen(true)}>
                        快速配置
                    </Button>
                </div>
                <p className="ae-flow-scene-hint">
                    可从子流程库逐项编排，或点击「快速配置」选择预制模板一键加载（加载后可直接保存）。全局参数与流程步骤相互独立。
                </p>

                <div className="ae-flow-split">
                    <aside className="ae-flow-lib">
                        <h3 className="ae-flow-panel-title">子流程库</h3>
                        <ul className="ae-flow-lib-list">
                            {SUB_PROCESS_DEFS.map((d) => (
                                <li key={d.code} className="ae-flow-lib-item">
                                    <div className="ae-flow-lib-main">
                                        <div className="ae-flow-lib-head">
                                            <strong>{d.name}</strong>
                                            <code>{d.code}</code>
                                        </div>
                                        <p>{d.description}</p>
                                    </div>
                                    <button
                                        type="button"
                                        className="ae-icon-add"
                                        title={`添加「${d.name}」到流程`}
                                        aria-label={`添加${d.name}`}
                                        onClick={() => addStep(d.code)}
                                    >
                                        <Plus size={16} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </aside>

                    <section className="ae-flow-result">
                        <button type="button" className="ae-global-entry" onClick={() => setGlobalOpen(true)}>
                            <span className="ae-global-entry-icon">
                                <SlidersHorizontal size={16} />
                            </span>
                            <span className="ae-global-entry-text">
                                <strong>全局参数配置</strong>
                                <span>
                                    通知{globalParams.notifyEnabled === '0' ? '启用' : '禁用'} ·{' '}
                                    {globalParams.ledContent || '未设置 LED 文案'}
                                </span>
                            </span>
                            <span className="ae-global-entry-action">加载全局参数</span>
                        </button>

                        <h3 className="ae-flow-panel-title">
                            执行流程
                            <span className="ae-flow-count">{steps.length} 步</span>
                        </h3>
                        {steps.length === 0 ? (
                            <Empty
                                description="点击左侧 + 添加子流程，或使用快速配置"
                                icon={<GitBranch size={36} />}
                            />
                        ) : (
                            <ol className="ae-flow-steps">
                                {steps.map((s, index) => {
                                    const def = defByCode(s.code);
                                    return (
                                        <li key={s.instanceId} className="ae-flow-step">
                                            <span className="ae-flow-step-idx">{index + 1}</span>
                                            <div className="ae-flow-step-main">
                                                <div className="ae-flow-step-title">
                                                    <strong>{def.name}</strong>
                                                    <code>{def.code}</code>
                                                    {s.fromScene && !s.needsConfirm ? (
                                                        <Tag color="success">场景已就绪</Tag>
                                                    ) : null}
                                                    {s.needsConfirm ? <Tag color="warning">待确认</Tag> : null}
                                                </div>
                                                <p className="ae-flow-step-desc">{def.description}</p>
                                            </div>
                                            <div className="ae-flow-step-actions">
                                                <Button
                                                    size="small"
                                                    icon={<Settings2 size={12} />}
                                                    onClick={() => setEditingId(s.instanceId)}
                                                    title="配置参数"
                                                />
                                                <Button
                                                    size="small"
                                                    icon={<ArrowUp size={12} />}
                                                    disabled={index === 0}
                                                    onClick={() => move(index, -1)}
                                                    title="上移"
                                                />
                                                <Button
                                                    size="small"
                                                    icon={<ArrowDown size={12} />}
                                                    disabled={index === steps.length - 1}
                                                    onClick={() => move(index, 1)}
                                                    title="下移"
                                                />
                                                <Button
                                                    size="small"
                                                    danger
                                                    icon={<Trash2 size={12} />}
                                                    onClick={() => remove(s.instanceId)}
                                                    title="删除"
                                                />
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                    </section>
                </div>
            </Drawer>

            <GlobalParamsDrawer
                open={globalOpen}
                initial={globalParams}
                onClose={() => setGlobalOpen(false)}
                onSave={(params) => {
                    setGlobalParams(params);
                    message.success('全局参数已写入，保存流程配置后生效');
                }}
            />

            <QuickConfigDrawer
                open={quickOpen}
                hasExistingSteps={steps.length > 0}
                onClose={() => setQuickOpen(false)}
                onConfirm={applyTemplate}
            />

            <ParamDrawer
                open={!!editing}
                step={editing}
                onClose={() => setEditingId(null)}
                onSave={(params) => {
                    setSteps((prev) =>
                        prev.map((s) =>
                            s.instanceId === editingId
                                ? { ...s, params, needsConfirm: false, fromScene: s.fromScene }
                                : s,
                        ),
                    );
                    message.success('子流程参数已更新');
                }}
            />
        </>
    );
}

/** @deprecated 兼容旧命名 */
export const FlowConfigModal = FlowConfigDrawer;

function QuickConfigDrawer({
    open,
    hasExistingSteps,
    onClose,
    onConfirm,
}: {
    open: boolean;
    hasExistingSteps: boolean;
    onClose: () => void;
    onConfirm: (tpl: QuickTemplate) => void;
}) {
    const [selectedId, setSelectedId] = useState(QUICK_TEMPLATES[0]?.id ?? '');
    const [confirmOpen, setConfirmOpen] = useState(false);

    useEffect(() => {
        if (open) {
            setSelectedId(QUICK_TEMPLATES[0]?.id ?? '');
            setConfirmOpen(false);
        }
    }, [open]);

    const selected = QUICK_TEMPLATES.find((t) => t.id === selectedId) ?? null;

    const tryLoad = () => {
        if (!selected) {
            message.warning('请先选择一个配置方案');
            return;
        }
        if (hasExistingSteps) setConfirmOpen(true);
        else onConfirm(selected);
    };

    return (
        <>
            <Drawer
                open={open}
                title="快速配置"
                onClose={onClose}
                width={420}
                nested
                footer={
                    <div className="ae-drawer-actions">
                        <Button onClick={onClose}>取消</Button>
                        <Button variant="primary" disabled={!selectedId} onClick={tryLoad}>
                            确认加载
                        </Button>
                    </div>
                }
            >
                <p className="ae-field-guide" style={{ marginBottom: 12 }}>
                    选择预制配置方案，确认后将加载对应子流程及参数；加载结果可直接保存，也可再微调。
                </p>
                <ul className="ae-tpl-list">
                    {QUICK_TEMPLATES.map((tpl) => {
                        const active = tpl.id === selectedId;
                        return (
                            <li key={tpl.id}>
                                <button
                                    type="button"
                                    className={`ae-tpl-card${active ? ' is-selected' : ''}`}
                                    onClick={() => setSelectedId(tpl.id)}
                                >
                                    <span className="ae-tpl-radio" aria-hidden="true" />
                                    <span className="ae-tpl-body">
                                        <strong>{tpl.name}</strong>
                                        <span>{tpl.description}</span>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </Drawer>

            <Drawer
                open={confirmOpen}
                title="覆盖当前流程？"
                onClose={() => setConfirmOpen(false)}
                width={400}
                nested
                footer={
                    <div className="ae-drawer-actions">
                        <Button onClick={() => setConfirmOpen(false)}>取消</Button>
                        <Button
                            variant="primary"
                            onClick={() => {
                                if (!selected) return;
                                onConfirm(selected);
                                setConfirmOpen(false);
                            }}
                        >
                            覆盖并加载
                        </Button>
                    </div>
                }
            >
                <p>
                    当前执行流程已有内容，加载「{selected?.name}」将覆盖现有步骤与参数。
                </p>
            </Drawer>
        </>
    );
}

export function CopyFlowDrawer({
    open,
    source,
    peers,
    onClose,
    onConfirmCopy,
}: {
    open: boolean;
    source: ModuleItem | null;
    peers: ModuleItem[];
    onClose: () => void;
    onConfirmCopy: (targetId: string) => void;
}) {
    const [targetId, setTargetId] = useState('');
    const [confirmOpen, setConfirmOpen] = useState(false);

    useEffect(() => {
        if (open) {
            setTargetId('');
            setConfirmOpen(false);
        }
    }, [open]);

    if (!source) return null;

    const target = peers.find((p) => p.id === targetId);

    return (
        <>
            <Drawer
                open={open}
                title="复制流程"
                onClose={onClose}
                width={420}
                footer={
                    <div className="ae-drawer-actions">
                        <Button onClick={onClose}>取消</Button>
                        <Button
                            variant="primary"
                            icon={<Copy size={14} />}
                            disabled={!targetId}
                            onClick={() => setConfirmOpen(true)}
                        >
                            确认复制
                        </Button>
                    </div>
                }
            >
                <FieldLike label="复制的模块">
                    <div className="ae-copy-source">
                        <strong>{source.name}</strong>
                        <span>
                            {source.code} · {source.typeName}
                        </span>
                    </div>
                </FieldLike>
                <FieldLike label="复制到模块" required>
                    <select
                        className="ae-native-select"
                        value={targetId}
                        onChange={(e) => setTargetId(e.target.value)}
                    >
                        <option value="">请选择同类型模块</option>
                        {peers.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}（{p.code}）
                            </option>
                        ))}
                    </select>
                    <p className="ae-field-guide">仅列出同模块类型，且不可选当前模块本身</p>
                </FieldLike>
            </Drawer>

            <Drawer
                open={confirmOpen}
                title="确认覆盖复制？"
                onClose={() => setConfirmOpen(false)}
                width={400}
                nested
                footer={
                    <div className="ae-drawer-actions">
                        <Button onClick={() => setConfirmOpen(false)}>取消</Button>
                        <Button
                            variant="primary"
                            onClick={() => {
                                if (!targetId) return;
                                onConfirmCopy(targetId);
                                setConfirmOpen(false);
                                onClose();
                            }}
                        >
                            确认覆盖
                        </Button>
                    </div>
                }
            >
                <p>
                    将把「{source.name}」的流程配置复制到「{target?.name}」。
                    {target ? '若目标模块已存在配置参数，将按覆盖更新策略替换。' : null}
                </p>
            </Drawer>
        </>
    );
}

function FieldLike({
    label,
    required,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="ae-field" style={{ marginBottom: 16 }}>
            <label className="ae-field-label">
                {required ? <span className="ae-field-required">*</span> : null}
                {label}
            </label>
            <div className="ae-field-control">{children}</div>
        </div>
    );
}

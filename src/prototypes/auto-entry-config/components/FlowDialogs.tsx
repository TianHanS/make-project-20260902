import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, GitBranch, Plus, Settings2, Trash2, Zap } from 'lucide-react';
import {
    FlowStep,
    ModuleItem,
    RegisterParams,
    SUB_PROCESS_DEFS,
    SubProcessCode,
    buildStandardSceneSteps,
    defaultParams,
    defByCode,
    nextStepId,
} from '../data';
import { Button, Drawer, Empty, Modal, Tag, message } from './ui';
import { ParamDrawer } from './ParamDrawer';

export function FlowConfigModal({
    open,
    module,
    initialSteps,
    onClose,
    onSave,
}: {
    open: boolean;
    module: ModuleItem | null;
    initialSteps: FlowStep[];
    onClose: () => void;
    onSave: (steps: FlowStep[]) => void;
}) {
    const [steps, setSteps] = useState<FlowStep[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [sceneConfirmOpen, setSceneConfirmOpen] = useState(false);

    useEffect(() => {
        if (!open) return;
        setSteps(initialSteps.map((s) => ({ ...s, params: structuredClone(s.params) })));
        setEditingId(null);
        // 仅在打开弹窗或切换模块时回填，避免父组件重渲染导致编辑中断
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

    const applyStandardScene = () => {
        setSteps(buildStandardSceneSteps());
        setSceneConfirmOpen(false);
        message.success('已加载「标准自动入厂流程」，可直接保存');
    };

    const onPickScene = () => {
        if (steps.length > 0) setSceneConfirmOpen(true);
        else applyStandardScene();
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
            message.info('已保存空流程配置');
        } else {
            message.success('流程配置已保存');
        }
        onSave(steps);
        onClose();
    };

    if (!module) return null;

    return (
        <>
            <Modal
                open={open}
                title={`流程配置 · ${module.name}`}
                onClose={onClose}
                width={920}
                maskClosable={false}
                footer={
                    <div className="ae-modal-actions">
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
                    <Button variant="primary" icon={<Zap size={14} />} onClick={onPickScene}>
                        标准自动入厂流程
                    </Button>
                </div>
                <p className="ae-flow-scene-hint">
                    快速场景：车辆提前预登记 → 到厂车牌识别 → 来煤入厂登记。加载后无需再配参即可直接保存。
                </p>

                <div className="ae-flow-split">
                    <aside className="ae-flow-lib">
                        <h3 className="ae-flow-panel-title">子流程库</h3>
                        <ul className="ae-flow-lib-list">
                            {SUB_PROCESS_DEFS.map((d) => (
                                <li key={d.code} className="ae-flow-lib-item">
                                    <div className="ae-flow-lib-head">
                                        <strong>{d.name}</strong>
                                        <code>{d.code}</code>
                                    </div>
                                    <p>{d.description}</p>
                                    <Button size="small" icon={<Plus size={12} />} onClick={() => addStep(d.code)}>
                                        添加到流程
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </aside>

                    <section className="ae-flow-result">
                        <h3 className="ae-flow-panel-title">
                            执行流程
                            <span className="ae-flow-count">{steps.length} 步</span>
                        </h3>
                        {steps.length === 0 ? (
                            <Empty description="从左侧添加子流程，或使用快速场景一键配置" icon={<GitBranch size={36} />} />
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
                                                >
                                                    配置
                                                </Button>
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
            </Modal>

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

            <Modal
                open={sceneConfirmOpen}
                title="覆盖当前流程？"
                onClose={() => setSceneConfirmOpen(false)}
                width={420}
                footer={
                    <div className="ae-modal-actions">
                        <Button onClick={() => setSceneConfirmOpen(false)}>取消</Button>
                        <Button variant="primary" onClick={applyStandardScene}>
                            覆盖并加载
                        </Button>
                    </div>
                }
            >
                <p>当前执行流程已有内容，加载「标准自动入厂流程」将覆盖现有步骤与参数。</p>
            </Modal>
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

            <Modal
                open={confirmOpen}
                title="确认覆盖复制？"
                onClose={() => setConfirmOpen(false)}
                width={420}
                footer={
                    <div className="ae-modal-actions">
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
            </Modal>
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

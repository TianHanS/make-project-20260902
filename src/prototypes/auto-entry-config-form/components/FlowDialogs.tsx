import React, { useEffect, useRef, useState } from 'react';
import { Copy, HelpCircle, Sparkles, Wand2 } from 'lucide-react';
import {
    BARRIER_OPTIONS,
    ENTER_POINT_OPTIONS,
    FLOW_STEPS,
    FlowFormValues,
    FlowStepId,
    ModuleItem,
    NotifyItem,
    REGISTER_TYPE_OPTIONS,
    RESET_BARRIER_OPTIONS,
    SCENE_OPTIONS,
    SceneSource,
    createDefaultFormValues,
} from '../data';
import { Button, Drawer, Field, Input, Select, message } from './ui';

function NotifyField({
    label,
    value,
    onChange,
    disabled,
}: {
    label: string;
    value: NotifyItem;
    onChange: (next: NotifyItem) => void;
    disabled?: boolean;
}) {
    return (
        <div className={`aef-notify${disabled ? ' is-disabled' : ''}`}>
            <div className="aef-notify-head">
                <label className="aef-switch">
                    <input
                        type="checkbox"
                        checked={value.enabled}
                        disabled={disabled}
                        onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
                    />
                    <span className="aef-switch-ui" />
                    <span className="aef-notify-label">{label}</span>
                </label>
            </div>
            <Input
                value={value.text}
                disabled={disabled || !value.enabled}
                placeholder="通知文案"
                onChange={(text) => onChange({ ...value, text })}
            />
        </div>
    );
}

function RadioGroup({
    name,
    value,
    options,
    onChange,
}: {
    name: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
}) {
    return (
        <div className="aef-radio-group" role="radiogroup">
            {options.map((o) => (
                <label key={o.value} className={`aef-radio${value === o.value ? ' is-checked' : ''}`}>
                    <input
                        type="radio"
                        name={name}
                        checked={value === o.value}
                        onChange={() => onChange(o.value)}
                    />
                    <span className="aef-radio-dot" />
                    <span>{o.label}</span>
                </label>
            ))}
        </div>
    );
}

export function FlowConfigDrawer({
    open,
    module,
    initial,
    onClose,
    onSave,
}: {
    open: boolean;
    module: ModuleItem | null;
    initial: { sceneSource: SceneSource; values: FlowFormValues } | null;
    onClose: () => void;
    onSave: (payload: { sceneSource: SceneSource; values: FlowFormValues }) => void;
}) {
    const [layer, setLayer] = useState<'scene' | 'form'>('scene');
    const [sceneSource, setSceneSource] = useState<SceneSource>(null);
    const [values, setValues] = useState<FlowFormValues>(createDefaultFormValues());
    const [tab, setTab] = useState<'basic' | 'advanced'>('basic');
    const [activeStep, setActiveStep] = useState<FlowStepId>('identify');
    const sectionRefs = useRef<Record<FlowStepId, HTMLElement | null>>({
        identify: null,
        register: null,
        release: null,
        reset: null,
    });

    useEffect(() => {
        if (!open) return;
        if (initial?.values?.enterPointName) {
            setLayer('form');
            setSceneSource(initial.sceneSource);
            setValues(structuredClone(initial.values));
        } else {
            setLayer('scene');
            setSceneSource(null);
            setValues(createDefaultFormValues());
        }
        setTab('basic');
        setActiveStep('identify');
    }, [open, module?.id, initial]);

    const patch = (partial: Partial<FlowFormValues>) => {
        setValues((prev) => ({ ...prev, ...partial }));
    };

    const showCoalNotify = values.registerType === '1' || values.registerType === '3';
    const showAshNotify = values.registerType === '2' || values.registerType === '3';

    const scrollToStep = (id: FlowStepId) => {
        setActiveStep(id);
        sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleSave = () => {
        if (!values.enterPointName.trim()) {
            message.error('请选择关联入厂点名');
            setTab('basic');
            return;
        }
        onSave({ sceneSource, values });
        message.success('流程配置已保存');
        onClose();
    };

    if (!module) return null;

    return (
        <Drawer
            open={open}
            title={
                <span className="aef-drawer-title-row">
                    <span>流程配置 · {module.name}</span>
                    {layer === 'form' ? (
                        <button type="button" className="aef-link-btn" onClick={() => setLayer('scene')}>
                            重选场景
                        </button>
                    ) : null}
                </span>
            }
            onClose={onClose}
            width={760}
            maskClosable={false}
            footer={
                layer === 'form' ? (
                    <div className="ae-drawer-actions">
                        <Button onClick={onClose}>取消</Button>
                        <Button variant="primary" onClick={handleSave}>
                            保存
                        </Button>
                    </div>
                ) : (
                    <div className="ae-drawer-actions">
                        <Button onClick={onClose}>取消</Button>
                    </div>
                )
            }
        >
            {layer === 'scene' ? (
                <div className="aef-scene-layer">
                    <p className="aef-scene-intro">
                        请选择自动入厂场景；若标准化方案与目标不一致，可跳过场景自行配置参数。
                    </p>
                    <div className="aef-scene-list">
                        {SCENE_OPTIONS.map((scene) => (
                            <button
                                key={scene.id}
                                type="button"
                                className="aef-scene-card"
                                onClick={() => {
                                    setValues(scene.build());
                                    setSceneSource('standard');
                                    setLayer('form');
                                    setTab('basic');
                                    message.success(`已加载「${scene.name}」默认参数`);
                                }}
                            >
                                <span className="aef-scene-icon">
                                    <Sparkles size={18} />
                                </span>
                                <span className="aef-scene-body">
                                    <strong>{scene.name}</strong>
                                    <span>{scene.description}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        className="aef-custom-entry"
                        onClick={() => {
                            setValues(createDefaultFormValues());
                            setSceneSource('custom');
                            setLayer('form');
                            setTab('basic');
                        }}
                    >
                        <Wand2 size={16} />
                        <span>
                            <strong>自定义配置</strong>
                            <em>跳过场景选择，自行配置参数</em>
                        </span>
                    </button>
                </div>
            ) : (
                <div className="aef-form-layer">
                    <div className="aef-tabs" role="tablist">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={tab === 'basic'}
                            className={`aef-tab${tab === 'basic' ? ' is-active' : ''}`}
                            onClick={() => setTab('basic')}
                        >
                            基础参数
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={tab === 'advanced'}
                            className={`aef-tab${tab === 'advanced' ? ' is-active' : ''}`}
                            onClick={() => setTab('advanced')}
                        >
                            高级参数配置
                            <span
                                className="aef-tab-tip"
                                title="如需改动更多流程信息、各环节消息通知内容，可按入厂登记子流程调整对应参数以达到需要的流程效果"
                            >
                                <HelpCircle size={14} />
                            </span>
                        </button>
                    </div>

                    {tab === 'basic' ? (
                        <div className="aef-tab-panel">
                            <p className="ae-field-guide">流程运行必须参数</p>
                            <Field label="登记类型" required>
                                <Select
                                    value={values.registerType}
                                    options={REGISTER_TYPE_OPTIONS}
                                    onChange={(v) => patch({ registerType: v as FlowFormValues['registerType'] })}
                                />
                            </Field>
                            <Field label="关联入厂点名" required>
                                <Select
                                    value={values.enterPointName}
                                    options={ENTER_POINT_OPTIONS}
                                    placeholder="请选择入厂点"
                                    allowClear
                                    onChange={(v) => patch({ enterPointName: v })}
                                />
                            </Field>
                        </div>
                    ) : (
                        <div className="aef-tab-panel">
                            <p className="aef-flow-caption">入厂登记流程</p>
                            <div className="aef-flow-track" aria-label="入厂登记流程图">
                                {FLOW_STEPS.map((step, index) => (
                                    <React.Fragment key={step.id}>
                                        <button
                                            type="button"
                                            className={`aef-flow-node${activeStep === step.id ? ' is-active' : ''}`}
                                            onClick={() => scrollToStep(step.id)}
                                        >
                                            <span className="aef-flow-index">{index + 1}</span>
                                            <span className="aef-flow-node-text">
                                                <strong>{step.title}</strong>
                                                <em>{step.desc}</em>
                                            </span>
                                        </button>
                                        {index < FLOW_STEPS.length - 1 ? <span className="aef-flow-arrow" /> : null}
                                    </React.Fragment>
                                ))}
                            </div>

                            <section
                                className="aef-step-block"
                                ref={(el) => {
                                    sectionRefs.current.identify = el;
                                }}
                            >
                                <h3>车辆识别</h3>
                                <NotifyField
                                    label="车辆识别信息通知"
                                    value={values.identifyNotify}
                                    onChange={(identifyNotify) => patch({ identifyNotify })}
                                />
                            </section>

                            <section
                                className="aef-step-block"
                                ref={(el) => {
                                    sectionRefs.current.register = el;
                                }}
                            >
                                <h3>登记</h3>
                                <Field
                                    label="登记类型"
                                    required
                                    extra={<span className="aef-sync-hint">与基础参数同步</span>}
                                >
                                    <Select
                                        value={values.registerType}
                                        options={REGISTER_TYPE_OPTIONS}
                                        onChange={(v) =>
                                            patch({ registerType: v as FlowFormValues['registerType'] })
                                        }
                                    />
                                </Field>
                                <Field
                                    label="关联入厂点名"
                                    required
                                    extra={<span className="aef-sync-hint">与基础参数同步</span>}
                                >
                                    <Select
                                        value={values.enterPointName}
                                        options={ENTER_POINT_OPTIONS}
                                        placeholder="请选择入厂点"
                                        allowClear
                                        onChange={(v) => patch({ enterPointName: v })}
                                    />
                                </Field>
                                <div className="aef-notify-group">
                                    <p className="aef-notify-group-title">消息通知</p>
                                    {showCoalNotify ? (
                                        <>
                                            <NotifyField
                                                label="来煤、非煤登记成功通知"
                                                value={values.coalSuccessNotify}
                                                onChange={(coalSuccessNotify) => patch({ coalSuccessNotify })}
                                            />
                                            <NotifyField
                                                label="来煤、非煤登记失败通知"
                                                value={values.coalFailNotify}
                                                onChange={(coalFailNotify) => patch({ coalFailNotify })}
                                            />
                                        </>
                                    ) : null}
                                    {showAshNotify ? (
                                        <>
                                            <NotifyField
                                                label="固废登记成功通知"
                                                value={values.ashSuccessNotify}
                                                onChange={(ashSuccessNotify) => patch({ ashSuccessNotify })}
                                            />
                                            <NotifyField
                                                label="固废登记失败通知"
                                                value={values.ashFailNotify}
                                                onChange={(ashFailNotify) => patch({ ashFailNotify })}
                                            />
                                        </>
                                    ) : null}
                                </div>
                            </section>

                            <section
                                className="aef-step-block"
                                ref={(el) => {
                                    sectionRefs.current.release = el;
                                }}
                            >
                                <h3>车辆放行</h3>
                                <Field label="道闸控制">
                                    <RadioGroup
                                        name="barrierControl"
                                        value={values.barrierControl}
                                        options={BARRIER_OPTIONS}
                                        onChange={(v) =>
                                            patch({ barrierControl: v as FlowFormValues['barrierControl'] })
                                        }
                                    />
                                </Field>
                            </section>

                            <section
                                className="aef-step-block"
                                ref={(el) => {
                                    sectionRefs.current.reset = el;
                                }}
                            >
                                <h3>现场还原复位</h3>
                                <Field
                                    label="复位等待时长 s"
                                    extra={
                                        <span className="ae-field-guide">
                                            前置登记结果在 LED 的通知保留多久后复位
                                        </span>
                                    }
                                >
                                    <input
                                        className="ae-input"
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={values.resetWaitSeconds}
                                        onChange={(e) => {
                                            const n = Number(e.target.value);
                                            patch({
                                                resetWaitSeconds: Number.isFinite(n)
                                                    ? Math.max(0, Math.floor(n))
                                                    : 15,
                                            });
                                        }}
                                    />
                                </Field>
                                <Field
                                    label="道闸复位控制"
                                    extra={
                                        <span className="ae-field-guide">
                                            放行后，现场的道闸可按此配置复位；若为雷达自动落杆，则配置为无
                                        </span>
                                    }
                                >
                                    <RadioGroup
                                        name="resetBarrierControl"
                                        value={values.resetBarrierControl}
                                        options={RESET_BARRIER_OPTIONS}
                                        onChange={(v) =>
                                            patch({
                                                resetBarrierControl: v as FlowFormValues['resetBarrierControl'],
                                            })
                                        }
                                    />
                                </Field>
                            </section>
                        </div>
                    )}
                </div>
            )}
        </Drawer>
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
        if (!open) return;
        setTargetId('');
        setConfirmOpen(false);
    }, [open, source?.id]);

    if (!source) return null;
    const target = peers.find((p) => p.id === targetId);

    return (
        <>
            <Drawer
                open={open}
                title={`复制流程 · ${source.name}`}
                onClose={onClose}
                width={440}
                footer={
                    <div className="ae-drawer-actions">
                        <Button onClick={onClose}>取消</Button>
                        <Button
                            variant="primary"
                            icon={<Copy size={14} />}
                            disabled={!targetId}
                            onClick={() => {
                                if (!targetId) {
                                    message.warning('请选择目标模块');
                                    return;
                                }
                                setConfirmOpen(true);
                            }}
                        >
                            复制
                        </Button>
                    </div>
                }
            >
                <Field label="源模块">
                    <Input value={`${source.name}（${source.code}）`} disabled onChange={() => {}} />
                </Field>
                <Field label="复制到模块" required>
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
                </Field>
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

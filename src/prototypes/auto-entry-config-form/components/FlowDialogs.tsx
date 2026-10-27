import React, { useEffect, useRef, useState } from 'react';
import { Copy, HelpCircle } from 'lucide-react';
import {
    BARRIER_OPTIONS,
    ENTER_POINT_OPTIONS,
    FLOW_STEPS,
    FlowFormValues,
    FlowStepId,
    MESSAGE_PLACEHOLDERS,
    ModuleItem,
    NotifyItem,
    RESET_BARRIER_OPTIONS,
    SceneSource,
    resolveEnterPointName,
    createStandardSceneValues,
} from '../data';
import { Button, Checkbox, Drawer, Field, Input, Select, Switch, message } from './ui';

function BasicParamTag() {
    return <span className="aef-basic-tag">基础参数</span>;
}

function StepBlockHead({
    index,
    title,
    desc,
}: {
    index: number;
    title: string;
    desc: string;
}) {
    return (
        <header className="aef-step-head">
            <span className="aef-step-badge" aria-hidden>
                {index}
            </span>
            <div className="aef-step-head-text">
                <h3>{title}</h3>
                <p>{desc}</p>
            </div>
        </header>
    );
}

type FocusTarget = { cardKey: string; field: 'broadcast' | 'led' };

const PLACEHOLDER_RE = /\{[^{}]+\}/g;

/** 将选区扩展到完整占位符 `{...}` */
function expandRangeToPlaceholders(text: string, start: number, end: number): [number, number] {
    let s = start;
    let e = end;
    PLACEHOLDER_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = PLACEHOLDER_RE.exec(text)) !== null) {
        const ts = match.index;
        const te = ts + match[0].length;
        if (s < te && e > ts) {
            s = Math.min(s, ts);
            e = Math.max(e, te);
        }
    }
    return [s, e];
}

/** Backspace / Delete 时整段删除命中的占位符 */
function deleteAdjacentPlaceholder(
    text: string,
    caret: number,
    key: 'Backspace' | 'Delete',
): { next: string; caret: number } | null {
    PLACEHOLDER_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = PLACEHOLDER_RE.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (key === 'Backspace' && caret > start && caret <= end) {
            return { next: text.slice(0, start) + text.slice(end), caret: start };
        }
        if (key === 'Delete' && caret >= start && caret < end) {
            return { next: text.slice(0, start) + text.slice(end), caret: start };
        }
    }
    return null;
}

function NotifyTextInput({
    value,
    onChange,
    onFocusField,
    placeholder,
    disabled,
}: {
    value: string;
    onChange: (v: string) => void;
    onFocusField: (el: HTMLInputElement) => void;
    placeholder?: string;
    disabled?: boolean;
}) {
    const ref = useRef<HTMLInputElement>(null);

    const applyText = (next: string, caret: number) => {
        onChange(next);
        requestAnimationFrame(() => {
            const el = ref.current;
            if (!el) return;
            el.focus();
            el.setSelectionRange(caret, caret);
        });
    };

    return (
        <input
            ref={ref}
            className="ae-input"
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onFocus={() => {
                if (ref.current) onFocusField(ref.current);
            }}
            onSelect={() => {
                if (ref.current) onFocusField(ref.current);
            }}
            onKeyDown={(e) => {
                if (disabled) return;
                if (e.key !== 'Backspace' && e.key !== 'Delete') return;
                const el = e.currentTarget;
                const start = el.selectionStart ?? 0;
                const end = el.selectionEnd ?? 0;

                if (start !== end) {
                    const [s, epos] = expandRangeToPlaceholders(value, start, end);
                    if (s !== start || epos !== end) {
                        e.preventDefault();
                        applyText(value.slice(0, s) + value.slice(epos), s);
                    }
                    return;
                }

                const unit = deleteAdjacentPlaceholder(value, start, e.key);
                if (unit) {
                    e.preventDefault();
                    applyText(unit.next, unit.caret);
                }
            }}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

/** 消息通知配置：每组内广播 / LED 各自启用 + 内容 */
function renderTestContent(template: string): string {
    return template
        .replace(/\{\/n\/\}/g, '\n')
        .replace(/\{[^{}]+\}/g, '— —')
        .trim();
}

function channelEnabled(value: NotifyItem, field: 'broadcast' | 'led'): boolean {
    return field === 'broadcast' ? value.broadcastEnabled : value.ledEnabled;
}

function MessageNotifySection({
    items,
}: {
    items: Array<{
        key: string;
        title: string;
        value: NotifyItem;
        onChange: (v: NotifyItem) => void;
        disabled?: boolean;
        ledPlaceholder?: string;
        broadcastPlaceholder?: string;
    }>;
}) {
    const focusRef = useRef<{ target: FocusTarget; el: HTMLInputElement } | null>(null);
    const [focusKey, setFocusKey] = useState<string | null>(null);

    const insertToken = (token: string) => {
        const cur = focusRef.current;
        if (!cur) return;
        const item = items.find((i) => i.key === cur.target.cardKey);
        if (!item || item.disabled) return;
        const field = cur.target.field;
        if (!channelEnabled(item.value, field)) return;
        const el = cur.el;
        const start = el.selectionStart ?? item.value[field].length;
        const end = el.selectionEnd ?? item.value[field].length;
        const nextText = item.value[field].slice(0, start) + token + item.value[field].slice(end);
        item.onChange({ ...item.value, [field]: nextText });
        const caret = start + token.length;
        requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(caret, caret);
        });
    };

    const sendTest = (item: (typeof items)[number]) => {
        if (item.disabled) return;
        const { broadcastEnabled, ledEnabled } = item.value;
        if (!broadcastEnabled && !ledEnabled) {
            message.warning('请先启用广播或 LED 后再发送测试');
            return;
        }
        const parts: string[] = [];
        let pushed = 0;
        if (broadcastEnabled) {
            const raw = item.value.broadcast.trim();
            const text = raw ? renderTestContent(raw) : '';
            if (text) {
                parts.push(`广播「${text}」`);
                pushed += 1;
            } else {
                parts.push('广播（内容为空，已跳过）');
            }
        } else {
            parts.push('广播（未启用）');
        }
        if (ledEnabled) {
            const raw = item.value.led.trim();
            const text = raw ? renderTestContent(raw) : '';
            if (text) {
                parts.push(`LED「${text}」`);
                pushed += 1;
            } else {
                parts.push('LED（内容为空，已跳过）');
            }
        } else {
            parts.push('LED（未启用）');
        }
        if (pushed === 0) {
            message.warning('已启用通道内容均为空，未推送');
            return;
        }
        message.success(
            `已下发「${item.title}」测试至对应设备（变量以 — — 占位）：${parts.join('；')}`,
        );
    };

    return (
        <section className="ae-msg-cfg">
            <header className="ae-msg-cfg-head">
                <h4>
                    <span className="ae-msg-cfg-dot" />
                    消息通知配置
                </h4>
                <p>
                    每组可分别设定广播 / LED 是否启用及推送内容；未启用或内容为空则不推送该通道
                </p>
            </header>

            <div className="ae-msg-placeholders">
                <div className="ae-msg-placeholders-label">插入占位符（光标点选按钮）</div>
                <div className="ae-msg-placeholders-btns">
                    {MESSAGE_PLACEHOLDERS.map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            className="ae-msg-ph-btn"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => insertToken(p.token)}
                            title={`插入 ${p.token}`}
                        >
                            {p.key}
                        </button>
                    ))}
                </div>
                {!focusKey ? (
                    <p className="ae-msg-ph-tip">先点击下方任一输入框，再点选变量插入到光标位置</p>
                ) : null}
            </div>

            <div className={`ae-msg-grid${items.length === 1 ? ' is-single' : ''}`}>
                {items.map((item) => {
                    const anyChannelOn =
                        item.value.broadcastEnabled || item.value.ledEnabled;
                    const broadcastOff = !!item.disabled || !item.value.broadcastEnabled;
                    const ledOff = !!item.disabled || !item.value.ledEnabled;
                    return (
                        <article
                            key={item.key}
                            className={`ae-msg-card${item.disabled ? ' is-disabled' : ''}${
                                focusKey?.startsWith(item.key) ? ' is-active' : ''
                            }`}
                        >
                            <div className="ae-msg-card-title-row">
                                <h5>{item.title}</h5>
                                <Button
                                    size="small"
                                    disabled={!!item.disabled || !anyChannelOn}
                                    onClick={() => sendTest(item)}
                                    title="仅向已启用且内容非空的通道下发测试，变量以 — — 占位"
                                >
                                    发送测试
                                </Button>
                            </div>
                            <div
                                className={`ae-msg-channel${
                                    focusKey === `${item.key}:broadcast` ? ' is-focus' : ''
                                }${broadcastOff && !item.disabled ? ' is-off' : ''}`}
                            >
                                <Checkbox
                                    checked={item.value.broadcastEnabled}
                                    onChange={(broadcastEnabled) =>
                                        item.onChange({ ...item.value, broadcastEnabled })
                                    }
                                >
                                    广播
                                </Checkbox>
                                <NotifyTextInput
                                    value={item.value.broadcast}
                                    disabled={broadcastOff}
                                    placeholder={item.broadcastPlaceholder ?? '广播内容'}
                                    onChange={(broadcast) =>
                                        item.onChange({ ...item.value, broadcast })
                                    }
                                    onFocusField={(el) => {
                                        focusRef.current = {
                                            target: { cardKey: item.key, field: 'broadcast' },
                                            el,
                                        };
                                        setFocusKey(`${item.key}:broadcast`);
                                    }}
                                />
                            </div>
                            <div
                                className={`ae-msg-channel${
                                    focusKey === `${item.key}:led` ? ' is-focus' : ''
                                }${ledOff && !item.disabled ? ' is-off' : ''}`}
                            >
                                <Checkbox
                                    checked={item.value.ledEnabled}
                                    onChange={(ledEnabled) =>
                                        item.onChange({ ...item.value, ledEnabled })
                                    }
                                >
                                    LED
                                </Checkbox>
                                <NotifyTextInput
                                    value={item.value.led}
                                    disabled={ledOff}
                                    placeholder={item.ledPlaceholder ?? 'LED 推送内容'}
                                    onChange={(led) => item.onChange({ ...item.value, led })}
                                    onFocusField={(el) => {
                                        focusRef.current = {
                                            target: { cardKey: item.key, field: 'led' },
                                            el,
                                        };
                                        setFocusKey(`${item.key}:led`);
                                    }}
                                />
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
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
    const [sceneSource, setSceneSource] = useState<SceneSource>('standard');
    const [values, setValues] = useState<FlowFormValues>(createStandardSceneValues());
    const [tab, setTab] = useState<'basic' | 'advanced'>('basic');
    const [activeStep, setActiveStep] = useState<FlowStepId>('identify');
    const sectionRefs = useRef<Record<FlowStepId, HTMLElement | null>>({
        identify: null,
        register: null,
        release: null,
        reset: null,
    });
    const contentScrollRef = useRef<HTMLDivElement | null>(null);
    const scrollLockRef = useRef(false);

    useEffect(() => {
        if (!open) return;
        if (initial?.values?.enterPointName) {
            setSceneSource(initial.sceneSource ?? 'standard');
            const next = structuredClone(initial.values);
            next.enterPointName = resolveEnterPointName(
                ENTER_POINT_OPTIONS,
                next.enterPointName,
            );
            setValues(next);
        } else {
            setSceneSource('standard');
            setValues(createStandardSceneValues());
        }
        setTab('basic');
        setActiveStep('identify');
    }, [open, module?.id, initial]);

    useEffect(() => {
        if (!open || tab !== 'advanced') return;
        const scroller = contentScrollRef.current;
        if (!scroller) return;

        const syncActive = () => {
            if (scrollLockRef.current) return;
            const anchor = scroller.scrollTop + 48;
            let current: FlowStepId = FLOW_STEPS[0].id;
            for (const step of FLOW_STEPS) {
                const el = sectionRefs.current[step.id];
                if (!el) continue;
                if (el.offsetTop - scroller.offsetTop <= anchor) current = step.id;
            }
            setActiveStep((prev) => (prev === current ? prev : current));
        };

        syncActive();
        scroller.addEventListener('scroll', syncActive, { passive: true });
        return () => scroller.removeEventListener('scroll', syncActive);
    }, [open, tab]);

    const patch = (partial: Partial<FlowFormValues>) => {
        setValues((prev) => ({ ...prev, ...partial }));
    };

    const showAshNotify = values.includeAsh;
    const showAshIpPort = values.includeAsh;
    const enterPointOptions = ENTER_POINT_OPTIONS;

    const patchIncludeAsh = (includeAsh: boolean) => {
        patch({
            includeAsh,
            ashRequestIpPort: includeAsh ? values.ashRequestIpPort : '',
        });
    };

    const scrollToStep = (id: FlowStepId) => {
        setActiveStep(id);
        const target = sectionRefs.current[id];
        const scroller = contentScrollRef.current;
        if (!target || !scroller) return;
        scrollLockRef.current = true;
        const top = target.offsetTop - scroller.offsetTop - 8;
        scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        window.setTimeout(() => {
            scrollLockRef.current = false;
        }, 420);
    };

    const handleSave = () => {
        if (showAshIpPort && !values.ashRequestIpPort.trim()) {
            message.error('请填写固废请求IP端口');
            setTab('basic');
            return;
        }
        if (!values.enterPointName.trim()) {
            message.error('请选择关联入厂点名');
            setTab('basic');
            return;
        }
        onSave({ sceneSource: sceneSource ?? 'standard', values });
        message.success('流程配置已保存');
        onClose();
    };

    if (!module) return null;

    return (
        <Drawer
            open={open}
            title={`流程配置 · ${module.name}`}
            onClose={onClose}
            width={1040}
            maskClosable={false}
            bodyClassName="aef-drawer-body--form"
            footer={
                <div className="ae-drawer-actions">
                    <Button onClick={onClose}>取消</Button>
                    <Button variant="primary" onClick={handleSave}>
                        保存
                    </Button>
                </div>
            }
        >
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

                    <div className={`aef-form-scroll${tab === 'advanced' ? ' aef-form-scroll--aer-adv' : ''}`}>
                    {tab === 'basic' ? (
                        <div className="aef-tab-panel">
                            <p className="ae-field-guide">流程运行必须参数</p>
                            <div className="aef-field-grid aef-field-grid--2">
                                <Field
                                    label={
                                        <>
                                            是否含固废 <BasicParamTag />
                                        </>
                                    }
                                    required
                                >
                                    <Switch
                                        checked={values.includeAsh}
                                        checkedChildren="启用"
                                        unCheckedChildren="禁用"
                                        onChange={patchIncludeAsh}
                                    />
                                </Field>
                                {showAshIpPort ? (
                                    <Field
                                        label={
                                            <>
                                                固废请求IP端口 <BasicParamTag />
                                            </>
                                        }
                                        required
                                    >
                                        <Input
                                            value={values.ashRequestIpPort}
                                            placeholder="如 192.168.92.1:81"
                                            onChange={(ashRequestIpPort) =>
                                                patch({ ashRequestIpPort })
                                            }
                                        />
                                    </Field>
                                ) : null}
                                <Field
                                    label={
                                        <>
                                            关联入厂点名 <BasicParamTag />
                                        </>
                                    }
                                    required
                                    extra={
                                        <span className="ae-field-guide">
                                            下拉选择入厂点名称；仅一个入厂点时自动赋值
                                        </span>
                                    }
                                >
                                    <Select
                                        value={values.enterPointName}
                                        options={enterPointOptions}
                                        placeholder="请选择入厂点名称"
                                        allowClear={enterPointOptions.length > 1}
                                        onChange={(enterPointName) => patch({ enterPointName })}
                                    />
                                </Field>
                            </div>
                        </div>
                    ) : (
                        <div className="aef-tab-panel aef-tab-panel--aer-adv">
                            <div className="aef-adv-layout">
                                <aside className="aef-adv-nav" aria-label="入厂流程">
                                    <p className="aef-adv-nav-title">入厂流程</p>
                                    <nav className="aef-adv-nav-list">
                                        {FLOW_STEPS.map((step, index) => (
                                            <button
                                                key={step.id}
                                                type="button"
                                                className={`aef-adv-nav-item${activeStep === step.id ? ' is-active' : ''}`}
                                                onClick={() => scrollToStep(step.id)}
                                            >
                                                <span className="aef-adv-nav-index">
                                                    {String(index + 1).padStart(2, '0')}
                                                </span>
                                                <span className="aef-adv-nav-text">
                                                    <strong>{step.title}</strong>
                                                </span>
                                            </button>
                                        ))}
                                    </nav>
                                </aside>

                                <div className="aef-adv-content" ref={contentScrollRef}>
                            <section
                                className={`aef-step-block aef-step-block--identify${activeStep === 'identify' ? ' is-active' : ''}`}
                                ref={(el) => {
                                    sectionRefs.current.identify = el;
                                }}
                            >
                                <StepBlockHead index={1} title="车辆识别" desc="识别结果通知" />
                                <div className="aef-step-body">
                                    <MessageNotifySection
                                        items={[
                                            {
                                                key: 'identify',
                                                title: '识别结果通知',
                                                value: values.identifyNotify,
                                                onChange: (identifyNotify) => patch({ identifyNotify }),
                                                ledPlaceholder: '{车牌号} 正在登记...',
                                                broadcastPlaceholder: '{车牌号} 正在登记...',
                                            },
                                        ]}
                                    />
                                </div>
                            </section>

                            <section
                                className={`aef-step-block aef-step-block--register${activeStep === 'register' ? ' is-active' : ''}`}
                                ref={(el) => {
                                    sectionRefs.current.register = el;
                                }}
                            >
                                <StepBlockHead
                                    index={2}
                                    title="登记"
                                    desc="入厂登记与结果通知"
                                />
                                <div className="aef-step-body">
                                <p className="ae-field-guide">
                                    对识别的车辆进行入厂登记（来煤、非煤）；启用「是否含固废」后支持粉煤灰固废车辆
                                </p>
                                <div className="aef-field-grid aef-field-grid--2">
                                    <Field
                                        label={
                                            <>
                                                是否含固废 <BasicParamTag />
                                            </>
                                        }
                                        required
                                    >
                                        <Switch
                                            checked={values.includeAsh}
                                            checkedChildren="启用"
                                            unCheckedChildren="禁用"
                                            onChange={patchIncludeAsh}
                                        />
                                    </Field>
                                    {showAshIpPort ? (
                                        <Field
                                            label={
                                                <>
                                                    固废请求IP端口 <BasicParamTag />
                                                </>
                                            }
                                            required
                                        >
                                            <Input
                                                value={values.ashRequestIpPort}
                                                placeholder="如 192.168.92.1:81"
                                                onChange={(ashRequestIpPort) =>
                                                    patch({ ashRequestIpPort })
                                                }
                                            />
                                        </Field>
                                    ) : null}
                                    <Field
                                        label={
                                            <>
                                                关联入厂点名 <BasicParamTag />
                                            </>
                                        }
                                        required
                                        extra={
                                            <span className="ae-field-guide">
                                                下拉选择入厂点名称；仅一个入厂点时自动赋值
                                            </span>
                                        }
                                    >
                                        <Select
                                            value={values.enterPointName}
                                            options={enterPointOptions}
                                            placeholder="请选择入厂点名称"
                                            allowClear={enterPointOptions.length > 1}
                                            onChange={(enterPointName) => patch({ enterPointName })}
                                        />
                                    </Field>
                                </div>
                                <MessageNotifySection
                                    items={[
                                        {
                                            key: 'coal-ok',
                                            title: '来煤、非煤登记成功通知',
                                            value: values.coalSuccessNotify,
                                            onChange: (coalSuccessNotify: NotifyItem) =>
                                                patch({ coalSuccessNotify }),
                                            ledPlaceholder:
                                                '{车牌号} {采样位} {过衡位}  登记成功',
                                            broadcastPlaceholder: '{车牌号} 登记成功，请入厂',
                                        },
                                        {
                                            key: 'coal-fail',
                                            title: '来煤、非煤登记失败通知',
                                            value: values.coalFailNotify,
                                            onChange: (coalFailNotify: NotifyItem) =>
                                                patch({ coalFailNotify }),
                                            ledPlaceholder: '{车牌号} 登记失败，请联系管理员',
                                            broadcastPlaceholder: '{车牌号} 登记失败，请联系管理员',
                                        },
                                        ...(showAshNotify
                                            ? [
                                                  {
                                                      key: 'ash-ok',
                                                      title: '固废登记成功通知',
                                                      value: values.ashSuccessNotify,
                                                      onChange: (ashSuccessNotify: NotifyItem) =>
                                                          patch({ ashSuccessNotify }),
                                                      ledPlaceholder: '{车牌号} 登记成功 请入厂',
                                                      broadcastPlaceholder: '{车牌号} 登记成功，请入厂',
                                                  },
                                                  {
                                                      key: 'ash-fail',
                                                      title: '固废登记失败通知',
                                                      value: values.ashFailNotify,
                                                      onChange: (ashFailNotify: NotifyItem) =>
                                                          patch({ ashFailNotify }),
                                                      ledPlaceholder:
                                                          '{车牌号} 登记失败，请联系管理员',
                                                      broadcastPlaceholder:
                                                          '{车牌号} 登记失败，请联系管理员',
                                                  },
                                              ]
                                            : []),
                                    ]}
                                />
                                </div>
                            </section>

                            <section
                                className={`aef-step-block aef-step-block--release${activeStep === 'release' ? ' is-active' : ''}`}
                                ref={(el) => {
                                    sectionRefs.current.release = el;
                                }}
                            >
                                <StepBlockHead index={3} title="道闸控制" desc="抬杆 / 落杆 / 无" />
                                <div className="aef-step-body">
                                <p className="ae-field-guide">控制拦车器的方法</p>
                                <div className="aef-field-grid aef-field-grid--barrier">
                                    <Field label="道闸控制" required>
                                        <RadioGroup
                                            name="barrierControl"
                                            value={values.barrierControl}
                                            options={BARRIER_OPTIONS}
                                            onChange={(v) =>
                                                patch({
                                                    barrierControl: v as FlowFormValues['barrierControl'],
                                                })
                                            }
                                        />
                                    </Field>
                                </div>
                                </div>
                            </section>

                            <section
                                className={`aef-step-block aef-step-block--reset${activeStep === 'reset' ? ' is-active' : ''}`}
                                ref={(el) => {
                                    sectionRefs.current.reset = el;
                                }}
                            >
                                <StepBlockHead
                                    index={4}
                                    title="现场复位还原"
                                    desc="等待复位与消息设定"
                                />
                                <div className="aef-step-body">
                                <div className="aef-field-grid aef-field-grid--2">
                                    <Field
                                        label="复位等待时长 s"
                                        required
                                        extra={
                                            <span className="ae-field-guide">
                                                前置登记结果保留多久后复位，默认填充 15
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
                                        required
                                        extra={
                                            <span className="ae-field-guide">
                                                0 无（默认）；1 抬杆；2 落杆。若为雷达自动落杆，则配置为无
                                            </span>
                                        }
                                    >
                                        <RadioGroup
                                            name="resetBarrierControl"
                                            value={values.resetBarrierControl}
                                            options={RESET_BARRIER_OPTIONS}
                                            onChange={(v) =>
                                                patch({
                                                    resetBarrierControl:
                                                        v as FlowFormValues['resetBarrierControl'],
                                                })
                                            }
                                        />
                                    </Field>
                                </div>
                                <div className="aef-notify-group">
                                    <MessageNotifySection
                                        items={[
                                            {
                                                key: 'reset',
                                                title: '复位消息设定',
                                                value: values.resetNotify,
                                                onChange: (resetNotify) => patch({ resetNotify }),
                                                ledPlaceholder: '排队登记 有序入厂',
                                                broadcastPlaceholder: '排队登记 有序入厂',
                                            },
                                        ]}
                                    />
                                </div>
                                </div>
                            </section>
                                </div>
                            </div>
                        </div>
                    )}
                    </div>
                </div>
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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import {
    BARRIER_OPTIONS,
    BarrierParams,
    CarIdentifyParams,
    FlowStep,
    MESSAGE_PLACEHOLDERS,
    METHOD_OPTIONS,
    NotifyBlock,
    REGISTER_TYPE_OPTIONS,
    RESET_BARRIER_OPTIONS,
    RegisterParams,
    ResetParams,
    SubProcessCode,
    YES_NO,
    defByCode,
} from '../data';
import { Button, Checkbox, Drawer, Field, Input, Select } from './ui';

const PARAM_DRAWER_WIDTH = 760;

function Hint({ text }: { text: string }) {
    return (
        <span className="ae-hint-tip" title={text}>
            <HelpCircle size={14} />
        </span>
    );
}

type FocusTarget = { cardKey: string; field: 'voice' | 'led' };

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
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

function MessageNotifySection({
    items,
}: {
    items: Array<{
        key: string;
        title: string;
        value: NotifyBlock;
        onChange: (v: NotifyBlock) => void;
        disabled?: boolean;
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

    return (
        <section className="ae-msg-cfg">
            <header className="ae-msg-cfg-head">
                <h4>
                    <span className="ae-msg-cfg-dot" />
                    消息通知配置
                </h4>
                <p>配置本流程触发时的语音与 LED 显示；可用顶部按钮在光标处插入占位符。</p>
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
                {!focusKey ? <p className="ae-msg-ph-tip">先点击下方任一输入框，再点选变量插入到光标位置</p> : null}
            </div>

            <div className="ae-msg-grid">
                {items.map((item) => (
                    <article
                        key={item.key}
                        className={`ae-msg-card${item.disabled ? ' is-disabled' : ''}${focusKey?.startsWith(item.key) ? ' is-active' : ''}`}
                    >
                        <h5>{item.title}</h5>
                        <Checkbox
                            checked={item.value.voiceEnabled}
                            onChange={(voiceEnabled) => item.onChange({ ...item.value, voiceEnabled })}
                        >
                            是否启用语音
                        </Checkbox>
                        <NotifyTextInput
                            value={item.value.voice}
                            disabled={item.disabled || !item.value.voiceEnabled}
                            placeholder="语音播报文案"
                            onChange={(voice) => item.onChange({ ...item.value, voice })}
                            onFocusField={(el) => {
                                focusRef.current = { target: { cardKey: item.key, field: 'voice' }, el };
                                setFocusKey(`${item.key}:voice`);
                            }}
                        />
                        <Checkbox
                            checked={item.value.ledEnabled}
                            onChange={(ledEnabled) => item.onChange({ ...item.value, ledEnabled })}
                        >
                            是否启用LED
                        </Checkbox>
                        <NotifyTextInput
                            value={item.value.led}
                            disabled={item.disabled || !item.value.ledEnabled}
                            placeholder="LED 显示文案"
                            onChange={(led) => item.onChange({ ...item.value, led })}
                            onFocusField={(el) => {
                                focusRef.current = { target: { cardKey: item.key, field: 'led' }, el };
                                setFocusKey(`${item.key}:led`);
                            }}
                        />
                    </article>
                ))}
            </div>
        </section>
    );
}

function CarIdentifyForm({
    value,
    onChange,
}: {
    value: CarIdentifyParams;
    onChange: (v: CarIdentifyParams) => void;
}) {
    return (
        <>
            <Field
                label="识别方式"
                required
                extra={<span className="ae-field-guide">按现场已装设备选择；仅一类设备时可默认该类</span>}
            >
                <Select
                    value={value.method}
                    options={METHOD_OPTIONS}
                    onChange={(method) => onChange({ ...value, method: method as CarIdentifyParams['method'] })}
                />
            </Field>
            <MessageNotifySection
                items={[
                    {
                        key: 'start',
                        title: '开始识别',
                        value: value.notifyStart,
                        onChange: (notifyStart) => onChange({ ...value, notifyStart }),
                    },
                    {
                        key: 'success',
                        title: '识别成功',
                        value: value.notifySuccess,
                        onChange: (notifySuccess) => onChange({ ...value, notifySuccess }),
                    },
                    {
                        key: 'fail',
                        title: '识别失败',
                        value: value.notifyFail,
                        onChange: (notifyFail) => onChange({ ...value, notifyFail }),
                    },
                    {
                        key: 'timeout',
                        title: '识别超时',
                        value: value.notifyTimeout,
                        onChange: (notifyTimeout) => onChange({ ...value, notifyTimeout }),
                    },
                ]}
            />
        </>
    );
}

function RegisterForm({ value, onChange }: { value: RegisterParams; onChange: (v: RegisterParams) => void }) {
    const showDirect = value.type === '1' || value.type === '3';
    return (
        <>
            <Field
                label="登记类型"
                required
                extra={<span className="ae-field-guide">决定后续通知组是否适用</span>}
            >
                <Select
                    value={value.type}
                    options={REGISTER_TYPE_OPTIONS}
                    onChange={(type) => onChange({ ...value, type: type as RegisterParams['type'] })}
                />
            </Field>
            <Field
                label="关联人员 / 入厂点名"
                required
                extra={<span className="ae-field-guide">关联现场联系人或点位名称</span>}
            >
                <Input
                    value={value.enterPointName}
                    onChange={(enterPointName) => onChange({ ...value, enterPointName })}
                    placeholder="例如：南门发卡室"
                />
            </Field>
            <MessageNotifySection
                items={[
                    {
                        key: 'reg-ok',
                        title: '登记成功',
                        value: value.notifySuccess,
                        onChange: (notifySuccess) => onChange({ ...value, notifySuccess }),
                    },
                    {
                        key: 'reg-fail',
                        title: '登记失败',
                        value: value.notifyFail,
                        onChange: (notifyFail) => onChange({ ...value, notifyFail }),
                    },
                    {
                        key: 'direct-ok',
                        title: '直通成功',
                        value: value.notifyDirectSuccess,
                        onChange: (notifyDirectSuccess) => onChange({ ...value, notifyDirectSuccess }),
                        disabled: !showDirect,
                    },
                    {
                        key: 'direct-fail',
                        title: '直通失败',
                        value: value.notifyDirectFail,
                        onChange: (notifyDirectFail) => onChange({ ...value, notifyDirectFail }),
                        disabled: !showDirect,
                    },
                ]}
            />
        </>
    );
}

function BarrierForm({ value, onChange }: { value: BarrierParams; onChange: (v: BarrierParams) => void }) {
    return (
        <Field label="道闸动作" required extra={<span className="ae-field-guide">本环节对拦车器的控制方式</span>}>
            <div className="ae-radio-row">
                {BARRIER_OPTIONS.map((o) => (
                    <label key={o.value} className="ae-radio">
                        <input
                            type="radio"
                            checked={value.control === o.value}
                            onChange={() => onChange({ control: o.value as BarrierParams['control'] })}
                        />
                        {o.label}
                    </label>
                ))}
            </div>
        </Field>
    );
}

function ResetForm({ value, onChange }: { value: ResetParams; onChange: (v: ResetParams) => void }) {
    return (
        <>
            <Field
                label="强制执行"
                required
                extra={<span className="ae-field-guide">前序异常时仍需执行复位</span>}
            >
                <div className="ae-radio-row">
                    {YES_NO.map((o) => (
                        <label key={o.value} className="ae-radio">
                            <input
                                type="radio"
                                checked={value.requireProcess === o.value}
                                onChange={() =>
                                    onChange({ ...value, requireProcess: o.value as ResetParams['requireProcess'] })
                                }
                            />
                            {o.label}
                        </label>
                    ))}
                </div>
            </Field>
            <Field label="等待时长（秒）" required extra={<span className="ae-field-guide">通知展示 / 等待时间</span>}>
                <Input
                    value={String(value.waitTime)}
                    onChange={(v) => {
                        const n = Number(v.replace(/\D/g, ''));
                        onChange({ ...value, waitTime: Number.isFinite(n) ? n : 0 });
                    }}
                    placeholder="15"
                />
            </Field>
            <Field
                label="识别后跳过等待"
                required
                extra={<span className="ae-field-guide">已识别下一车时可跳过等待</span>}
            >
                <div className="ae-radio-row">
                    {YES_NO.map((o) => (
                        <label key={o.value} className="ae-radio">
                            <input
                                type="radio"
                                checked={value.skipWait === o.value}
                                onChange={() => onChange({ ...value, skipWait: o.value as ResetParams['skipWait'] })}
                            />
                            {o.label}
                        </label>
                    ))}
                </div>
            </Field>
            <Field label="复位道闸" required extra={<span className="ae-field-guide">复位结束时道闸状态</span>}>
                <Select
                    value={value.barrierControl}
                    options={RESET_BARRIER_OPTIONS}
                    onChange={(barrierControl) =>
                        onChange({ ...value, barrierControl: barrierControl as ResetParams['barrierControl'] })
                    }
                />
            </Field>
            <MessageNotifySection
                items={[
                    {
                        key: 'reset',
                        title: '复位完成',
                        value: value.notify,
                        onChange: (notify) => onChange({ ...value, notify }),
                    },
                ]}
            />
        </>
    );
}

export function ParamDrawer({
    open,
    step,
    onClose,
    onSave,
}: {
    open: boolean;
    step: FlowStep | null;
    onClose: () => void;
    onSave: (params: FlowStep['params']) => void;
}) {
    const [draft, setDraft] = useState<FlowStep['params'] | null>(null);
    const code: SubProcessCode | null = step?.code ?? null;
    const title = useMemo(() => (code ? `${defByCode(code).name} · 参数配置` : '参数配置'), [code]);

    useEffect(() => {
        if (open && step) setDraft(structuredClone(step.params));
        if (!open) setDraft(null);
    }, [open, step]);

    if (!step || !draft) {
        return (
            <Drawer open={open} title={title} onClose={onClose} width={PARAM_DRAWER_WIDTH} nested footer={null}>
                <p className="ae-muted">未选择子流程</p>
            </Drawer>
        );
    }

    const body =
        step.code === 'carIdentify' ? (
            <CarIdentifyForm value={draft as CarIdentifyParams} onChange={setDraft} />
        ) : step.code === 'register' ? (
            <RegisterForm value={draft as RegisterParams} onChange={setDraft} />
        ) : step.code === 'BarrierControl' ? (
            <BarrierForm value={draft as BarrierParams} onChange={setDraft} />
        ) : (
            <ResetForm value={draft as ResetParams} onChange={setDraft} />
        );

    return (
        <Drawer
            open={open}
            title={title}
            onClose={onClose}
            width={PARAM_DRAWER_WIDTH}
            nested
            footer={
                <div className="ae-drawer-actions">
                    <Button onClick={onClose}>取消</Button>
                    <Button
                        variant="primary"
                        onClick={() => {
                            onSave(draft);
                            onClose();
                        }}
                    >
                        确定
                    </Button>
                </div>
            }
        >
            <p className="ae-param-desc">{defByCode(step.code).description}</p>
            {body}
        </Drawer>
    );
}

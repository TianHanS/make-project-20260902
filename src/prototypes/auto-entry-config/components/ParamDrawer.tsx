import React, { useMemo, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import {
    BARRIER_OPTIONS,
    BarrierParams,
    CarIdentifyParams,
    FlowStep,
    METHOD_OPTIONS,
    REGISTER_TYPE_OPTIONS,
    RESET_BARRIER_OPTIONS,
    RegisterParams,
    ResetParams,
    SubProcessCode,
    YES_NO,
    defByCode,
} from '../data';
import { Button, Drawer, Field, Input, Select } from './ui';

function Hint({ text }: { text: string }) {
    return (
        <span className="ae-hint-tip" title={text}>
            <HelpCircle size={14} />
        </span>
    );
}

function NotifyFields({
    label,
    value,
    onChange,
    hint,
    disabled = false,
}: {
    label: string;
    value: { enabled: boolean; led: string; voice: string };
    onChange: (v: { enabled: boolean; led: string; voice: string }) => void;
    hint: string;
    disabled?: boolean;
}) {
    return (
        <fieldset className={`ae-notify-block${disabled ? ' is-disabled' : ''}`} disabled={disabled}>
            <legend>
                {label} <Hint text={hint} />
            </legend>
            <div className="ae-radio-row">
                <label className="ae-radio">
                    <input
                        type="radio"
                        checked={value.enabled}
                        onChange={() => onChange({ ...value, enabled: true })}
                    />
                    启用
                </label>
                <label className="ae-radio">
                    <input
                        type="radio"
                        checked={!value.enabled}
                        onChange={() => onChange({ ...value, enabled: false })}
                    />
                    禁用
                </label>
            </div>
            <Field label="LED 显示内容" extra={<span className="ae-field-guide">现场 LED 屏展示文案</span>}>
                <Input value={value.led} onChange={(led) => onChange({ ...value, led })} placeholder="请输入 LED 文案" />
            </Field>
            <Field label="语音播报内容" extra={<span className="ae-field-guide">现场语音播报文案</span>}>
                <Input
                    value={value.voice}
                    onChange={(voice) => onChange({ ...value, voice })}
                    placeholder="请输入语音文案"
                />
            </Field>
        </fieldset>
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
            <NotifyFields
                label="识别结果通知"
                value={value.notify}
                onChange={(notify) => onChange({ ...value, notify })}
                hint="识别成功后向现场 LED / 语音提示"
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
            <NotifyFields
                label="登记成功通知"
                value={value.notifySuccess}
                onChange={(notifySuccess) => onChange({ ...value, notifySuccess })}
                hint="登记成功时的现场提示"
            />
            <NotifyFields
                label="登记失败通知"
                value={value.notifyFail}
                onChange={(notifyFail) => onChange({ ...value, notifyFail })}
                hint="登记失败时的现场提示"
            />
            <NotifyFields
                label="直通成功通知"
                value={value.notifyDirectSuccess}
                onChange={(notifyDirectSuccess) => onChange({ ...value, notifyDirectSuccess })}
                hint="登记类型为煤/非煤或自动登记时可用"
                disabled={!showDirect}
            />
            <NotifyFields
                label="直通失败通知"
                value={value.notifyDirectFail}
                onChange={(notifyDirectFail) => onChange({ ...value, notifyDirectFail })}
                hint="登记类型为煤/非煤或自动登记时可用"
                disabled={!showDirect}
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
            <NotifyFields
                label="复位完成通知"
                value={value.notify}
                onChange={(notify) => onChange({ ...value, notify })}
                hint="复位完成的现场提示"
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

    React.useEffect(() => {
        if (open && step) setDraft(structuredClone(step.params));
        if (!open) setDraft(null);
    }, [open, step]);

    if (!step || !draft) {
        return (
            <Drawer open={open} title={title} onClose={onClose} width={440} footer={null}>
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
            width={460}
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

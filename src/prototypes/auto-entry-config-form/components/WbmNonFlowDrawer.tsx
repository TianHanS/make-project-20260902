import React, { useEffect, useState } from 'react';
import { NotifyItem } from '../data';
import {
    NON_FLOW_SECTIONS,
    NonFlowField,
    NonFlowValues,
    createDefaultNonFlowValues,
    normalizeNonFlowValues,
} from '../wbm-nonflow';
import { MessageNotifySection } from './MessageNotifySection';
import { Button, Checkbox, Drawer, Field, Select, Switch } from './ui';

function RadioGroup({
    name,
    value,
    options,
    onChange,
}: {
    name: string;
    value: string;
    options: ReadonlyArray<{ value: string; label: string }>;
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

/** 多选取值以逗号连接存储，便于与其它非流程参数一起持久化 */
function parseMulti(raw: unknown): string[] {
    return String(raw ?? '')
        .split(',')
        .filter(Boolean);
}

function CheckboxGroup({
    value,
    options,
    onChange,
}: {
    value: string[];
    options: ReadonlyArray<{ value: string; label: string }>;
    onChange: (v: string[]) => void;
}) {
    return (
        <div className="wbm-check-row">
            {options.map((o) => (
                <Checkbox
                    key={o.value}
                    checked={value.includes(o.value)}
                    onChange={(on) =>
                        onChange(
                            on
                                ? options.map((x) => x.value).filter((v) => v === o.value || value.includes(v))
                                : value.filter((v) => v !== o.value),
                        )
                    }
                >
                    {o.label}
                </Checkbox>
            ))}
        </div>
    );
}

function NumInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
    return (
        <input
            className="ae-input"
            type="number"
            min={0}
            value={Number.isFinite(value) ? value : 0}
            onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        />
    );
}

function readNotify(values: NonFlowValues, f: NonFlowField): NotifyItem {
    const nk = f.notifyKeys!;
    return {
        broadcastEnabled: !!values[nk.broadcastEnabled],
        broadcast: String(values[nk.broadcast] ?? ''),
        ledEnabled: !!values[nk.ledEnabled],
        led: String(values[nk.led] ?? ''),
    };
}

function writeNotify(
    setValues: React.Dispatch<React.SetStateAction<NonFlowValues>>,
    f: NonFlowField,
    v: NotifyItem,
) {
    const nk = f.notifyKeys!;
    setValues((prev) => ({
        ...prev,
        [nk.broadcastEnabled]: v.broadcastEnabled,
        [nk.broadcast]: v.broadcast,
        [nk.ledEnabled]: v.ledEnabled,
        [nk.led]: v.led,
    }));
}

/** 相邻同组字段合并为一个带小标题的子块，未分组字段仍按整卡片网格排列 */
function groupFields(fields: NonFlowField[]) {
    const runs: Array<{ title?: string; fields: NonFlowField[] }> = [];
    for (const f of fields) {
        const last = runs[runs.length - 1];
        if (last && last.title === f.group) last.fields.push(f);
        else runs.push({ title: f.group, fields: [f] });
    }
    return runs;
}

function isFieldVisible(f: NonFlowField, values: NonFlowValues) {
    if (f.visibleWhen && values[f.visibleWhen.key] !== f.visibleWhen.equals) return false;
    if (
        f.visibleWhenIncludes &&
        !parseMulti(values[f.visibleWhenIncludes.key]).includes(f.visibleWhenIncludes.value)
    ) {
        return false;
    }
    return true;
}

function renderField(
    f: NonFlowField,
    values: NonFlowValues,
    setValues: React.Dispatch<React.SetStateAction<NonFlowValues>>,
) {
    if (f.type === 'notifyPair' && f.notifyKeys) {
        return (
            <div key={f.key} className="wbm-nonflow-notify-wrap">
                <MessageNotifySection
                    items={[
                        {
                            key: f.key,
                            title: f.label,
                            value: readNotify(values, f),
                            onChange: (v) => writeNotify(setValues, f, v),
                        },
                    ]}
                />
            </div>
        );
    }

    const set = (key: string, v: string | number | boolean) =>
        setValues((prev) => ({ ...prev, [key]: v }));

    // 选项受某个多选字段约束时，只保留已勾选的取值
    const selectOptions = f.optionsLimitedBy
        ? (f.options ?? []).filter((o) => parseMulti(values[f.optionsLimitedBy!]).includes(o.value))
        : (f.options ?? []);
    const rawValue = String(values[f.key] ?? f.defaultValue ?? '');
    const selectValue = selectOptions.some((o) => o.value === rawValue)
        ? rawValue
        : (selectOptions[0]?.value ?? '');

    return (
        <Field key={f.key} label={`${f.label}${f.unit ? `（${f.unit}）` : ''}`} hint={f.hint}>
            {f.type === 'bool' ? (
                <Switch
                    checked={!!values[f.key]}
                    checkedChildren="是"
                    unCheckedChildren="否"
                    onChange={(v) => set(f.key, v)}
                />
            ) : f.type === 'radio' ? (
                <RadioGroup
                    name={f.key}
                    value={String(values[f.key] ?? f.defaultValue ?? '')}
                    options={f.options ?? []}
                    onChange={(v) => set(f.key, v)}
                />
            ) : f.type === 'multi' ? (
                <CheckboxGroup
                    value={parseMulti(values[f.key] ?? f.defaultValue)}
                    options={f.options ?? []}
                    onChange={(list) => set(f.key, list.join(','))}
                />
            ) : f.type === 'select' ? (
                <Select
                    value={selectValue}
                    options={selectOptions}
                    onChange={(v) => set(f.key, v)}
                />
            ) : f.type === 'number' ? (
                <NumInput
                    value={Number(values[f.key] ?? f.defaultValue ?? 0)}
                    onChange={(n) => set(f.key, n)}
                />
            ) : f.type === 'time' ? (
                <input
                    className="ae-input"
                    type="time"
                    value={String(values[f.key] ?? f.defaultValue ?? '')}
                    onChange={(e) => set(f.key, e.target.value)}
                />
            ) : (
                <input
                    className="ae-input"
                    value={String(values[f.key] ?? '')}
                    placeholder={f.label}
                    onChange={(e) => set(f.key, e.target.value)}
                />
            )}
        </Field>
    );
}

export function WbmNonFlowDrawer({
    open,
    initial,
    onClose,
    onSave,
}: {
    open: boolean;
    initial: NonFlowValues | null | undefined;
    onClose: () => void;
    onSave: (values: NonFlowValues) => void;
}) {
    const [values, setValues] = useState<NonFlowValues>(createDefaultNonFlowValues());

    useEffect(() => {
        if (!open) return;
        setValues(normalizeNonFlowValues(initial));
    }, [open, initial]);

    return (
        <Drawer
            open={open}
            nested
            width={720}
            onClose={onClose}
            title="非流程参数配置"
            bodyClassName="aef-drawer-body--form"
            footer={
                <div className="ae-drawer-actions">
                    <Button onClick={onClose}>取消</Button>
                    <Button
                        variant="primary"
                        onClick={() => {
                            onSave(values);
                            onClose();
                        }}
                    >
                        确定
                    </Button>
                </div>
            }
        >
            <div className="aef-form-scroll wbm-nonflow-scroll">
                {NON_FLOW_SECTIONS.map((sec) => {
                    const visible = sec.fields.filter((f) => isFieldVisible(f, values));
                    const notifyFields = visible.filter((f) => f.type === 'notifyPair');
                    const groups = groupFields(visible.filter((f) => f.type !== 'notifyPair'));
                    return (
                        <section key={sec.id} className="wbm-section">
                            <header className="wbm-section-head">
                                <h3 className="wbm-section-title">{sec.title}</h3>
                                {sec.description ? (
                                    <p className="wbm-section-desc">{sec.description}</p>
                                ) : null}
                            </header>
                            {groups.map((g, i) =>
                                g.title ? (
                                    <div key={g.title} className="wbm-nonflow-group">
                                        <h4 className="wbm-nonflow-group-title">{g.title}</h4>
                                        <div className="aef-field-grid aef-field-grid--2">
                                            {g.fields.map((f) => renderField(f, values, setValues))}
                                        </div>
                                    </div>
                                ) : (
                                    <div key={`plain-${i}`} className="aef-field-grid aef-field-grid--2">
                                        {g.fields.map((f) => renderField(f, values, setValues))}
                                    </div>
                                ),
                            )}
                            {notifyFields.map((f) => renderField(f, values, setValues))}
                        </section>
                    );
                })}
            </div>
        </Drawer>
    );
}

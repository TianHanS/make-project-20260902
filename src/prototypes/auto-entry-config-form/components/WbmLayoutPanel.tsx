import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ModuleItem } from '../data';
import {
    DEVICE_ROLE_OPTIONS,
    DeviceRole,
    SideLayout,
    VEHICLE_TYPE_OPTIONS,
    WEIGH_MODE_OPTIONS,
    WEIGHING_PROCESS_OPTIONS,
    WbmDeviceLayout,
    WbmModuleConfig,
    WbmStrategy,
    applyOneWayLayout,
    applyTicketPrintDefaults,
    collectUsedDeviceIds,
    createDefaultDeviceLayout,
    devicesByKind,
    generateWbmConfig,
    getModuleDevices,
    isOneWayWeighDefault,
    oneWayWeighSide,
    saveLayoutOnly,
    suggestStrategyFromLayout,
    ticketPrintOptionsFor,
} from '../wbm-data';
import { Button, Checkbox, Field, Modal, Select, Switch, message } from './ui';

function RadioGroup({
    name,
    value,
    options,
    onChange,
    disabled = false,
    compact = false,
}: {
    name: string;
    value: string;
    options: readonly { value: string; label: string }[];
    onChange: (v: string) => void;
    disabled?: boolean;
    compact?: boolean;
}) {
    return (
        <div
            className={`aef-radio-group${compact ? ' is-compact' : ''}${disabled ? ' is-disabled' : ''}`}
            role="radiogroup"
        >
            {options.map((o) => (
                <label key={o.value} className={`aef-radio${value === o.value ? ' is-checked' : ''}`}>
                    <input
                        type="radio"
                        name={name}
                        checked={value === o.value}
                        disabled={disabled}
                        onChange={() => onChange(o.value)}
                    />
                    <span className="aef-radio-dot" />
                    <span>{o.label}</span>
                </label>
            ))}
        </div>
    );
}

function SideDeviceFields({
    title,
    tip,
    moduleId,
    side,
    sideKey,
    layout,
    onChange,
}: {
    title: string;
    tip?: string;
    moduleId: string;
    side: SideLayout;
    sideKey: 'approach' | 'opposite';
    layout: WbmDeviceLayout;
    onChange: (next: SideLayout) => void;
}) {
    const slot = (
        field: keyof SideLayout,
        kind: 'barrier' | 'plateOut' | 'plateIn' | 'cardReader',
        label: string,
        roleField?: keyof SideLayout,
    ) => {
        const used = collectUsedDeviceIds(layout, { side: sideKey, field });
        const deviceId = side[field] as string;
        const options = [
            { value: '', label: '不关联' },
            ...devicesByKind(moduleId, kind).map((d) => ({
                value: d.id,
                label: d.name,
                disabled: used.has(d.id) && d.id !== deviceId,
            })),
        ];
        return (
            <Field label={label} key={field}>
                <div className={roleField ? 'wbm-device-slot' : undefined}>
                    <Select
                        value={deviceId}
                        allowClear
                        options={options}
                        onChange={(v) => onChange({ ...side, [field]: v })}
                    />
                    {roleField ? (
                        <RadioGroup
                            compact
                            disabled={!deviceId}
                            name={`${sideKey}-${roleField}`}
                            value={side[roleField] as string}
                            options={DEVICE_ROLE_OPTIONS}
                            onChange={(v) => onChange({ ...side, [roleField]: v as DeviceRole })}
                        />
                    ) : null}
                </div>
            </Field>
        );
    };

    return (
        <section className="wbm-side-block">
            <header className="wbm-side-head">
                <h4>{title}</h4>
                {tip ? <p>{tip}</p> : null}
            </header>
            <div className="aef-field-grid aef-field-grid--2">
                {slot('barrierId', 'barrier', '道闸')}
                {slot('plateOutId', 'plateOut', '车牌识别器（向外）', 'plateOutRole')}
                {slot('plateInId', 'plateIn', '车牌识别器（向内）', 'plateInRole')}
                {slot('cardReaderId', 'cardReader', '读卡器', 'cardReaderRole')}
            </div>
        </section>
    );
}

/** 设备布局及计量要求面板：作为流程配置抽屉的第一个 Tab 内容 */
export function WbmLayoutPanel({
    active,
    module,
    existing,
    onComplete,
    onSaveLayoutOnly,
    onDirtyChange,
    actionsRef,
}: {
    /** Tab 激活时按最新配置回填 */
    active: boolean;
    module: ModuleItem | null;
    existing: WbmModuleConfig | null;
    /** 确认配置：重编排并进入流程编排 Tab */
    onComplete: (cfg: WbmModuleConfig) => void;
    /** 仅保存布局与场景，不改动已有流程编排 */
    onSaveLayoutOnly: (cfg: WbmModuleConfig) => void;
    /** 本 Tab 是否有未保存改动，供切 Tab 时拦截 */
    onDirtyChange?: (dirty: boolean) => void;
    /** 把保存动作交给抽屉底栏统一渲染 */
    actionsRef?: React.MutableRefObject<{ save?: () => void; saveAndRearrange?: () => void }>;
}) {
    const [layout, setLayout] = useState<WbmDeviceLayout>(() =>
        createDefaultDeviceLayout(module?.id ?? 'm-wbm1'),
    );
    const [strategy, setStrategy] = useState<WbmStrategy>(() =>
        suggestStrategyFromLayout(module?.id ?? 'm-wbm1', createDefaultDeviceLayout(module?.id ?? 'm-wbm1')),
    );
    const [confirmOpen, setConfirmOpen] = useState(false);
    /** 最近一次加载或保存后的快照，用于判断是否有未保存改动 */
    const savedSnapshotRef = useRef('');

    useEffect(() => {
        if (!active || !module) return;
        const initLayout = existing?.layout
            ? structuredClone(existing.layout)
            : createDefaultDeviceLayout(module.id);
        const initStrategy = existing?.strategy
            ? applyTicketPrintDefaults(structuredClone(existing.strategy))
            : suggestStrategyFromLayout(module.id, initLayout);
        setLayout(initLayout);
        setStrategy(initStrategy);
        setConfirmOpen(false);
        savedSnapshotRef.current = JSON.stringify({ layout: initLayout, strategy: initStrategy });
        onDirtyChange?.(false);
    }, [active, module?.id, existing]);

    useEffect(() => {
        if (!active || !savedSnapshotRef.current) return;
        onDirtyChange?.(JSON.stringify({ layout, strategy }) !== savedSnapshotRef.current);
    }, [active, layout, strategy]);

    const refreshFromLayout = (nextLayout: WbmDeviceLayout, keep?: Partial<WbmStrategy>) => {
        if (!module) return;
        const suggested = suggestStrategyFromLayout(
            module.id,
            nextLayout,
            keep?.weighMode ?? strategy.weighMode,
            keep?.weighingProcess ?? strategy.weighingProcess,
        );
        setStrategy((prev) =>
            applyTicketPrintDefaults({
                ...suggested,
                ...keep,
                oneWayWeigh: keep?.oneWayWeigh ?? prev.oneWayWeigh,
                vehicleTypes: keep?.vehicleTypes ?? prev.vehicleTypes,
                requireDriverAlight: keep?.requireDriverAlight ?? prev.requireDriverAlight,
                approachCameraId: keep?.approachCameraId ?? prev.approachCameraId,
                oppositeCameraId: keep?.oppositeCameraId ?? prev.oppositeCameraId,
                printCoal: prev.printCoal,
                printOutboundMaterial: prev.printOutboundMaterial,
                printInboundMaterial: prev.printInboundMaterial,
                printBiomass: prev.printBiomass,
            }),
        );
    };

    const patchStrategy = (partial: Partial<WbmStrategy>) => {
        setStrategy((prev) => applyTicketPrintDefaults({ ...prev, ...partial }));
    };

    const toggleVehicle = (code: string) => {
        setStrategy((prev) => {
            const has = prev.vehicleTypes.includes(code);
            const vehicleTypes = has
                ? prev.vehicleTypes.filter((c) => c !== code)
                : [...prev.vehicleTypes, code];
            return applyTicketPrintDefaults({ ...prev, vehicleTypes });
        });
    };

    const validate = (): string | null => {
        if (!strategy.vehicleTypes.length) return '请至少勾选一种计量车种';
        return null;
    };

    const markSaved = () => {
        savedSnapshotRef.current = JSON.stringify({ layout, strategy });
        onDirtyChange?.(false);
    };

    const handleConfirm = () => {
        if (!module) return;
        const err = validate();
        if (err) {
            message.error(err);
            return;
        }
        setConfirmOpen(false);
        markSaved();
        onComplete(generateWbmConfig(module.id, layout, strategy, existing));
    };

    const handleSaveOnly = () => {
        if (!module) return;
        const err = validate();
        if (err) {
            message.error(err);
            return;
        }
        markSaved();
        onSaveLayoutOnly(saveLayoutOnly(module.id, layout, strategy, existing));
        message.success('已保存设备布局及计量要求（未改动流程与参数）');
    };

    /** 切换衡器类型：单向过磅按类型取默认，并同步调整设备布局的方向 */
    const changeWeighMode = (mode: WbmStrategy['weighMode']) => {
        if (!module) return;
        const oneWayWeigh = isOneWayWeighDefault(mode);
        const nextLayout = applyOneWayLayout(layout, mode, oneWayWeigh, module.id);
        setLayout(nextLayout);
        setStrategy((prev) => applyTicketPrintDefaults({ ...prev, weighMode: mode, oneWayWeigh }));
    };

    const toggleOneWay = (oneWayWeigh: boolean) => {
        if (!module) return;
        const nextLayout = applyOneWayLayout(layout, strategy.weighMode, oneWayWeigh, module.id);
        setLayout(nextLayout);
        patchStrategy({ oneWayWeigh });
    };

    // 每次渲染后把最新的保存动作挂给抽屉底栏
    useEffect(() => {
        if (!actionsRef) return;
        actionsRef.current = {
            save: handleSaveOnly,
            saveAndRearrange: () => setConfirmOpen(true),
        };
    });

    const hasPhoto = module ? getModuleDevices(module.id).hasAlightPhotoSignal : false;
    const cameraOptions = module
        ? [
              { value: '', label: '不关联' },
              ...devicesByKind(module.id, 'camera').map((d) => ({ value: d.id, label: d.name })),
          ]
        : [{ value: '', label: '不关联' }];
    const printOptions = ticketPrintOptionsFor(strategy.vehicleTypes);
    const keepSide = oneWayWeighSide(strategy.weighMode);
    const showApproach = !strategy.oneWayWeigh || keepSide === 'approach';
    const showOpposite = !strategy.oneWayWeigh || keepSide === 'opposite';

    if (!module) return null;

    return (
        <>
            <div className="aef-tab-panel wbm-layout-panel">
                <div className="wbm-layout-panel-scroll">
                    <p className="wbm-page-banner">
                        设备布局及计量要求即基础配置。点击「保存并重新设定」将按最新要求重新匹配执行流程及参数；仅「保存」则只保存布局与场景，不改动已有流程编排。
                    </p>

                    <section className="wbm-section">
                        <h3 className="wbm-section-title">场景选择</h3>
                        <div className="aef-field-grid aef-field-grid--2">
                            <Field label="衡器类型" required>
                                <RadioGroup
                                    name="weighMode"
                                    value={strategy.weighMode}
                                    options={WEIGH_MODE_OPTIONS}
                                    onChange={(v) => changeWeighMode(v as WbmStrategy['weighMode'])}
                                />
                            </Field>
                            <Field label="上磅流程" required>
                                <RadioGroup
                                    name="weighingProcess"
                                    value={strategy.weighingProcess}
                                    options={WEIGHING_PROCESS_OPTIONS}
                                    onChange={(v) =>
                                        patchStrategy({
                                            weighingProcess: v as WbmStrategy['weighingProcess'],
                                        })
                                    }
                                />
                            </Field>
                        </div>
                    </section>

                    <section className="wbm-section">
                        <h3 className="wbm-section-title">设备布局</h3>
                        <p className="aef-sync-hint">
                            {strategy.weighMode === '3'
                                ? '混用衡：以重车进厂方向作为「进厂方向」。同模块设备不可重复关联。'
                                : '同模块设备不可重复关联；可不关联。'}
                        </p>
                        <p className="aef-sync-hint">
                            车牌识别器、读卡器选定设备后可指定主辅角色：选择主要识别设备，若主设备异常，则根据辅助设备识别来车。主辅设备都正常时，则使用主辅设备相互验证。
                        </p>
                        <div className="aef-field-grid aef-field-grid--2 wbm-oneway-row">
                            <Field label="是否单向过磅">
                                <Switch
                                    checked={strategy.oneWayWeigh}
                                    checkedChildren="是"
                                    unCheckedChildren="否"
                                    onChange={toggleOneWay}
                                />
                                <p className="aef-sync-hint" style={{ marginTop: 6 }}>
                                    {strategy.oneWayWeigh
                                        ? `仅按${keepSide === 'approach' ? '进厂' : '出厂'}方向布置设备，另一方向不参与编排`
                                        : '进厂、出厂两个方向分别布置设备'}
                                </p>
                            </Field>
                        </div>
                        {showApproach ? (
                            <SideDeviceFields
                                title="进厂方向"
                                moduleId={module.id}
                                side={layout.approach}
                                sideKey="approach"
                                layout={layout}
                                onChange={(approach) => {
                                    const next = { ...layout, approach };
                                    setLayout(next);
                                    refreshFromLayout(next, {
                                        weighMode: strategy.weighMode,
                                        weighingProcess: strategy.weighingProcess,
                                        oneWayWeigh: strategy.oneWayWeigh,
                                        vehicleTypes: strategy.vehicleTypes,
                                        requireDriverAlight: strategy.requireDriverAlight,
                                    });
                                }}
                            />
                        ) : null}
                        {showOpposite ? (
                            <SideDeviceFields
                                title="出厂方向"
                                moduleId={module.id}
                                side={layout.opposite}
                                sideKey="opposite"
                                layout={layout}
                                onChange={(opposite) => {
                                    const next = { ...layout, opposite };
                                    setLayout(next);
                                    refreshFromLayout(next, {
                                        weighMode: strategy.weighMode,
                                        weighingProcess: strategy.weighingProcess,
                                        oneWayWeigh: strategy.oneWayWeigh,
                                        vehicleTypes: strategy.vehicleTypes,
                                        requireDriverAlight: strategy.requireDriverAlight,
                                    });
                                }}
                            />
                        ) : null}
                    </section>

                    <section className="wbm-section">
                        <h3 className="wbm-section-title">场景业务要求</h3>
                        <div className="aef-field-grid aef-field-grid--2">
                            <Field label="计量车种" required>
                                <div className="wbm-check-row">
                                    {VEHICLE_TYPE_OPTIONS.map((o) => (
                                        <Checkbox
                                            key={o.value}
                                            checked={strategy.vehicleTypes.includes(o.value)}
                                            onChange={() => toggleVehicle(o.value)}
                                        >
                                            {o.label}
                                        </Checkbox>
                                    ))}
                                </div>
                            </Field>
                            <Field label="是否要求司机下车计量">
                                <Switch
                                    checked={strategy.requireDriverAlight}
                                    checkedChildren="是"
                                    unCheckedChildren="否"
                                    onChange={(requireDriverAlight) =>
                                        patchStrategy({
                                            requireDriverAlight,
                                            alightMethod: hasPhoto ? 'photo' : 'weight',
                                        })
                                    }
                                />
                                <p className="aef-sync-hint" style={{ marginTop: 6 }}>
                                    {hasPhoto
                                        ? '模块已配置下车光电信号，下车校验按光电方式加载'
                                        : '无下车光电信号，下车校验按司机体重判断加载'}
                                </p>
                            </Field>
                            <Field label="是否启用车辆二次一致性校验">
                                <Switch
                                    checked={strategy.consistencyCheck}
                                    checkedChildren="是"
                                    unCheckedChildren="否"
                                    onChange={(consistencyCheck) => patchStrategy({ consistencyCheck })}
                                />
                            </Field>
                            <Field label="进厂方向抓拍摄像头">
                                <Select
                                    value={strategy.approachCameraId}
                                    allowClear
                                    options={cameraOptions.map((o) =>
                                        o.value && o.value === strategy.oppositeCameraId
                                            ? { ...o, disabled: true }
                                            : o,
                                    )}
                                    placeholder={
                                        cameraOptions.length > 1 ? '请选择' : '本模块未关联摄像头'
                                    }
                                    disabled={cameraOptions.length <= 1}
                                    onChange={(approachCameraId) => patchStrategy({ approachCameraId })}
                                />
                            </Field>
                            <Field label="出厂方向抓拍摄像头">
                                <Select
                                    value={strategy.oppositeCameraId}
                                    allowClear
                                    options={cameraOptions.map((o) =>
                                        o.value && o.value === strategy.approachCameraId
                                            ? { ...o, disabled: true }
                                            : o,
                                    )}
                                    placeholder={
                                        cameraOptions.length > 1 ? '请选择' : '本模块未关联摄像头'
                                    }
                                    disabled={cameraOptions.length <= 1}
                                    onChange={(oppositeCameraId) => patchStrategy({ oppositeCameraId })}
                                />
                            </Field>
                            <Field label="磅单打印">
                                {printOptions.length ? (
                                    <div className="wbm-check-row">
                                        {printOptions.map((o) => (
                                            <Checkbox
                                                key={o.key}
                                                checked={strategy[o.key]}
                                                onChange={(checked) =>
                                                    patchStrategy({ [o.key]: checked })
                                                }
                                            >
                                                {o.label}
                                            </Checkbox>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="aef-sync-hint">请先勾选计量车种，再选择需要打印的磅单</p>
                                )}
                            </Field>
                        </div>
                    </section>
                </div>
            </div>

            <Modal
                open={confirmOpen}
                stacked
                title="是否确认配置？"
                onClose={() => setConfirmOpen(false)}
                footer={
                    <div className="ae-drawer-actions">
                        <Button onClick={() => setConfirmOpen(false)}>取消</Button>
                        <Button variant="primary" onClick={handleConfirm}>
                            确认
                        </Button>
                    </div>
                }
            >
                <p className="wbm-confirm-text">
                    确认后将根据配置加载编排流程及参数配置，并进入流程编排页面。是否继续？
                </p>
            </Modal>
        </>
    );
}

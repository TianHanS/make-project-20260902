import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowUpDown,
    GitBranch,
    GripVertical,
    HelpCircle,
    Plus,
    PlusCircle,
    Trash2,
} from 'lucide-react';
import { ModuleItem, NotifyItem } from '../data';
import {
    CATEGORY_LABEL,
    EXEC_PHASES,
    ExecPhase,
    LIB_CATEGORY_OPTIONS,
    LibCategoryToggle,
    PHASE_LABEL,
    StepCategory,
    StepId,
    SUB_PROCESS_LIBRARY,
    WbmFlowStep,
    WbmModuleConfig,
    checkStepPlacement,
    filterLibrary,
    forcedOrderOf,
    insertStepIntoPhase,
    isPhaseLocked,
    sortStepsByPhase,
    stepPhase,
    getStepSchema,
    createStepAdvanced,
    createStepUid,
    hasOnScaleInfraredPoint,
    getFlameoutSignalAvailability,
    isStepParamVisible,
    isNotifyVisible,
    getNotifyDefault,
    getAlightStartNotifyDefault,
    buildOverloadRangeRows,
    normalizeStepAdvanced,
    reloadParamsAfterFlowSave,
    validateWbmConfig,
    type ParamField,
    type StepParamValues,
} from '../wbm-data';
import { Button, Checkbox, Drawer, Empty, Field, MultiSelect, Select, Switch, Tag, message } from './ui';
import { MessageNotifySection } from './MessageNotifySection';
import { WbmNonFlowDrawer } from './WbmNonFlowDrawer';
import { WbmLayoutPanel } from './WbmLayoutPanel';
import { normalizeNonFlowValues } from '../wbm-nonflow';

type TabId = 'layout' | 'flow' | 'advanced';

const TAB_LABEL: Record<TabId, string> = {
    layout: '设备布局及计量要求',
    flow: '流程编排',
    advanced: '高级参数配置',
};

function stepsSignature(steps: WbmFlowStep[]): string {
    return steps.map((s) => `${s.uid}@${stepPhase(s)}`).join('|');
}

/** 上次保存时的执行流程快照，用于标记本次新增与调序的步骤 */
interface StepBaselineItem {
    uid: string;
    phase: ExecPhase;
}

type StepChange = { kind: 'added' } | { kind: 'moved'; from: number };

function stepBaseline(steps: WbmFlowStep[]): StepBaselineItem[] {
    return steps.map((s) => ({ uid: s.uid, phase: stepPhase(s) }));
}

/**
 * 与上次保存的执行流程比对：
 * 基线里没有的 uid 记为新增；仍在基线里的，用最长递增子序列找出「相对顺序没变」的一批，
 * 其余（含换了大类的）记为调序，避免插入一步就把后面所有步骤都标成变动。
 */
function diffSteps(steps: WbmFlowStep[], baseline: StepBaselineItem[]): Map<string, StepChange> {
    const changes = new Map<string, StepChange>();
    if (!baseline.length) return changes;
    const basePos = new Map(baseline.map((item, index) => [item.uid, index]));
    const basePhase = new Map(baseline.map((item) => [item.uid, item.phase]));

    const kept: Array<{ uid: string; pos: number }> = [];
    steps.forEach((step) => {
        const pos = basePos.get(step.uid);
        if (pos === undefined) {
            changes.set(step.uid, { kind: 'added' });
            return;
        }
        kept.push({ uid: step.uid, pos });
    });

    // 最长递增子序列：留在序列里的视为未动
    const tails: number[] = [];
    const prev: number[] = new Array(kept.length).fill(-1);
    const tailIdx: number[] = [];
    kept.forEach((item, i) => {
        let lo = 0;
        let hi = tails.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (tails[mid] < item.pos) lo = mid + 1;
            else hi = mid;
        }
        tails[lo] = item.pos;
        tailIdx[lo] = i;
        prev[i] = lo > 0 ? tailIdx[lo - 1] : -1;
    });
    const stable = new Set<string>();
    let cursor = tails.length ? tailIdx[tails.length - 1] : -1;
    while (cursor >= 0) {
        stable.add(kept[cursor].uid);
        cursor = prev[cursor];
    }

    steps.forEach((step) => {
        if (changes.has(step.uid)) return;
        const pos = basePos.get(step.uid);
        if (pos === undefined) return;
        const phaseChanged = basePhase.get(step.uid) !== stepPhase(step);
        if (!stable.has(step.uid) || phaseChanged) {
            changes.set(step.uid, { kind: 'moved', from: pos + 1 });
        }
    });
    return changes;
}

function resolveStepCategory(step: Pick<WbmFlowStep, 'id' | 'category'>): StepCategory {
    if (step.category) return step.category;
    return SUB_PROCESS_LIBRARY.find((s) => s.id === step.id)?.category ?? 'metering';
}

function isRequiredStep(step: Pick<WbmFlowStep, 'id' | 'required'>): boolean {
    return SUB_PROCESS_LIBRARY.find((s) => s.id === step.id)?.required ?? !!step.required;
}

function NumInput({
    value,
    onChange,
    title,
}: {
    value: number;
    onChange: (n: number) => void;
    title?: string;
}) {
    return (
        <input
            className="ae-input"
            type="number"
            min={0}
            step="any"
            title={title}
            value={Number.isFinite(value) ? value : 0}
            onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        />
    );
}

/** 超量程量程表：车型一行三列，便于批量录入 */
function OverloadRangeTable({
    params,
    values,
    vehicleTypes,
    onPatch,
}: {
    params: ParamField[];
    values: StepParamValues;
    vehicleTypes: string[];
    onPatch: (key: string, v: string | number) => void;
}) {
    const rows = buildOverloadRangeRows(params, vehicleTypes);
    if (!rows.length) {
        return <p className="aef-sync-hint">请先在设备布局中勾选计量车种，再配置对应量程</p>;
    }
    return (
        <div className="wbm-range-table-wrap">
            <p className="wbm-range-table-tip">
                按车型配置下限 / 上限（吨）与超阈值动作；超出阈值视为超量程。展示范围随场景「计量车种」联动。
            </p>
            <table className="wbm-range-table">
                <thead>
                    <tr>
                        <th>车型</th>
                        <th>下限阈值（吨）</th>
                        <th>上限阈值（吨）</th>
                        <th>超阈值动作</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        const minVal = Number(values[row.min.key] ?? row.min.defaultValue);
                        const maxVal = Number(values[row.max.key] ?? row.max.defaultValue);
                        const actionVal = String(
                            values[row.action.key] ?? row.action.defaultValue ?? '1',
                        );
                        return (
                            <tr key={row.group}>
                                <td className="wbm-range-table-name">{row.name}</td>
                                <td>
                                    <NumInput
                                        value={minVal}
                                        title={`${row.name}下限阈值`}
                                        onChange={(n) => onPatch(row.min.key, n)}
                                    />
                                </td>
                                <td>
                                    <NumInput
                                        value={maxVal}
                                        title={`${row.name}上限阈值`}
                                        onChange={(n) => onPatch(row.max.key, n)}
                                    />
                                </td>
                                <td>
                                    <Select
                                        value={actionVal}
                                        options={row.action.options ?? []}
                                        onChange={(v) => onPatch(row.action.key, v)}
                                    />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export function WbmFlowConfigDrawer({
    open,
    module,
    initial,
    onClose,
    onSave,
}: {
    open: boolean;
    module: ModuleItem | null;
    initial: WbmModuleConfig | null;
    onClose: () => void;
    onSave: (cfg: WbmModuleConfig) => void;
}) {
    const [cfg, setCfg] = useState<WbmModuleConfig | null>(null);
    const [tab, setTab] = useState<TabId>('layout');
    const [libCats, setLibCats] = useState<LibCategoryToggle>({ metering: true, device: true });
    const [selectedLibId, setSelectedLibId] = useState<StepId | null>(null);
    const [onlyParams, setOnlyParams] = useState(false);
    const [onlyNotify, setOnlyNotify] = useState(false);
    const [activeNav, setActiveNav] = useState<string | null>(null);
    const [dragUid, setDragUid] = useState<string | null>(null);
    const [dragOverUid, setDragOverUid] = useState<string | null>(null);
    const [dragOverPhase, setDragOverPhase] = useState<ExecPhase | null>(null);
    const [nonFlowOpen, setNonFlowOpen] = useState(false);
    const [layoutDirty, setLayoutDirty] = useState(false);
    const [savedStepsSig, setSavedStepsSig] = useState('');
    const [savedSteps, setSavedSteps] = useState<StepBaselineItem[]>([]);
    const blockRefs = useRef<Partial<Record<string, HTMLElement | null>>>({});
    /** 保存后配置回流会重置 Tab，用它保留用户所在页 */
    const tabAfterSyncRef = useRef<TabId | null>(null);
    /** 布局 Tab 的保存动作由抽屉底栏统一触发 */
    const layoutActionsRef = useRef<{ save?: () => void; saveAndRearrange?: () => void }>({});

    useEffect(() => {
        if (!open || !module) return;
        const cloned = initial ? structuredClone(initial) : null;
        if (cloned) {
            cloned.nonFlow = normalizeNonFlowValues(cloned.nonFlow);
            const nextAdv = { ...cloned.advanced };
            for (const s of cloned.steps) {
                if (!nextAdv[s.uid]) continue;
                nextAdv[s.uid] = normalizeStepAdvanced(s.id, nextAdv[s.uid], {
                    alightMethod: cloned.strategy?.alightMethod,
                });
            }
            cloned.advanced = nextAdv;
        }
        setCfg(cloned);
        setSavedStepsSig(stepsSignature(cloned?.steps ?? []));
        setSavedSteps(stepBaseline(cloned?.steps ?? []));
        // 每次进入抽屉都从「设备布局及计量要求」开始；保存回流时保留原 Tab
        setTab(tabAfterSyncRef.current ?? 'layout');
        tabAfterSyncRef.current = null;
        setLibCats({ metering: true, device: true });
        setSelectedLibId(null);
        setOnlyParams(false);
        setOnlyNotify(false);
        setActiveNav(null);
        setDragUid(null);
        setDragOverUid(null);
        setDragOverPhase(null);
        setNonFlowOpen(false);
        setLayoutDirty(false);
    }, [open, module?.id, initial]);

    const libItems = useMemo(() => filterLibrary(libCats), [libCats]);
    const stepCountMap = useMemo(() => {
        const map = new Map<StepId, number>();
        for (const s of cfg?.steps ?? []) {
            map.set(s.id, (map.get(s.id) ?? 0) + 1);
        }
        return map;
    }, [cfg?.steps]);

    const flowDirty = !!cfg && stepsSignature(cfg.steps) !== savedStepsSig;
    /** 相对上次保存的新增与调序，加上重新匹配带来的待确认步骤，用于执行流程里的醒目标记 */
    const stepChanges = useMemo(() => {
        const marks = diffSteps(cfg?.steps ?? [], savedSteps);
        for (const step of cfg?.steps ?? []) {
            if (step.isNew && !marks.has(step.uid)) marks.set(step.uid, { kind: 'added' });
        }
        return marks;
    }, [cfg?.steps, savedSteps]);
    const addedCount = [...stepChanges.values()].filter((c) => c.kind === 'added').length;
    const movedCount = stepChanges.size - addedCount;

    if (!module) return null;
    const isEmpty = !initial || !initial.steps.length;

    const patchCfg = (updater: (c: WbmModuleConfig) => WbmModuleConfig) => {
        setCfg((prev) => (prev ? updater(prev) : prev));
    };

    const requestTab = (next: TabId) => {
        if (next === tab) return;
        if (tab === 'layout' && layoutDirty) {
            message.warning('需保存已改动参数');
            return;
        }
        if (next !== 'layout' && isEmpty) {
            message.warning('请先在「设备布局及计量要求」中保存并重新设定，生成执行流程');
            return;
        }
        if (tab === 'flow' && next !== 'flow' && flowDirty) {
            message.warning('流程编排存在更新，请先保存执行流程！');
            return;
        }
        setTab(next);
    };

    const addStep = (id?: StepId) => {
        const targetId = id ?? selectedLibId;
        if (!cfg || !targetId) return;
        const item =
            libItems.find((s) => s.id === targetId) ??
            filterLibrary({ metering: true, device: true }).find((s) => s.id === targetId);
        if (!item) return;
        const step: WbmFlowStep = {
            uid: createStepUid(item.id),
            id: item.id,
            category: item.category,
            phase: item.defaultPhase,
            name: item.name,
            desc: item.desc,
            required: item.required,
            source: 'manual',
            isNew: true,
        };
        patchCfg((c) => ({
            ...c,
            steps: insertStepIntoPhase(c.steps, step, item.defaultPhase),
            advanced: {
                ...c.advanced,
                [step.uid]: createStepAdvanced(item.id, {
                    alightMethod: cfg?.strategy.alightMethod,
                    moduleId: cfg?.moduleId,
                }),
            },
        }));
        setSelectedLibId(targetId);
        message.success(`已添加「${item.name}」到「${PHASE_LABEL[item.defaultPhase]}」`);
    };

    const removeStepByUid = (uid: string) => {
        const step = cfg?.steps.find((s) => s.uid === uid);
        if (!step) return;
        patchCfg((c) => {
            const { [uid]: _removed, ...restAdv } = c.advanced;
            return {
                ...c,
                steps: c.steps.filter((s) => s.uid !== uid),
                advanced: restAdv,
            };
        });
        message.success(`已从执行流程移除「${step.name}」`);
    };

    const requestRemoveStep = (uid: string) => {
        const step = cfg?.steps.find((s) => s.uid === uid);
        // 必选子流程不提供删除入口
        if (!step || isRequiredStep(step)) return;
        removeStepByUid(uid);
    };

    const resetDrag = () => {
        setDragUid(null);
        setDragOverUid(null);
        setDragOverPhase(null);
    };

    /**
     * 拖拽落位：把 uid 移到目标大类的指定位置。
     * beforeUid 为空表示落到该大类末尾；违反强制归属或强制排序时拒绝并提示。
     */
    const moveStepTo = (uid: string, targetPhase: ExecPhase, beforeUid: string | null) => {
        if (!cfg || uid === beforeUid) return;
        const moving = cfg.steps.find((s) => s.uid === uid);
        if (!moving) return;
        const moved: WbmFlowStep = { ...moving, phase: targetPhase };
        const rest = cfg.steps.filter((s) => s.uid !== uid);
        let next: WbmFlowStep[];
        if (beforeUid) {
            const at = rest.findIndex((s) => s.uid === beforeUid);
            if (at < 0) return;
            next = [...rest.slice(0, at), moved, ...rest.slice(at)];
        } else {
            next = insertStepIntoPhase(rest, moved, targetPhase, false);
        }
        next = sortStepsByPhase(next);
        if (stepsSignature(next) === stepsSignature(cfg.steps)) return;
        const err = checkStepPlacement(next, moved, targetPhase);
        if (err) {
            message.warning(err);
            return;
        }
        patchCfg((c) => ({ ...c, steps: next }));
    };

    const saveDraft = () => {
        if (!cfg) return;
        const next = reloadParamsAfterFlowSave(cfg, cfg.steps);
        const errs = validateWbmConfig(next);
        setCfg(next);
        setSavedStepsSig(stepsSignature(next.steps));
        setSavedSteps(stepBaseline(next.steps));
        if (errs.length) {
            message.warning(`已保存草稿，但仍有校验项：${errs[0]}`);
        } else {
            message.success('配置已保存');
        }
        tabAfterSyncRef.current = tab;
        onSave({ ...next, status: 'draft', updatedAt: new Date().toISOString() });
    };

    const scrollToStep = (uid: string) => {
        if (tab === 'flow' && flowDirty) {
            message.warning('流程编排存在更新，请先保存执行流程！');
            return;
        }
        setActiveNav(uid);
        setTab('advanced');
        requestAnimationFrame(() => {
            blockRefs.current[uid]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    };

    const toggleLibCat = (key: keyof LibCategoryToggle) => {
        setLibCats((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <>
            <Drawer
                open={open}
                width={1120}
                onClose={onClose}
                title={
                    <div className="aef-drawer-title-row">
                        <span>{module.name} · 无人值守计量</span>
                    </div>
                }
                bodyClassName="aef-drawer-body--form"
                footer={
                    <div className="ae-drawer-actions">
                        <Button onClick={onClose}>关闭</Button>
                        {tab === 'layout' ? (
                            <>
                                <span title="仅保存配置的内容，但不会重新编排流程，高级配置参数将根据设备布局及计量要求加载">
                                    <Button onClick={() => layoutActionsRef.current.save?.()}>
                                        保存
                                    </Button>
                                </span>
                                <Button
                                    variant="primary"
                                    onClick={() => layoutActionsRef.current.saveAndRearrange?.()}
                                >
                                    保存并重新设定
                                </Button>
                            </>
                        ) : (
                            <Button variant="primary" disabled={!cfg || isEmpty} onClick={saveDraft}>
                                保存
                            </Button>
                        )}
                    </div>
                }
            >
                <div className="aef-form-layer">
                            <div className="wbm-tabs-bar">
                                <div className="aef-tabs" role="tablist">
                                    {(['layout', 'flow', 'advanced'] as TabId[]).map((id) => (
                                        <button
                                            key={id}
                                            type="button"
                                            role="tab"
                                            aria-selected={tab === id}
                                            aria-disabled={id !== 'layout' && isEmpty}
                                            className={`aef-tab${tab === id ? ' is-active' : ''}${
                                                id !== 'layout' && isEmpty ? ' is-locked' : ''
                                            }`}
                                            title={
                                                id !== 'layout' && isEmpty
                                                    ? '完成设备布局及计量要求后可用'
                                                    : undefined
                                            }
                                            onClick={() => requestTab(id)}
                                        >
                                            {TAB_LABEL[id]}
                                            {id === 'advanced' ? (
                                                <span
                                                    className="aef-tab-tip"
                                                    title="如需改动更多流程信息、各环节消息通知内容，可调整对应参数以达到需要的流程效果"
                                                >
                                                    <HelpCircle size={14} />
                                                </span>
                                            ) : null}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div
                                className={`aef-form-scroll${
                                    tab === 'flow'
                                        ? ' aef-form-scroll--flow'
                                        : tab === 'advanced'
                                          ? ' aef-form-scroll--advanced'
                                          : ' aef-form-scroll--layout'
                                }`}
                            >
                                {tab === 'layout' ? (
                                    <WbmLayoutPanel
                                        active={open && tab === 'layout'}
                                        module={module}
                                        existing={cfg ?? initial}
                                        onDirtyChange={setLayoutDirty}
                                        actionsRef={layoutActionsRef}
                                        onSaveLayoutOnly={(next) => {
                                            tabAfterSyncRef.current = 'layout';
                                            setCfg(next);
                                            onSave(next);
                                        }}
                                        onComplete={(next) => {
                                            tabAfterSyncRef.current = 'flow';
                                            setCfg(next);
                                            setSavedStepsSig(stepsSignature(next.steps));
                                            setSavedSteps(stepBaseline(next.steps));
                                            setTab('flow');
                                            onSave(next);
                                            message.success('已按最新要求重新匹配执行流程与参数');
                                        }}
                                    />
                                ) : null}

                                {tab === 'flow' && cfg ? (
                                    <div className="aef-tab-panel wbm-flow-panel">
                                        <div className="ae-flow-split">
                                            <aside className="ae-flow-lib">
                                                <h3 className="ae-flow-panel-title wbm-lib-head-row">
                                                    <span>子流程库</span>
                                                    <div
                                                        className="wbm-lib-filters"
                                                        role="group"
                                                        aria-label="子流程分类"
                                                    >
                                                        {LIB_CATEGORY_OPTIONS.map((o) => (
                                                            <Checkbox
                                                                key={o.key}
                                                                checked={libCats[o.key]}
                                                                onChange={() => toggleLibCat(o.key)}
                                                            >
                                                                {o.label}
                                                            </Checkbox>
                                                        ))}
                                                    </div>
                                                </h3>
                                                <ul className="ae-flow-lib-list">
                                                    {libItems.map((item) => {
                                                        const count = stepCountMap.get(item.id) ?? 0;
                                                        return (
                                                            <li
                                                                key={item.id}
                                                                className={`ae-flow-lib-item wbm-cat-${item.category}${
                                                                    selectedLibId === item.id
                                                                        ? ' is-selected'
                                                                        : ''
                                                                }`}
                                                            >
                                                                <div
                                                                    className="ae-flow-lib-main"
                                                                    onClick={() =>
                                                                        setSelectedLibId(item.id)
                                                                    }
                                                                    onDoubleClick={() =>
                                                                        addStep(item.id)
                                                                    }
                                                                >
                                                                    <div className="ae-flow-lib-head">
                                                                        <strong>
                                                                            {item.required ? '*' : ''}
                                                                            {item.name}
                                                                        </strong>
                                                                        {count > 0 ? (
                                                                            <span className="wbm-lib-count">
                                                                                ×{count}
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                    <p>{item.desc}</p>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className="ae-icon-add"
                                                                    title={`添加「${item.name}」到执行流程`}
                                                                    aria-label={`添加${item.name}`}
                                                                    onClick={() => addStep(item.id)}
                                                                >
                                                                    <Plus size={16} />
                                                                </button>
                                                            </li>
                                                        );
                                                    })}
                                                    {libItems.length === 0 ? (
                                                        <li className="wbm-lib-empty ae-flow-lib-item">
                                                            请至少勾选一个分类以浏览子流程
                                                        </li>
                                                    ) : null}
                                                </ul>
                                            </aside>

                                            <section className="ae-flow-result">
                                                <h3 className="ae-flow-panel-title wbm-flow-exec-head">
                                                    <span className="wbm-flow-exec-head-main">
                                                        执行流程
                                                        <span className="ae-flow-count">
                                                            {cfg.steps.length} 步
                                                        </span>
                                                        {addedCount || movedCount ? (
                                                            <span className="wbm-change-summary">
                                                                {addedCount ? (
                                                                    <span className="wbm-change-chip wbm-change-chip--added">
                                                                        <i aria-hidden />
                                                                        新增 {addedCount} 步
                                                                    </span>
                                                                ) : null}
                                                                {movedCount ? (
                                                                    <span className="wbm-change-chip wbm-change-chip--moved">
                                                                        <i aria-hidden />
                                                                        调序 {movedCount} 步
                                                                    </span>
                                                                ) : null}
                                                                <em>
                                                                    {flowDirty
                                                                        ? '保存后生效'
                                                                        : '相对上次匹配'}
                                                                </em>
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                    <div className="wbm-cat-legend" aria-label="流程分类颜色图例">
                                                        {(
                                                            [
                                                                ['before', '计量前'],
                                                                ['metering', '计量中'],
                                                                ['complete', '计量完成'],
                                                                ['device', '设备控制'],
                                                            ] as const
                                                        ).map(([key, label]) => (
                                                            <span
                                                                key={key}
                                                                className={`wbm-cat-legend-item wbm-cat-legend-item--${key}`}
                                                            >
                                                                <i aria-hidden />
                                                                {label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </h3>

                                                {cfg.steps.length === 0 ? (
                                                    <Empty
                                                        description="点击左侧 + 添加子流程"
                                                        icon={<GitBranch size={36} />}
                                                    />
                                                ) : (
                                                    <div className="wbm-phase-groups">
                                                        {EXEC_PHASES.map((phase) => {
                                                            const rows = cfg.steps.filter(
                                                                (s) => stepPhase(s) === phase,
                                                            );
                                                            return (
                                                                <section
                                                                    key={phase}
                                                                    className={`wbm-phase-box wbm-phase-box--${phase}${
                                                                        dragOverPhase === phase
                                                                            ? ' is-drop-target'
                                                                            : ''
                                                                    }`}
                                                                    aria-label={PHASE_LABEL[phase]}
                                                                    onDragOver={(e) => {
                                                                        e.preventDefault();
                                                                        e.dataTransfer.dropEffect = 'move';
                                                                        setDragOverPhase(phase);
                                                                        setDragOverUid(null);
                                                                    }}
                                                                    onDrop={(e) => {
                                                                        e.preventDefault();
                                                                        if (dragUid) {
                                                                            moveStepTo(dragUid, phase, null);
                                                                        }
                                                                        resetDrag();
                                                                    }}
                                                                >
                                                                    <header className="wbm-phase-head">
                                                                        <span className="wbm-phase-name">
                                                                            {PHASE_LABEL[phase]}
                                                                        </span>
                                                                        <span className="wbm-phase-count">
                                                                            {rows.length} 步
                                                                        </span>
                                                                    </header>

                                                                    {rows.length === 0 ? (
                                                                        <p className="wbm-phase-empty">
                                                                            从左侧添加或拖拽子流程到此
                                                                        </p>
                                                                    ) : (
                                                                        <ol className="ae-flow-steps">
                                                                            {rows.map((step) => {
                                                                                const cat =
                                                                                    resolveStepCategory(step);
                                                                                const idx = cfg.steps.findIndex(
                                                                                    (s) => s.uid === step.uid,
                                                                                );
                                                                                const order = forcedOrderOf(step.id);
                                                                                const locked = isPhaseLocked(step.id);
                                                                                const change = stepChanges.get(
                                                                                    step.uid,
                                                                                );
                                                                                return (
                                                                                    <li
                                                                                        key={step.uid}
                                                                                        className={`ae-flow-step wbm-exec-step wbm-cat-${cat}${
                                                                                            dragUid === step.uid
                                                                                                ? ' is-dragging'
                                                                                                : ''
                                                                                        }${
                                                                                            dragOverUid === step.uid &&
                                                                                            dragUid !== step.uid
                                                                                                ? ' is-drag-over'
                                                                                                : ''
                                                                                        }${
                                                                                            change?.kind === 'added'
                                                                                                ? ' is-added'
                                                                                                : change?.kind ===
                                                                                                    'moved'
                                                                                                  ? ' is-moved'
                                                                                                  : ''
                                                                                        }`}
                                                                                        onDragOver={(e) => {
                                                                                            e.preventDefault();
                                                                                            e.stopPropagation();
                                                                                            e.dataTransfer.dropEffect =
                                                                                                'move';
                                                                                            setDragOverPhase(phase);
                                                                                            if (
                                                                                                dragOverUid !== step.uid
                                                                                            ) {
                                                                                                setDragOverUid(step.uid);
                                                                                            }
                                                                                        }}
                                                                                        onDrop={(e) => {
                                                                                            e.preventDefault();
                                                                                            e.stopPropagation();
                                                                                            if (dragUid) {
                                                                                                moveStepTo(
                                                                                                    dragUid,
                                                                                                    phase,
                                                                                                    step.uid,
                                                                                                );
                                                                                            }
                                                                                            resetDrag();
                                                                                        }}
                                                                                    >
                                                                                        <button
                                                                                            type="button"
                                                                                            className="wbm-exec-drag-handle"
                                                                                            draggable
                                                                                            title={
                                                                                                locked
                                                                                                    ? `拖拽调整顺序（只能在「${PHASE_LABEL[phase]}」内调整）`
                                                                                                    : '拖拽调整顺序，可跨大类'
                                                                                            }
                                                                                            aria-label={`拖拽调整「${step.name}」顺序`}
                                                                                            onDragStart={(e) => {
                                                                                                setDragUid(step.uid);
                                                                                                e.dataTransfer.effectAllowed =
                                                                                                    'move';
                                                                                                e.dataTransfer.setData(
                                                                                                    'text/plain',
                                                                                                    step.uid,
                                                                                                );
                                                                                            }}
                                                                                            onDragEnd={resetDrag}
                                                                                        >
                                                                                            <GripVertical size={16} />
                                                                                        </button>
                                                                                        <span className="ae-flow-step-idx">
                                                                                            {idx + 1}
                                                                                        </span>
                                                                                        <div className="ae-flow-step-main">
                                                                                            <div className="ae-flow-step-title">
                                                                                                <strong>
                                                                                                    {isRequiredStep(step)
                                                                                                        ? '*'
                                                                                                        : ''}
                                                                                                    {step.name}
                                                                                                </strong>
                                                                                                {order ? (
                                                                                                    <span
                                                                                                        className="wbm-exec-order"
                                                                                                        title={`强制排序 ${order}：本类内不可与其他强制排序子流程逆序，中间可插入其他子流程`}
                                                                                                    >
                                                                                                        顺序 {order}
                                                                                                    </span>
                                                                                                ) : null}
                                                                                                {change?.kind ===
                                                                                                'added' ? (
                                                                                                    <span
                                                                                                        className="wbm-change-tag wbm-change-tag--added"
                                                                                                        title="本次新增，保存后生效"
                                                                                                    >
                                                                                                        <PlusCircle
                                                                                                            size={12}
                                                                                                        />
                                                                                                        新增
                                                                                                    </span>
                                                                                                ) : null}
                                                                                                {change?.kind ===
                                                                                                'moved' ? (
                                                                                                    <span
                                                                                                        className="wbm-change-tag wbm-change-tag--moved"
                                                                                                        title={`顺序已调整，上次保存时为第 ${change.from} 步`}
                                                                                                    >
                                                                                                        <ArrowUpDown
                                                                                                            size={12}
                                                                                                        />
                                                                                                        调序 · 原第{' '}
                                                                                                        {change.from} 步
                                                                                                    </span>
                                                                                                ) : null}
                                                                                                {step.isNew ? (
                                                                                                    <Tag color="warning">
                                                                                                        待确认
                                                                                                    </Tag>
                                                                                                ) : null}
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="ae-flow-step-actions">
                                                                                            {isRequiredStep(step) ? (
                                                                                                <span className="wbm-exec-required-tip">
                                                                                                    必选
                                                                                                </span>
                                                                                            ) : (
                                                                                                <Button
                                                                                                    size="small"
                                                                                                    danger
                                                                                                    icon={
                                                                                                        <Trash2
                                                                                                            size={12}
                                                                                                        />
                                                                                                    }
                                                                                                    onClick={() =>
                                                                                                        requestRemoveStep(
                                                                                                            step.uid,
                                                                                                        )
                                                                                                    }
                                                                                                    title="删除"
                                                                                                />
                                                                                            )}
                                                                                        </div>
                                                                                    </li>
                                                                                );
                                                                            })}
                                                                        </ol>
                                                                    )}
                                                                </section>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </section>
                                        </div>
                                    </div>
                                ) : null}

                                {tab === 'advanced' && cfg ? (
                                    <div className="aef-tab-panel wbm-adv-panel">
                                        <div className="wbm-adv-toolbar-row">
                                            <button
                                                type="button"
                                                className="wbm-tabs-aside-btn"
                                                onClick={() => setNonFlowOpen(true)}
                                            >
                                                非流程参数配置
                                            </button>
                                            <div className="wbm-check-row">
                                                <Checkbox
                                                    checked={onlyParams}
                                                    onChange={(v) => {
                                                        setOnlyParams(v);
                                                        if (v) setOnlyNotify(false);
                                                    }}
                                                >
                                                    仅显示配置参数
                                                </Checkbox>
                                                <Checkbox
                                                    checked={onlyNotify}
                                                    onChange={(v) => {
                                                        setOnlyNotify(v);
                                                        if (v) setOnlyParams(false);
                                                    }}
                                                >
                                                    仅显示消息配置
                                                </Checkbox>
                                            </div>
                                        </div>
                                        <div className="wbm-adv-layout">
                                            <aside
                                                className="wbm-adv-timeline"
                                                aria-label="执行流程导航"
                                            >
                                                <div className="wbm-adv-timeline-title">执行流程</div>
                                                <ol className="wbm-adv-timeline-list">
                                                    {cfg.steps.map((s, i) => (
                                                        <React.Fragment key={s.uid}>
                                                        {/* 每个大类的第一步前插入分段标题 */}
                                                        {stepPhase(s) !==
                                                        (i > 0 ? stepPhase(cfg.steps[i - 1]) : null) ? (
                                                            <li className="wbm-adv-timeline-phase">
                                                                {PHASE_LABEL[stepPhase(s)]}
                                                            </li>
                                                        ) : null}
                                                        <li>
                                                            <button
                                                                type="button"
                                                                className={`wbm-adv-timeline-item${
                                                                    activeNav === s.uid
                                                                        ? ' is-active'
                                                                        : ''
                                                                }`}
                                                                onClick={() => scrollToStep(s.uid)}
                                                            >
                                                                <span className="wbm-adv-timeline-dot">
                                                                    {i + 1}
                                                                </span>
                                                                <span className="wbm-adv-timeline-text">
                                                                    <strong>
                                                                        {s.required ? '*' : ''}
                                                                        {s.name}
                                                                    </strong>
                                                                    <em>
                                                                        {CATEGORY_LABEL[s.category]}
                                                                    </em>
                                                                </span>
                                                                {s.isNew ? (
                                                                    <i
                                                                        className="wbm-new-dot"
                                                                        aria-label="新增"
                                                                    />
                                                                ) : null}
                                                            </button>
                                                        </li>
                                                        </React.Fragment>
                                                    ))}
                                                </ol>
                                            </aside>
                                            <div className="wbm-adv-content">
                                                {cfg.steps.map((step, i) => {
                                                    const schema = getStepSchema(step.id);
                                                    const adv = cfg.advanced[step.uid] ?? {
                                                        params: {},
                                                        notifies: {},
                                                    };
                                                    const showParams = !onlyNotify;
                                                    const showNotify = !onlyParams;
                                                    return (
                                                        <section
                                                            key={step.uid}
                                                            className={`aef-step-block${
                                                                step.isNew ? ' wbm-step-new' : ''
                                                            }${
                                                                activeNav === step.uid
                                                                    ? ' is-active'
                                                                    : ''
                                                            }`}
                                                            ref={(el) => {
                                                                blockRefs.current[step.uid] = el;
                                                            }}
                                                        >
                                                            <header className="aef-step-head">
                                                                <span className="aef-step-badge">
                                                                    {i + 1}
                                                                </span>
                                                                <div className="aef-step-head-text">
                                                                    <h3>
                                                                        {step.name}
                                                                        {step.isNew ? (
                                                                            <Tag color="processing">
                                                                                新增待确认
                                                                            </Tag>
                                                                        ) : null}
                                                                    </h3>
                                                                    <p>{step.desc}</p>
                                                                </div>
                                                            </header>
                                                            <div className="aef-step-body">
                                                                {showParams &&
                                                                schema?.params.length &&
                                                                step.id === 'overload' ? (
                                                                    <OverloadRangeTable
                                                                        params={schema.params}
                                                                        values={{
                                                                            ...Object.fromEntries(
                                                                                schema.params.map(
                                                                                    (sp) => [
                                                                                        sp.key,
                                                                                        adv.params[
                                                                                            sp.key
                                                                                        ] ??
                                                                                            sp.defaultValue,
                                                                                    ],
                                                                                ),
                                                                            ),
                                                                            ...adv.params,
                                                                        }}
                                                                        vehicleTypes={
                                                                            cfg.strategy.vehicleTypes
                                                                        }
                                                                        onPatch={(key, v) =>
                                                                            patchCfg((c) => ({
                                                                                ...c,
                                                                                advanced: {
                                                                                    ...c.advanced,
                                                                                    [step.uid]: {
                                                                                        ...adv,
                                                                                        params: {
                                                                                            ...adv.params,
                                                                                            [key]: v,
                                                                                        },
                                                                                    },
                                                                                },
                                                                            }))
                                                                        }
                                                                    />
                                                                ) : null}
                                                                {showParams &&
                                                                schema?.params.length &&
                                                                step.id !== 'overload' ? (
                                                                    <div className="aef-field-grid aef-field-grid--3">
                                                                        {(() => {
                                                                            const mergedParams = {
                                                                                ...adv.params,
                                                                            };
                                                                            for (const sp of schema.params) {
                                                                                if (
                                                                                    mergedParams[
                                                                                        sp.key
                                                                                    ] === undefined
                                                                                ) {
                                                                                    mergedParams[
                                                                                        sp.key
                                                                                    ] =
                                                                                        Array.isArray(
                                                                                            sp.defaultValue,
                                                                                        )
                                                                                            ? [
                                                                                                  ...sp.defaultValue,
                                                                                              ]
                                                                                            : sp.defaultValue;
                                                                                }
                                                                            }
                                                                            const vehicleCtx = {
                                                                                vehicleTypes:
                                                                                    cfg.strategy
                                                                                        .vehicleTypes,
                                                                            };
                                                                            return schema.params.map(
                                                                                (p, pi) => {
                                                                            if (
                                                                                !isStepParamVisible(
                                                                                    p,
                                                                                    mergedParams,
                                                                                    vehicleCtx,
                                                                                )
                                                                            ) {
                                                                                return null;
                                                                            }
                                                                            const prevVisible = schema.params
                                                                                .slice(0, pi)
                                                                                .reverse()
                                                                                .find((x) =>
                                                                                    isStepParamVisible(
                                                                                        x,
                                                                                        mergedParams,
                                                                                        vehicleCtx,
                                                                                    ),
                                                                                );
                                                                            const showGroup =
                                                                                !!p.group &&
                                                                                p.group !==
                                                                                    prevVisible?.group;
                                                                            const paramVal =
                                                                                mergedParams[p.key];
                                                                            const infraredReady =
                                                                                hasOnScaleInfraredPoint(
                                                                                    cfg.layout,
                                                                                );
                                                                            const flameoutSignals =
                                                                                getFlameoutSignalAvailability(
                                                                                    cfg.moduleId,
                                                                                );
                                                                            const multiOpts =
                                                                                p.key ===
                                                                                'onScaleJudgeModes'
                                                                                    ? (p.options ?? []).map(
                                                                                          (o) =>
                                                                                              o.value ===
                                                                                                  '2' &&
                                                                                              !infraredReady
                                                                                                  ? {
                                                                                                        ...o,
                                                                                                        disabled: true,
                                                                                                    }
                                                                                                  : o,
                                                                                      )
                                                                                    : p.options ?? [];
                                                                            const selectOpts =
                                                                                p.key ===
                                                                                'flameoutMonitor'
                                                                                    ? (p.options ?? []).map(
                                                                                          (o) => {
                                                                                              if (
                                                                                                  o.value ===
                                                                                                      'io' &&
                                                                                                  !flameoutSignals.hasIo
                                                                                              ) {
                                                                                                  return {
                                                                                                      ...o,
                                                                                                      disabled: true,
                                                                                                  };
                                                                                              }
                                                                                              if (
                                                                                                  o.value ===
                                                                                                      'current' &&
                                                                                                  !flameoutSignals.hasCurrent
                                                                                              ) {
                                                                                                  return {
                                                                                                      ...o,
                                                                                                      disabled: true,
                                                                                                  };
                                                                                              }
                                                                                              return o;
                                                                                          },
                                                                                      )
                                                                                    : p.options ?? [];
                                                                            return (
                                                                                <React.Fragment key={p.key}>
                                                                                    {showGroup ? (
                                                                                        <div className="wbm-param-group">
                                                                                            {p.group}
                                                                                        </div>
                                                                                    ) : null}
                                                                            <Field
                                                                                label={`${p.label}${
                                                                                    p.unit
                                                                                        ? `（${p.unit}）`
                                                                                        : ''
                                                                                }`}
                                                                                hint={p.tip || undefined}
                                                                            >
                                                                                {p.type ===
                                                                                'bool' ? (
                                                                                    <Switch
                                                                                        checked={
                                                                                            !!paramVal
                                                                                        }
                                                                                        checkedChildren="是"
                                                                                        unCheckedChildren="否"
                                                                                        onChange={(
                                                                                            v,
                                                                                        ) =>
                                                                                            patchCfg(
                                                                                                (
                                                                                                    c,
                                                                                                ) => ({
                                                                                                    ...c,
                                                                                                    advanced:
                                                                                                        {
                                                                                                            ...c.advanced,
                                                                                                            [step.uid]:
                                                                                                                {
                                                                                                                    ...adv,
                                                                                                                    params: {
                                                                                                                        ...adv.params,
                                                                                                                        [p.key]:
                                                                                                                            v,
                                                                                                                    },
                                                                                                                },
                                                                                                        },
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                ) : p.type ===
                                                                                  'select' ? (
                                                                                    <Select
                                                                                        value={String(
                                                                                            paramVal,
                                                                                        )}
                                                                                        options={selectOpts}
                                                                                        onChange={(
                                                                                            v,
                                                                                        ) =>
                                                                                            patchCfg(
                                                                                                (
                                                                                                    c,
                                                                                                ) => {
                                                                                                    const nextParams =
                                                                                                        {
                                                                                                            ...adv.params,
                                                                                                            [p.key]:
                                                                                                                v,
                                                                                                        };
                                                                                                    let nextNotifies =
                                                                                                        {
                                                                                                            ...adv.notifies,
                                                                                                        };
                                                                                                    let nextStrategy =
                                                                                                        c.strategy;
                                                                                                    if (
                                                                                                        step.id ===
                                                                                                            'driverAlight' &&
                                                                                                        p.key ===
                                                                                                            'alightMethod'
                                                                                                    ) {
                                                                                                        const method =
                                                                                                            v ===
                                                                                                            'photo'
                                                                                                                ? 'photo'
                                                                                                                : 'weight';
                                                                                                        nextStrategy =
                                                                                                            {
                                                                                                                ...c.strategy,
                                                                                                                alightMethod:
                                                                                                                    method,
                                                                                                            };
                                                                                                        const start =
                                                                                                            adv
                                                                                                                .notifies
                                                                                                                .alightStartNotify;
                                                                                                        const weightText =
                                                                                                            '请下磅前往等待区域';
                                                                                                        const photoText =
                                                                                                            '请下磅按下开关开始计量';
                                                                                                        if (
                                                                                                            !start ||
                                                                                                            [
                                                                                                                weightText,
                                                                                                                photoText,
                                                                                                            ].includes(
                                                                                                                start.led.trim(),
                                                                                                            ) ||
                                                                                                            [
                                                                                                                weightText,
                                                                                                                photoText,
                                                                                                            ].includes(
                                                                                                                start.broadcast.trim(),
                                                                                                            )
                                                                                                        ) {
                                                                                                            nextNotifies =
                                                                                                                {
                                                                                                                    ...nextNotifies,
                                                                                                                    alightStartNotify:
                                                                                                                        getAlightStartNotifyDefault(
                                                                                                                            method,
                                                                                                                        ),
                                                                                                                };
                                                                                                        }
                                                                                                    }
                                                                                                    return {
                                                                                                        ...c,
                                                                                                        strategy:
                                                                                                            nextStrategy,
                                                                                                        advanced:
                                                                                                            {
                                                                                                                ...c.advanced,
                                                                                                                [step.uid]:
                                                                                                                    {
                                                                                                                        ...adv,
                                                                                                                        params: nextParams,
                                                                                                                        notifies:
                                                                                                                            nextNotifies,
                                                                                                                    },
                                                                                                            },
                                                                                                    };
                                                                                                },
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                ) : p.type ===
                                                                                  'multi' ? (
                                                                                    <MultiSelect
                                                                                        value={
                                                                                            Array.isArray(
                                                                                                paramVal,
                                                                                            )
                                                                                                ? paramVal.map(
                                                                                                      String,
                                                                                                  )
                                                                                                : paramVal
                                                                                                  ? [
                                                                                                        String(
                                                                                                            paramVal,
                                                                                                        ),
                                                                                                    ]
                                                                                                  : []
                                                                                        }
                                                                                        options={multiOpts}
                                                                                        placeholder="请选择"
                                                                                        onChange={(
                                                                                            v,
                                                                                        ) => {
                                                                                            const next =
                                                                                                v.length
                                                                                                    ? v
                                                                                                    : [
                                                                                                          '1',
                                                                                                      ];
                                                                                            patchCfg(
                                                                                                (
                                                                                                    c,
                                                                                                ) => ({
                                                                                                    ...c,
                                                                                                    advanced:
                                                                                                        {
                                                                                                            ...c.advanced,
                                                                                                            [step.uid]:
                                                                                                                {
                                                                                                                    ...adv,
                                                                                                                    params: {
                                                                                                                        ...adv.params,
                                                                                                                        [p.key]:
                                                                                                                            next,
                                                                                                                    },
                                                                                                                },
                                                                                                        },
                                                                                                }),
                                                                                            );
                                                                                        }}
                                                                                    />
                                                                                ) : (
                                                                                    <NumInput
                                                                                        value={Number(
                                                                                            paramVal,
                                                                                        )}
                                                                                        onChange={(
                                                                                            n,
                                                                                        ) =>
                                                                                            patchCfg(
                                                                                                (
                                                                                                    c,
                                                                                                ) => ({
                                                                                                    ...c,
                                                                                                    advanced:
                                                                                                        {
                                                                                                            ...c.advanced,
                                                                                                            [step.uid]:
                                                                                                                {
                                                                                                                    ...adv,
                                                                                                                    params: {
                                                                                                                        ...adv.params,
                                                                                                                        [p.key]:
                                                                                                                            n,
                                                                                                                    },
                                                                                                                },
                                                                                                        },
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                )}
                                                                            </Field>
                                                                                </React.Fragment>
                                                                            );
                                                                                },
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                ) : null}
                                                                {showNotify &&
                                                                schema?.notifies.some((n) =>
                                                                    isNotifyVisible(n, {
                                                                        vehicleTypes:
                                                                            cfg.strategy
                                                                                .vehicleTypes,
                                                                    }),
                                                                ) ? (
                                                                    <MessageNotifySection
                                                                        items={schema.notifies
                                                                            .filter((n) =>
                                                                                isNotifyVisible(n, {
                                                                                    vehicleTypes:
                                                                                        cfg.strategy
                                                                                            .vehicleTypes,
                                                                                }),
                                                                            )
                                                                            .map((n) => ({
                                                                                key: n.key,
                                                                                title: n.title,
                                                                                value:
                                                                                    adv.notifies[
                                                                                        n.key
                                                                                    ] ??
                                                                                    (n.key ===
                                                                                    'alightStartNotify'
                                                                                        ? getAlightStartNotifyDefault(
                                                                                              (adv
                                                                                                  .params
                                                                                                  .alightMethod ===
                                                                                                  'photo'
                                                                                                  ? 'photo'
                                                                                                  : adv
                                                                                                        .params
                                                                                                        .alightMethod ===
                                                                                                    'weight'
                                                                                                  ? 'weight'
                                                                                                  : cfg
                                                                                                        .strategy
                                                                                                        .alightMethod) as
                                                                                                  | 'photo'
                                                                                                  | 'weight',
                                                                                          )
                                                                                        : getNotifyDefault(
                                                                                              n.key,
                                                                                          )),
                                                                                onChange: (v) =>
                                                                                    patchCfg(
                                                                                        (c) => ({
                                                                                            ...c,
                                                                                            advanced:
                                                                                                {
                                                                                                    ...c.advanced,
                                                                                                    [step.uid]:
                                                                                                        {
                                                                                                            ...adv,
                                                                                                            notifies:
                                                                                                                {
                                                                                                                    ...adv.notifies,
                                                                                                                    [n.key]:
                                                                                                                        v,
                                                                                                                },
                                                                                                        },
                                                                                                },
                                                                                        }),
                                                                                    ),
                                                                            }))}
                                                                    />
                                                                ) : null}
                                                                {!schema?.params.length &&
                                                                !schema?.notifies.length ? (
                                                                    <p className="aef-sync-hint">
                                                                        本步骤无额外配置项
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                        </section>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                </div>
            </Drawer>
            <WbmNonFlowDrawer
                open={nonFlowOpen}
                initial={cfg?.nonFlow}
                onClose={() => setNonFlowOpen(false)}
                onSave={(values) => {
                    patchCfg((c) => ({ ...c, nonFlow: values }));
                    message.success('非流程参数已更新');
                }}
            />
        </>
    );
}

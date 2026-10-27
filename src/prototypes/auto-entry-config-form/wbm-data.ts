/** 汽车衡（WBM）流程配置 · 对齐最新操作表单需求 + 2609 子流程/默认编排 */

import { NotifyItem, defaultNotify } from './data';
import { NonFlowValues, createDefaultNonFlowValues, normalizeNonFlowValues } from './wbm-nonflow';

export type WeighMode = '1' | '2' | '3' | '4';
export type WeighingProcess = '1' | '2';
export type AlightMethod = 'photo' | 'weight';
export type FlameoutMonitor = 'io' | 'current' | 'weight';
export type DeviceKind = 'barrier' | 'plateOut' | 'plateIn' | 'cardReader' | 'camera' | 'photoSignal';
export type StepCategory = 'before' | 'metering' | 'complete' | 'device';
/** 执行流程的三个大类；设备控制不单独成类，其子流程落在某个大类内 */
export type ExecPhase = 'before' | 'metering' | 'complete';
export type WbmConfigStatus = 'empty' | 'draft';

/** 子流程库分类勾选：计量（含计量前/中/完成）+ 设备控制 */
export interface LibCategoryToggle {
    metering: boolean;
    device: boolean;
}

export type StepId =
    | 'identify'
    | 'emptyScale'
    | 'inGateUp'
    | 'inGateDown'
    | 'onScale'
    | 'recheck'
    | 'flameout'
    | 'driverAlight'
    | 'weigh'
    | 'overload'
    | 'capture'
    | 'upload'
    | 'ticket'
    | 'outGateUp'
    | 'outGateDown'
    | 'offScale'
    | 'reset';

export interface DeviceOption {
    id: string;
    name: string;
    kind: DeviceKind;
}

/** 识别设备角色：主设备异常时按辅助设备识别，都正常时相互验证 */
export type DeviceRole = 'primary' | 'assist';

export const DEVICE_ROLE_OPTIONS = [
    { value: 'primary', label: '主设备' },
    { value: 'assist', label: '辅助设备' },
] as const;

export interface SideLayout {
    barrierId: string;
    plateOutId: string;
    plateOutRole: DeviceRole;
    plateInId: string;
    plateInRole: DeviceRole;
    cardReaderId: string;
    cardReaderRole: DeviceRole;
}

/** 车牌识别器 / 读卡器三个槽位与其角色字段的对应 */
export const RECOGNIZE_SLOTS: Array<{ idField: keyof SideLayout; roleField: keyof SideLayout }> = [
    { idField: 'plateOutId', roleField: 'plateOutRole' },
    { idField: 'plateInId', roleField: 'plateInRole' },
    { idField: 'cardReaderId', roleField: 'cardReaderRole' },
];

export interface WbmDeviceLayout {
    approach: SideLayout;
    opposite: SideLayout;
}

/** 快速配置 · 场景与业务要求 */
export interface WbmStrategy {
    weighMode: WeighMode;
    weighingProcess: WeighingProcess;
    /** 单向过磅：只按一个方向布置设备 */
    oneWayWeigh: boolean;
    vehicleTypes: string[];
    requireDriverAlight: boolean;
    alightMethod: AlightMethod;
    consistencyCheck: boolean;
    /** 进厂方向抓拍摄像头（单选，可为空；不随衡器类型 / 单向过磅隐藏） */
    approachCameraId: string;
    /** 出厂方向抓拍摄像头（单选，可为空；不随衡器类型 / 单向过磅隐藏） */
    oppositeCameraId: string;
    /** 由磅单打印勾选派生，用于决定是否编排「磅单打印」子流程 */
    ticketPrint: boolean;
    printCoal: boolean;
    printOutboundMaterial: boolean;
    printInboundMaterial: boolean;
    printBiomass: boolean;
    sceneName: string;
}

export interface SubProcessDef {
    id: StepId;
    category: StepCategory;
    name: string;
    desc: string;
    required: boolean;
    /** 默认所属执行大类（设备控制类也必须落在某个大类内） */
    defaultPhase: ExecPhase;
    /** 强制归属父级分类：true 时不允许添加或拖拽到其他大类 */
    lockPhase: boolean;
    /** 强制排序号：同大类内带号子流程的相对顺序不可逆，号之间可插入其他子流程 */
    forcedOrder?: number;
}

export interface WbmFlowStep {
    /** 执行流实例唯一键（同类型可重复加入） */
    uid: string;
    id: StepId;
    category: StepCategory;
    /** 实例实际所属执行大类；缺失时按子流程默认大类回落 */
    phase?: ExecPhase;
    name: string;
    desc: string;
    required: boolean;
    source: 'rule' | 'manual';
    /** 本次相对上次编排新增 */
    isNew?: boolean;
}

export function createStepUid(id: StepId): string {
    return `${id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface ParamField {
    key: string;
    label: string;
    type: 'number' | 'bool' | 'select' | 'multi' | 'text';
    unit?: string;
    /** 配置项说明（单独一行展示） */
    tip?: string;
    options?: Array<{ value: string; label: string; disabled?: boolean }>;
    defaultValue: string | number | boolean | string[];
    /** 分组标题（同组连续字段前展示一次） */
    group?: string;
    /** 依赖场景「计量车种」显示（单一车种） */
    vehicleType?: string;
    /** 依赖场景「计量车种」显示（任一匹配即显示） */
    vehicleTypesAny?: string[];
    /** 依赖同步骤其它参数显示 */
    visibleWhen?: {
        key: string;
        equals?: string | number | boolean;
        /** 多选参数包含某值时显示 */
        includes?: string;
    };
}

export interface NotifyDef {
    key: string;
    title: string;
    /** 依赖场景「计量车种」显示 */
    vehicleType?: string;
}

export interface StepParamSchema {
    stepId: StepId;
    params: ParamField[];
    notifies: NotifyDef[];
}

export interface WbmBasicParams {
    recognizeTimeoutMin: number;
    detectEmptyOnRecognize: boolean;
    allowManualPlate: boolean;
    autoEntryRegister: boolean;
    emptyDefaultWeight: number;
    emptyDetectCount: number;
    emptyDetectIntervalMs: number;
    minOnScaleCoalHeavy: number;
    minOnScaleCoalLight: number;
    minOnScaleMaterialHeavy: number;
    minOnScaleMaterialLight: number;
    minOnScaleTransfer: number;
    minOnScaleBiomassHeavy: number;
    minOnScaleBiomassLight: number;
    transferClassifyThreshold: number;
    onScaleByWeight: boolean;
    onScaleByInfrared: boolean;
    recheckWaitSec: number;
    driverWeightKg: number;
    driverWaitSec: number;
    flameoutMonitor: FlameoutMonitor;
    weighStableSec: number;
    weighSampleCount: number;
    weighSampleIntervalMs: number;
    weighSolidifyTimeoutSec: number;
    minOffScaleCoal: number;
    minOffScaleMaterial: number;
    minOffScaleTransfer: number;
    minOffScaleBiomass: number;
    failLockSec: number;
    captureFailLock: boolean;
    singleStepWaitMs: number;
    meteringEndWaitMs: number;
}

export type StepParamValue = string | number | boolean | string[];
export type StepParamValues = Record<string, StepParamValue>;
export type StepNotifyValues = Record<string, NotifyItem>;

/** 原型：道闸已配置时视为模块已挂接红外对射点 YXEnterBarrierHLCDSLinked */
export function hasOnScaleInfraredPoint(layout: WbmDeviceLayout): boolean {
    return !!(layout.approach?.barrierId || layout.opposite?.barrierId);
}

/** 原型：模拟熄火震动点位 YXVibratorIO / YCVibratorCurrent 是否已配置 */
export function getFlameoutSignalAvailability(_moduleId?: string): {
    hasIo: boolean;
    hasCurrent: boolean;
} {
    // 默认模拟两点均存在 → 判断方式默认 I/O
    return { hasIo: true, hasCurrent: true };
}

export function resolveFlameoutMonitorDefault(
    avail: { hasIo: boolean; hasCurrent: boolean } = getFlameoutSignalAvailability(),
): FlameoutMonitor {
    if (avail.hasIo) return 'io';
    if (avail.hasCurrent) return 'current';
    return 'weight';
}

export function isStepParamVisible(
    param: ParamField,
    values: StepParamValues,
    ctx?: { vehicleTypes?: string[] },
): boolean {
    if (param.vehicleType && ctx?.vehicleTypes && !ctx.vehicleTypes.includes(param.vehicleType)) {
        return false;
    }
    if (param.vehicleTypesAny?.length && ctx?.vehicleTypes) {
        if (!param.vehicleTypesAny.some((t) => ctx.vehicleTypes!.includes(t))) return false;
    }
    const rule = param.visibleWhen;
    if (!rule) return true;
    const raw = values[rule.key];
    if (rule.includes !== undefined) {
        const list = Array.isArray(raw) ? raw.map(String) : raw != null && raw !== '' ? [String(raw)] : [];
        return list.includes(rule.includes);
    }
    if (rule.equals !== undefined) return raw === rule.equals;
    return true;
}

export function isNotifyVisible(
    notify: NotifyDef,
    ctx?: { vehicleTypes?: string[] },
): boolean {
    if (notify.vehicleType && ctx?.vehicleTypes && !ctx.vehicleTypes.includes(notify.vehicleType)) {
        return false;
    }
    return true;
}

export interface WbmAdvancedByStep {
    params: StepParamValues;
    notifies: StepNotifyValues;
}

export interface WbmModuleConfig {
    moduleId: string;
    /** 是否已确认过快速配置并生成流程 */
    layoutConfigured: boolean;
    /** 布局/场景是否曾保存（可未生成流程） */
    layoutSaved: boolean;
    status: WbmConfigStatus;
    layout: WbmDeviceLayout;
    strategy: WbmStrategy;
    steps: WbmFlowStep[];
    basic: WbmBasicParams;
    /** 按执行流实例 uid 存高级配置（同类型多实例各自独立） */
    advanced: Record<string, WbmAdvancedByStep>;
    /** 非流程参数（车辆停放位置核验、异常结束放行、启停设定等） */
    nonFlow: NonFlowValues;
    basicTouched: string[];
    updatedAt?: string;
}

export const WEIGH_MODE_OPTIONS = [
    { value: '1', label: '重衡' },
    { value: '2', label: '轻衡' },
    { value: '3', label: '混用衡' },
    { value: '4', label: '可切换衡' },
] as const;

export const WEIGHING_PROCESS_OPTIONS = [
    { value: '1', label: '先识别再上磅' },
    { value: '2', label: '先上磅再识别' },
] as const;

export const VEHICLE_TYPE_OPTIONS = [
    { value: 'coal', label: '燃煤' },
    { value: 'material', label: '物资' },
    { value: 'transfer', label: '搬倒' },
    { value: 'biomass', label: '生物质' },
] as const;

export const SUB_PROCESS_LIBRARY: SubProcessDef[] = [
    {
        id: 'identify',
        category: 'before',
        name: '车辆识别及核验',
        desc: '识别计量车辆信息并核验车辆是否允许计量',
        required: true,
        defaultPhase: 'before',
        lockPhase: true,
        forcedOrder: 1,
    },
    {
        id: 'emptyScale',
        category: 'before',
        name: '空磅核验',
        desc: '先识别再上磅时默认编排：在计量前判断衡器读数是否归零，是否允许计量',
        required: false,
        defaultPhase: 'before',
        lockPhase: false,
    },
    {
        id: 'onScale',
        category: 'before',
        name: '已上磅判断',
        desc: '根据红外对射或者衡器读数，保证车辆已经上磅',
        required: true,
        defaultPhase: 'before',
        lockPhase: true,
        forcedOrder: 2,
    },
    {
        id: 'recheck',
        category: 'before',
        name: '车辆二次核验',
        desc: '是否启用车辆二次一致性校验=是时默认编排：二次识别并与首次结果核验一致',
        required: false,
        defaultPhase: 'before',
        lockPhase: true,
    },
    {
        id: 'flameout',
        category: 'before',
        name: '车辆稳定（熄火）核验',
        desc: '判断衡器读数是否稳定，允许开始计量取值',
        required: true,
        defaultPhase: 'before',
        lockPhase: true,
        forcedOrder: 3,
    },
    {
        id: 'driverAlight',
        category: 'before',
        name: '司机下车核验',
        desc: '是否要求司机下车计量=是时默认编排：判断司机是否已经下车',
        required: false,
        defaultPhase: 'before',
        lockPhase: true,
    },
    {
        id: 'weigh',
        category: 'metering',
        name: '重量取值',
        desc: '读取衡器读数，获得计量车辆的计量结果',
        required: true,
        defaultPhase: 'metering',
        lockPhase: true,
        forcedOrder: 1,
    },
    {
        id: 'overload',
        category: 'metering',
        name: '计量超量程及处理',
        desc: '判断车辆是否超量程及超量程、超载后的锁车、报警处理',
        required: false,
        defaultPhase: 'metering',
        lockPhase: true,
    },
    {
        id: 'capture',
        category: 'metering',
        name: '计量抓拍',
        desc: '默认编排：对在衡器上的车辆进行抓拍',
        required: true,
        defaultPhase: 'metering',
        lockPhase: false,
    },
    {
        id: 'upload',
        category: 'metering',
        name: '计量数据上传',
        desc: '自动根据计量车种，按要求上传计量结果数据',
        required: true,
        defaultPhase: 'metering',
        lockPhase: true,
        forcedOrder: 2,
    },
    {
        id: 'ticket',
        category: 'complete',
        name: '磅单打印',
        desc: '是否磅单打印=是时默认编排：打印纸质磅单',
        required: false,
        defaultPhase: 'complete',
        lockPhase: true,
    },
    {
        id: 'offScale',
        category: 'complete',
        name: '车辆已下磅核验',
        desc: '出厂方向配置了道闸时默认编排：根据衡器读数判断车辆是否已经下磅离场',
        required: false,
        defaultPhase: 'complete',
        lockPhase: true,
    },
    {
        id: 'reset',
        category: 'complete',
        name: '设备复位',
        desc: '完成计量后，按初始化状态复位衡器各设备状态',
        required: true,
        defaultPhase: 'complete',
        lockPhase: true,
    },
    {
        id: 'inGateUp',
        category: 'device',
        name: '来车道闸抬杆',
        desc: '先识别再上磅且进厂方向配置了道闸时默认编排：控制来车方向的道闸抬杆',
        required: false,
        defaultPhase: 'before',
        lockPhase: false,
    },
    {
        id: 'inGateDown',
        category: 'device',
        name: '来车道闸落杆',
        desc: '控制来车方向的道闸落杆',
        required: false,
        defaultPhase: 'before',
        lockPhase: false,
    },
    {
        id: 'outGateUp',
        category: 'device',
        name: '对向道闸抬杆',
        desc: '出厂方向配置了道闸时默认编排：控制来车对向方向的道闸抬杆',
        required: false,
        defaultPhase: 'complete',
        lockPhase: false,
    },
    {
        id: 'outGateDown',
        category: 'device',
        name: '对向道闸落杆',
        desc: '控制来车对向方向的道闸落杆',
        required: false,
        defaultPhase: 'complete',
        lockPhase: false,
    },
];

export const CATEGORY_LABEL: Record<StepCategory, string> = {
    before: '计量前',
    metering: '计量中',
    complete: '计量完成',
    device: '设备控制',
};

export const LIB_CATEGORY_OPTIONS = [
    { key: 'metering' as const, label: '计量子流程' },
    { key: 'device' as const, label: '设备控制' },
] as const;

const def = (id: StepId) => SUB_PROCESS_LIBRARY.find((s) => s.id === id)!;

/** 执行流程三个大类的固定先后顺序 */
export const EXEC_PHASES: ExecPhase[] = ['before', 'metering', 'complete'];

export const PHASE_LABEL: Record<ExecPhase, string> = {
    before: '计量前',
    metering: '计量中',
    complete: '计量完成',
};

export function stepDefOf(id: StepId): SubProcessDef | undefined {
    return SUB_PROCESS_LIBRARY.find((s) => s.id === id);
}

/** 实例所属大类：优先取实例值，其次按子流程默认大类回落 */
export function stepPhase(step: Pick<WbmFlowStep, 'id' | 'phase'>): ExecPhase {
    if (step.phase && EXEC_PHASES.includes(step.phase)) return step.phase;
    return stepDefOf(step.id)?.defaultPhase ?? 'metering';
}

export function isPhaseLocked(id: StepId): boolean {
    return !!stepDefOf(id)?.lockPhase;
}

export function forcedOrderOf(id: StepId): number | undefined {
    return stepDefOf(id)?.forcedOrder;
}

/** 保证执行流始终按 计量前 → 计量中 → 计量完成 分段（段内相对顺序不变） */
export function sortStepsByPhase(steps: WbmFlowStep[]): WbmFlowStep[] {
    const out: WbmFlowStep[] = [];
    for (const phase of EXEC_PHASES) {
        for (const step of steps) {
            if (stepPhase(step) === phase) out.push(step);
        }
    }
    return out;
}

/**
 * 把子流程插入指定大类：默认按强制排序号找合适位次，否则落在该大类末尾。
 */
export function insertStepIntoPhase(
    steps: WbmFlowStep[],
    step: WbmFlowStep,
    phase: ExecPhase,
    respectForcedOrder = true,
): WbmFlowStep[] {
    const placed: WbmFlowStep = { ...step, phase };
    const order = respectForcedOrder ? forcedOrderOf(step.id) : undefined;
    const next = [...steps];
    let at = -1;

    if (typeof order === 'number') {
        at = next.findIndex((s) => {
            if (stepPhase(s) !== phase) return false;
            const other = forcedOrderOf(s.id);
            return typeof other === 'number' && other > order;
        });
    }
    if (at < 0) {
        // 落到该大类末尾；该大类为空时落到后一个大类之前
        const lastOfPhase = next.reduce((acc, s, i) => (stepPhase(s) === phase ? i : acc), -1);
        if (lastOfPhase >= 0) {
            at = lastOfPhase + 1;
        } else {
            const laterPhases = EXEC_PHASES.slice(EXEC_PHASES.indexOf(phase) + 1);
            const firstLater = next.findIndex((s) => laterPhases.includes(stepPhase(s)));
            at = firstLater < 0 ? next.length : firstLater;
        }
    }
    next.splice(at, 0, placed);
    return sortStepsByPhase(next);
}

/** 校验某大类内带强制排序号的子流程是否仍按号递增 */
function findForcedOrderConflict(steps: WbmFlowStep[], phase: ExecPhase): string | null {
    const ordered = steps
        .filter((s) => stepPhase(s) === phase)
        .map((s) => ({ step: s, order: forcedOrderOf(s.id) }))
        .filter((item): item is { step: WbmFlowStep; order: number } => typeof item.order === 'number');
    for (let i = 1; i < ordered.length; i += 1) {
        if (ordered[i].order < ordered[i - 1].order) {
            return `「${ordered[i].step.name}」需排在「${ordered[i - 1].step.name}」之前`;
        }
    }
    return null;
}

/**
 * 放置校验：返回 null 表示可落位，否则返回拒绝原因。
 * @param nextSteps 落位后的完整执行流（已含目标大类归属）
 */
export function checkStepPlacement(
    nextSteps: WbmFlowStep[],
    moving: WbmFlowStep,
    targetPhase: ExecPhase,
): string | null {
    if (isPhaseLocked(moving.id) && stepDefOf(moving.id)?.defaultPhase !== targetPhase) {
        const home = PHASE_LABEL[stepDefOf(moving.id)!.defaultPhase];
        return `「${moving.name}」只能在「${home}」内调整`;
    }
    return findForcedOrderConflict(nextSteps, targetPhase);
}

function toFlowStep(id: StepId, source: 'rule' | 'manual' = 'rule'): WbmFlowStep {
    const d = def(id);
    return {
        uid: createStepUid(id),
        id: d.id,
        category: d.category,
        phase: d.defaultPhase,
        name: d.name,
        desc: d.desc,
        required: d.required,
        source,
    };
}

/**
 * 按计量流程生成默认执行流（保存并重新设定时）：
 *
 * 先识别再上磅（1）：
 *   计量前 识别 → 空磅 → [来车抬杆] → 已上磅 → [二次核验] → 熄火 → [司机下车]
 *   计量中 重量取值 → 计量抓拍 → 计量数据上传
 *   计量完成 [磅单] → [对向抬杆] → [已下磅] → 设备复位
 *
 * 先上磅再识别（2）：
 *   计量前 识别 → 已上磅 → [二次核验] → 熄火 → [司机下车]（不含空磅、来车抬杆）
 *   计量中 / 计量完成 与上相同
 *
 * [] 表示按场景条件插入：二次核验←一致性校验；司机下车←要求下车；
 * 来车抬杆←进厂方向有道闸；对向抬杆/已下磅←出厂方向有道闸；磅单←ticketPrint。
 */
export function buildDefaultSteps(strategy: WbmStrategy, layout: WbmDeviceLayout): WbmFlowStep[] {
    const identifyFirst = strategy.weighingProcess !== '2';
    const hasApproachBarrier = !!layout.approach.barrierId;
    const hasOppositeBarrier = !!layout.opposite.barrierId;
    const ids: StepId[] = [];

    // —— 计量前 ——
    ids.push('identify');
    if (identifyFirst) {
        ids.push('emptyScale');
        if (hasApproachBarrier) ids.push('inGateUp');
    }
    ids.push('onScale');
    if (strategy.consistencyCheck) ids.push('recheck');
    ids.push('flameout');
    if (strategy.requireDriverAlight) ids.push('driverAlight');

    // —— 计量中 ——
    ids.push('weigh', 'capture', 'upload');

    // —— 计量完成 ——
    if (strategy.ticketPrint) ids.push('ticket');
    if (hasOppositeBarrier) ids.push('outGateUp', 'offScale');
    ids.push('reset');

    return sortStepsByPhase(ids.map((id) => toFlowStep(id, 'rule')));
}

export function filterLibrary(cats: LibCategoryToggle): SubProcessDef[] {
    return SUB_PROCESS_LIBRARY.filter((s) => {
        const isDevice = s.category === 'device';
        if (isDevice) return cats.device;
        return cats.metering;
    });
}

/** 高级参数按子流程类型去重（同类型多实例共用一份配置） */

export const WBM_MODULE_DEVICES: Record<
    string,
    { devices: DeviceOption[]; hasAlightPhotoSignal: boolean }
> = {
    'm-wbm1': {
        hasAlightPhotoSignal: true,
        devices: [
            { id: 'd-b1-a', name: '1#衡 · 东道闸', kind: 'barrier' },
            { id: 'd-b1-b', name: '1#衡 · 西道闸', kind: 'barrier' },
            { id: 'd-p1-out-e', name: '1#衡 · 东向外车牌', kind: 'plateOut' },
            { id: 'd-p1-out-w', name: '1#衡 · 西向外车牌', kind: 'plateOut' },
            { id: 'd-p1-in-e', name: '1#衡 · 东向内车牌', kind: 'plateIn' },
            { id: 'd-p1-in-w', name: '1#衡 · 西向内车牌', kind: 'plateIn' },
            { id: 'd-c1-e', name: '1#衡 · 东读卡器', kind: 'cardReader' },
            { id: 'd-c1-w', name: '1#衡 · 西读卡器', kind: 'cardReader' },
            { id: 'd-cam1', name: '1#衡 · 车头抓拍摄像头', kind: 'camera' },
            { id: 'd-cam1-rear', name: '1#衡 · 车尾抓拍摄像头', kind: 'camera' },
            { id: 'd-cam1-pano', name: '1#衡 · 全景抓拍摄像头', kind: 'camera' },
            { id: 'd-photo1', name: '1#衡 · 下车光电信号', kind: 'photoSignal' },
        ],
    },
    'm-wbm2': {
        hasAlightPhotoSignal: false,
        devices: [
            { id: 'd-b2-a', name: '2#衡 · 南道闸', kind: 'barrier' },
            { id: 'd-b2-b', name: '2#衡 · 北道闸', kind: 'barrier' },
            { id: 'd-p2-out-s', name: '2#衡 · 南向外车牌', kind: 'plateOut' },
            { id: 'd-p2-out-n', name: '2#衡 · 北向外车牌', kind: 'plateOut' },
            { id: 'd-p2-in-s', name: '2#衡 · 南向内车牌', kind: 'plateIn' },
            { id: 'd-p2-in-n', name: '2#衡 · 北向内车牌', kind: 'plateIn' },
            { id: 'd-c2-s', name: '2#衡 · 南读卡器', kind: 'cardReader' },
            { id: 'd-c2-n', name: '2#衡 · 北读卡器', kind: 'cardReader' },
            { id: 'd-cam2', name: '2#衡 · 车头抓拍摄像头', kind: 'camera' },
            { id: 'd-cam2-pano', name: '2#衡 · 全景抓拍摄像头', kind: 'camera' },
        ],
    },
};

export function getModuleDevices(moduleId: string) {
    return WBM_MODULE_DEVICES[moduleId] ?? { hasAlightPhotoSignal: false, devices: [] };
}

export function devicesByKind(moduleId: string, kind: DeviceKind): DeviceOption[] {
    return getModuleDevices(moduleId).devices.filter((d) => d.kind === kind);
}

export function emptySideLayout(): SideLayout {
    return {
        barrierId: '',
        plateOutId: '',
        plateOutRole: 'primary',
        plateInId: '',
        plateInRole: 'assist',
        cardReaderId: '',
        cardReaderRole: 'assist',
    };
}

export function createDefaultDeviceLayout(moduleId: string): WbmDeviceLayout {
    const devices = getModuleDevices(moduleId).devices;
    const barriers = devices.filter((d) => d.kind === 'barrier');
    const plateOut = devices.filter((d) => d.kind === 'plateOut');
    const plateIn = devices.filter((d) => d.kind === 'plateIn');
    const cards = devices.filter((d) => d.kind === 'cardReader');
    return {
        approach: {
            ...emptySideLayout(),
            barrierId: barriers[0]?.id ?? '',
            plateOutId: plateOut[0]?.id ?? '',
            plateInId: plateIn[0]?.id ?? '',
            cardReaderId: cards[0]?.id ?? '',
        },
        opposite: {
            ...emptySideLayout(),
            barrierId: barriers[1]?.id ?? '',
            plateOutId: plateOut[1]?.id ?? '',
            plateInId: plateIn[1]?.id ?? '',
            cardReaderId: cards[1]?.id ?? '',
        },
    };
}

export type TicketPrintKey =
    | 'printCoal'
    | 'printOutboundMaterial'
    | 'printInboundMaterial'
    | 'printBiomass';

/** 磅单打印选项与计量车种的对应关系：车种选中才加载对应选项 */
export const TICKET_PRINT_OPTIONS: Array<{
    key: TicketPrintKey;
    label: string;
    vehicleTypes: string[];
}> = [
    { key: 'printCoal', label: '煤车磅单打印', vehicleTypes: ['coal'] },
    { key: 'printOutboundMaterial', label: '出厂物资磅单打印', vehicleTypes: ['material', 'transfer'] },
    { key: 'printInboundMaterial', label: '入厂物资磅单打印', vehicleTypes: ['material', 'transfer'] },
    { key: 'printBiomass', label: '生物质磅单打印', vehicleTypes: ['biomass'] },
];

export function ticketPrintOptionsFor(vehicleTypes: string[]) {
    return TICKET_PRINT_OPTIONS.filter((o) => o.vehicleTypes.some((v) => vehicleTypes.includes(v)));
}

/** 车种取消后清掉对应打印勾选；ticketPrint 由勾选派生，不再是独立开关 */
export function applyTicketPrintDefaults(strategy: WbmStrategy): WbmStrategy {
    const allowed = new Set(ticketPrintOptionsFor(strategy.vehicleTypes).map((o) => o.key));
    const next = { ...strategy };
    for (const o of TICKET_PRINT_OPTIONS) {
        next[o.key] = allowed.has(o.key) ? strategy[o.key] : false;
    }
    next.ticketPrint = TICKET_PRINT_OPTIONS.some((o) => next[o.key]);
    return next;
}

/** 重衡 / 轻衡默认单向过磅；混用衡 / 可切换衡默认双向 */
export function isOneWayWeighDefault(weighMode: WeighMode): boolean {
    return weighMode === '1' || weighMode === '2';
}

/** 单向过磅保留的方向：轻衡按出厂方向，其余按进厂方向 */
export function oneWayWeighSide(weighMode: WeighMode): 'approach' | 'opposite' {
    return weighMode === '2' ? 'opposite' : 'approach';
}

function sideHasDevice(side: SideLayout): boolean {
    return !!(side.barrierId || side.plateOutId || side.plateInId || side.cardReaderId);
}

/** 单向过磅时清空另一侧；恢复双向时为空的一侧回填默认设备（避开已占用设备） */
export function applyOneWayLayout(
    layout: WbmDeviceLayout,
    weighMode: WeighMode,
    oneWayWeigh: boolean,
    moduleId: string,
): WbmDeviceLayout {
    if (oneWayWeigh) {
        const keep = oneWayWeighSide(weighMode);
        return {
            approach: keep === 'approach' ? { ...layout.approach } : emptySideLayout(),
            opposite: keep === 'opposite' ? { ...layout.opposite } : emptySideLayout(),
        };
    }
    const defaults = createDefaultDeviceLayout(moduleId);
    const fill = (side: SideLayout, def: SideLayout, used: Set<string>): SideLayout => {
        if (sideHasDevice(side)) return { ...side };
        return {
            ...side,
            barrierId: used.has(def.barrierId) ? '' : def.barrierId,
            plateOutId: used.has(def.plateOutId) ? '' : def.plateOutId,
            plateInId: used.has(def.plateInId) ? '' : def.plateInId,
            cardReaderId: used.has(def.cardReaderId) ? '' : def.cardReaderId,
        };
    };
    const approach = fill(layout.approach, defaults.approach, collectUsedDeviceIds(layout));
    return {
        approach,
        opposite: fill(layout.opposite, defaults.opposite, collectUsedDeviceIds({ ...layout, approach })),
    };
}

export function suggestStrategyFromLayout(
    moduleId: string,
    layout: WbmDeviceLayout,
    weighMode: WeighMode = '1',
    weighingProcess: WeighingProcess = '1',
): WbmStrategy {
    const meta = getModuleDevices(moduleId);
    const hasInner = !!(
        layout.opposite.plateInId ||
        layout.opposite.cardReaderId ||
        layout.approach.plateInId
    );
    const cameras = devicesByKind(moduleId, 'camera');
    const base: WbmStrategy = {
        weighMode,
        weighingProcess,
        oneWayWeigh: isOneWayWeighDefault(weighMode),
        vehicleTypes: ['coal'],
        requireDriverAlight: false,
        alightMethod: meta.hasAlightPhotoSignal ? 'photo' : 'weight',
        consistencyCheck: hasInner,
        approachCameraId: cameras[0]?.id ?? '',
        oppositeCameraId: cameras[1]?.id ?? '',
        ticketPrint: false,
        printCoal: false,
        printOutboundMaterial: false,
        printInboundMaterial: false,
        printBiomass: false,
        sceneName: '现场快速配置',
    };
    return applyTicketPrintDefaults(base);
}

export function createDefaultBasic(): WbmBasicParams {
    return {
        recognizeTimeoutMin: 3,
        detectEmptyOnRecognize: false,
        allowManualPlate: false,
        autoEntryRegister: false,
        emptyDefaultWeight: 0,
        emptyDetectCount: 1,
        emptyDetectIntervalMs: 500,
        minOnScaleCoalHeavy: 40,
        minOnScaleCoalLight: 10,
        minOnScaleMaterialHeavy: 20,
        minOnScaleMaterialLight: 5,
        minOnScaleTransfer: 3,
        minOnScaleBiomassHeavy: 20,
        minOnScaleBiomassLight: 2,
        transferClassifyThreshold: 25,
        onScaleByWeight: true,
        onScaleByInfrared: false,
        recheckWaitSec: 20,
        driverWeightKg: 60,
        driverWaitSec: 20,
        flameoutMonitor: 'io',
        weighStableSec: 5,
        weighSampleCount: 5,
        weighSampleIntervalMs: 1000,
        weighSolidifyTimeoutSec: 30,
        minOffScaleCoal: 0.5,
        minOffScaleMaterial: 0.5,
        minOffScaleTransfer: 0.01,
        minOffScaleBiomass: 0.5,
        failLockSec: 30,
        captureFailLock: false,
        singleStepWaitMs: 1000,
        meteringEndWaitMs: 10000,
    };
}

const OVER_RANGE_ACTION_OPTS = [
    { value: '1', label: '闭锁' },
    { value: '2', label: '报警' },
];

/** 量程三字段一组：下限 / 上限 / 超阈值动作（表格行录入） */
function rangeTriad(
    vehicleType: string,
    name: string,
    keyPrefix: string,
    minDefault: number,
    maxDefault: number,
): ParamField[] {
    const group = `${name}量程`;
    return [
        {
            key: `${keyPrefix}MinRange`,
            label: '下限阈值',
            type: 'number',
            unit: '吨',
            group,
            vehicleType,
            defaultValue: minDefault,
        },
        {
            key: `${keyPrefix}MaxRange`,
            label: '上限阈值',
            type: 'number',
            unit: '吨',
            group,
            vehicleType,
            defaultValue: maxDefault,
        },
        {
            key: `${keyPrefix}OverAction`,
            label: '超阈值动作',
            type: 'select',
            group,
            vehicleType,
            options: OVER_RANGE_ACTION_OPTS,
            defaultValue: '1',
        },
    ];
}

export interface OverloadRangeRow {
    name: string;
    vehicleType: string;
    group: string;
    min: ParamField;
    max: ParamField;
    action: ParamField;
}

/** 按计量车种过滤后的量程表行（保持 schema 顺序） */
export function buildOverloadRangeRows(
    params: ParamField[],
    vehicleTypes: string[],
): OverloadRangeRow[] {
    const bucket = new Map<
        string,
        Partial<OverloadRangeRow> & { min?: ParamField; max?: ParamField; action?: ParamField }
    >();
    const order: string[] = [];
    for (const p of params) {
        if (!p.group) continue;
        if (p.vehicleType && !vehicleTypes.includes(p.vehicleType)) continue;
        if (!bucket.has(p.group)) {
            bucket.set(p.group, {
                name: p.group.replace(/量程$/, ''),
                vehicleType: p.vehicleType ?? '',
                group: p.group,
            });
            order.push(p.group);
        }
        const row = bucket.get(p.group)!;
        if (p.key.endsWith('MinRange')) row.min = p;
        else if (p.key.endsWith('MaxRange')) row.max = p;
        else if (p.key.endsWith('OverAction')) row.action = p;
    }
    return order
        .map((g) => bucket.get(g)!)
        .filter((r): r is OverloadRangeRow => !!(r.min && r.max && r.action));
}

/** 各子流程高级参数 schema（摘录 2.3，原型可配） */
export const STEP_PARAM_SCHEMAS: StepParamSchema[] = [
    {
        stepId: 'identify',
        params: [
            {
                key: 'recognizeTimeoutSec',
                label: '识别超时时间',
                type: 'number',
                unit: '秒',
                tip: '识别车辆请求车辆信息超时，自动结束流程重新识别最新车牌',
                defaultValue: 180,
            },
            {
                key: 'detectEmptyOnRecognize',
                label: '识别时是否检测空磅',
                type: 'bool',
                tip: '检测衡器读数归零；识别到车辆时同步核验衡器读数是否归零',
                defaultValue: false,
            },
            {
                key: 'enableVehicleRecheck',
                label: '是否二次校验车辆',
                type: 'bool',
                tip: '等待一段时间后再次识别车辆，保证车辆不是路过误识别',
                defaultValue: false,
            },
            {
                key: 'recheckWaitSec',
                label: '二次校验车辆等待时间',
                type: 'number',
                unit: '秒',
                tip: '间隔多久后再次识别车辆',
                defaultValue: 20,
                visibleWhen: { key: 'enableVehicleRecheck', equals: true },
            },
            {
                key: 'autoEntryRegister',
                label: '是否自动入厂登记',
                type: 'bool',
                defaultValue: false,
            },
        ],
        notifies: [
            { key: 'identifyNotify', title: '识别结果通知' },
            { key: 'allowMeterNotify', title: '允许计量通知' },
            { key: 'denyMeterNotify', title: '禁止计量通知' },
        ],
    },
    {
        stepId: 'emptyScale',
        params: [
            { key: 'emptyDefaultWeight', label: '空磅默认重量', type: 'number', unit: '吨', defaultValue: 0 },
            { key: 'emptyDetectCount', label: '连续检测次数', type: 'number', unit: '次', defaultValue: 1 },
            { key: 'emptyDetectIntervalMs', label: '连续检测间隔', type: 'number', unit: '毫秒', defaultValue: 500 },
        ],
        notifies: [{ key: 'emptyFailNotify', title: '检测失败通知' }],
    },
    {
        stepId: 'onScale',
        params: [
            {
                key: 'onScaleJudgeModes',
                label: '判断方式',
                type: 'multi',
                group: '核验方式',
                tip: '配置判断车辆上磅的方式；未配置红外对射点时仅可选衡器读数',
                options: [
                    { value: '1', label: '衡器读数' },
                    { value: '2', label: '红外对射信号' },
                ],
                defaultValue: ['1'],
            },
            {
                key: 'minOnScaleCoalHeavy',
                label: '燃煤重车最小上磅重量',
                type: 'number',
                unit: '吨',
                group: '按重量核验',
                tip: '燃煤重车上磅检测的最小重量阈值，低于该值判定未上磅',
                defaultValue: 40,
                visibleWhen: { key: 'onScaleJudgeModes', includes: '1' },
            },
            {
                key: 'minOnScaleCoalLight',
                label: '燃煤轻车最小上磅重量',
                type: 'number',
                unit: '吨',
                group: '按重量核验',
                tip: '燃煤轻车上磅检测的最小重量阈值，低于该值判定未上磅',
                defaultValue: 10,
                visibleWhen: { key: 'onScaleJudgeModes', includes: '1' },
            },
            {
                key: 'minOnScaleMaterialHeavy',
                label: '物资车重车最小上磅重量',
                type: 'number',
                unit: '吨',
                group: '按重量核验',
                tip: '物资重车上磅检测的最小重量阈值，低于该值判定未上磅',
                defaultValue: 20,
                visibleWhen: { key: 'onScaleJudgeModes', includes: '1' },
            },
            {
                key: 'minOnScaleMaterialLight',
                label: '物资车轻车最小上磅重量',
                type: 'number',
                unit: '吨',
                group: '按重量核验',
                tip: '物资轻车上磅检测的最小重量阈值，低于该值判定未上磅',
                defaultValue: 5,
                visibleWhen: { key: 'onScaleJudgeModes', includes: '1' },
            },
            {
                key: 'minOnScaleTransfer',
                label: '搬倒煤最小上磅重量',
                type: 'number',
                unit: '吨',
                group: '按重量核验',
                tip: '搬倒煤车辆上磅检测的最小重量阈值，低于该值判定未上磅',
                defaultValue: 3,
                visibleWhen: { key: 'onScaleJudgeModes', includes: '1' },
            },
            {
                key: 'minOnScaleBiomassHeavy',
                label: '生物质重车最小上磅重量',
                type: 'number',
                unit: '吨',
                group: '按重量核验',
                tip: '生物质重车上磅检测的最小重量阈值，低于该值判定未上磅',
                defaultValue: 20,
                visibleWhen: { key: 'onScaleJudgeModes', includes: '1' },
            },
            {
                key: 'minOnScaleBiomassLight',
                label: '生物质轻车最小上磅重量',
                type: 'number',
                unit: '吨',
                group: '按重量核验',
                tip: '生物质轻车上磅检测的最小重量阈值，低于该值判定未上磅',
                defaultValue: 2,
                visibleWhen: { key: 'onScaleJudgeModes', includes: '1' },
            },
            {
                key: 'transferClassifyThreshold',
                label: '搬倒煤分类阈值',
                type: 'number',
                unit: '吨',
                group: '按重量核验',
                tip: '搬倒煤重量分界线，用于判断过重衡或回皮；大于此值过重衡，小于此值回皮',
                defaultValue: 25,
                visibleWhen: { key: 'onScaleJudgeModes', includes: '1' },
            },
            {
                key: 'irDetectCount',
                label: '红外对射检测次数',
                type: 'number',
                unit: '次',
                group: '按红外对射核验',
                tip: '道闸限位开关检测次数',
                defaultValue: 3,
                visibleWhen: { key: 'onScaleJudgeModes', includes: '2' },
            },
            {
                key: 'irDetectIntervalMs',
                label: '红外对射检测间隔',
                type: 'number',
                unit: '毫秒',
                group: '按红外对射核验',
                tip: '道闸限位开关检测间隔',
                defaultValue: 1000,
                visibleWhen: { key: 'onScaleJudgeModes', includes: '2' },
            },
            {
                key: 'boardTimeoutSec',
                label: '超时未上磅时间',
                type: 'number',
                unit: '秒',
                group: '超时控制',
                defaultValue: 60,
            },
            {
                key: 'boardTimeoutDropGate',
                label: '超时落闸开关',
                type: 'bool',
                group: '超时控制',
                defaultValue: false,
            },
        ],
        notifies: [
            { key: 'noBoardTimeoutNotify', title: '超时未上磅通知' },
            { key: 'onScaleRepeatNotify', title: '每15秒重复提示' },
            { key: 'onScaleOkNotify', title: '已上磅通知' },
        ],
    },
    {
        stepId: 'recheck',
        params: [
            {
                key: 'cardCompareWaitSec',
                label: '车卡比对等待时间',
                type: 'number',
                unit: '秒',
                tip: '车辆与卡信息比对的等待时长；根据道闸内或闸外多种识别结果进行二次校车',
                defaultValue: 20,
            },
            {
                key: 'cardCompareFailAction',
                label: '车卡比对异常动作',
                type: 'select',
                tip: '车卡比对异常时的处理动作',
                options: [
                    { value: '1', label: '闭锁' },
                    { value: '2', label: '报警' },
                ],
                defaultValue: '1',
            },
        ],
        notifies: [
            { key: 'recheckStartNotify', title: '开始校验提示' },
            { key: 'consistencyOkNotify', title: '校验通过通知' },
            { key: 'consistencyFailNotify', title: '校验失败通知' },
        ],
    },
    {
        stepId: 'flameout',
        params: [
            {
                key: 'flameoutMonitor',
                label: '判断方式',
                type: 'select',
                tip: '根据信号点位自动默认：存在 YXVibratorIO / YCVibratorCurrent 时按存在项取值，均存在默认 I/O，均不存在则为重量',
                options: [
                    { value: 'io', label: 'I/O信号' },
                    { value: 'current', label: '电流信号' },
                    { value: 'weight', label: '重量' },
                ],
                defaultValue: 'io',
            },
            {
                key: 'currentStableValue',
                label: '电流稳定值',
                type: 'number',
                tip: '电流信号判断稳定时的阈值',
                defaultValue: 1,
                visibleWhen: { key: 'flameoutMonitor', equals: 'current' },
            },
            {
                key: 'weightStableDiff',
                label: '稳定时重量差值',
                type: 'number',
                unit: '吨',
                tip: '震动检测为重量时，判定稳定允许的重量波动差值',
                defaultValue: 0.05,
                visibleWhen: { key: 'flameoutMonitor', equals: 'weight' },
            },
            {
                key: 'vibrateJudgeIntervalMs',
                label: '震动判断间隔',
                type: 'number',
                unit: '毫秒',
                tip: '震动检测为重量时，两次重量采样的判断间隔',
                defaultValue: 1000,
                visibleWhen: { key: 'flameoutMonitor', equals: 'weight' },
            },
        ],
        notifies: [
            { key: 'flameoutStartNotify', title: '开始校验提示' },
            { key: 'flameoutOkNotify', title: '校验通过通知' },
            { key: 'flameoutFailNotify', title: '校验失败通知' },
        ],
    },
    {
        stepId: 'driverAlight',
        params: [
            {
                key: 'alightMethod',
                label: '判断方法',
                type: 'select',
                tip: '根据配置的信号点位判断：存在司机下车光电信号则默认按设备信号，否则按司机体重',
                options: [
                    { value: 'weight', label: '体重' },
                    { value: 'photo', label: '司机下车按按钮' },
                ],
                defaultValue: 'weight',
            },
            {
                key: 'driverWeightKg',
                label: '司机重量',
                type: 'number',
                unit: 'kg',
                tip: '司机体重基准值，用于检测司机上下磅',
                defaultValue: 60,
                visibleWhen: { key: 'alightMethod', equals: 'weight' },
            },
            {
                key: 'driverWaitSec',
                label: '检测司机上下磅等待时间',
                type: 'number',
                unit: '秒',
                tip: '检测司机上下磅的等待时长',
                defaultValue: 20,
            },
            {
                key: 'alightFailOffAction',
                label: '校验司机下磅失败动作',
                type: 'select',
                tip: '校验司机下磅失败时的处理动作',
                options: [
                    { value: '1', label: '闭锁' },
                    { value: '2', label: '报警' },
                ],
                defaultValue: '1',
            },
            {
                key: 'alightFailOnAction',
                label: '校验司机上磅失败动作',
                type: 'select',
                tip: '校验司机上磅失败时的处理动作',
                options: [
                    { value: '1', label: '闭锁' },
                    { value: '2', label: '报警' },
                ],
                defaultValue: '1',
            },
        ],
        notifies: [
            { key: 'alightStartNotify', title: '开始核验时提示' },
            { key: 'alightOkNotify', title: '核验成功通知' },
            { key: 'alightFailNotify', title: '核验失败通知' },
        ],
    },
    {
        stepId: 'weigh',
        params: [
            { key: 'weighStableSec', label: '称重稳定时间', type: 'number', unit: '秒', defaultValue: 5 },
            { key: 'weighSampleCount', label: '称重采集次数', type: 'number', unit: '次', defaultValue: 5 },
            { key: 'weighSampleIntervalMs', label: '称重采集间隔', type: 'number', unit: '毫秒', defaultValue: 1000 },
            { key: 'weighSolidifyTimeoutSec', label: '固化重量超时', type: 'number', unit: '秒', defaultValue: 30 },
        ],
        notifies: [
            { key: 'weighingNotify', title: '称重进行中通知' },
            { key: 'weighFailNotify', title: '称重失败通知' },
        ],
    },
    {
        stepId: 'overload',
        params: [
            ...rangeTriad('coal', '燃煤轻车', 'coalLight', 10, 10),
            ...rangeTriad('coal', '燃煤重车', 'coalHeavy', 46, 46),
            ...rangeTriad('material', '物资车重车', 'materialHeavy', 20, 20),
            ...rangeTriad('material', '物资车轻车', 'materialLight', 5, 5),
            ...rangeTriad('transfer', '搬倒煤重车', 'transferHeavy', 30, 50),
            ...rangeTriad('transfer', '搬倒煤轻车', 'transferLight', 10, 20),
            ...rangeTriad('biomass', '生物质重车', 'biomassHeavy', 15, 46),
            ...rangeTriad('biomass', '生物质轻车', 'biomassLight', 2, 20),
        ],
        notifies: [
            { key: 'underweightLockNotify', title: '超轻闭锁通知' },
            { key: 'underweightAlarmNotify', title: '超轻报警通知' },
            { key: 'overloadLockNotify', title: '超载闭锁通知' },
            { key: 'overloadAlarmNotify', title: '超载报警通知' },
            {
                key: 'transferWrongScaleNotify',
                title: '转场煤走错衡',
                vehicleType: 'transfer',
            },
        ],
    },
    {
        stepId: 'capture',
        params: [
            {
                key: 'captureFailLock',
                label: '图片抓拍失败是否闭锁',
                type: 'bool',
                tip: '计量图片抓拍失败时的处理策略：闭锁则不上传；不闭锁则继续上传',
                defaultValue: false,
            },
        ],
        notifies: [
            { key: 'captureStartNotify', title: '开始抓拍' },
            { key: 'captureOkNotify', title: '抓拍成功通知' },
            { key: 'captureFailNotify', title: '抓拍失败通知' },
        ],
    },
    {
        stepId: 'upload',
        params: [{ key: 'failLockSec', label: '计量失败锁车时间', type: 'number', unit: '秒', defaultValue: 30 }],
        notifies: [
            { key: 'uploadOkNotify', title: '数据上传成功通知' },
            { key: 'uploadFailNotify', title: '数据上传失败通知' },
        ],
    },
    {
        stepId: 'ticket',
        params: [
            {
                key: 'printCoal',
                label: '煤车磅单打印',
                type: 'bool',
                tip: '煤车计量完成后是否打印磅单',
                vehicleType: 'coal',
                defaultValue: true,
            },
            {
                key: 'printOutboundMaterial',
                label: '出厂物资磅单打印',
                type: 'bool',
                tip: '出厂物资计量完成后是否打印磅单',
                vehicleTypesAny: ['material', 'transfer'],
                defaultValue: true,
            },
            {
                key: 'printInboundMaterial',
                label: '入厂物资磅单打印',
                type: 'bool',
                tip: '入厂物资计量完成后是否打印磅单',
                vehicleTypesAny: ['material', 'transfer'],
                defaultValue: true,
            },
            {
                key: 'printBiomass',
                label: '生物质磅单打印',
                type: 'bool',
                tip: '生物质计量完成后是否打印磅单',
                vehicleType: 'biomass',
                defaultValue: true,
            },
        ],
        notifies: [
            { key: 'ticketOkNotify', title: '打印成功通知' },
            { key: 'ticketFailNotify', title: '打印失败通知' },
        ],
    },
    {
        stepId: 'offScale',
        params: [
            {
                key: 'minOffScaleCoal',
                label: '煤车最小下磅重量',
                type: 'number',
                unit: '吨',
                group: '下磅核验',
                vehicleType: 'coal',
                tip: '衡器重量小于该值时，视为车辆已下磅',
                defaultValue: 0.5,
            },
            {
                key: 'minOffScaleMaterial',
                label: '物资车最小下磅重量',
                type: 'number',
                unit: '吨',
                group: '下磅核验',
                vehicleType: 'material',
                tip: '衡器重量小于该值时，视为车辆已下磅',
                defaultValue: 0.5,
            },
            {
                key: 'minOffScaleTransfer',
                label: '搬倒煤最小下磅重量',
                type: 'number',
                unit: '吨',
                group: '下磅核验',
                vehicleType: 'transfer',
                tip: '衡器重量小于该值时，视为车辆已下磅',
                defaultValue: 0.01,
            },
            {
                key: 'minOffScaleBiomass',
                label: '生物质最小下磅重量',
                type: 'number',
                unit: '吨',
                group: '下磅核验',
                vehicleType: 'biomass',
                tip: '衡器重量小于该值时，视为车辆已下磅',
                defaultValue: 0.5,
            },
        ],
        notifies: [{ key: 'offScaleLateNotify', title: '未及时下磅通知' }],
    },
    {
        stepId: 'reset',
        params: [{ key: 'resetWaitSec', label: '复位等待', type: 'number', unit: '秒', defaultValue: 5 }],
        notifies: [{ key: 'resetNotify', title: '退出/复位消息设定' }],
    },
    {
        stepId: 'inGateUp',
        params: [],
        notifies: [],
    },
    {
        stepId: 'inGateDown',
        params: [],
        notifies: [],
    },
    {
        stepId: 'outGateUp',
        params: [],
        notifies: [],
    },
    {
        stepId: 'outGateDown',
        params: [],
        notifies: [],
    },
];

const NOTIFY_DEFAULTS: Record<string, NotifyItem> = {
    identifyNotify: defaultNotify('{车牌号} 请等待'),
    allowMeterNotify: defaultNotify('{车牌号}识别成功，请驱车上磅'),
    denyMeterNotify: defaultNotify('{车牌号}{平台消息}'),
    emptyFailNotify: defaultNotify('当前磅重不为空，请先清零'),
    noBoardTimeoutNotify: defaultNotify('超时未上磅，重启流程'),
    onScaleRepeatNotify: defaultNotify('{车牌号}司机请驱车上磅'),
    onScaleOkNotify: defaultNotify('{车牌号}已上磅'),
    recheckStartNotify: defaultNotify('开始车卡校验'),
    consistencyOkNotify: defaultNotify('车卡比对成功'),
    consistencyFailNotify: defaultNotify('车卡比对失败'),
    flameoutStartNotify: defaultNotify('请熄火下车'),
    flameoutOkNotify: defaultNotify('车辆已熄火，开始计量'),
    flameoutFailNotify: defaultNotify('车辆长时间未熄火'),
    alightStartNotify: defaultNotify('请下磅前往等待区域'),
    alightOkNotify: defaultNotify('司机已下磅，开始计量'),
    alightFailNotify: defaultNotify(
        '未下磅计量，请退出',
        '未检测到司机下磅，请退出后重新计量',
    ),
    weighingNotify: defaultNotify('{车牌号} 正在计量，请保持静止'),
    weighFailNotify: defaultNotify('{车牌号} 计量未稳定，请重试'),
    overloadNotify: defaultNotify('{车牌号} 超出量程，禁止计量'),
    underweightLockNotify: defaultNotify('{车牌号}重量超轻无法计量'),
    underweightAlarmNotify: defaultNotify('{车牌号}重量超轻，警告'),
    overloadLockNotify: defaultNotify('{车牌号}重量超载无法计量'),
    overloadAlarmNotify: defaultNotify('{车牌号}重量超载，警告'),
    transferWrongScaleNotify: defaultNotify('{车牌号}转场煤走错衡，无法计量'),
    captureStartNotify: defaultNotify('开始图片抓拍', undefined, false),
    captureOkNotify: defaultNotify('图片抓拍成功'),
    captureFailNotify: defaultNotify('图片抓拍失败'),
    uploadOkNotify: defaultNotify('{车牌号}计量结束，司机请驱车下磅'),
    uploadFailNotify: defaultNotify('计量失败，请联系计量员或下磅重新计量'),
    ticketOkNotify: defaultNotify('请司机前往门岗获取磅单'),
    ticketFailNotify: defaultNotify('磅单打印失败，请联系管理员'),
    offScaleLateNotify: defaultNotify('{车牌号}请下磅'),
    resetNotify: defaultNotify('排队过磅 有序通行'),
};

export function getNotifyDefault(key: string): NotifyItem {
    return { ...(NOTIFY_DEFAULTS[key] ?? defaultNotify('{车牌号} 请等待')) };
}

/** 旧默认文案（仅匹配时迁移，避免覆盖用户自定义） */
const LEGACY_NOTIFY_TEXTS: Record<string, string[]> = {
    flameoutOkNotify: ['{车牌号} 已熄火，开始计量', '{车牌号}已熄火，开始计量'],
    flameoutFailNotify: ['{车牌号} 请熄火后计量', '{车牌号}请熄火后计量'],
    alightOkNotify: ['{车牌号} 请下车后计量', '{车牌号}请下车后计量'],
    alightFailNotify: [
        '{车牌号} 下车核验失败，请重试',
        '{车牌号}下车核验失败，请重试',
        '{车牌号} 下车核验失败，请联系管理员',
    ],
    alightStartNotify: [
        '请下磅前往等待区域',
        '请下磅按下开关开始计量',
        '{车牌号} 请下车后计量',
    ],
    captureFailNotify: ['{车牌号} 抓拍失败', '{车牌号}抓拍失败'],
    uploadFailNotify: [
        '{车牌号} 计量上传失败',
        '{车牌号}计量上传失败',
        '{车牌号} 计量上传失败，请重试',
    ],
    uploadOkNotify: [
        '{车牌号} {重量}吨 计量完成，请下磅',
        '{车牌号} 计量完成，请下磅',
        '{车牌号}{重量}吨 计量完成，请下磅',
    ],
    ticketNotify: ['{车牌号} 请领取磅单', '{车牌号}请领取磅单'],
    ticketOkNotify: ['{车牌号} 请领取磅单', '{车牌号}请领取磅单'],
};

function notifyMatchesLegacy(key: string, item: NotifyItem): boolean {
    const list = LEGACY_NOTIFY_TEXTS[key];
    if (!list?.length) return false;
    const led = item.led.trim();
    const bc = item.broadcast.trim();
    return list.includes(led) || list.includes(bc);
}

/** 补齐缺失参数/通知项，并将已知旧默认文案刷新为最新表默认 */
export function normalizeStepAdvanced(
    stepId: StepId,
    adv: WbmAdvancedByStep,
    opts?: { alightMethod?: AlightMethod },
): WbmAdvancedByStep {
    const schema = STEP_PARAM_SCHEMAS.find((s) => s.stepId === stepId);
    if (!schema) return adv;
    const params: StepParamValues = { ...adv.params };
    const notifies: StepNotifyValues = { ...adv.notifies };
    let changed = false;

    for (const p of schema.params) {
        if (params[p.key] === undefined) {
            params[p.key] = Array.isArray(p.defaultValue) ? [...p.defaultValue] : p.defaultValue;
            changed = true;
        }
    }
    if (stepId === 'driverAlight') {
        const method =
            params.alightMethod === 'photo' || params.alightMethod === 'weight'
                ? (params.alightMethod as AlightMethod)
                : opts?.alightMethod ?? 'weight';
        if (params.alightMethod !== method) {
            params.alightMethod = method;
            changed = true;
        }
    }
    if (stepId === 'ticket' && !notifies.ticketOkNotify && notifies.ticketNotify) {
        const legacy = notifies.ticketNotify;
        notifies.ticketOkNotify = notifyMatchesLegacy('ticketNotify', legacy)
            ? getNotifyDefault('ticketOkNotify')
            : { ...legacy };
        changed = true;
    }

    for (const n of schema.notifies) {
        const cur = notifies[n.key];
        const method =
            stepId === 'driverAlight' &&
            (params.alightMethod === 'photo' || params.alightMethod === 'weight')
                ? (params.alightMethod as AlightMethod)
                : opts?.alightMethod ?? 'weight';
        if (!cur || notifyMatchesLegacy(n.key, cur)) {
            notifies[n.key] =
                n.key === 'alightStartNotify'
                    ? getAlightStartNotifyDefault(method)
                    : getNotifyDefault(n.key);
            changed = true;
        }
    }
    return changed ? { ...adv, params, notifies } : adv;
}

/** 司机下车·开始核验提示：按体重 / 按按钮信号（光电）自动取值 */
export function getAlightStartNotifyDefault(method: AlightMethod = 'weight'): NotifyItem {
    const text =
        method === 'photo' ? '请下磅按下开关开始计量' : '请下磅前往等待区域';
    return defaultNotify(text);
}

export function createStepAdvanced(
    stepId: StepId,
    opts?: { alightMethod?: AlightMethod; moduleId?: string },
): WbmAdvancedByStep {
    const schema = STEP_PARAM_SCHEMAS.find((s) => s.stepId === stepId);
    const params: StepParamValues = {};
    const notifies: StepNotifyValues = {};
    if (schema) {
        for (const p of schema.params) {
            params[p.key] = Array.isArray(p.defaultValue) ? [...p.defaultValue] : p.defaultValue;
        }
        if (stepId === 'flameout') {
            params.flameoutMonitor = resolveFlameoutMonitorDefault(
                getFlameoutSignalAvailability(opts?.moduleId),
            );
        }
        if (stepId === 'driverAlight') {
            params.alightMethod = opts?.alightMethod ?? 'weight';
        }
        for (const n of schema.notifies) {
            notifies[n.key] =
                n.key === 'alightStartNotify'
                    ? getAlightStartNotifyDefault(
                          (params.alightMethod as AlightMethod) ?? opts?.alightMethod ?? 'weight',
                      )
                    : getNotifyDefault(n.key);
        }
    }
    return { params, notifies };
}

export function createAdvancedForSteps(
    steps: WbmFlowStep[],
    strategy?: Pick<WbmStrategy, 'alightMethod'>,
    moduleId?: string,
): Record<string, WbmAdvancedByStep> {
    const out: Record<string, WbmAdvancedByStep> = {};
    for (const s of steps) {
        const uid = s.uid || createStepUid(s.id);
        out[uid] = createStepAdvanced(s.id, {
            alightMethod: strategy?.alightMethod,
            moduleId,
        });
    }
    return out;
}

/** 按同类型出现顺序迁移/保留各实例高级配置；新实例标记 isNew */
export function mergeStepsAfterArrange(
    prevSteps: WbmFlowStep[],
    nextSteps: WbmFlowStep[],
    prevAdv: Record<string, WbmAdvancedByStep>,
    strategy?: Pick<WbmStrategy, 'alightMethod'>,
    moduleId?: string,
): { steps: WbmFlowStep[]; advanced: Record<string, WbmAdvancedByStep> } {
    const queues = new Map<StepId, WbmAdvancedByStep[]>();
    const consumedLegacy = new Set<StepId>();
    for (const s of prevSteps) {
        const uid = s.uid;
        let adv: WbmAdvancedByStep | undefined =
            uid && prevAdv[uid] ? structuredClone(prevAdv[uid]) : undefined;
        if (!adv && prevAdv[s.id] && !consumedLegacy.has(s.id)) {
            adv = structuredClone(prevAdv[s.id]);
            consumedLegacy.add(s.id);
        }
        if (!adv) continue;
        const list = queues.get(s.id) ?? [];
        list.push(adv);
        queues.set(s.id, list);
    }

    const advanced: Record<string, WbmAdvancedByStep> = {};
    const steps = nextSteps.map((s) => {
        const uid = s.uid || createStepUid(s.id);
        const q = queues.get(s.id);
        const fromPrev = q?.length ? q.shift()! : null;
        advanced[uid] =
            fromPrev ??
            createStepAdvanced(s.id, {
                alightMethod: strategy?.alightMethod,
                moduleId,
            });
        return {
            ...s,
            uid,
            isNew: !fromPrev,
        };
    });
    return { steps, advanced };
}

export function syncBasicFromStrategy(basic: WbmBasicParams, strategy: WbmStrategy): WbmBasicParams {
    return {
        ...basic,
        // 打印开关由 strategy 驱动时，高级 ticket 块也会同步
    };
}

export function generateWbmConfig(
    moduleId: string,
    layout: WbmDeviceLayout,
    strategy: WbmStrategy,
    prev?: WbmModuleConfig | null,
): WbmModuleConfig {
    const nextStrategy = applyTicketPrintDefaults(strategy);
    const steps = buildDefaultSteps(nextStrategy, layout);
    const basic = createDefaultBasic();
    let advanced = createAdvancedForSteps(steps, nextStrategy, moduleId);
    let markedSteps = steps;

    if (prev?.steps?.length) {
        const merged = mergeStepsAfterArrange(
            prev.steps,
            steps,
            prev.advanced ?? {},
            nextStrategy,
            moduleId,
        );
        markedSteps = merged.steps;
        advanced = merged.advanced;
    }

    // 同步 ticket 打印勾选到各磅单打印实例
    for (const s of markedSteps) {
        if (s.id !== 'ticket' || !advanced[s.uid]) continue;
        advanced[s.uid] = {
            ...advanced[s.uid],
            params: {
                ...advanced[s.uid].params,
                printCoal: nextStrategy.printCoal,
                printOutboundMaterial: nextStrategy.printOutboundMaterial,
                printInboundMaterial: nextStrategy.printInboundMaterial,
                printBiomass: nextStrategy.printBiomass,
            },
        };
    }

    return {
        moduleId,
        layoutConfigured: true,
        layoutSaved: true,
        status: 'draft',
        layout: structuredClone(layout),
        strategy: { ...nextStrategy },
        steps: markedSteps,
        basic: syncBasicFromStrategy(basic, nextStrategy),
        advanced,
        nonFlow: prev?.nonFlow
            ? normalizeNonFlowValues(prev.nonFlow)
            : createDefaultNonFlowValues(),
        basicTouched: [],
        updatedAt: new Date().toISOString(),
    };
}

/** 仅保存布局/场景，不改流程与参数 */
export function saveLayoutOnly(
    moduleId: string,
    layout: WbmDeviceLayout,
    strategy: WbmStrategy,
    prev?: WbmModuleConfig | null,
): WbmModuleConfig {
    const nextStrategy = applyTicketPrintDefaults(strategy);
    if (prev) {
        return {
            ...prev,
            layoutSaved: true,
            layout: structuredClone(layout),
            strategy: { ...nextStrategy },
            updatedAt: new Date().toISOString(),
        };
    }
    return {
        moduleId,
        layoutConfigured: false,
        layoutSaved: true,
        status: 'empty',
        layout: structuredClone(layout),
        strategy: { ...nextStrategy },
        steps: [],
        basic: createDefaultBasic(),
        advanced: {},
        nonFlow: createDefaultNonFlowValues(),
        basicTouched: [],
        updatedAt: new Date().toISOString(),
    };
}

export function reloadParamsAfterFlowSave(
    cfg: WbmModuleConfig,
    steps: WbmFlowStep[],
): WbmModuleConfig {
    const merged = mergeStepsAfterArrange(
        cfg.steps,
        steps,
        cfg.advanced,
        cfg.strategy,
        cfg.moduleId,
    );
    const basic = createDefaultBasic();
    return {
        ...cfg,
        steps: merged.steps,
        advanced: merged.advanced,
        basic,
        status: 'draft',
        updatedAt: new Date().toISOString(),
    };
}

export function deviceName(moduleId: string, id: string): string {
    if (!id) return '未关联';
    return getModuleDevices(moduleId).devices.find((d) => d.id === id)?.name ?? id;
}

export function collectUsedDeviceIds(
    layout: WbmDeviceLayout,
    except?: { side: 'approach' | 'opposite'; field: keyof SideLayout },
): Set<string> {
    const used = new Set<string>();
    (['approach', 'opposite'] as const).forEach((side) => {
        (['barrierId', 'plateOutId', 'plateInId', 'cardReaderId'] as const).forEach((field) => {
            if (except && except.side === side && except.field === field) return;
            const id = layout[side][field];
            if (id) used.add(id);
        });
    });
    return used;
}

export function hasWbmSavedConfig(cfg?: WbmModuleConfig | null): boolean {
    return !!cfg?.layoutConfigured && (cfg.steps?.length ?? 0) > 0;
}

export function validateWbmConfig(cfg: WbmModuleConfig): string[] {
    const errs: string[] = [];
    if (!cfg.layoutConfigured || !cfg.steps.length) {
        errs.push('尚未完成设备布局及计量要求确认，请先生成流程');
        return errs;
    }
    if (!cfg.strategy.vehicleTypes.length) errs.push('请至少勾选一种计量车种');
    for (const d of SUB_PROCESS_LIBRARY.filter((s) => s.required)) {
        if (!cfg.steps.some((s) => s.id === d.id)) errs.push(`缺少必选子流程「${d.name}」`);
    }
    return errs;
}

function normalizeSide(raw: unknown, fallback: SideLayout): SideLayout {
    if (!raw || typeof raw !== 'object') return { ...fallback };
    const o = raw as Record<string, unknown>;
    const role = (v: unknown, def: DeviceRole): DeviceRole => (v === 'assist' || v === 'primary' ? v : def);
    return {
        barrierId: typeof o.barrierId === 'string' ? o.barrierId : '',
        plateOutId: typeof o.plateOutId === 'string' ? o.plateOutId : '',
        plateOutRole: role(o.plateOutRole, 'primary'),
        plateInId: typeof o.plateInId === 'string' ? o.plateInId : '',
        plateInRole: role(o.plateInRole, 'assist'),
        cardReaderId: typeof o.cardReaderId === 'string' ? o.cardReaderId : '',
        cardReaderRole: role(o.cardReaderRole, 'assist'),
    };
}

function normalizeLayout(raw: unknown, moduleId: string): WbmDeviceLayout {
    const d = createDefaultDeviceLayout(moduleId);
    if (!raw || typeof raw !== 'object') return d;
    const v = raw as Record<string, unknown>;
    return {
        approach: normalizeSide(v.approach, d.approach),
        opposite: normalizeSide(v.opposite, d.opposite),
    };
}

function normalizeStrategy(raw: unknown, layout: WbmDeviceLayout, moduleId: string): WbmStrategy {
    const d = suggestStrategyFromLayout(moduleId, layout);
    if (!raw || typeof raw !== 'object') return d;
    const v = raw as Record<string, unknown>;
    const weighMode =
        v.weighMode === '2' || v.weighMode === '3' || v.weighMode === '4' ? v.weighMode : '1';
    const base: WbmStrategy = {
        weighMode,
        weighingProcess: v.weighingProcess === '2' ? '2' : '1',
        vehicleTypes: Array.isArray(v.vehicleTypes)
            ? (v.vehicleTypes as string[]).filter(Boolean)
            : d.vehicleTypes,
        requireDriverAlight:
            typeof v.requireDriverAlight === 'boolean' ? v.requireDriverAlight : d.requireDriverAlight,
        alightMethod: v.alightMethod === 'photo' ? 'photo' : 'weight',
        consistencyCheck:
            typeof v.consistencyCheck === 'boolean' ? v.consistencyCheck : d.consistencyCheck,
        oneWayWeigh:
            typeof v.oneWayWeigh === 'boolean' ? v.oneWayWeigh : isOneWayWeighDefault(weighMode),
        approachCameraId:
            typeof v.approachCameraId === 'string' &&
            (!v.approachCameraId ||
                devicesByKind(moduleId, 'camera').some((c) => c.id === v.approachCameraId))
                ? v.approachCameraId
                : d.approachCameraId,
        oppositeCameraId:
            typeof v.oppositeCameraId === 'string' &&
            (!v.oppositeCameraId ||
                devicesByKind(moduleId, 'camera').some((c) => c.id === v.oppositeCameraId))
                ? v.oppositeCameraId
                : d.oppositeCameraId,
        ticketPrint: typeof v.ticketPrint === 'boolean' ? v.ticketPrint : d.ticketPrint,
        printCoal: typeof v.printCoal === 'boolean' ? v.printCoal : false,
        printOutboundMaterial:
            typeof v.printOutboundMaterial === 'boolean' ? v.printOutboundMaterial : false,
        printInboundMaterial:
            typeof v.printInboundMaterial === 'boolean' ? v.printInboundMaterial : false,
        printBiomass: typeof v.printBiomass === 'boolean' ? v.printBiomass : false,
        sceneName: typeof v.sceneName === 'string' ? v.sceneName : d.sceneName,
    };
    return applyTicketPrintDefaults(base);
}

const STORAGE_KEY = 'aef-wbm-configs-v5';

const KNOWN_STEP_IDS = new Set<StepId>(SUB_PROCESS_LIBRARY.map((s) => s.id));

/** 旧配置缺少的必选子流程按默认顺序补回 */
function ensureRequiredSteps(steps: WbmFlowStep[]): WbmFlowStep[] {
    if (!steps.length) return steps;
    const order = SUB_PROCESS_LIBRARY.filter((s) => s.required).map((s) => s.id);
    const next = [...steps];
    for (const id of order) {
        if (next.some((s) => s.id === id)) continue;
        const idx = order.indexOf(id);
        const afterId = order[idx - 1];
        const at = afterId ? next.findIndex((s) => s.id === afterId) : -1;
        const step = toFlowStep(id, 'rule');
        if (at >= 0) next.splice(at + 1, 0, step);
        else next.push(step);
    }
    return next;
}

/** 旧「来车/对向道闸控制」按抬杆/落杆参数拆成独立子流程；动作为「无」则丢弃 */
function migrateLegacyGateSteps(
    steps: WbmFlowStep[],
    rawAdv: Record<string, WbmAdvancedByStep>,
): WbmFlowStep[] {
    return steps.flatMap((step) => {
        const legacyId = step.id as string;
        if (legacyId !== 'inGate' && legacyId !== 'outGate') return [step];
        const adv = rawAdv[step.uid] || rawAdv[legacyId];
        const actionKey = legacyId === 'inGate' ? 'allowGateAction' : 'oppositeGateAction';
        const action = String(adv?.params?.[actionKey] ?? '1');
        if (action === '3') return [];
        const nextId: StepId =
            legacyId === 'inGate'
                ? action === '2'
                    ? 'inGateDown'
                    : 'inGateUp'
                : action === '2'
                  ? 'outGateDown'
                  : 'outGateUp';
        const d = def(nextId);
        return [
            {
                ...step,
                id: nextId,
                name: d.name,
                desc: d.desc,
                category: d.category,
                required: d.required,
                phase: step.phase || d.defaultPhase,
            },
        ];
    });
}

export function loadWbmConfigs(): Record<string, WbmModuleConfig> {
    try {
        const raw =
            localStorage.getItem(STORAGE_KEY) ||
            localStorage.getItem('aef-wbm-configs-v4') ||
            localStorage.getItem('aef-wbm-configs-v3') ||
            localStorage.getItem('aef-wbm-configs-v2') ||
            localStorage.getItem('aef-wbm-configs-v1');
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>;
        const out: Record<string, WbmModuleConfig> = {};
        for (const [id, cfg] of Object.entries(parsed)) {
            const layout = normalizeLayout(cfg.layout ?? cfg, id);
            const legacy = (cfg.layout ?? {}) as Record<string, unknown>;
            const legacyStrategy =
                cfg.strategy && typeof cfg.strategy === 'object'
                    ? (cfg.strategy as Record<string, unknown>)
                    : {
                          weighMode: legacy.weighMode,
                          weighingProcess: legacy.weighingProcess,
                          vehicleTypes: legacy.vehicleTypes,
                          requireDriverAlight: legacy.requireDriverAlight,
                          consistencyCheck: legacy.consistencyCheck,
                          ticketPrint: legacy.ticketPrint,
                      };
            const legacyApproach =
                legacy.approach && typeof legacy.approach === 'object'
                    ? String((legacy.approach as Record<string, unknown>).cameraId ?? '')
                    : '';
            const legacyOpposite =
                legacy.opposite && typeof legacy.opposite === 'object'
                    ? String((legacy.opposite as Record<string, unknown>).cameraId ?? '')
                    : '';
            /** 旧版：场景多选 / 方向布局单选 → 策略层进厂 / 出厂单选 */
            const legacyCams = Array.isArray(legacyStrategy.captureCameraIds)
                ? (legacyStrategy.captureCameraIds as unknown[]).filter(
                      (camId): camId is string =>
                          typeof camId === 'string' &&
                          devicesByKind(id, 'camera').some((c) => c.id === camId),
                  )
                : [];
            const strategy = normalizeStrategy(
                {
                    ...legacyStrategy,
                    approachCameraId:
                        (typeof legacyStrategy.approachCameraId === 'string' &&
                        legacyStrategy.approachCameraId
                            ? legacyStrategy.approachCameraId
                            : '') ||
                        legacyApproach ||
                        legacyCams[0] ||
                        '',
                    oppositeCameraId:
                        (typeof legacyStrategy.oppositeCameraId === 'string' &&
                        legacyStrategy.oppositeCameraId
                            ? legacyStrategy.oppositeCameraId
                            : '') ||
                        legacyOpposite ||
                        legacyCams[1] ||
                        '',
                },
                layout,
                id,
            );
            let steps = Array.isArray(cfg.steps) ? (cfg.steps as WbmFlowStep[]) : [];
            const rawAdvEarly =
                cfg.advanced && typeof cfg.advanced === 'object'
                    ? (cfg.advanced as Record<string, WbmAdvancedByStep>)
                    : {};
            // 旧道闸控制（含抬杆/落杆/无参数）→ 抬杆 / 落杆独立子流程
            steps = migrateLegacyGateSteps(steps, rawAdvEarly);
            // 丢弃已下线的子流程（如车辆停放位置核验、异常放行控制已改为非流程配置）
            steps = steps.filter((s) => KNOWN_STEP_IDS.has(s.id));
            // 补齐后来改为必选的子流程（如计量抓拍）
            steps = ensureRequiredSteps(steps);
            // migrate old step names if empty but configured
            if (!steps.length && cfg.layoutConfigured) {
                steps = buildDefaultSteps(strategy, layout);
            }
            // 旧配置无 phase 字段：按子流程默认大类回落，并按三大类分段
            steps = sortStepsByPhase(
                steps.map((s) => ({
                    ...s,
                    uid: s.uid || createStepUid(s.id),
                    phase: stepPhase(s),
                })),
            );
            const rawAdv = rawAdvEarly;
            const advanced: Record<string, WbmAdvancedByStep> = {};
            for (const s of steps) {
                let adv: WbmAdvancedByStep;
                if (rawAdv[s.uid]) {
                    adv = rawAdv[s.uid];
                } else if (rawAdv[s.id]) {
                    // 旧版按类型合并存储 → 每个实例克隆一份，可再各自改
                    adv = structuredClone(rawAdv[s.id]);
                } else {
                    adv = createStepAdvanced(s.id, {
                        alightMethod: strategy.alightMethod,
                        moduleId: id,
                    });
                }
                advanced[s.uid] = normalizeStepAdvanced(s.id, adv, {
                    alightMethod: strategy.alightMethod,
                });
            }
            out[id] = {
                moduleId: id,
                layoutConfigured: !!cfg.layoutConfigured && steps.length > 0,
                layoutSaved: !!(cfg.layoutSaved ?? cfg.layoutConfigured),
                status: cfg.layoutConfigured && steps.length ? 'draft' : 'empty',
                layout,
                strategy,
                steps,
                basic: { ...createDefaultBasic(), ...(cfg.basic as object) },
                advanced,
                nonFlow: normalizeNonFlowValues(cfg.nonFlow as Partial<NonFlowValues> | undefined),
                basicTouched: Array.isArray(cfg.basicTouched) ? (cfg.basicTouched as string[]) : [],
                updatedAt: typeof cfg.updatedAt === 'string' ? cfg.updatedAt : undefined,
            };
        }
        saveWbmConfigs(out);
        return out;
    } catch {
        return {};
    }
}

export function saveWbmConfigs(map: Record<string, WbmModuleConfig>) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getStepSchema(stepId: StepId): StepParamSchema | undefined {
    return STEP_PARAM_SCHEMAS.find((s) => s.stepId === stepId);
}

export function isStepInFlow(steps: WbmFlowStep[], id: StepId): boolean {
    return steps.some((s) => s.id === id);
}

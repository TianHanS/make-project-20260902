/** AER 自动入厂 · 数据模型与 mock */

export type ModuleType = 'AER' | 'WBM' | 'VE' | 'TRA' | 'SG';

export interface ModuleItem {
    id: string;
    name: string;
    code: string;
    type: ModuleType;
    typeName: string;
}

export type SubProcessCode = 'carIdentify' | 'register' | 'BarrierControl' | 'reset';

export interface SubProcessDef {
    code: SubProcessCode;
    name: string;
    description: string;
}

export interface NotifyBlock {
    enabled: boolean;
    led: string;
    voice: string;
}

export interface CarIdentifyParams {
    method: '1' | '2' | '3' | '4';
    notify: NotifyBlock;
}

export interface RegisterParams {
    type: '1' | '2' | '3';
    enterPointName: string;
    notifySuccess: NotifyBlock;
    notifyFail: NotifyBlock;
    notifyDirectSuccess: NotifyBlock;
    notifyDirectFail: NotifyBlock;
}

export interface BarrierParams {
    control: '1' | '2';
}

export interface ResetParams {
    requireProcess: '0' | '1';
    waitTime: number;
    skipWait: '0' | '1';
    barrierControl: '0' | '1' | '2';
    notify: NotifyBlock;
}

export type StepParams = CarIdentifyParams | RegisterParams | BarrierParams | ResetParams;

export interface FlowStep {
    instanceId: string;
    code: SubProcessCode;
    /** 手动添加且未打开过配参 */
    needsConfirm: boolean;
    /** 来自快速场景且未再手动改过标记 */
    fromScene: boolean;
    params: StepParams;
}

export interface ModuleFlowConfig {
    moduleId: string;
    steps: FlowStep[];
    updatedAt?: string;
}

export const SUB_PROCESS_DEFS: SubProcessDef[] = [
    {
        code: 'carIdentify',
        name: '车辆识别',
        description: '获取现场安装设备识别的车辆信息，这些信息可以是车牌识别器、车辆读卡器、二维码识别装置等装置',
    },
    {
        code: 'register',
        name: '登记',
        description: '对识别的车辆进行入厂登记，可对煤车、非煤物资车、粉煤灰固废车辆进行入厂登记',
    },
    {
        code: 'BarrierControl',
        name: '道闸控制',
        description: '控制拦车器的方法',
    },
    {
        code: 'reset',
        name: '现场复位',
        description: '一般在完成流程后，设定现场的通知时长等参数，以确保信息通知到位，现场设备恢复待入厂状态',
    },
];

export const METHOD_OPTIONS = [
    { value: '1', label: '车牌' },
    { value: '2', label: '卡号' },
    { value: '3', label: '云驿二维码' },
    { value: '4', label: '兼容模式（二维码→卡→车牌）' },
];

export const REGISTER_TYPE_OPTIONS = [
    { value: '1', label: '煤/非煤物资' },
    { value: '2', label: '粉煤灰固废' },
    { value: '3', label: '自动登记（先查预登记）' },
];

export const BARRIER_OPTIONS = [
    { value: '1', label: '抬杆' },
    { value: '2', label: '落杆' },
];

export const RESET_BARRIER_OPTIONS = [
    { value: '0', label: '无' },
    { value: '1', label: '抬杆' },
    { value: '2', label: '落杆' },
];

export const YES_NO = [
    { value: '0', label: '否' },
    { value: '1', label: '是' },
];

let stepSeq = 0;
export function nextStepId() {
    return `step-${Date.now()}-${++stepSeq}`;
}

export function defaultNotify(led = '', voice = ''): NotifyBlock {
    return { enabled: true, led, voice };
}

export function defaultParams(code: SubProcessCode): StepParams {
    switch (code) {
        case 'carIdentify':
            return {
                method: '1',
                notify: defaultNotify('请稍候，正在登记…', '请稍候，正在登记'),
            } satisfies CarIdentifyParams;
        case 'register':
            return {
                type: '1',
                enterPointName: '',
                notifySuccess: defaultNotify('登记成功，请通行', '登记成功，请通行'),
                notifyFail: defaultNotify('登记失败，请联系管理员', '登记失败，请联系管理员'),
                notifyDirectSuccess: defaultNotify('通行成功', '通行成功'),
                notifyDirectFail: defaultNotify('通行失败', '通行失败'),
            } satisfies RegisterParams;
        case 'BarrierControl':
            return { control: '1' } satisfies BarrierParams;
        case 'reset':
            return {
                requireProcess: '1',
                waitTime: 15,
                skipWait: '1',
                barrierControl: '0',
                notify: defaultNotify('现场已复位，请下一辆车入厂', '现场已复位'),
            } satisfies ResetParams;
    }
}

/** 标准自动入厂流程预制 */
export function buildStandardSceneSteps(): FlowStep[] {
    const car = defaultParams('carIdentify') as CarIdentifyParams;
    car.method = '1';

    const reg = defaultParams('register') as RegisterParams;
    reg.type = '1';
    reg.enterPointName = '南门发卡室';

    const barrier = defaultParams('BarrierControl') as BarrierParams;
    barrier.control = '1';

    const reset = defaultParams('reset') as ResetParams;
    reset.waitTime = 15;
    reset.skipWait = '1';
    reset.barrierControl = '0';

    return [
        { instanceId: nextStepId(), code: 'carIdentify', needsConfirm: false, fromScene: true, params: car },
        { instanceId: nextStepId(), code: 'register', needsConfirm: false, fromScene: true, params: reg },
        { instanceId: nextStepId(), code: 'BarrierControl', needsConfirm: false, fromScene: true, params: barrier },
        { instanceId: nextStepId(), code: 'reset', needsConfirm: false, fromScene: true, params: reset },
    ];
}

export function defByCode(code: SubProcessCode) {
    return SUB_PROCESS_DEFS.find((d) => d.code === code)!;
}

export const INITIAL_MODULES: ModuleItem[] = [
    { id: 'm-ve9', name: '南门入厂点（全自动入厂）', code: 'VE-9', type: 'AER', typeName: '自动入厂' },
    { id: 'm-ve2', name: '南门入厂点（自助入厂）', code: 'VE-2', type: 'AER', typeName: '自动入厂' },
    { id: 'm-ve4', name: '出厂点（自动）', code: 'VE-4', type: 'AER', typeName: '自动入厂' },
    { id: 'm-ve10', name: '北门入厂点（全自动）', code: 'VE-10', type: 'AER', typeName: '自动入厂' },
    { id: 'm-wbm1', name: '1#汽车衡', code: 'WBM-1', type: 'WBM', typeName: '汽车计量' },
    { id: 'm-wbm2', name: '2#汽车衡', code: 'WBM-2', type: 'WBM', typeName: '汽车计量' },
    { id: 'm-ve1', name: '南门入厂点1', code: 'VE-1', type: 'VE', typeName: '汽车入厂点' },
    { id: 'm-tra1', name: '1#火车机械采样', code: 'TRA-1', type: 'TRA', typeName: '火车机械采样' },
    { id: 'm-sg1', name: '北门出厂点（管理员）', code: 'SG-1', type: 'SG', typeName: '汽车出厂点' },
];

export const MODULE_TYPE_FILTER_OPTIONS = [
    { value: '', label: '全部类型' },
    { value: 'AER', label: '自动入厂' },
    { value: 'WBM', label: '汽车计量' },
    { value: 'VE', label: '汽车入厂点' },
    { value: 'TRA', label: '火车机械采样' },
    { value: 'SG', label: '汽车出厂点' },
];

const STORAGE_KEY = 'ae-auto-entry-flow-configs-v1';

export function loadConfigs(): Record<string, ModuleFlowConfig> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw) as Record<string, ModuleFlowConfig>;
    } catch {
        return {};
    }
}

export function saveConfigs(map: Record<string, ModuleFlowConfig>) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function cloneSteps(steps: FlowStep[]): FlowStep[] {
    return steps.map((s) => ({
        ...s,
        instanceId: nextStepId(),
        params: structuredClone(s.params),
    }));
}

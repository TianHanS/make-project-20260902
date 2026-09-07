/** AER 自动入厂 · 场景表单版数据模型与 mock */

export type ModuleType = 'AER' | 'WBM' | 'VE' | 'TRA' | 'SG';

export interface ModuleItem {
    id: string;
    name: string;
    code: string;
    type: ModuleType;
    typeName: string;
}

export type RegisterType = '1' | '2' | '3';
export type BarrierAction = '1' | '2' | '3';
export type ResetBarrier = '0' | '1' | '2';
export type SceneSource = 'standard' | 'custom' | null;

export interface NotifyItem {
    enabled: boolean;
    text: string;
}

export interface FlowFormValues {
    registerType: RegisterType;
    enterPointName: string;
    identifyNotify: NotifyItem;
    coalSuccessNotify: NotifyItem;
    coalFailNotify: NotifyItem;
    ashSuccessNotify: NotifyItem;
    ashFailNotify: NotifyItem;
    barrierControl: BarrierAction;
    resetWaitSeconds: number;
    resetBarrierControl: ResetBarrier;
}

export interface ModuleFlowConfig {
    moduleId: string;
    sceneSource: SceneSource;
    values: FlowFormValues;
    updatedAt?: string;
}

export const REGISTER_TYPE_OPTIONS = [
    { value: '1', label: '来煤、非煤物资' },
    { value: '2', label: '固废粉煤灰' },
    { value: '3', label: '自动登记' },
];

export const ENTER_POINT_OPTIONS = [
    { value: '南门发卡室', label: '南门发卡室' },
    { value: '南门入厂点', label: '南门入厂点' },
    { value: '北门入厂点', label: '北门入厂点' },
    { value: '固废登记点', label: '固废登记点' },
    { value: '出厂点（自动）', label: '出厂点（自动）' },
];

export const BARRIER_OPTIONS = [
    { value: '1', label: '抬杆' },
    { value: '2', label: '落杆' },
    { value: '3', label: '无' },
];

export const RESET_BARRIER_OPTIONS = [
    { value: '0', label: '无' },
    { value: '1', label: '抬杆' },
    { value: '2', label: '落杆' },
];

export function defaultNotify(text: string, enabled = true): NotifyItem {
    return { enabled, text };
}

export function createDefaultFormValues(): FlowFormValues {
    return {
        registerType: '1',
        enterPointName: '',
        identifyNotify: defaultNotify('请上磅识别'),
        coalSuccessNotify: defaultNotify('登记成功，请通行'),
        coalFailNotify: defaultNotify('登记失败，请联系管理员'),
        ashSuccessNotify: defaultNotify('固废登记成功，请通行'),
        ashFailNotify: defaultNotify('固废登记失败，请联系管理员'),
        barrierControl: '1',
        resetWaitSeconds: 15,
        resetBarrierControl: '0',
    };
}

/** 标准自动入厂场景预制值 */
export function createStandardSceneValues(): FlowFormValues {
    return {
        ...createDefaultFormValues(),
        registerType: '1',
        enterPointName: '南门发卡室',
        barrierControl: '1',
        resetWaitSeconds: 15,
        resetBarrierControl: '0',
    };
}

export interface SceneOption {
    id: 'standard';
    name: string;
    description: string;
    build: () => FlowFormValues;
}

export const SCENE_OPTIONS: SceneOption[] = [
    {
        id: 'standard',
        name: '标准自动入厂',
        description: '根据读取的车辆信息，自动进行来煤、非煤入厂登记，并放行抬杆',
        build: createStandardSceneValues,
    },
];

export const FLOW_STEPS = [
    { id: 'identify', title: '车辆识别', desc: '读取车辆信息并通知' },
    { id: 'register', title: '登记', desc: '入厂登记与结果通知' },
    { id: 'release', title: '车辆放行', desc: '道闸控制放行' },
    { id: 'reset', title: '现场复位还原', desc: '通知保留后复位' },
] as const;

export type FlowStepId = (typeof FLOW_STEPS)[number]['id'];

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

const STORAGE_KEY = 'aef-auto-entry-form-configs-v1';

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

export function cloneConfig(cfg: ModuleFlowConfig, targetModuleId: string): ModuleFlowConfig {
    return {
        moduleId: targetModuleId,
        sceneSource: cfg.sceneSource,
        values: structuredClone(cfg.values),
        updatedAt: new Date().toISOString(),
    };
}

export function hasSavedConfig(cfg?: ModuleFlowConfig | null): boolean {
    return !!cfg?.values?.enterPointName;
}

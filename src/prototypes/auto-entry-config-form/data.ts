/** AER 自动入厂 · 场景表单版数据模型与 mock */

export type ModuleType = 'AER' | 'WBM' | 'VE' | 'TRA' | 'BIB' | 'SG';

export type ModuleCategory = 'all' | 'gate' | 'weigh' | 'mechSample' | 'beltSample';

export interface ModuleItem {
    id: string;
    name: string;
    code: string;
    type: ModuleType;
    typeName: string;
}

export type BarrierAction = '1' | '2' | '3';
export type ResetBarrier = '0' | '1' | '2';
export type SceneSource = 'standard' | 'custom' | null;

/** 消息通知：广播 / LED 各自「是否启用 + 内容」；未启用或内容为空则不推送该通道 */
export interface NotifyItem {
    broadcastEnabled: boolean;
    broadcast: string;
    ledEnabled: boolean;
    led: string;
}

export interface FlowFormValues {
    /** 是否含固废：true=启用(1)，false=禁用(0，默认) */
    includeAsh: boolean;
    /** 固废请求 IP 端口；仅「是否含固废」启用时使用 */
    ashRequestIpPort: string;
    /** 关联入厂点名（下拉单选） */
    enterPointName: string;
    /** 车辆识别 · 识别结果通知 */
    identifyNotify: NotifyItem;
    coalSuccessNotify: NotifyItem;
    coalFailNotify: NotifyItem;
    ashSuccessNotify: NotifyItem;
    ashFailNotify: NotifyItem;
    barrierControl: BarrierAction;
    resetWaitSeconds: number;
    resetBarrierControl: ResetBarrier;
    /** 现场还原复位 · 复位消息设定 */
    resetNotify: NotifyItem;
}

export interface ModuleFlowConfig {
    moduleId: string;
    sceneSource: SceneSource;
    values: FlowFormValues;
    updatedAt?: string;
}

export const ENTER_POINT_OPTIONS = [
    { value: '南门发卡室', label: '南门发卡室' },
    { value: '南门入厂点1', label: '南门入厂点1' },
    { value: '北门入厂点', label: '北门入厂点' },
    { value: '西门入厂点', label: '西门入厂点' },
    { value: '东门入厂点', label: '东门入厂点' },
];

/** 入厂点仅一条时默认赋唯一值；否则保留 current（若仍在列表中） */
export function resolveEnterPointName(
    options: Array<{ value: string; label: string }> = ENTER_POINT_OPTIONS,
    current = '',
): string {
    if (options.length === 1) return options[0].value;
    if (current && options.some((o) => o.value === current)) return current;
    return '';
}

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

export function defaultNotify(led: string, broadcast?: string, enabled = true): NotifyItem {
    return {
        broadcastEnabled: enabled,
        broadcast: broadcast ?? led,
        ledEnabled: enabled,
        led,
    };
}

export function createDefaultFormValues(): FlowFormValues {
    return {
        includeAsh: false,
        ashRequestIpPort: '',
        enterPointName: resolveEnterPointName(ENTER_POINT_OPTIONS),
        identifyNotify: defaultNotify('{车牌号} 正在登记...'),
        coalSuccessNotify: defaultNotify(
            '{车牌号} {采样位} {过衡位}  登记成功',
            '{车牌号} 登记成功，请入厂',
        ),
        coalFailNotify: defaultNotify(
            '{车牌号} 登记失败，请联系管理员',
            '{车牌号} 登记失败，请联系管理员',
        ),
        ashSuccessNotify: defaultNotify('{车牌号} 登记成功 请入厂', '{车牌号} 登记成功，请入厂'),
        ashFailNotify: defaultNotify(
            '{车牌号} 登记失败，请联系管理员',
            '{车牌号} 登记失败，请联系管理员',
        ),
        barrierControl: '1',
        resetWaitSeconds: 15,
        resetBarrierControl: '0',
        resetNotify: defaultNotify('排队登记 有序入厂'),
    };
}

/** 标准自动入厂场景预制值 */
export function createStandardSceneValues(): FlowFormValues {
    const base = createDefaultFormValues();
    return {
        ...base,
        includeAsh: false,
        ashRequestIpPort: '',
        enterPointName: resolveEnterPointName(ENTER_POINT_OPTIONS, '南门发卡室'),
        barrierControl: '1',
        resetWaitSeconds: 15,
        resetBarrierControl: '0',
    };
}

/** 兼容旧数据：registerTypes 含 ash / 旧单选值 → includeAsh */
function normalizeIncludeAsh(raw: unknown, legacyRegisterTypes: unknown): boolean {
    if (typeof raw === 'boolean') return raw;
    if (raw === 1 || raw === '1') return true;
    if (raw === 0 || raw === '0') return false;
    if (Array.isArray(legacyRegisterTypes) && legacyRegisterTypes.includes('ash')) return true;
    if (legacyRegisterTypes === '2' || legacyRegisterTypes === '3') return true;
    return false;
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

export const MESSAGE_PLACEHOLDERS = [
    { key: '来煤日期', token: '{来煤日期}' },
    { key: '车牌号', token: '{车牌号}' },
    { key: '流水号', token: '{流水号}' },
    { key: '卸煤区', token: '{卸煤区}' },
    { key: '采样位', token: '{采样位}' },
    { key: '过衡位', token: '{过衡位}' },
    { key: '平台消息', token: '{平台消息}' },
    { key: '换行', token: '{/n/}' },
] as const;

export const FLOW_STEPS = [
    { id: 'identify', title: '车辆识别', desc: '识别结果通知' },
    { id: 'register', title: '登记', desc: '入厂登记与结果通知' },
    { id: 'release', title: '道闸控制', desc: '抬杆 / 落杆 / 无' },
    { id: 'reset', title: '现场复位还原', desc: '等待复位与消息设定' },
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
    { id: 'm-tra2', name: '2#火车机械采样', code: 'TRA-2', type: 'TRA', typeName: '火车机械采样' },
    { id: 'm-bib1', name: '6A入炉采样机', code: 'BIB-1', type: 'BIB', typeName: '入炉皮带采样' },
    { id: 'm-bib2', name: '6B入炉采样机', code: 'BIB-2', type: 'BIB', typeName: '入炉皮带采样' },
    { id: 'm-sg1', name: '北门出厂点（管理员）', code: 'SG-1', type: 'SG', typeName: '汽车出厂点' },
];

export const MODULE_TYPE_FILTER_OPTIONS = [
    { value: '', label: '全部类型' },
    { value: 'AER', label: '自动入厂' },
    { value: 'WBM', label: '汽车计量' },
    { value: 'VE', label: '汽车入厂点' },
    { value: 'TRA', label: '火车机械采样' },
    { value: 'BIB', label: '入炉皮带采样' },
    { value: 'SG', label: '汽车出厂点' },
];

/** 顶层业务分类 Tab */
export const MODULE_CATEGORY_TABS: Array<{
    id: ModuleCategory;
    label: string;
    types: ModuleType[] | null;
}> = [
    { id: 'all', label: '全部', types: null },
    { id: 'gate', label: '出入厂', types: ['AER', 'VE', 'SG'] },
    { id: 'weigh', label: '计量', types: ['WBM'] },
    { id: 'mechSample', label: '机械采样', types: ['TRA'] },
    { id: 'beltSample', label: '皮带采样', types: ['BIB'] },
];

export function moduleMatchesCategory(module: ModuleItem, category: ModuleCategory): boolean {
    const tab = MODULE_CATEGORY_TABS.find((t) => t.id === category);
    if (!tab || !tab.types) return true;
    return tab.types.includes(module.type);
}

const STORAGE_KEY = 'aef-auto-entry-form-configs-v6';

function normalizeNotify(raw: unknown, fallback: NotifyItem): NotifyItem {
    if (!raw || typeof raw !== 'object') return { ...fallback };
    const o = raw as Record<string, unknown>;
    const legacyText = typeof o.text === 'string' ? o.text : '';
    /** 旧版共用 `enabled` → 广播 / LED 同启同停 */
    const legacyEnabled = typeof o.enabled === 'boolean' ? o.enabled : undefined;
    return {
        broadcastEnabled:
            typeof o.broadcastEnabled === 'boolean'
                ? o.broadcastEnabled
                : legacyEnabled ?? fallback.broadcastEnabled,
        broadcast:
            typeof o.broadcast === 'string'
                ? o.broadcast
                : legacyText || fallback.broadcast,
        ledEnabled:
            typeof o.ledEnabled === 'boolean' ? o.ledEnabled : legacyEnabled ?? fallback.ledEnabled,
        led: typeof o.led === 'string' ? o.led : legacyText || fallback.led,
    };
}

function normalizeValues(raw: unknown): FlowFormValues {
    const defaults = createDefaultFormValues();
    if (!raw || typeof raw !== 'object') return defaults;
    const v = raw as Record<string, unknown>;
    const enterPointName = typeof v.enterPointName === 'string' ? v.enterPointName : '';
    const legacyTypes = v.registerTypes ?? v.registerType;
    const includeAsh = normalizeIncludeAsh(v.includeAsh, legacyTypes);
    return {
        includeAsh,
        ashRequestIpPort: includeAsh
            ? typeof v.ashRequestIpPort === 'string'
                ? v.ashRequestIpPort.trim()
                : ''
            : '',
        enterPointName: resolveEnterPointName(ENTER_POINT_OPTIONS, enterPointName),
        identifyNotify: normalizeNotify(v.identifyNotify, defaults.identifyNotify),
        coalSuccessNotify: normalizeNotify(v.coalSuccessNotify, defaults.coalSuccessNotify),
        coalFailNotify: normalizeNotify(v.coalFailNotify, defaults.coalFailNotify),
        ashSuccessNotify: normalizeNotify(v.ashSuccessNotify, defaults.ashSuccessNotify),
        ashFailNotify: normalizeNotify(v.ashFailNotify, defaults.ashFailNotify),
        barrierControl:
            v.barrierControl === '1' || v.barrierControl === '2' || v.barrierControl === '3'
                ? v.barrierControl
                : defaults.barrierControl,
        resetWaitSeconds:
            typeof v.resetWaitSeconds === 'number' && Number.isFinite(v.resetWaitSeconds)
                ? Math.max(0, Math.floor(v.resetWaitSeconds))
                : defaults.resetWaitSeconds,
        resetBarrierControl:
            v.resetBarrierControl === '0' ||
            v.resetBarrierControl === '1' ||
            v.resetBarrierControl === '2'
                ? v.resetBarrierControl
                : defaults.resetBarrierControl,
        resetNotify: normalizeNotify(v.resetNotify, defaults.resetNotify),
    };
}

export function loadConfigs(): Record<string, ModuleFlowConfig> {
    try {
        const raw =
            localStorage.getItem(STORAGE_KEY) ||
            localStorage.getItem('aef-auto-entry-form-configs-v4') ||
            localStorage.getItem('aef-auto-entry-form-configs-v3') ||
            localStorage.getItem('aef-auto-entry-form-configs-v2') ||
            localStorage.getItem('aef-auto-entry-form-configs-v1');
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, ModuleFlowConfig>;
        const out: Record<string, ModuleFlowConfig> = {};
        for (const [id, cfg] of Object.entries(parsed)) {
            out[id] = {
                ...cfg,
                values: normalizeValues(cfg.values),
            };
        }
        saveConfigs(out);
        return out;
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

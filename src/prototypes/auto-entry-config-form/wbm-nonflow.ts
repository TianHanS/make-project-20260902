/** 非流程参数配置 · 对齐《自动化流程配置项-2609》【2.4】非流程配置项「自动取值规则」 */

export type NonFlowFieldType =
    | 'bool'
    | 'select'
    | 'radio'
    /** 多选：取值以英文逗号连接存储，如 "1,2" */
    | 'multi'
    | 'text'
    | 'number'
    | 'time'
    | 'notifyPair';

export interface NonFlowField {
    key: string;
    label: string;
    type: NonFlowFieldType;
    unit?: string;
    /** 配置项说明，显示在标签下方 */
    hint?: string;
    options?: Array<{ value: string; label: string }>;
    /** 选项收敛为某个多选字段已勾选的取值 */
    optionsLimitedBy?: string;
    /** 同组字段在卡片内合并为一个带小标题的子块 */
    group?: string;
    defaultValue?: string | number | boolean;
    /** 成对消息：广播/LED */
    notifyKeys?: { ledEnabled: string; broadcastEnabled: string; led: string; broadcast: string };
    ledEnabledDefault?: boolean;
    broadcastEnabledDefault?: boolean;
    ledDefault?: string;
    broadcastDefault?: string;
    /** 依赖其它字段显示 */
    visibleWhen?: { key: string; equals: string | number | boolean };
    /** 依赖某个多选字段是否勾选了指定取值 */
    visibleWhenIncludes?: { key: string; value: string };
}

export interface NonFlowSection {
    id: string;
    title: string;
    /** 分类说明，展示在子标题下方 */
    description?: string;
    fields: NonFlowField[];
}

/** 变更默认值时递增，用于丢弃旧本地缓存中的过期默认 */
export const NON_FLOW_SCHEMA_VERSION = 11;

const GATE_OPTS = [
    { value: '1', label: '抬杆' },
    { value: '2', label: '落杆' },
    { value: '3', label: '不控制' },
];

const EXC_DIR_OPTS = [
    { value: '1', label: '进车方向' },
    { value: '2', label: '进车对向' },
    { value: '3', label: '入厂方向' },
    { value: '4', label: '出厂方向' },
];

const SWITCH_ENABLE_OPTS = [
    { value: '1', label: '启用' },
    { value: '2', label: '不启用' },
];

const SUPPORT_MODE_OPTS = [
    { value: '1', label: '重衡' },
    { value: '2', label: '轻衡' },
    { value: '3', label: '混用衡' },
];

function notifyPair(
    key: string,
    label: string,
    opts: {
        ledEnabledDefault?: boolean;
        broadcastEnabledDefault?: boolean;
        ledDefault: string;
        broadcastDefault: string;
    },
): NonFlowField {
    return {
        key,
        label,
        type: 'notifyPair',
        notifyKeys: {
            ledEnabled: `${key}_ledEnabled`,
            broadcastEnabled: `${key}_broadcastEnabled`,
            led: `${key}_led`,
            broadcast: `${key}_broadcast`,
        },
        ledEnabledDefault: opts.ledEnabledDefault ?? true,
        broadcastEnabledDefault: opts.broadcastEnabledDefault ?? true,
        ledDefault: opts.ledDefault,
        broadcastDefault: opts.broadcastDefault,
    };
}

const START_NOTIFY = {
    ledEnabledDefault: true,
    broadcastEnabledDefault: true,
    ledDefault: '排队等待 有序上磅',
    broadcastDefault: '计量系统已启动',
};

const EXIT_NOTIFY = {
    ledEnabledDefault: true,
    broadcastEnabledDefault: true,
    ledDefault: '禁止上磅',
    broadcastDefault: '计量已停止',
};

export const NON_FLOW_SECTIONS: NonFlowSection[] = [
    {
        id: 'parkPosition',
        title: '车辆停放位置核验',
        description: '通过红外对射保证车辆停放位置未超出衡器悬空',
        fields: [
            {
                key: 'PARK_irDetectCount',
                label: '红外对射检测次数',
                type: 'number',
                unit: '次',
                defaultValue: 3,
            },
            {
                key: 'PARK_irDetectIntervalMs',
                label: '红外对射检测间隔',
                type: 'number',
                unit: '毫秒',
                defaultValue: 1000,
            },
            notifyPair('parkFrontLimitNotify', '前限位超出提示', {
                ledEnabledDefault: false,
                broadcastEnabledDefault: true,
                ledDefault: '前限位遮挡，请司机调整车位',
                broadcastDefault: '前限位遮挡，请司机调整车位',
            }),
            notifyPair('parkRearLimitNotify', '后限位超出提示', {
                ledEnabledDefault: false,
                broadcastEnabledDefault: true,
                ledDefault: '后限位遮挡，请司机调整车位',
                broadcastDefault: '后限位遮挡，请司机调整车位',
            }),
        ],
    },
    {
        id: 'excPass',
        title: '异常结束放行',
        description: '出现异常时，若放行车辆离场，车辆从哪边离场',
        fields: [
            {
                key: 'BARRIER_excLiftDir',
                label: '异常时抬闸放行方向',
                type: 'select',
                options: EXC_DIR_OPTS,
                defaultValue: '4',
            },
        ],
    },
    {
        id: 'startSetting',
        title: '启动计量设定',
        description: '启动自动计量程序时，现场的道闸、LED等装置如何布置',
        fields: [
            {
                key: 'BARRIER_startIn',
                label: '启动时进道闸状态',
                type: 'select',
                options: GATE_OPTS,
                defaultValue: '2',
            },
            {
                key: 'BARRIER_startOut',
                label: '启动时出道闸状态',
                type: 'select',
                options: GATE_OPTS,
                defaultValue: '2',
            },
            notifyPair('startNotify', '启动消息设定', START_NOTIFY),
        ],
    },
    {
        id: 'exitSetting',
        title: '退出计量设定',
        description: '退出自动计量程序时，现场的道闸、LED等装置如何布置',
        fields: [
            {
                key: 'BARRIER_closeIn',
                label: '退出时进道闸状态',
                type: 'select',
                options: GATE_OPTS,
                defaultValue: '2',
            },
            {
                key: 'BARRIER_closeOut',
                label: '退出时出道闸状态',
                type: 'select',
                options: GATE_OPTS,
                defaultValue: '2',
            },
            notifyPair('exitNotify', '退出消息设定', EXIT_NOTIFY),
        ],
    },
    {
        id: 'schedule',
        title: '计量自动启停设定',
        description: '按时间点自动启停计量程序',
        fields: [
            {
                key: '10072',
                label: '是否启用定期启停',
                type: 'bool',
                defaultValue: false,
            },
            {
                key: '10073',
                label: '定期停止时间',
                type: 'time',
                defaultValue: '',
                visibleWhen: { key: '10072', equals: true },
            },
            {
                key: '10074',
                label: '定期启动时间',
                type: 'time',
                defaultValue: '',
                visibleWhen: { key: '10072', equals: true },
            },
        ],
    },
    {
        id: 'global',
        title: '全局设定',
        fields: [
            {
                key: '10006',
                label: '单步结束等待时间',
                type: 'number',
                unit: '毫秒',
                defaultValue: 0,
            },
            {
                key: '10007',
                label: '计量结束等待时间',
                type: 'number',
                unit: '毫秒',
                defaultValue: 0,
            },
        ],
    },
    {
        id: 'dynamicSwitch',
        title: '动态切换模式',
        fields: [
            {
                key: '10065',
                label: '是否启用模式切换',
                type: 'radio',
                hint: '是否启用重轻衡切换功能',
                options: SWITCH_ENABLE_OPTS,
                defaultValue: '2',
            },
            {
                key: '10065_modes',
                label: '支持模式',
                type: 'multi',
                options: SUPPORT_MODE_OPTS,
                defaultValue: '1,2',
                visibleWhen: { key: '10065', equals: '1' },
            },
            {
                key: '10066',
                label: '进道闸状态',
                type: 'select',
                group: '切换重衡时',
                options: GATE_OPTS,
                defaultValue: '2',
                visibleWhen: { key: '10065', equals: '1' },
                visibleWhenIncludes: { key: '10065_modes', value: '1' },
            },
            {
                key: '10067',
                label: '出道闸状态',
                type: 'select',
                group: '切换重衡时',
                options: GATE_OPTS,
                defaultValue: '3',
                visibleWhen: { key: '10065', equals: '1' },
                visibleWhenIncludes: { key: '10065_modes', value: '1' },
            },
            {
                key: '10068',
                label: '进道闸状态',
                type: 'select',
                group: '切换轻衡时',
                options: GATE_OPTS,
                defaultValue: '3',
                visibleWhen: { key: '10065', equals: '1' },
                visibleWhenIncludes: { key: '10065_modes', value: '2' },
            },
            {
                key: '10069',
                label: '出道闸状态',
                type: 'select',
                group: '切换轻衡时',
                options: GATE_OPTS,
                defaultValue: '3',
                visibleWhen: { key: '10065', equals: '1' },
                visibleWhenIncludes: { key: '10065_modes', value: '2' },
            },
            {
                key: 'BARRIER_switchMixIn',
                label: '进道闸状态',
                type: 'select',
                group: '切换混用衡时',
                options: GATE_OPTS,
                defaultValue: '3',
                visibleWhen: { key: '10065', equals: '1' },
                visibleWhenIncludes: { key: '10065_modes', value: '3' },
            },
            {
                key: 'BARRIER_switchMixOut',
                label: '出道闸状态',
                type: 'select',
                group: '切换混用衡时',
                options: GATE_OPTS,
                defaultValue: '3',
                visibleWhen: { key: '10065', equals: '1' },
                visibleWhenIncludes: { key: '10065_modes', value: '3' },
            },
            {
                key: '10070',
                label: '切换衡器后LED发送指令',
                type: 'text',
                defaultValue: '已关闭 禁止计量',
                visibleWhen: { key: '10065', equals: '1' },
            },
            {
                key: '10071',
                label: '默认切换模式',
                type: 'select',
                options: SUPPORT_MODE_OPTS,
                optionsLimitedBy: '10065_modes',
                defaultValue: '1',
                visibleWhen: { key: '10065', equals: '1' },
            },
        ],
    },
];

export type NonFlowValues = Record<string, string | number | boolean>;

export function createDefaultNonFlowValues(): NonFlowValues {
    const out: NonFlowValues = { __nfv: NON_FLOW_SCHEMA_VERSION };
    for (const sec of NON_FLOW_SECTIONS) {
        for (const f of sec.fields) {
            if (f.type === 'notifyPair' && f.notifyKeys) {
                out[f.notifyKeys.ledEnabled] = f.ledEnabledDefault ?? true;
                out[f.notifyKeys.broadcastEnabled] = f.broadcastEnabledDefault ?? true;
                out[f.notifyKeys.led] = f.ledDefault ?? '';
                out[f.notifyKeys.broadcast] = f.broadcastDefault ?? '';
            } else if (f.defaultValue !== undefined) {
                out[f.key] = f.defaultValue;
            }
        }
    }
    return out;
}

/** 兼容旧存储；schema 版本变更时重置为最新自动取值默认 */
export function normalizeNonFlowValues(raw: Partial<NonFlowValues> | null | undefined): NonFlowValues {
    const base = createDefaultNonFlowValues();
    const ver = raw && typeof raw.__nfv === 'number' ? raw.__nfv : 0;
    if (ver !== NON_FLOW_SCHEMA_VERSION) {
        return base;
    }
    const out: NonFlowValues = { ...base, ...raw, __nfv: NON_FLOW_SCHEMA_VERSION };
    if (out['10071'] === 'heavy') out['10071'] = '1';
    if (out['10071'] === 'light') out['10071'] = '2';
    return out;
}

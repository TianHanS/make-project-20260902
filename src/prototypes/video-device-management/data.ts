/**
 * 设备管理业务域 · 数据模型、系统字典与 mock 数据
 *
 * 两类业务实体：CameraGroup / Camera
 * 国标设备不再单独建档，设备 ID 直接维护在摄像头上，表单下拉候选取自摄像头表已录入的值；
 * 流媒体服务地址不在平台维护，由部署文件下发（`DEPLOY_MEDIA_ADDRESS`）。
 * 全部实体均含审计字段（创建时间、创建人、更新时间、更新人），由"系统"写入。  */

/** 通用审计字段：仅系统写入，表单不可编辑 */
export interface AuditFields {
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
}

/** 摄像头分组：按需求不设启用字段 */
export interface CameraGroup extends AuditFields {
    id: string;
    name: string;
    parentId: string | null;
    sort: number;
    remark: string;
}

/** 接入方式：决定国标信息与网络接入信息的录入范围 */
export type AccessType = 'gb' | 'nonGb' | 'compat';

export const ACCESS_TYPE_DICT: DictItem[] = [
    { value: 'gb', label: '国标' },
    { value: 'nonGb', label: '非国标' },
    { value: 'compat', label: '兼容' },
];

/** 摄像头 = 业务台账 ∪ 通道信息；国标设备 ID 直接维护在摄像头上 */
export interface Camera extends AuditFields {
    id: string;
    name: string;
    groupId: string;
    /** 接入方式：国标只录国标信息，非国标只录网络接入 */
    accessType: AccessType;
    /** 国标设备 ID（20 位）；非国标接入时为空 */
    deviceId: string;
    channelId: string;
    channelNo: string;
    host: string;
    port: string;
    username: string;
    password: string;
    vendor: string;
    cameraType: string;
    sort: number;
    sn: string;
    mac: string;
    remark: string;
}

export interface DeviceDomainData {
    groups: CameraGroup[];
    cameras: Camera[];
}

/* ------------------------------------------------------------------ */
/* 摄像头表内已录入值：作为表单下拉候选                                 */
/* ------------------------------------------------------------------ */

export interface DeviceOption {
    deviceId: string;
    host: string;
    port: string;
    username: string;
    password: string;
    /** 已关联的摄像头路数 */
    count: number;
}

/** 按摄像头表内的设备 ID 去重汇总，供表单下拉选择既有国标设备 ID */
export function collectDeviceOptions(data: DeviceDomainData): DeviceOption[] {
    const map = new Map<string, DeviceOption>();
    data.cameras.forEach((camera) => {
        const key = camera.deviceId.trim();
        if (!key) return;
        const exist = map.get(key);
        if (exist) {
            exist.count += 1;
            exist.host = exist.host || camera.host;
            exist.username = exist.username || camera.username;
            exist.password = exist.password || camera.password;
            return;
        }
        map.set(key, {
            deviceId: key,
            host: camera.host,
            port: camera.port || '554',
            username: camera.username,
            password: camera.password,
            count: 1,
        });
    });
    return [...map.values()].sort((a, b) => a.deviceId.localeCompare(b.deviceId));
}

export interface HostOption {
    host: string;
    port: string;
    username: string;
    password: string;
    /** 使用该 IP 的摄像头路数 */
    count: number;
}

/** 摄像头表内已录入的 IP（唯一不重复），选中后带出端口与账号密码 */
export function collectHostOptions(data: DeviceDomainData): HostOption[] {
    const map = new Map<string, HostOption>();
    data.cameras.forEach((camera) => {
        const key = camera.host.trim();
        if (!key) return;
        const exist = map.get(key);
        if (exist) {
            exist.count += 1;
            exist.port = exist.port || camera.port;
            exist.username = exist.username || camera.username;
            exist.password = exist.password || camera.password;
            return;
        }
        map.set(key, {
            host: key,
            port: camera.port || '554',
            username: camera.username,
            password: camera.password,
            count: 1,
        });
    });
    return [...map.values()].sort((a, b) => b.count - a.count || a.host.localeCompare(b.host));
}

/* ------------------------------------------------------------------ */
/* 系统字典                                                            */
/* ------------------------------------------------------------------ */

export interface DictItem {
    value: string;
    label: string;
    /** 导入模板中的同义写法 */
    alias?: string[];
}

/** 字典：摄像头种类 */
export const CAMERA_TYPE_DICT: DictItem[] = [
    { value: 'gun', label: '枪机' },
    { value: 'dome', label: '球机' },
    { value: 'hemisphere', label: '半球机' },
    { value: 'panorama', label: '全景机' },
    { value: 'other', label: '其他' },
];

/** 字典：摄像头厂商（label 对齐导入模板填写口径） */
export const VENDOR_DICT: DictItem[] = [
    { value: 'hikvision', label: '海康', alias: ['海康威视', 'HIKVISION'] },
    { value: 'dahua', label: '大华', alias: ['浙江大华', 'DAHUA'] },
    { value: 'huawei', label: '华为', alias: ['HUAWEI'] },
    { value: 'v360', label: '360', alias: ['360智慧生活'] },
    { value: 'uniview', label: '宇视', alias: ['UNIVIEW'] },
    { value: 'tiandy', label: '天地伟业', alias: ['TIANDY'] },
    { value: 'other', label: '其他' },
];

/** 按导入模板中的文本匹配字典项（支持同义写法） */
export function dictByLabel(dict: DictItem[], text: string): DictItem | undefined {
    const target = String(text ?? '').trim();
    if (!target) return undefined;
    return dict.find(
        (item) => item.label === target || (item.alias || []).some((alias) => alias === target),
    );
}

/** 国标 20 位编码中常用的类型编码（3 位） */
export const GB_TYPE_CODE_DICT = [
    { value: '132', label: '132 网络摄像机' },
    { value: '131', label: '131 摄像机' },
    { value: '118', label: '118 NVR' },
    { value: '111', label: '111 DVR' },
    { value: '215', label: '215 业务分组' },
];

export function dictLabel(dict: DictItem[], value: string): string {
    return dict.find((item) => item.value === value)?.label || value || '—';
}

/* ------------------------------------------------------------------ */
/* 摄像头导入模板                                                      */
/* ------------------------------------------------------------------ */

/** 模板列顺序，与《摄像头数据导入模板.xlsx》一致；* 为必填、** 为按接入方式条件必填 */
export const IMPORT_COLUMNS = [
    '*摄像头名称',
    '*分组',
    '*种类',
    '接入方式',
    '**所属国标设备ID',
    '**国标通道号',
    '**通道号',
    '**摄像头IP',
    '**端口',
    '**账号',
    '**密码',
    '*厂商',
    'SN',
    'MAC',
    '备注',
];

/** 模板首行注意事项，与《摄像头数据导入模板.xlsx》一致 */
export const IMPORT_TEMPLATE_NOTICE = [
    '注意：',
    '1、带‘*’标记的是必填的字段，不填会导入失败。',
    '2、种类字段，填写 枪机、球机 二选一，必填。',
    '3、厂商字段，填写 海康、大华、华为、360，选其一填写。',
    '4、接入方式，填写 国标、非国标、兼容 三选一填写。',
    '5、国标接入 **所属国标设备ID、**国标通道号 必填；非国标接入  **通道号、**摄像头IP、**端口、**账号、**密码 必填。',
    '6、分组不存在将自动创建一级分组、存在则分配至对应分组下。',
].join('\n');

/** 导入抽屉内的导入说明 */
export const IMPORT_GUIDE = '下载模板并阅读模板中对导入数据填写要求，以保证数据导入成功。';

/* ------------------------------------------------------------------ */
/* 国标 20 位编码：8 中心 + 2 行业 + 3 类型 + 1 网络 + 6 序号            */
/* ------------------------------------------------------------------ */

export interface GbCodeSegments {
    center: string;
    industry: string;
    typeCode: string;
    net: string;
    seq: string;
}

export const GB_SEGMENT_META = [
    { key: 'center' as const, len: 8, label: '中心编码', hint: '前 6 位行政区划码 + 2 位中心编号' },
    { key: 'industry' as const, len: 2, label: '行业编码', hint: '行业分类，继承国标设备' },
    { key: 'typeCode' as const, len: 3, label: '类型编码', hint: '设备/通道类型' },
    { key: 'net' as const, len: 1, label: '网络标识', hint: '网络/域标识，继承国标设备' },
    { key: 'seq' as const, len: 6, label: '序号', hint: '000001~999999，不得为 000000' },
];

export const EMPTY_GB_SEGMENTS: GbCodeSegments = {
    center: '',
    industry: '',
    typeCode: '',
    net: '',
    seq: '',
};

/** 20 位编码拆分为各段；不足 20 位按顺序尽量填充 */
export function splitGbCode(code: string): GbCodeSegments {
    const digits = onlyDigits(code);
    let cursor = 0;
    const next = (len: number) => {
        const part = digits.slice(cursor, cursor + len);
        cursor += len;
        return part;
    };
    return {
        center: next(8),
        industry: next(2),
        typeCode: next(3),
        net: next(1),
        seq: next(6),
    };
}

export function joinGbCode(seg: GbCodeSegments): string {
    return `${seg.center}${seg.industry}${seg.typeCode}${seg.net}${seg.seq}`;
}

export function onlyDigits(value: string): string {
    return String(value ?? '').replace(/\D/g, '');
}

/** 取 6 位序号的后三位并去掉前导 0，作为逻辑通道号默认值 */
export function deriveChannelNo(channelId: string): string {
    const seq = splitGbCode(channelId).seq;
    if (!seq) return '';
    const trimmed = seq.slice(-3).replace(/^0+/, '');
    return trimmed || '0';
}

/** 收集平台已录入的段值，用于各段下拉候选 */
export function collectSegmentOptions(
    data: DeviceDomainData,
    key: keyof GbCodeSegments,
): string[] {
    const set = new Set<string>();
    const push = (code: string) => {
        const value = splitGbCode(code)[key];
        if (value) set.add(value);
    };
    data.cameras.forEach((item) => {
        push(item.deviceId);
        push(item.channelId);
    });
    if (key === 'typeCode') GB_TYPE_CODE_DICT.forEach((item) => set.add(item.value));
    return [...set].sort();
}

/* ------------------------------------------------------------------ */
/* 分组树工具                                                          */
/* ------------------------------------------------------------------ */

export interface GroupTreeNode extends CameraGroup {
    children: GroupTreeNode[];
    depth: number;
}

export function buildGroupTree(groups: CameraGroup[]): GroupTreeNode[] {
    const byParent = new Map<string, CameraGroup[]>();
    groups.forEach((group) => {
        const key = group.parentId || '__root__';
        const list = byParent.get(key) || [];
        list.push(group);
        byParent.set(key, list);
    });
    const walk = (parentKey: string, depth: number): GroupTreeNode[] =>
        (byParent.get(parentKey) || [])
            .slice()
            .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'zh-CN'))
            .map((group) => ({
                ...group,
                depth,
                children: walk(group.id, depth + 1),
            }));
    return walk('__root__', 0);
}

/** 目标分组及其全部子孙 id（用于阻止成环、统计含下级数量） */
export function collectSubtreeIds(groups: CameraGroup[], rootId: string): Set<string> {
    const ids = new Set<string>([rootId]);
    let grown = true;
    while (grown) {
        grown = false;
        groups.forEach((group) => {
            if (group.parentId && ids.has(group.parentId) && !ids.has(group.id)) {
                ids.add(group.id);
                grown = true;
            }
        });
    }
    return ids;
}

export function groupPathName(groups: CameraGroup[], groupId: string): string {
    const names: string[] = [];
    let cursor = groups.find((group) => group.id === groupId);
    let guard = 0;
    while (cursor && guard < 20) {
        names.unshift(cursor.name);
        cursor = cursor.parentId ? groups.find((group) => group.id === cursor!.parentId) : undefined;
        guard += 1;
    }
    return names.join(' / ') || '—';
}

export function groupName(groups: CameraGroup[], groupId: string): string {
    return groups.find((group) => group.id === groupId)?.name || '—';
}

/* ------------------------------------------------------------------ */
/* 取流地址派生（不落库，按厂商在代码中拼接 RTSP 路径）                  */
/* ------------------------------------------------------------------ */

/** RTSP 路径规则：按厂商字典值在代码中写死 */
export function rtspPathByVendor(vendor: string, channelNo: string): string {
    const no = channelNo || '1';
    switch (vendor) {
        case 'hikvision':
            return `/Streaming/Channels/${no}01`;
        case 'dahua':
            return `/cam/realmonitor?channel=${no}&subtype=0`;
        case 'uniview':
            return `/media/video${no}`;
        case 'huawei':
            return `/LiveMedia/ch${no}/Media1`;
        case 'tiandy':
            return `/video${no}`;
        case 'v360':
            return `/live/ch${no}`;
        default:
            return `/stream${no}`;
    }
}

export interface StreamUrls {
    flv: string;
    wsFlv: string;
    hls: string;
    rtsp: string;
}

/** 流媒体服务地址不在平台维护，由部署文件下发 */
export const DEPLOY_MEDIA_ADDRESS = '10.50.136.251:80';

export function buildStreamUrls(
    camera: Pick<
        Camera,
        'channelId' | 'channelNo' | 'host' | 'port' | 'username' | 'password' | 'vendor' | 'deviceId'
    >,
): StreamUrls {
    const addr = DEPLOY_MEDIA_ADDRESS;
    const deviceId = camera.deviceId || '—';
    const channelId = camera.channelId || '—';
    const stream = `${deviceId}_${channelId}`;
    const host = camera.host || '—';
    const port = camera.port || '554';
    const account = camera.username ? `${camera.username}:${camera.password || ''}@` : '';
    return {
        flv: `http://${addr}/rtp/${stream}.live.flv`,
        wsFlv: `ws://${addr}/rtp/${stream}.live.flv`,
        hls: `http://${addr}/rtp/${stream}/hls.m3u8`,
        rtsp: `rtsp://${account}${host}:${port}${rtspPathByVendor(camera.vendor, camera.channelNo)}`,
    };
}

/* ------------------------------------------------------------------ */
/* 审计与当前操作人                                                    */
/* ------------------------------------------------------------------ */

export const CURRENT_USER = '张运维';

export function nowStamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 新增：创建与更新审计同为当前操作 */
export function createAudit(): AuditFields {
    const at = nowStamp();
    return { createdAt: at, createdBy: CURRENT_USER, updatedAt: at, updatedBy: CURRENT_USER };
}

/** 更新：仅刷新更新信息，不改创建信息 */
export function touchAudit<T extends AuditFields>(entity: T): Pick<AuditFields, 'updatedAt' | 'updatedBy'> {
    void entity;
    return { updatedAt: nowStamp(), updatedBy: CURRENT_USER };
}

export function nextId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/* ------------------------------------------------------------------ */
/* mock 数据                                                           */
/* ------------------------------------------------------------------ */

const CENTER = '43010201';
const INDUSTRY = '49';
const NET = '0';

function deviceCode(seq: number): string {
    return `${CENTER}${INDUSTRY}118${NET}${String(seq).padStart(6, '0')}`;
}

function channelCode(seq: number): string {
    return `${CENTER}${INDUSTRY}132${NET}${String(seq).padStart(6, '0')}`;
}

function audit(created: string, createdBy: string, updated: string, updatedBy: string): AuditFields {
    return { createdAt: created, createdBy, updatedAt: updated, updatedBy };
}

function createSeedData(): DeviceDomainData {
    const groups: CameraGroup[] = [
        { id: 'g-plant', name: '厂区总览', parentId: null, sort: 1, remark: '一级分组', ...audit('2026-07-01 09:12:03', '系统管理员', '2026-07-01 09:12:03', '系统管理员') },
        { id: 'g-scale', name: '计量区域', parentId: 'g-plant', sort: 1, remark: '汽车衡、轨道衡', ...audit('2026-07-01 09:15:20', '系统管理员', '2026-08-12 10:02:41', '张运维') },
        { id: 'g-scale-in', name: '入厂衡', parentId: 'g-scale', sort: 1, remark: '', ...audit('2026-07-03 14:20:11', '张运维', '2026-07-03 14:20:11', '张运维') },
        { id: 'g-scale-out', name: '出厂衡', parentId: 'g-scale', sort: 2, remark: '', ...audit('2026-07-03 14:22:38', '张运维', '2026-07-03 14:22:38', '张运维') },
        { id: 'g-yard', name: '煤场区域', parentId: 'g-plant', sort: 2, remark: '干煤棚与露天煤场', ...audit('2026-07-01 09:18:44', '系统管理员', '2026-08-20 16:31:07', '张运维') },
        { id: 'g-unload', name: '卸煤沟', parentId: 'g-plant', sort: 3, remark: '', ...audit('2026-07-05 11:03:55', '张运维', '2026-07-05 11:03:55', '张运维') },
        { id: 'g-belt', name: '输煤系统', parentId: 'g-plant', sort: 4, remark: '皮带沿线', ...audit('2026-07-05 11:08:12', '张运维', '2026-09-01 08:44:19', '张运维') },
        { id: 'g-lab', name: '无人化实验室', parentId: null, sort: 2, remark: '制样、化验区域', ...audit('2026-07-08 15:40:26', '系统管理员', '2026-07-08 15:40:26', '系统管理员') },
    ];

    /** 演示用国标设备 ID：直接落在摄像头行上，不再单独建档 */
    const DEV = {
        nvr1: { id: deviceCode(1) },
        nvr2: { id: deviceCode(2) },
        gw1: { id: deviceCode(3) },
        ipc1: { id: deviceCode(4) },
    };

    const cameraSeed: Array<
        Pick<Camera, 'id' | 'name' | 'groupId' | 'vendor' | 'cameraType' | 'sort' | 'remark'> & {
            device: { id: string };
            seq: number;
            host: string;
            /** 缺省即国标接入 */
            access?: AccessType;
            createdAt: string;
            createdBy: string;
            updatedAt: string;
            updatedBy: string;
        }
    > = [
        { id: 'c-01', name: '1#汽车衡·车头枪机', groupId: 'g-scale-in', device: DEV.nvr1, vendor: 'hikvision', cameraType: 'gun', sort: 1, remark: '车牌识别辅助', seq: 1, host: '10.50.136.11', createdAt: '2026-07-02 11:02:14', createdBy: '张运维', updatedAt: '2026-09-05 10:18:22', updatedBy: '张运维' },
        { id: 'c-02', name: '1#汽车衡·车尾枪机', groupId: 'g-scale-in', device: DEV.nvr1, vendor: 'hikvision', cameraType: 'gun', sort: 2, remark: '', seq: 2, host: '10.50.136.11', createdAt: '2026-07-02 11:04:39', createdBy: '张运维', updatedAt: '2026-09-05 10:18:45', updatedBy: '张运维' },
        { id: 'c-03', name: '1#汽车衡·全景球机', groupId: 'g-scale-in', device: DEV.nvr1, vendor: 'hikvision', cameraType: 'dome', sort: 3, remark: '磅房全景', seq: 3, host: '10.50.136.11', createdAt: '2026-07-02 11:06:50', createdBy: '张运维', updatedAt: '2026-08-11 15:41:03', updatedBy: '系统管理员' },
        { id: 'c-04', name: '2#汽车衡·车头枪机', groupId: 'g-scale-out', device: DEV.nvr1, vendor: 'hikvision', cameraType: 'gun', sort: 1, remark: '', seq: 4, host: '10.50.136.11', createdAt: '2026-07-02 11:09:27', createdBy: '张运维', updatedAt: '2026-08-11 15:42:19', updatedBy: '系统管理员' },
        { id: 'c-05', name: '2#汽车衡·司机室半球', groupId: 'g-scale-out', device: DEV.nvr1, vendor: 'dahua', cameraType: 'hemisphere', sort: 2, remark: '设备维修中', seq: 5, host: '10.50.136.11', createdAt: '2026-07-02 11:12:08', createdBy: '张运维', updatedAt: '2026-09-08 09:02:41', updatedBy: '张运维' },
        { id: 'c-06', name: 'A煤场1区球机', groupId: 'g-yard', device: DEV.nvr2, vendor: 'dahua', cameraType: 'dome', sort: 1, remark: '堆取料机跟踪', seq: 11, host: '10.50.136.12', createdAt: '2026-07-04 09:31:52', createdBy: '张运维', updatedAt: '2026-08-25 14:12:33', updatedBy: '张运维' },
        { id: 'c-07', name: 'A煤场2区球机', groupId: 'g-yard', device: DEV.nvr2, vendor: 'dahua', cameraType: 'dome', sort: 2, remark: '', seq: 12, host: '10.50.136.12', createdAt: '2026-07-04 09:34:16', createdBy: '张运维', updatedAt: '2026-08-25 14:13:07', updatedBy: '张运维' },
        { id: 'c-08', name: 'B煤场全景机', groupId: 'g-yard', device: DEV.nvr2, vendor: 'uniview', cameraType: 'panorama', sort: 3, remark: '煤场盘煤辅助', seq: 13, host: '10.50.136.12', createdAt: '2026-07-04 09:38:44', createdBy: '张运维', updatedAt: '2026-09-03 16:50:28', updatedBy: '系统管理员' },
        { id: 'c-09', name: '卸煤沟1#枪机', groupId: 'g-unload', device: DEV.nvr2, vendor: 'hikvision', cameraType: 'gun', sort: 1, remark: '', seq: 14, host: '10.50.136.12', createdAt: '2026-07-06 10:15:03', createdBy: '张运维', updatedAt: '2026-08-19 11:28:56', updatedBy: '张运维' },
        { id: 'c-10', name: '卸煤沟2#枪机', groupId: 'g-unload', device: DEV.nvr2, vendor: 'hikvision', cameraType: 'gun', sort: 2, remark: '', seq: 15, host: '10.50.136.12', createdAt: '2026-07-06 10:17:41', createdBy: '张运维', updatedAt: '2026-08-19 11:29:22', updatedBy: '张运维' },
        { id: 'c-11', name: '输煤皮带1#转运站', groupId: 'g-belt', device: DEV.gw1, vendor: 'tiandy', cameraType: 'gun', sort: 1, remark: '网关代理接入', seq: 21, access: 'compat', host: '10.50.140.51', createdAt: '2026-07-11 14:02:35', createdBy: '张运维', updatedAt: '2026-09-04 09:15:48', updatedBy: '张运维' },
        { id: 'c-12', name: '输煤皮带2#转运站', groupId: 'g-belt', device: DEV.gw1, vendor: 'tiandy', cameraType: 'gun', sort: 2, remark: '网关代理接入', seq: 22, access: 'compat', host: '10.50.140.52', createdAt: '2026-07-11 14:05:19', createdBy: '张运维', updatedAt: '2026-09-04 09:16:12', updatedBy: '张运维' },
        { id: 'c-13', name: '碎煤机层球机', groupId: 'g-belt', device: DEV.gw1, vendor: 'huawei', cameraType: 'dome', sort: 3, remark: '', seq: 23, host: '10.50.140.53', createdAt: '2026-07-11 14:09:07', createdBy: '张运维', updatedAt: '2026-08-27 17:44:31', updatedBy: '系统管理员' },
        { id: 'c-14', name: '制样间全景机', groupId: 'g-lab', device: DEV.ipc1, vendor: 'hikvision', cameraType: 'panorama', sort: 1, remark: '非国标直连', seq: 31, access: 'nonGb', host: '10.50.137.31', createdAt: '2026-07-18 09:22:40', createdBy: '张运维', updatedAt: '2026-08-30 17:06:25', updatedBy: '系统管理员' },
    ];

    const cameras: Camera[] = cameraSeed.map((seed) => {
        const accessType: AccessType = seed.access || 'gb';
        /** 非国标接入不落国标信息，通道号按硬盘录像机实际通道录入 */
        const channelId = accessType === 'nonGb' ? '' : channelCode(seed.seq);
        return {
            id: seed.id,
            name: seed.name,
            groupId: seed.groupId,
            accessType,
            deviceId: accessType === 'nonGb' ? '' : seed.device.id,
            channelId,
            channelNo: channelId ? deriveChannelNo(channelId) : String(seed.seq % 100),
            host: seed.host,
            port: '554',
            username: 'admin',
            password: 'Admin@12345',
            vendor: seed.vendor,
            cameraType: seed.cameraType,
            sort: seed.sort,
            sn: `SN${String(seed.seq).padStart(8, '0')}`,
            mac: `00:1A:2B:${String(seed.seq).padStart(2, '0')}:C3:D4`,
            remark: seed.remark,
            createdAt: seed.createdAt,
            createdBy: seed.createdBy,
            updatedAt: seed.updatedAt,
            updatedBy: seed.updatedBy,
        };
    });

    return { groups, cameras };
}

const STORAGE_KEY = 'vdm-device-domain-v4';
/** 历史版本按新到旧排列，读取到即迁移，不再直接丢弃已维护的数据 */
const LEGACY_STORAGE_KEYS = ['vdm-device-domain-v3', 'vdm-device-domain-v2', 'vdm-device-domain-v1'];

/**
 * 旧摄像头数据迁移到新模型
 * - 接入方式：按国标设备 ID 与国标通道号是否齐全推断（都有为国标，都无为非国标，只有其一按兼容）
 * - 通道号：旧记录留空时按序号后三位补齐
 * - 设备名称、流媒体服务地址：字段下线，读取时丢弃
 */
export function migrateCamera(raw: Record<string, unknown>): Camera {
    const text = (key: string) => String(raw[key] ?? '').trim();
    const deviceId = onlyDigits(text('deviceId'));
    const channelId = onlyDigits(text('channelId'));
    const hasGbDevice = deviceId.length === 20;
    const hasGbChannel = channelId.length === 20;
    const stored = text('accessType');
    const accessType: AccessType = ACCESS_TYPE_DICT.some((item) => item.value === stored)
        ? (stored as AccessType)
        : hasGbDevice && hasGbChannel
          ? 'gb'
          : !hasGbDevice && !hasGbChannel
            ? 'nonGb'
            : 'compat';
    return {
        id: text('id') || nextId('cam'),
        name: text('name'),
        groupId: text('groupId'),
        accessType,
        deviceId: accessType === 'nonGb' ? '' : deviceId,
        channelId: accessType === 'nonGb' ? '' : channelId,
        channelNo: text('channelNo') || deriveChannelNo(channelId),
        host: text('host'),
        port: text('port') || '554',
        username: text('username'),
        password: text('password'),
        vendor: text('vendor'),
        cameraType: text('cameraType'),
        sort: Number(raw.sort) || 0,
        sn: text('sn'),
        mac: text('mac'),
        remark: text('remark'),
        createdAt: text('createdAt') || nowStamp(),
        createdBy: text('createdBy') || CURRENT_USER,
        updatedAt: text('updatedAt') || nowStamp(),
        updatedBy: text('updatedBy') || CURRENT_USER,
    };
}

function readStored(): Partial<DeviceDomainData> | null {
    for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw) as Partial<DeviceDomainData>;
    }
    return null;
}

export function loadDomainData(): DeviceDomainData {
    try {
        const parsed = readStored();
        const seed = createSeedData();
        if (!parsed) return seed;
        return {
            groups: parsed.groups?.length ? parsed.groups : seed.groups,
            cameras: parsed.cameras?.length
                ? parsed.cameras.map((camera) => migrateCamera(camera as unknown as Record<string, unknown>))
                : seed.cameras,
        };
    } catch {
        return createSeedData();
    }
}

export function saveDomainData(data: DeviceDomainData) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
        /* 预览环境忽略存储异常 */
    }
}

export function resetDomainData(): DeviceDomainData {
    const seed = createSeedData();
    saveDomainData(seed);
    return seed;
}

/* ------------------------------------------------------------------ */
/* 统计与校验                                                          */
/* ------------------------------------------------------------------ */

/** 分组下摄像头数量：本级 / 含下级 */
export function countCamerasByGroup(
    data: DeviceDomainData,
    groupId: string,
): { own: number; total: number } {
    const own = data.cameras.filter((camera) => camera.groupId === groupId).length;
    const subtree = collectSubtreeIds(data.groups, groupId);
    const total = data.cameras.filter((camera) => subtree.has(camera.groupId)).length;
    return { own, total };
}

export function isChannelIdTaken(data: DeviceDomainData, channelId: string, selfId?: string): boolean {
    if (onlyDigits(channelId).length !== 20) return false;
    return data.cameras.some((camera) => camera.channelId === channelId && camera.id !== selfId);
}

export function isGroupNameTaken(data: DeviceDomainData, name: string, selfId?: string): boolean {
    const target = name.trim();
    if (!target) return false;
    return data.groups.some((group) => group.name.trim() === target && group.id !== selfId);
}

export function isCameraNameTaken(data: DeviceDomainData, name: string, selfId?: string): boolean {
    const target = name.trim();
    if (!target) return false;
    return data.cameras.some((camera) => camera.name.trim() === target && camera.id !== selfId);
}

/** MAC 比较忽略大小写与分隔符，避免 00:1A:2B 与 001a2b 被当成两台设备 */
function normalizeMac(mac: string): string {
    return mac.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
}

/** SN 唯一性：留空不参与校验 */
export function isSnTaken(data: DeviceDomainData, sn: string, selfId?: string): boolean {
    const target = sn.trim().toUpperCase();
    if (!target) return false;
    return data.cameras.some((camera) => camera.sn.trim().toUpperCase() === target && camera.id !== selfId);
}

/** MAC 唯一性：留空不参与校验 */
export function isMacTaken(data: DeviceDomainData, mac: string, selfId?: string): boolean {
    const target = normalizeMac(mac);
    if (!target) return false;
    return data.cameras.some((camera) => normalizeMac(camera.mac) === target && camera.id !== selfId);
}

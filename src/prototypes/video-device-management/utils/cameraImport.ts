/**
 * 摄像头导入的校验与演示数据生成（纯逻辑，与 UI 无关）
 *
 * 原型不做真实文件解析：选择文件后按模板口径生成一批待确认数据，
 * 用于走通「导入结果确认 → 保存」流程；校验规则与表单一致。
 *
 * 异常原因文案固定三种口径，并定位到具体字段：
 * - `XX字段，必填字段为空`
 * - `XX字段，字段无效`
 * - `XX字段，不唯一`
 */
import {
    ACCESS_TYPE_DICT,
    AccessType,
    CAMERA_TYPE_DICT,
    Camera,
    CameraGroup,
    DeviceDomainData,
    VENDOR_DICT,
    collectDeviceOptions,
    createAudit,
    deriveChannelNo,
    dictByLabel,
    isCameraNameTaken,
    joinGbCode,
    nextId,
    onlyDigits,
    splitGbCode,
} from '../data';
import { isValidIp } from '../components/IpInput';

/** 一行导入数据：raw 保留原始单元格，便于保存前按最新库数据复校 */
export interface ImportRow {
    rowNo: number;
    raw: string[];
    name: string;
    groupName: string;
    typeLabel: string;
    accessLabel: string;
    deviceId: string;
    channelId: string;
    channelNo: string;
    host: string;
    port: string;
    username: string;
    password: string;
    vendorLabel: string;
    sn: string;
    mac: string;
    remark: string;
    errors: string[];
}

const requiredEmpty = (label: string) => `${label}字段，必填字段为空`;
const invalidField = (label: string) => `${label}字段，字段无效`;
const notUnique = (label: string) => `${label}字段，不唯一`;

/** 对整批单元格做校验，每行收集全部异常原因 */
export function validateCells(cells: string[][], data: DeviceDomainData): ImportRow[] {
    const seenNames = new Set<string>();
    const seenChannels = new Set<string>();

    return cells.map((raw, i) => {
        const cell = (index: number) => (raw[index] ?? '').trim();
        const row: ImportRow = {
            rowNo: i + 3, // 模板第 1 行注意事项、第 2 行表头，数据从第 3 行开始
            raw,
            name: cell(0),
            groupName: cell(1),
            typeLabel: cell(2),
            accessLabel: cell(3),
            deviceId: onlyDigits(cell(4)),
            channelId: onlyDigits(cell(5)),
            channelNo: cell(6),
            host: cell(7),
            port: cell(8),
            username: cell(9),
            password: cell(10),
            vendorLabel: cell(11),
            sn: cell(12),
            mac: cell(13),
            remark: cell(14),
            errors: [],
        };

        const fail = (text: string) => row.errors.push(text);
        // 接入方式选填：留空按国标处理（模板未标 *，国标为主流接入）
        const access = row.accessLabel ? dictByLabel(ACCESS_TYPE_DICT, row.accessLabel) : ACCESS_TYPE_DICT[0];
        const needGb = access?.value === 'gb' || access?.value === 'compat';
        const needNetwork = access?.value === 'nonGb' || access?.value === 'compat';

        // 摄像头名称：必填 + 全平台唯一 + 批内唯一
        if (!row.name) fail(requiredEmpty('摄像头名称'));
        else if (isCameraNameTaken(data, row.name) || seenNames.has(row.name)) fail(notUnique('摄像头名称'));

        // 分组：必填即可，不存在的分组在保存时自动建为一级分组
        if (!row.groupName) fail(requiredEmpty('分组'));

        // 种类：必填 + 字典内存在
        if (!row.typeLabel) fail(requiredEmpty('种类'));
        else if (!dictByLabel(CAMERA_TYPE_DICT, row.typeLabel)) fail(invalidField('种类'));

        // 接入方式：填写后须为字典三选一
        if (row.accessLabel && !access) fail(invalidField('接入方式'));

        // 所属国标设备 ID：国标与兼容接入必填 20 位数字（设备不再单独建档，随摄像头维护）
        if (needGb) {
            if (!row.deviceId) fail(requiredEmpty('所属国标设备ID'));
            else if (row.deviceId.length !== 20) fail(invalidField('所属国标设备ID'));
        }

        // 国标通道号：国标与兼容接入必填，20 位且序号非全 0，全平台与批内唯一
        if (needGb) {
            if (!row.channelId) fail(requiredEmpty('国标通道号'));
            else if (row.channelId.length !== 20 || /^0+$/.test(splitGbCode(row.channelId).seq)) {
                fail(invalidField('国标通道号'));
            } else if (
                data.cameras.some((item) => item.channelId === row.channelId) ||
                seenChannels.has(row.channelId)
            ) {
                fail(notUnique('国标通道号'));
            }
        }

        // 通道号：非国标与兼容接入必填；其余填写后校验数字
        if (needNetwork && !row.channelNo) fail(requiredEmpty('通道号'));
        else if (row.channelNo && !/^\d+$/.test(row.channelNo)) fail(invalidField('通道号'));

        // 厂商：必填 + 字典内存在
        if (!row.vendorLabel) fail(requiredEmpty('厂商'));
        else if (!dictByLabel(VENDOR_DICT, row.vendorLabel)) fail(invalidField('厂商'));

        // 网络接入信息：非国标与兼容接入必填，国标接入选填
        if (needNetwork && !row.host) fail(requiredEmpty('摄像头IP'));
        else if (row.host && !isValidIp(row.host)) fail(invalidField('摄像头IP'));

        if (needNetwork && !row.port) fail(requiredEmpty('端口'));
        else if (row.port && !/^\d+$/.test(row.port)) fail(invalidField('端口'));

        if (needNetwork && !row.username) fail(requiredEmpty('账号'));
        if (needNetwork && !row.password) fail(requiredEmpty('密码'));

        if (!row.errors.length) {
            seenNames.add(row.name);
            seenChannels.add(row.channelId);
        }
        return row;
    });
}

/**
 * 分组落位：已维护的按名称挂到对应分组，未维护的自动建一级分组
 * 返回新建分组与「分组名 → 分组 ID」映射，供 toCamera 使用
 */
export function resolveImportGroups(
    rows: ImportRow[],
    data: DeviceDomainData,
): { created: CameraGroup[]; groupIdByName: Map<string, string> } {
    const groupIdByName = new Map(data.groups.map((item) => [item.name, item.id]));
    const created: CameraGroup[] = [];
    let sort = data.groups
        .filter((item) => !item.parentId)
        .reduce((max, item) => Math.max(max, item.sort), 0);

    rows.forEach((row) => {
        if (!row.groupName || groupIdByName.has(row.groupName)) return;
        sort += 1;
        const group: CameraGroup = {
            id: nextId('grp'),
            name: row.groupName,
            parentId: null,
            sort,
            remark: '摄像头导入自动创建',
            ...createAudit(),
        };
        created.push(group);
        groupIdByName.set(group.name, group.id);
    });

    return { created, groupIdByName };
}

export function toCamera(
    row: ImportRow,
    data: DeviceDomainData,
    order: number,
    groupIdByName: Map<string, string>,
): Camera {
    const groupId = groupIdByName.get(row.groupName) || '';
    const type = dictByLabel(CAMERA_TYPE_DICT, row.typeLabel)!;
    const vendor = dictByLabel(VENDOR_DICT, row.vendorLabel)!;
    const accessType = (dictByLabel(ACCESS_TYPE_DICT, row.accessLabel)?.value || 'gb') as AccessType;
    /** 同一国标设备 ID 已有摄像头时沿用其网络默认值 */
    const sibling = row.deviceId ? data.cameras.find((item) => item.deviceId === row.deviceId) : undefined;
    const gb = accessType !== 'nonGb';
    return {
        id: nextId('cam'),
        name: row.name,
        groupId,
        accessType,
        deviceId: gb ? row.deviceId : '',
        channelId: gb ? row.channelId : '',
        channelNo: row.channelNo || deriveChannelNo(row.channelId),
        host: row.host || sibling?.host || '',
        port: row.port || '554',
        username: row.username || sibling?.username || '',
        password: row.password || sibling?.password || '',
        vendor: vendor.value,
        cameraType: type.value,
        sort: order + 1,
        sn: row.sn,
        mac: row.mac,
        remark: row.remark,
        ...createAudit(),
    };
}

/**
 * 演示用导入数据：150 条校验通过 + 2 条异常，共 152 条。
 * 两条异常覆盖三种异常原因口径（必填为空 / 字段无效 / 不唯一）。
 * 每次导入使用新批次号与空闲通道序号，避免重复演示时因唯一性全部失败。
 */
export function buildDemoCells(data: DeviceDomainData): string[][] {
    // 叶子分组优先；若无叶子则退回全部已维护分组
    const leafGroups = data.groups.filter((group) => !data.groups.some((item) => item.parentId === group.id));
    const groups = leafGroups.length ? leafGroups : data.groups;
    /** 国标设备 ID 取自摄像头表中已录入的值 */
    const devices = collectDeviceOptions(data);
    if (!groups.length || !devices.length) return [];

    const types = ['枪机', '球机'];
    const vendors = ['海康', '大华', '华为', '360'];

    // 批次后缀保证名称不与历史导入冲突；通道序号从已占用最大值之后起编
    const batch = String(Date.now() % 100000).padStart(5, '0');
    let nextSeq = 200;
    data.cameras.forEach((camera) => {
        const seq = Number(splitGbCode(camera.channelId).seq);
        if (Number.isFinite(seq) && seq >= nextSeq) nextSeq = seq + 1;
    });
    if (nextSeq > 999849) nextSeq = 200;

    const cells: string[][] = [];

    for (let i = 0; i < 150; i += 1) {
        const device = devices[i % devices.length];
        const group = groups[i % groups.length];
        const seg = splitGbCode(device.deviceId);
        const seq = nextSeq + i;
        const channelId = joinGbCode({
            center: seg.center || '43010201',
            industry: seg.industry || '49',
            typeCode: '132',
            net: seg.net || '0',
            seq: String(seq).padStart(6, '0'),
        });
        /** 每 10 条掺入一条非国标、一条兼容，覆盖三种接入方式 */
        const accessLabel = i % 10 === 4 ? '非国标' : i % 10 === 9 ? '兼容' : '国标';
        const nonGb = accessLabel === '非国标';
        /** 第 8 条用平台尚未维护的分组名，演示「分组不存在自动建一级分组」 */
        const groupLabel = i === 7 ? '三号煤场' : group.name;
        cells.push([
            `${groupLabel}-导入${batch}-${String(i + 1).padStart(3, '0')}`,
            groupLabel,
            types[i % types.length],
            accessLabel,
            nonGb ? '' : device.deviceId,
            nonGb ? '' : channelId,
            String(seq % 1000),
            device.host || '10.50.136.11',
            '554',
            'admin',
            'Admin@12345',
            vendors[i % vendors.length],
            `SN${batch}${String(i + 1).padStart(5, '0')}`,
            `00:1A:2B:${String((i % 90) + 10)}:C3:D4`,
            '',
        ]);
    }

    const device = devices[0];
    const seg = splitGbCode(device.deviceId);
    const badSeq = nextSeq + 400;

    // 异常行 1：种类未填（必填为空）+ 摄像头 IP 段越界（字段无效）
    cells.push([
        `${groups[0].name}-导入${batch}-901`,
        groups[0].name,
        '',
        '国标',
        device.deviceId,
        joinGbCode({
            center: seg.center || '43010201',
            industry: seg.industry || '49',
            typeCode: '132',
            net: seg.net || '0',
            seq: String(badSeq).padStart(6, '0'),
        }),
        String(badSeq % 1000),
        '10.50.136.300',
        '554',
        'admin',
        'Admin@12345',
        '海康',
        `SN${batch}00400`,
        '00:1A:2B:40:C3:D4',
        '',
    ]);

    // 异常行 2：名称与国标通道号均与平台已有摄像头重复（不唯一）
    const existing = data.cameras[0];
    cells.push([
        existing?.name || `${groups[0].name}-导入${batch}-dup`,
        groups[0].name,
        '球机',
        '国标',
        device.deviceId,
        existing?.channelId || String(cells[0]?.[5] || ''),
        '401',
        device.host || '10.50.136.11',
        '554',
        'admin',
        'Admin@12345',
        '大华',
        `SN${batch}00401`,
        '00:1A:2B:41:C3:D4',
        '',
    ]);

    return cells;
}

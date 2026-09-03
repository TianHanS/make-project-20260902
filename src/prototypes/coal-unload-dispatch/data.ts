/**
 * 卸煤调度管理 - 样例数据与业务逻辑（前端 mock）
 * 数据均为贴近业务的脱敏样例，日期随运行时「今天」动态生成，保证默认进入即有数据。
 */

export type PlanStatus = '计划完结' | '未完结';

export interface UnloadPoint {
    id: string;
    name: string; // 卸煤点名称（唯一）
    coalYard: string; // 关联煤场
    zone: string; // 关联分区
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
}

export interface MinePointInfo {
    id: string;
    fullName: string; // 矿点名称（全名）
    shortName: string; // 矿点简称（可为空）
    origin: string; // 地区
}

export interface UnloadDetail {
    id: string;
    mineId: string;
    mineShortName: string; // 矿点名称（简称）
    ledName: string; // LED 显示矿点名
    mineFullName: string; // 矿点名称
    planId: string; // 计划 id
    planSerial: string; // 计划流水号
    unloadPoint: string; // 卸煤点（空 = 未分配）
    coalYard: string; // 关联煤场（由卸煤点派生）
    zone: string; // 关联分区（由卸煤点派生）
    status: PlanStatus;
    operator: string; // 操作人
    operatedAt: string; // 操作时间
    createdBy: string; // 创建人
    createdAt: string; // 创建时间
    date: string; // 来煤日期 YYYY-MM-DD
}

export interface MatchPrediction {
    detailId: string;
    mineLabel: string;
    ledName: string;
    unloadPointId: string | null; // null = 匹配失败
    unloadPointName: string;
    reason: string;
}

/* ---------------- 日期工具 ---------------- */

export function fmtDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function addDays(base: Date, n: number): Date {
    const d = new Date(base);
    d.setDate(d.getDate() + n);
    return d;
}

export function fmtDateTime(d: Date): string {
    return `${fmtDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function parseDate(s: string): Date | null {
    if (!s) return null;
    const [y, m, d] = s.split('-').map((v) => Number(v));
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
}

export function fmtNow(): string {
    return fmtDateTime(new Date());
}

const NOW = new Date();
export const TODAY = fmtDate(NOW);
export const YESTERDAY = fmtDate(addDays(NOW, -1));
export const TOMORROW = fmtDate(addDays(NOW, 1));

/* ---------------- 基础字典 ---------------- */

export const COAL_YARDS = ['一号煤场', '二号煤场', '三号煤场'];

export const ZONES_BY_YARD: Record<string, string[]> = {
    '一号煤场': ['东区', '西区'],
    '二号煤场': ['南区', '北区'],
    '三号煤场': ['中区'],
};

export function zonesOf(yard: string): string[] {
    return ZONES_BY_YARD[yard] || [];
}

/* ---------------- 卸煤点 ---------------- */

export function buildInitialUnloadPoints(): UnloadPoint[] {
    const sys = '系统';
    const wang = '王工';
    const mk = (
        id: string,
        name: string,
        coalYard: string,
        zone: string,
        daysAgoCreated: number,
        daysAgoUpdated: number,
    ): UnloadPoint => ({
        id,
        name,
        coalYard,
        zone,
        createdAt: fmtDateTime(addDays(NOW, -daysAgoCreated)),
        createdBy: sys,
        updatedAt: fmtDateTime(addDays(NOW, -daysAgoUpdated)),
        updatedBy: daysAgoUpdated === 0 ? wang : sys,
    });
    return [
        mk('up1', '卸煤点A', '一号煤场', '东区', 32, 3),
        mk('up2', '卸煤点B', '一号煤场', '西区', 30, 2),
        mk('up3', '卸煤点C', '二号煤场', '南区', 28, 5),
        mk('up4', '卸煤点D', '二号煤场', '北区', 26, 1),
        mk('up5', '卸煤点E', '三号煤场', '中区', 24, 0),
    ];
}

/* ---------------- 矿点 ---------------- */

export const MINE_POINTS: MinePointInfo[] = [
    { id: 'm1', fullName: '岭北矿务局煤矿', shortName: '岭北', origin: '内蒙古' },
    { id: 'm2', fullName: '东山煤业有限公司', shortName: '东山', origin: '山西' },
    { id: 'm3', fullName: '东山能源集团', shortName: '东山', origin: '山西' }, // 与 m2 简称重复 -> 自动同步加序号
    { id: 'm4', fullName: '华能一号矿', shortName: '华能', origin: '内蒙古' },
    { id: 'm5', fullName: '兴盛煤业', shortName: '兴盛', origin: '山西' },
    { id: 'm6', fullName: '富强煤矿', shortName: '', origin: '内蒙古' }, // 简称为空 -> LED 名回退全名
    { id: 'm7', fullName: '大成煤业', shortName: '大成', origin: '山西' },
    { id: 'm8', fullName: '平安矿', shortName: '平安', origin: '内蒙古' },
];

export function mineById(id: string): MinePointInfo | undefined {
    return MINE_POINTS.find((m) => m.id === id);
}

/* ---------------- 历史最近卸煤点（自动匹配 mock） ---------------- */

// mineId -> 历史最近一次的卸煤点 id；缺省表示无历史记录（自动匹配失败）
export const HISTORY_UNLOAD_POINT_ID: Record<string, string> = {
    m1: 'up1',
    m2: 'up3',
    m3: 'up4',
    m4: 'up2',
    m5: 'up5',
    m6: 'up1',
};

/* ---------------- 卸煤要求明细（矿点卸煤管理） ---------------- */

interface DetailPlan {
    mineId: string;
    date: string;
    planSeq: number;
    unloadPoint: string;
    status: PlanStatus;
    operator: string;
    operatedAt: string;
}

export function buildInitialDetails(): UnloadDetail[] {
    let seq = 0;
    const t = (date: string, hhmm: string) => `${date} ${hhmm}`;

    const make = (
        mineId: string,
        mineShortName: string,
        ledName: string,
        mineFullName: string,
        date: string,
        planSeq: number,
        unloadPoint: string,
        status: PlanStatus,
        operator: string,
        operatedAt: string,
        createdBy = '系统',
    ): UnloadDetail => {
        seq += 1;
        const ds = date.replace(/-/g, '');
        return {
            id: `d${seq}`,
            mineId,
            mineShortName,
            ledName,
            mineFullName,
            planId: `PL${ds}${String(planSeq).padStart(3, '0')}`,
            planSerial: `XS${ds}${String(planSeq).padStart(4, '0')}`,
            unloadPoint,
            coalYard: '',
            zone: '',
            status,
            operator,
            operatedAt,
            createdBy,
            createdAt: t(date, '08:00'),
            date,
        };
    };

    const rows: UnloadDetail[] = [
        // —— 今日（含历史已分配 + 若干未分配，供自动匹配演示）——
        make('m1', '岭北', '岭北', '岭北矿务局煤矿', TODAY, 1, '卸煤点A', '未完结', '王工', t(TODAY, '08:36')),
        make('m2', '东山', '东山', '东山煤业有限公司', TODAY, 2, '卸煤点C', '未完结', '王工', t(TODAY, '08:41')),
        make('m3', '东山2', '东山2', '东山能源集团', TODAY, 3, '', '未完结', '系统', t(TODAY, '08:00')),
        make('m4', '华能', '华能', '华能一号矿', TODAY, 4, '', '未完结', '系统', t(TODAY, '08:00')),
        make('m5', '兴盛', '兴盛', '兴盛煤业', TODAY, 5, '', '未完结', '系统', t(TODAY, '08:00')),
        make('m6', '', '富强煤矿', '富强煤矿', TODAY, 6, '卸煤点B', '未完结', '李工', t(TODAY, '09:02')),
        make('m7', '大成', '大成', '大成煤业', TODAY, 7, '', '未完结', '系统', t(TODAY, '08:00')),
        make('m8', '平安', '平安', '平安矿', TODAY, 8, '卸煤点E', '计划完结', '李工', t(TODAY, '09:20')),
        // —— 明日（仅 3 条，供「后一日」演示）——
        make('m2', '东山', '东山', '东山煤业有限公司', TOMORROW, 1, '', '未完结', '系统', t(TOMORROW, '08:00')),
        make('m4', '华能', '华能', '华能一号矿', TOMORROW, 2, '卸煤点A', '未完结', '系统', t(TOMORROW, '08:00')),
        make('m8', '平安', '平安', '平安矿', TOMORROW, 3, '', '未完结', '系统', t(TOMORROW, '08:00')),
        // —— 昨日（历史，供「前一日」演示）——
        make('m1', '岭北', '岭北', '岭北矿务局煤矿', YESTERDAY, 1, '卸煤点A', '计划完结', '王工', t(YESTERDAY, '17:45')),
        make('m3', '东山2', '东山2', '东山能源集团', YESTERDAY, 2, '卸煤点D', '计划完结', '王工', t(YESTERDAY, '17:50')),
        make('m5', '兴盛', '兴盛', '兴盛煤业', YESTERDAY, 3, '卸煤点C', '计划完结', '李工', t(YESTERDAY, '17:52')),
    ];

    // 依据卸煤点回填煤场 / 分区
    const points = buildInitialUnloadPoints();
    const byName = new Map(points.map((p) => [p.name, p]));
    return rows.map((r) => {
        const p = byName.get(r.unloadPoint);
        return p ? { ...r, coalYard: p.coalYard, zone: p.zone } : r;
    });
}

/* ---------------- 自动匹配预测（mock） ---------------- */

export function predictMatches(details: UnloadDetail[], date: string, points: UnloadPoint[]): MatchPrediction[] {
    const pointById = new Map(points.map((p) => [p.id, p]));
    return details
        .filter((r) => r.date === date && !r.unloadPoint)
        .map((r) => {
            const histId = HISTORY_UNLOAD_POINT_ID[r.mineId];
            const point = histId ? pointById.get(histId) : undefined;
            const label = r.mineShortName || r.mineFullName;
            if (point) {
                return {
                    detailId: r.id,
                    mineLabel: label,
                    ledName: r.ledName,
                    unloadPointId: point.id,
                    unloadPointName: point.name,
                    reason: '',
                };
            }
            return {
                detailId: r.id,
                mineLabel: label,
                ledName: r.ledName,
                unloadPointId: null,
                unloadPointName: '',
                reason: '无历史卸煤点记录',
            };
        });
}

/* ---------------- LED 设定默认内容 ---------------- */

export interface LedSettings {
    offDuty: string; // 非接卸时段默认显示内容
    reception: string; // 接待时段默认显示内容
}

export const INITIAL_LED_SETTINGS: LedSettings = {
    offDuty: '现处于非接卸时段\n请卸煤车辆在指定区域等候\n听从现场调度指挥',
    reception: '欢迎莅临我厂\n卸煤车辆请按指引有序停放\n听从现场工作人员引导',
};
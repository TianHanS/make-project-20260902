/**
 * 视频监控业务域 · 回放录像段与时间工具
 *
 * 录像段为演示数据：按「摄像头 + 自然日」用固定种子生成，同一路摄像头在同一天
 * 反复查询结果一致，便于评审时复现；超出保留期与未来时间不产出录像。
 */
import { Camera, DeviceDomainData, buildGroupTree, groupName } from './data';
import coalYardFrame from './assets/live-coalyard.jpg';
import weighbridgeFrame from './assets/live-weighbridge.jpg';

export const DAY_MS = 86400000;

/** 录像保留天数：超出保留期的时段查不到录像 */
export const RETENTION_DAYS = 30;

/** 分屏档位：实时监控 1 / 4 / 9 / 16 */
export type LayoutSize = 1 | 4 | 9 | 16;

export const LAYOUTS: { value: LayoutSize; label: string }[] = [
    { value: 1, label: '1' },
    { value: 4, label: '4' },
    { value: 9, label: '9' },
    { value: 16, label: '16' },
];

/** 视频回放最多同时回放 4 路，分屏只提供 1 / 4 */
export const PLAYBACK_LAYOUTS: { value: LayoutSize; label: string }[] = LAYOUTS.filter(
    (item) => item.value <= 4,
);

/** 窗口槽位总数：切到小分屏时多余的点播记录先留着，切回来自动复位 */
export const SLOT_COUNT = 16;

/** 回放窗口槽位总数 */
export const PLAYBACK_SLOT_COUNT = 4;

/** 分屏列数：4→2 列、9→3 列、16→4 列 */
export function gridColumns(size: number): number {
    return Math.max(1, Math.round(Math.sqrt(size)));
}

/* ------------------------------------------------------------------ */
/* 摄像头顺序                                                          */
/* ------------------------------------------------------------------ */

export interface OrderedCamera {
    camera: Camera;
    group: string;
}

/**
 * 按分组树的原有顺序（分组排序 + 分组内摄像头排序）拉平摄像头。
 * 分屏窗口按此顺序填充，切换布局不改变顺序。
 */
export function orderCameras(data: DeviceDomainData): OrderedCamera[] {
    const out: OrderedCamera[] = [];
    const pushGroupCameras = (groupId: string, name: string) => {
        data.cameras
            .filter((camera) => camera.groupId === groupId)
            .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'zh-CN'))
            .forEach((camera) => out.push({ camera, group: name }));
    };
    const walk = (nodes: ReturnType<typeof buildGroupTree>) => {
        nodes.forEach((node) => {
            pushGroupCameras(node.id, node.name);
            walk(node.children);
        });
    };
    walk(buildGroupTree(data.groups));

    const covered = new Set(out.map((item) => item.camera.id));
    data.cameras
        .filter((camera) => !covered.has(camera.id))
        .forEach((camera) => out.push({ camera, group: groupName(data.groups, camera.groupId) }));
    return out;
}

/** 按场景挑选画面底图，与实时预览窗口保持一致 */
export function frameOf(cameraName: string, group: string): string {
    return /煤|皮带|输煤|堆|卸/.test(`${cameraName}${group}`) ? coalYardFrame : weighbridgeFrame;
}

/** 由通道号派生稳定的码流参数，避免每次渲染都跳动 */
export function streamStats(channelId: string) {
    const seed = [...channelId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return {
        resolution: seed % 3 === 0 ? '2560×1440' : '1920×1080',
        fps: 25,
        bitrate: 2048 + (seed % 9) * 256,
    };
}

/** 实时窗口播放模式：高清走视频流，流畅走图片帧 */
export type PlayMode = 'hd' | 'smooth';

export const PLAY_MODE_TIPS: Record<PlayMode, string> = {
    hd: '清晰度更高，对本机性能要求更高，适合 4 路以下视频同播。',
    smooth: '清晰度下降，无画面声音，对本机性能要求低，适合 9 路、16 路等多路视频同播。',
};

/** 本机能力：只取浏览器能稳定读到的项，不读系统实时 CPU 占用 */
export interface ClientCapacity {
    cores: number;
    /** GB；浏览器未上报时为 0 */
    memoryGb: number;
    screenWidth: number;
    screenHeight: number;
}

export function readClientCapacity(): ClientCapacity {
    const nav = navigator as Navigator & { deviceMemory?: number };
    return {
        cores: nav.hardwareConcurrency || 4,
        memoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : 0,
        screenWidth: window.screen?.width || 1920,
        screenHeight: window.screen?.height || 1080,
    };
}

/**
 * 流畅模式的图片帧率。
 * 候选只有 1 / 2 / 5 / 8 帧/秒，按 CPU 核数、大致内存、屏幕面积和当前分屏路数打分后取一档。
 * 不写入部署配置。
 */
export function matchSmoothFps(layout: number, capacity: ClientCapacity): number {
    let score = 0;
    if (capacity.cores >= 8) score += 2;
    else if (capacity.cores >= 4) score += 1;

    if (capacity.memoryGb >= 16) score += 2;
    else if (capacity.memoryGb >= 8) score += 1;
    else if (capacity.memoryGb === 0) score += 1;
    else score -= 1;

    const megapixels = (capacity.screenWidth * capacity.screenHeight) / 1_000_000;
    if (megapixels >= 6) score -= 1;
    else if (megapixels <= 1.5) score += 1;

    if (layout >= 16) score -= 3;
    else if (layout >= 9) score -= 2;
    else if (layout >= 4) score -= 1;
    else score += 1;

    if (score >= 4) return 8;
    if (score >= 2) return 5;
    if (score >= 0) return 2;
    return 1;
}

/** 图片帧估算码率（kbps），随匹配到的帧率变化，明显低于高清主码流 */
export function smoothBitrate(fps: number): number {
    return 120 * fps;
}

/* ------------------------------------------------------------------ */
/* 时间工具                                                            */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, '0');

export function dayStart(ms: number): number {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

export function fmtDateTime(ms: number): string {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtClock(ms: number): string {
    const d = new Date(ms);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtShortClock(ms: number): string {
    const d = new Date(ms);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDayLabel(ms: number): string {
    const d = new Date(ms);
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** datetime-local（含秒）控件取值 */
export function toLocalInput(ms: number): string {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fromLocalInput(value: string): number {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? 0 : ms;
}

export interface TimeRange {
    from: number;
    to: number;
}

export type QuickRangeKey = 'today' | 'yesterday' | 'last3';

export const QUICK_RANGES: { key: QuickRangeKey; label: string }[] = [
    { key: 'today', label: '今天' },
    { key: 'yesterday', label: '昨天' },
    { key: 'last3', label: '近3天' },
];

export function quickRange(key: QuickRangeKey, now = Date.now()): TimeRange {
    const today = dayStart(now);
    if (key === 'yesterday') return { from: today - DAY_MS, to: today - 1000 };
    if (key === 'last3') return { from: today - 2 * DAY_MS, to: now };
    return { from: today, to: now };
}

/* ------------------------------------------------------------------ */
/* 录像段                                                              */
/* ------------------------------------------------------------------ */

export interface RecordSegment {
    start: number;
    end: number;
}

function hashSeed(text: string): number {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    }
    return h >>> 0;
}

function seededRandom(seed: number): () => number {
    let s = seed || 1;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

/** 单日录像段：连续录像被若干断档切开，断档模拟设备离线或未触发录像 */
function segmentsOfDay(cameraId: string, day: number): RecordSegment[] {
    const rand = seededRandom(hashSeed(`${cameraId}@${day}`));
    const segments: RecordSegment[] = [];
    const end = day + DAY_MS;
    let cursor = day + Math.floor(rand() * 18) * 60000;
    while (cursor < end) {
        const len = (25 + Math.floor(rand() * 170)) * 60000;
        const stop = Math.min(cursor + len, end);
        if (stop - cursor > 60000) segments.push({ start: cursor, end: stop });
        const gap = rand() < 0.62 ? (3 + Math.floor(rand() * 9)) * 60000 : (18 + Math.floor(rand() * 42)) * 60000;
        cursor = stop + gap;
    }
    return segments;
}

/** 查询区间内的录像段：裁剪到区间、保留期与当前时刻之内 */
export function segmentsForRange(cameraId: string, range: TimeRange, now = Date.now()): RecordSegment[] {
    const limit = Math.min(range.to, now);
    const earliest = dayStart(now) - (RETENTION_DAYS - 1) * DAY_MS;
    const from = Math.max(range.from, earliest);
    if (limit <= from) return [];

    const out: RecordSegment[] = [];
    for (let day = dayStart(from); day <= dayStart(limit); day += DAY_MS) {
        segmentsOfDay(cameraId, day).forEach((seg) => {
            const start = Math.max(seg.start, from);
            const stop = Math.min(seg.end, limit);
            if (stop - start > 30000) out.push({ start, end: stop });
        });
    }
    return out;
}

export function hasRecordAt(segments: RecordSegment[], ms: number): boolean {
    return segments.some((seg) => ms >= seg.start && ms < seg.end);
}

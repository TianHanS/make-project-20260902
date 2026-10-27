/**
 * 视频监控（UR2.1 实时监控 / UR2.3 视频回放）
 *
 * 原「视频远程集中监控」与「视频回放查询」两个入口合并为本页。
 * 两个 Tab 共用同一套现网交互：左树分组批量点播 / 摄像头点播到选中分屏，
 * 右下角状态栏提供分屏切换、全屏、全部关闭。
 * 视频回放在此基础上叠加时间筛选与逐窗口独立的播放控制：分屏只到 1 / 4 路，
 * 播放、定位、倍速只作用于当前选中的那个窗口，其余窗口不受影响。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Camera as CameraIcon,
    Maximize2,
    Minimize2,
    Pause,
    Play,
    PowerOff,
    RotateCcw,
    RotateCw,
    Search,
    Video,
    X,
} from 'lucide-react';
import { DeviceDomainData } from '../data';
import {
    LAYOUTS,
    LayoutSize,
    PLAY_MODE_TIPS,
    PLAYBACK_LAYOUTS,
    PLAYBACK_SLOT_COUNT,
    PlayMode,
    QUICK_RANGES,
    QuickRangeKey,
    RecordSegment,
    SLOT_COUNT,
    TimeRange,
    fmtClock,
    fmtDateTime,
    fromLocalInput,
    frameOf,
    gridColumns,
    hasRecordAt,
    matchSmoothFps,
    orderCameras,
    quickRange,
    readClientCapacity,
    segmentsForRange,
    smoothBitrate,
    streamStats,
    toLocalInput,
} from '../monitor-data';
import { MonitorTree } from '../components/MonitorTree';
import { PlaybackTimeline } from '../components/PlaybackTimeline';
import { Button, message } from '../components/ui';

type TabKey = 'live' | 'playback';

/** 倍速：0.5 ~ 2 倍连续可拖，步进 0.1；刻度文字只作参考锚点 */
const SPEED_MIN = 0.5;
const SPEED_MAX = 2;
const SPEED_STEP = 0.1;
const SPEED_MARKS = [0.5, 1, 1.5, 2];

const fmtSpeed = (value: number) => String(Number(value.toFixed(1)));

/** 单个回放窗口的播放状态：各窗口独立推进，互不影响 */
interface SlotPlayback {
    cursor: number;
    playing: boolean;
    speed: number;
}

/** 一面视频墙的槽位状态：点播记录、选中窗口、单窗口放大、分屏档位 */
function useWall(initialIds: string[], slotCount: number, defaultLayout: LayoutSize) {
    const [slots, setSlots] = useState<(string | null)[]>(() => {
        const init: (string | null)[] = Array(slotCount).fill(null);
        initialIds.slice(0, slotCount).forEach((id, index) => {
            init[index] = id;
        });
        return init;
    });
    const [active, setActive] = useState(0);
    const [solo, setSolo] = useState(-1);
    const [layout, setLayout] = useState<LayoutSize>(defaultLayout);
    return { slots, setSlots, active, setActive, solo, setSolo, layout, setLayout, slotCount };
}

export function MonitorPage({ data }: { data: DeviceDomainData }) {
    const ordered = useMemo(() => orderCameras(data), [data]);
    const cameraMap = useMemo(() => new Map(ordered.map((item) => [item.camera.id, item])), [ordered]);
    const defaultIds = useMemo(() => ordered.slice(0, 4).map((item) => item.camera.id), [ordered]);

    const [tab, setTab] = useState<TabKey>('live');

    const live = useWall(defaultIds, SLOT_COUNT, 4);
    const playback = useWall(defaultIds, PLAYBACK_SLOT_COUNT, 4);
    const wall = tab === 'live' ? live : playback;
    const layout = wall.layout;

    const visibleSlots = wall.slots.slice(0, layout);
    const playingIds = visibleSlots.filter((id): id is string => !!id);

    /* ================= 回放窗口状态（先于点播逻辑声明，供点播复位使用） ================= */

    const initialRange = useMemo(() => quickRange('today'), []);
    const [fromText, setFromText] = useState(() => toLocalInput(initialRange.from));
    const [toText, setToText] = useState(() => toLocalInput(initialRange.to));
    const [quickKey, setQuickKey] = useState<QuickRangeKey | ''>('today');
    const [query, setQuery] = useState<{ range: TimeRange; token: number }>(() => ({
        range: initialRange,
        token: 0,
    }));
    const [loading, setLoading] = useState(false);
    const [speedTip, setSpeedTip] = useState(false);
    const [slotPlay, setSlotPlay] = useState<SlotPlayback[]>(() =>
        Array.from({ length: PLAYBACK_SLOT_COUNT }, () => ({
            cursor: initialRange.from,
            playing: false,
            speed: 1,
        })),
    );

    const patchSlotPlay = (slot: number, partial: Partial<SlotPlayback>) =>
        setSlotPlay((prev) => prev.map((item, index) => (index === slot ? { ...item, ...partial } : item)));

    /** 窗口内的起播点：区间起点无录像时落到该路最早一段录像 */
    const startCursorOf = (cameraId: string, range: TimeRange): number => {
        const segments = segmentsForRange(cameraId, range);
        if (hasRecordAt(segments, range.from)) return range.from;
        return segments.length ? segments[0].start : range.from;
    };

    /* ================= 点播 / 分屏（两个 Tab 一致） ================= */

    const playCamera = (cameraId: string) => {
        const slot = Math.min(wall.active, layout - 1);
        wall.setSlots((prev) => {
            const next = [...prev];
            next[slot] = cameraId;
            return next;
        });
        wall.setActive((slot + 1) % layout);
        if (tab === 'playback') {
            patchSlotPlay(slot, { cursor: startCursorOf(cameraId, query.range), playing: true });
        }
    };

    const batchPlay = (cameraIds: string[]) => {
        if (!cameraIds.length) {
            message.warning('该分组下暂无摄像头');
            return;
        }
        const picked = cameraIds.slice(0, layout);
        wall.setSlots(() => {
            const next: (string | null)[] = Array(wall.slotCount).fill(null);
            picked.forEach((id, index) => {
                next[index] = id;
            });
            return next;
        });
        wall.setActive(picked.length < layout ? picked.length : 0);
        wall.setSolo(-1);
        if (tab === 'playback') {
            setSlotPlay((prev) =>
                prev.map((item, index) => {
                    const cameraId = picked[index];
                    if (!cameraId) return { ...item, cursor: query.range.from, playing: false };
                    return { ...item, cursor: startCursorOf(cameraId, query.range), playing: true };
                }),
            );
        }
        message.success(
            cameraIds.length > picked.length
                ? `分组共 ${cameraIds.length} 路，已按 ${layout} 分屏播放前 ${picked.length} 路`
                : `已批量播放 ${picked.length} 路`,
        );
    };

    const closeSlot = (slot: number) => {
        wall.setSlots((prev) => {
            const next = [...prev];
            next[slot] = null;
            return next;
        });
        wall.setActive(slot);
        if (wall.solo === slot) wall.setSolo(-1);
        if (tab === 'playback') patchSlotPlay(slot, { playing: false });
    };

    const closeAll = () => {
        if (!playingIds.length) return;
        wall.setSlots(Array(wall.slotCount).fill(null));
        wall.setActive(0);
        wall.setSolo(-1);
        if (tab === 'playback') {
            setSlotPlay((prev) => prev.map((item) => ({ ...item, playing: false })));
        }
        message.success('已关闭全部画面');
    };

    const changeLayout = (next: LayoutSize) => {
        const dropped = wall.slots.slice(next).filter(Boolean).length;
        wall.setLayout(next);
        wall.setActive((prev) => Math.min(prev, next - 1));
        wall.setSolo(-1);
        if (dropped) message.info(`切换为 ${next} 分屏，${dropped} 路移出画面，切回后自动复位`);
    };

    const stageRef = useRef<HTMLDivElement>(null);
    const toggleStageFullscreen = () => {
        const el = stageRef.current;
        if (!el) return;
        if (document.fullscreenElement) {
            document.exitFullscreen?.();
            return;
        }
        const request = el.requestFullscreen?.bind(el);
        if (!request) {
            message.warning('当前环境不支持全屏');
            return;
        }
        request().catch(() => message.warning('全屏被浏览器拒绝'));
    };

    /* ================= 实时监控 ================= */

    const [liveClock, setLiveClock] = useState(() => Date.now());
    useEffect(() => {
        if (tab !== 'live') return;
        const id = setInterval(() => setLiveClock(Date.now()), 1000);
        return () => clearInterval(id);
    }, [tab]);

    /** 每路实时窗口的播放模式，回放不使用 */
    const [slotModes, setSlotModes] = useState<PlayMode[]>(() => Array(SLOT_COUNT).fill('hd'));
    const clientCapacity = useMemo(() => readClientCapacity(), []);
    /** 流畅帧率随当前分屏路数重算，不落配置 */
    const smoothFps = useMemo(
        () => matchSmoothFps(live.layout, clientCapacity),
        [live.layout, clientCapacity],
    );

    const setSlotMode = (slot: number, mode: PlayMode) => {
        setSlotModes((prev) => prev.map((item, index) => (index === slot ? mode : item)));
    };

    const applyAllModes = (mode: PlayMode) => {
        setSlotModes(Array(SLOT_COUNT).fill(mode));
        if (mode === 'smooth') {
            message.info('已全部切换为流畅');
            return;
        }
        message.success('已全部切换为高清');
    };

    const playingModes = live.slots
        .slice(0, live.layout)
        .map((id, index) => (id ? slotModes[index] : null))
        .filter((mode): mode is PlayMode => !!mode);
    const allHd = playingModes.length > 0 && playingModes.every((mode) => mode === 'hd');
    const allSmooth = playingModes.length > 0 && playingModes.every((mode) => mode === 'smooth');

    /** 总流量：高清按主码流累加，流畅按图片帧码率累加 */
    const totalFlow = visibleSlots.reduce((sum, id, index) => {
        if (!id || tab !== 'live') return sum;
        const camera = cameraMap.get(id)?.camera;
        if (!camera) return sum;
        return sum + (slotModes[index] === 'smooth' ? smoothBitrate(smoothFps) : streamStats(camera.channelId).bitrate);
    }, 0);

    /* ================= 视频回放 ================= */

    const playbackIds = playback.slots.slice(0, playback.layout).filter((id): id is string => !!id);
    const segmentMap = useMemo(() => {
        const map = new Map<string, RecordSegment[]>();
        playbackIds.forEach((id) => map.set(id, segmentsForRange(id, query.range)));
        return map;
    }, [playbackIds.join('|'), query.token]);

    const applyQuick = (key: QuickRangeKey) => {
        const next = quickRange(key);
        setQuickKey(key);
        setFromText(toLocalInput(next.from));
        setToText(toLocalInput(next.to));
    };

    const runQuery = () => {
        const range: TimeRange = { from: fromLocalInput(fromText), to: fromLocalInput(toText) };
        if (!range.from || !range.to) {
            message.warning('请填写完整的开始时间与结束时间');
            return;
        }
        if (range.to <= range.from) {
            message.warning('结束时间须晚于开始时间');
            return;
        }
        if (!playingIds.length) {
            message.warning('请先从左侧摄像头列表选择需要回放的摄像头');
            return;
        }
        setQuery((prev) => ({ range, token: prev.token + 1 }));
        setSlotPlay((prev) => prev.map((item) => ({ ...item, cursor: range.from, playing: false })));
        setLoading(true);
    };

    /** 加载完成后各窗口各自落到自己最早一段录像并起播 */
    const playbackSlotsRef = useRef(playback.slots);
    playbackSlotsRef.current = playback.slots;

    useEffect(() => {
        if (!loading) return;
        const timer = setTimeout(() => {
            setLoading(false);
            setSlotPlay((prev) =>
                prev.map((item, index) => {
                    const cameraId = playbackSlotsRef.current[index];
                    if (!cameraId) return { ...item, cursor: query.range.from, playing: false };
                    return { ...item, cursor: startCursorOf(cameraId, query.range), playing: true };
                }),
            );
        }, 700);
        return () => clearTimeout(timer);
    }, [loading, query.token]);

    /** 首次进入回放 Tab 时按默认时间范围自动加载 */
    const playbackReady = useRef(false);
    useEffect(() => {
        if (tab !== 'playback' || playbackReady.current) return;
        playbackReady.current = true;
        setLoading(true);
    }, [tab]);

    /** 播放推进：逐窗口按各自倍速独立走时间游标 */
    useEffect(() => {
        if (tab !== 'playback' || loading) return;
        const step = 250;
        const id = setInterval(() => {
            setSlotPlay((prev) => {
                let changed = false;
                const next = prev.map((item, index) => {
                    if (!item.playing || !playbackSlotsRef.current[index]) return item;
                    changed = true;
                    const ms = item.cursor + step * item.speed;
                    if (ms >= query.range.to) return { ...item, cursor: query.range.to, playing: false };
                    return { ...item, cursor: ms };
                });
                return changed ? next : prev;
            });
        }, step);
        return () => clearInterval(id);
    }, [tab, loading, query.token, query.range.to]);

    /** 播放控制条与时间轴的作用对象：当前选中的那个回放窗口 */
    const activeSlot = Math.min(playback.active, playback.layout - 1);
    const activeCameraId = playback.slots[activeSlot] ?? null;
    const activeCamera = activeCameraId ? cameraMap.get(activeCameraId) : undefined;
    const activeState = slotPlay[activeSlot] ?? { cursor: query.range.from, playing: false, speed: 1 };
    const activeControllable = !!activeCameraId && !loading;

    const seekActive = (ms: number) => {
        if (!activeControllable) return;
        patchSlotPlay(activeSlot, {
            cursor: Math.min(query.range.to, Math.max(query.range.from, ms)),
        });
    };

    const activeTrack = activeCameraId
        ? {
              cameraId: activeCameraId,
              name: activeCamera?.camera.name || activeCameraId,
              segments: segmentMap.get(activeCameraId) || [],
          }
        : null;

    /* ================= 渲染 ================= */

    useEffect(() => {
        if (wall.solo < 0) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') wall.setSolo(-1);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [wall.solo]);

    const renderWindow = (slot: number, cameraId: string | null) => {
        const entry = cameraId ? cameraMap.get(cameraId) : undefined;
        const camera = entry?.camera;
        const selected = wall.active === slot;
        const solo = wall.solo === slot;
        const stats = camera ? streamStats(camera.channelId) : null;
        const mode: PlayMode = slotModes[slot] ?? 'hd';
        const smooth = tab === 'live' && mode === 'smooth';
        const segments = cameraId ? segmentMap.get(cameraId) || [] : [];
        const state = slotPlay[slot] ?? { cursor: query.range.from, playing: false, speed: 1 };
        const onAir =
            !!camera && (tab === 'live' || (!loading && hasRecordAt(segments, state.cursor)));

        return (
            <div
                key={`slot-${slot}`}
                className={[
                    'vdm-mon-window',
                    selected ? 'is-selected' : '',
                    camera ? '' : 'is-idle',
                    smooth ? 'is-smooth' : '',
                ]
                    .filter(Boolean)
                    .join(' ')}
                onClick={() => wall.setActive(slot)}
                onDoubleClick={() => camera && wall.setSolo(solo ? -1 : slot)}
            >
                {onAir && camera ? (
                    <>
                        <img
                            className="vdm-mon-frame"
                            src={frameOf(camera.name, entry?.group || '')}
                            alt={`${camera.name} 画面`}
                        />
                        <div className="vdm-mon-grain" aria-hidden="true" />
                    </>
                ) : camera ? (
                    <div className="vdm-mon-blank">
                        {loading ? '正在加载录像…' : segments.length === 0 ? '所选时段无录像' : '当前时段无录像'}
                    </div>
                ) : (
                    <div className="vdm-mon-blank">
                        {selected ? '已选中，从左侧选择摄像头' : `窗口 ${slot + 1}`}
                    </div>
                )}

                {camera ? (
                    <>
                        <div className="vdm-mon-osd is-top">
                            {tab === 'live' ? (
                                <>
                                    <span className="vdm-mon-chip is-live">
                                        <i />
                                        LIVE
                                    </span>
                                    <span className={`vdm-mon-chip${smooth ? ' is-smooth' : ''}`}>
                                        {smooth ? '流畅' : '高清'}
                                    </span>
                                </>
                            ) : (
                                <span className={`vdm-mon-chip${state.playing ? ' is-playing' : ''}`}>
                                    {state.playing ? `播放中 ${fmtSpeed(state.speed)}倍` : '已暂停'}
                                </span>
                            )}
                            <span className="vdm-mon-osd-name">{camera.name}</span>
                        </div>
                        <div className="vdm-mon-osd is-top-right">
                            {fmtDateTime(tab === 'live' ? liveClock : state.cursor)}
                        </div>
                        {onAir && stats ? (
                            <div className="vdm-mon-osd is-bottom-right">
                                {tab === 'live'
                                    ? smooth
                                        ? `图片帧 · ${smoothFps}fps · 无声`
                                        : `${stats.resolution} · ${stats.fps}fps`
                                    : `${stats.resolution} · ${stats.fps}fps · ${stats.bitrate}kbps`}
                            </div>
                        ) : null}
                        <div className="vdm-mon-window-tools">
                            {tab === 'live' ? (
                                <div
                                    className="vdm-mon-mode"
                                    onClick={(e) => e.stopPropagation()}
                                    onDoubleClick={(e) => e.stopPropagation()}
                                >
                                    {(['hd', 'smooth'] as PlayMode[]).map((item) => (
                                        <button
                                            key={item}
                                            type="button"
                                            className={mode === item ? 'is-active' : ''}
                                            onClick={() => setSlotMode(slot, item)}
                                        >
                                            {item === 'hd' ? '高清' : '流畅'}
                                        </button>
                                    ))}
                                    <div className="vdm-mon-mode-tip" role="tooltip">
                                        <p>
                                            <b>高清</b>：{PLAY_MODE_TIPS.hd}
                                        </p>
                                        <p>
                                            <b>流畅</b>：{PLAY_MODE_TIPS.smooth}
                                        </p>
                                    </div>
                                </div>
                            ) : null}
                            {tab === 'live' ? (
                                <button
                                    type="button"
                                    title="抓图"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        message.success(`已抓拍「${camera.name}」当前画面`);
                                    }}
                                >
                                    <CameraIcon size={13} />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    title={state.playing ? '暂停本窗口' : '播放本窗口'}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        wall.setActive(slot);
                                        patchSlotPlay(slot, { playing: !state.playing });
                                    }}
                                >
                                    {state.playing ? <Pause size={13} /> : <Play size={13} />}
                                </button>
                            )}
                            <button
                                type="button"
                                title={solo ? '还原' : '单窗口放大'}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    wall.setSolo(solo ? -1 : slot);
                                }}
                            >
                                {solo ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                            </button>
                            <button
                                type="button"
                                title="关闭画面"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeSlot(slot);
                                }}
                            >
                                <X size={13} />
                            </button>
                        </div>
                    </>
                ) : null}
            </div>
        );
    };

    const cols = wall.solo >= 0 ? 1 : gridColumns(layout);
    const layoutOptions = tab === 'live' ? LAYOUTS : PLAYBACK_LAYOUTS;

    return (
        <div className="vdm-split">
            <MonitorTree
                data={data}
                capacity={layout}
                playingIds={playingIds}
                onPlayCamera={playCamera}
                onBatchPlay={batchPlay}
                actionText={tab === 'live' ? '点播' : '回放'}
            />

            <section className="vdm-mon-content">
                <header className="vdm-content-head">
                    <div className="vdm-content-title">
                        <h2>视频监控</h2>
                        <span>
                            {tab === 'live' ? '正在播放' : '正在回放'} {playingIds.length} 路 · {layout} 分屏
                        </span>
                    </div>
                    <div className="vdm-mon-tabs">
                        <button
                            type="button"
                            className={`vdm-mon-tab${tab === 'live' ? ' is-active' : ''}`}
                            onClick={() => setTab('live')}
                        >
                            <Video size={14} />
                            实时监控
                        </button>
                        <button
                            type="button"
                            className={`vdm-mon-tab${tab === 'playback' ? ' is-active' : ''}`}
                            onClick={() => setTab('playback')}
                        >
                            <Play size={14} />
                            视频回放
                        </button>
                    </div>
                </header>

                {tab === 'playback' ? (
                    <div className="vdm-mon-toolbar">
                        <label className="vdm-mon-time">
                            <span>开始时间</span>
                            <input
                                type="datetime-local"
                                step={1}
                                className="vdm-datetime"
                                value={fromText}
                                onChange={(e) => {
                                    setFromText(e.target.value);
                                    setQuickKey('');
                                }}
                            />
                        </label>
                        <label className="vdm-mon-time">
                            <span>结束时间</span>
                            <input
                                type="datetime-local"
                                step={1}
                                className="vdm-datetime"
                                value={toText}
                                onChange={(e) => {
                                    setToText(e.target.value);
                                    setQuickKey('');
                                }}
                            />
                        </label>
                        <div className="vdm-mon-quick">
                            {QUICK_RANGES.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    className={`vdm-mon-quick-btn${quickKey === item.key ? ' is-active' : ''}`}
                                    onClick={() => applyQuick(item.key)}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                        <Button variant="primary" icon={<Search size={14} />} onClick={runQuery}>
                            查询
                        </Button>
                    </div>
                ) : null}

                <div className="vdm-mon-wall" ref={stageRef}>
                    <div className="vdm-mon-stage is-flush">
                        <div
                            className="vdm-mon-grid"
                            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                        >
                            {wall.solo >= 0
                                ? renderWindow(wall.solo, wall.slots[wall.solo])
                                : visibleSlots.map((cameraId, slot) => renderWindow(slot, cameraId))}
                        </div>
                    </div>

                    <div className="vdm-mon-statusbar">
                        <span className="vdm-mon-flow">
                            {tab === 'live'
                                ? `总流量：${totalFlow ? Math.round(totalFlow / 8).toLocaleString('en-US') : 0}KB/s`
                                : activeCamera
                                  ? `选中窗口 ${activeSlot + 1}：${activeCamera.camera.name} · ${fmtDateTime(activeState.cursor)} · 在播 ${playingIds.length} 路`
                                  : `选中窗口 ${activeSlot + 1}：暂无画面 · 在播 ${playingIds.length} 路`}
                        </span>
                        <div className="vdm-mon-statusbar-tools">
                            {tab === 'live' ? (
                                <div className="vdm-mon-mode is-global">
                                    <button
                                        type="button"
                                        className={allHd ? 'is-active' : ''}
                                        disabled={!playingIds.length}
                                        onClick={() => applyAllModes('hd')}
                                    >
                                        高清
                                    </button>
                                    <button
                                        type="button"
                                        className={allSmooth ? 'is-active' : ''}
                                        disabled={!playingIds.length}
                                        onClick={() => applyAllModes('smooth')}
                                    >
                                        流畅
                                    </button>
                                    <div className="vdm-mon-mode-tip" role="tooltip">
                                        <p>一次切换当前所有在播窗口。</p>
                                        <p>
                                            <b>高清</b>：{PLAY_MODE_TIPS.hd}
                                        </p>
                                        <p>
                                            <b>流畅</b>：{PLAY_MODE_TIPS.smooth}
                                        </p>
                                    </div>
                                </div>
                            ) : null}
                            <div className="vdm-mon-layouts is-dark">
                                {layoutOptions.map((item) => (
                                    <button
                                        key={item.value}
                                        type="button"
                                        className={`vdm-mon-layout-btn${layout === item.value ? ' is-active' : ''}`}
                                        title={`${item.label} 分屏`}
                                        onClick={() => changeLayout(item.value)}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                            <button
                                type="button"
                                className="vdm-mon-status-btn"
                                title="全屏"
                                onClick={toggleStageFullscreen}
                            >
                                <Maximize2 size={14} />
                                全屏
                            </button>
                            <button
                                type="button"
                                className="vdm-mon-status-btn is-danger"
                                title="全部关闭"
                                onClick={closeAll}
                            >
                                <PowerOff size={14} />
                                全部关闭
                            </button>
                        </div>
                    </div>
                </div>

                {tab === 'playback' ? (
                    <>
                        <div className="vdm-mon-transport">
                            <div className="vdm-mon-transport-left">
                                <span className="vdm-mon-transport-target">
                                    控制窗口 {activeSlot + 1}
                                    {activeCamera ? ` · ${activeCamera.camera.name}` : ' · 未点播'}
                                </span>
                                <button
                                    type="button"
                                    title="本窗口后退 15 秒"
                                    disabled={!activeControllable}
                                    onClick={() => seekActive(activeState.cursor - 15000)}
                                >
                                    <RotateCcw size={15} />
                                </button>
                                <button
                                    type="button"
                                    className="is-primary"
                                    title={activeState.playing ? '暂停本窗口' : '播放本窗口'}
                                    disabled={!activeControllable}
                                    onClick={() =>
                                        activeControllable &&
                                        patchSlotPlay(activeSlot, { playing: !activeState.playing })
                                    }
                                >
                                    {activeState.playing ? <Pause size={16} /> : <Play size={16} />}
                                </button>
                                <button
                                    type="button"
                                    title="本窗口前进 15 秒"
                                    disabled={!activeControllable}
                                    onClick={() => seekActive(activeState.cursor + 15000)}
                                >
                                    <RotateCw size={15} />
                                </button>
                                <span className="vdm-mon-transport-clock">{fmtDateTime(activeState.cursor)}</span>
                                <span className="vdm-mon-transport-range">
                                    {fmtClock(query.range.from)} ~ {fmtClock(query.range.to)}
                                </span>
                            </div>
                            <div className="vdm-mon-speeds">
                                <span className="vdm-mon-speed-title">倍速播放</span>
                                <div className={`vdm-mon-speed-slider${speedTip ? ' is-tip' : ''}`}>
                                    <input
                                        type="range"
                                        min={SPEED_MIN}
                                        max={SPEED_MAX}
                                        step={SPEED_STEP}
                                        value={activeState.speed}
                                        aria-label="倍速播放"
                                        disabled={!activeControllable}
                                        onChange={(e) =>
                                            patchSlotPlay(activeSlot, {
                                                speed: Number(Number(e.target.value).toFixed(1)),
                                            })
                                        }
                                        onMouseDown={() => setSpeedTip(true)}
                                        onMouseUp={() => setSpeedTip(false)}
                                        onMouseEnter={() => setSpeedTip(true)}
                                        onMouseLeave={() => setSpeedTip(false)}
                                        onFocus={() => setSpeedTip(true)}
                                        onBlur={() => setSpeedTip(false)}
                                    />
                                    <span
                                        className="vdm-mon-speed-bubble"
                                        style={{
                                            left: `${((activeState.speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100}%`,
                                        }}
                                    >
                                        {fmtSpeed(activeState.speed)} 倍
                                    </span>
                                    <div className="vdm-mon-speed-ticks">
                                        {SPEED_MARKS.map((item) => (
                                            <span
                                                key={item}
                                                className={activeState.speed === item ? 'is-active' : ''}
                                                onClick={() =>
                                                    activeControllable &&
                                                    patchSlotPlay(activeSlot, { speed: item })
                                                }
                                            >
                                                {item}倍
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <PlaybackTimeline
                            range={query.range}
                            track={activeTrack}
                            slotIndex={activeSlot}
                            cursor={activeState.cursor}
                            onSeek={seekActive}
                        />
                    </>
                ) : null}
            </section>
        </div>
    );
}

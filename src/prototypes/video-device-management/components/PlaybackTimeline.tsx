/**
 * 回放时间轴：跟随当前选中的那个回放窗口
 *
 * 着色区段为该窗口摄像头在查询区间内的录像；点击只定位这一个窗口，
 * 其他窗口保持各自的播放进度。操作指引随鼠标悬浮提示，不常驻文字注解。
 */
import React, { useMemo, useRef, useState } from 'react';
import {
    DAY_MS,
    RecordSegment,
    TimeRange,
    fmtClock,
    fmtDateTime,
    fmtDayLabel,
    fmtShortClock,
} from '../monitor-data';

export interface TimelineTrack {
    cameraId: string;
    name: string;
    segments: RecordSegment[];
}

interface PlaybackTimelineProps {
    range: TimeRange;
    /** 当前选中窗口的录像轨道；窗口无画面时为 null */
    track: TimelineTrack | null;
    slotIndex: number;
    cursor: number;
    onSeek: (ms: number) => void;
}

/** 刻度步长候选：保证整轴刻度在 6~12 个之间 */
const STEPS = [
    5 * 60000,
    15 * 60000,
    30 * 60000,
    60 * 60000,
    2 * 3600000,
    3 * 3600000,
    6 * 3600000,
    12 * 3600000,
    DAY_MS,
];

function pickStep(duration: number): number {
    return STEPS.find((step) => duration / step <= 10) || DAY_MS;
}

export function PlaybackTimeline({ range, track, slotIndex, cursor, onSeek }: PlaybackTimelineProps) {
    const lanesRef = useRef<HTMLDivElement>(null);
    const [hover, setHover] = useState<number | null>(null);

    const span = Math.max(1, range.to - range.from);
    const pct = (ms: number) => ((ms - range.from) / span) * 100;
    const clamp = (ms: number) => Math.min(range.to, Math.max(range.from, ms));

    const msAtClientX = (clientX: number): number => {
        const el = lanesRef.current;
        if (!el) return range.from;
        const rect = el.getBoundingClientRect();
        const ratio = (clientX - rect.left) / Math.max(1, rect.width);
        return clamp(range.from + ratio * span);
    };

    const ticks = useMemo(() => {
        const step = pickStep(span);
        const first = Math.ceil(range.from / step) * step;
        const list: number[] = [];
        for (let ms = first; ms <= range.to; ms += step) list.push(ms);
        return { step, list };
    }, [range.from, range.to, span]);

    const multiDay = new Date(range.from).toDateString() !== new Date(range.to).toDateString();
    const segments = track?.segments || [];

    return (
        <div className="vdm-tl is-single">
            <div className="vdm-tl-corner">时间轴</div>
            <div className="vdm-tl-ruler">
                {ticks.list.map((ms) => (
                    <span key={ms} className="vdm-tl-tick" style={{ left: `${pct(ms)}%` }}>
                        {multiDay && ticks.step >= 3600000 ? `${fmtDayLabel(ms)} ` : ''}
                        {ticks.step % 3600000 === 0 || ticks.step >= 3600000 ? fmtShortClock(ms) : fmtClock(ms)}
                    </span>
                ))}
            </div>

            <div className="vdm-tl-labels">
                <div className="vdm-tl-label" title={track?.name || ''}>
                    窗口 {slotIndex + 1}
                    {track ? ` · ${track.name}` : ' · 未点播'}
                </div>
            </div>

            <div
                className="vdm-tl-lanes"
                ref={lanesRef}
                onClick={(e) => track && onSeek(msAtClientX(e.clientX))}
                onMouseMove={(e) => setHover(msAtClientX(e.clientX))}
                onMouseLeave={() => setHover(null)}
            >
                <div className="vdm-tl-lane is-merged">
                    {segments.map((seg) => (
                        <span
                            key={`${seg.start}-${seg.end}`}
                            className="vdm-tl-seg"
                            style={{
                                left: `${pct(seg.start)}%`,
                                width: `${Math.max(0.2, pct(seg.end) - pct(seg.start))}%`,
                            }}
                            title={`${fmtDateTime(seg.start)} ~ ${fmtClock(seg.end)}`}
                        />
                    ))}
                    {segments.length === 0 ? (
                        <span className="vdm-tl-lane-empty">
                            {track ? '该摄像头在所选时段无录像' : '请先选中一个有画面的窗口'}
                        </span>
                    ) : null}
                </div>

                {ticks.list.map((ms) => (
                    <span key={`grid-${ms}`} className="vdm-tl-grid" style={{ left: `${pct(ms)}%` }} />
                ))}

                {hover !== null ? (
                    <span className="vdm-tl-hover" style={{ left: `${pct(hover)}%` }}>
                        <em>{fmtClock(hover)}</em>
                        <i className={`vdm-tl-hover-tip${pct(hover) > 60 ? ' is-left' : ''}`}>
                            单击只定位窗口 {slotIndex + 1}，其他窗口不受影响
                        </i>
                    </span>
                ) : null}

                <span className="vdm-tl-cursor" style={{ left: `${pct(cursor)}%` }}>
                    <em>{fmtClock(cursor)}</em>
                </span>
            </div>
        </div>
    );
}

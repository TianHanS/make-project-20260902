/**
 * 实时监控预览（点播直播窗口）
 *
 * 列表「监控预览」与表单「保存并预览监控」共用：按所选协议向流媒体服务点播，
 * 展示实时画面、通道信息与取流地址。
 */
import React, { useEffect, useRef, useState } from 'react';
import { Camera as CameraIcon, Maximize2, Minimize2, RefreshCw, Volume2, VolumeX, X, Zap } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
    CAMERA_TYPE_DICT,
    Camera,
    DeviceDomainData,
    VENDOR_DICT,
    buildStreamUrls,
    dictLabel,
    groupName,
    onlyDigits,
} from '../data';
import { Button, CopyText, IconButton, message } from './ui';
import coalYardFrame from '../assets/live-coalyard.jpg';
import weighbridgeFrame from '../assets/live-weighbridge.jpg';

type Protocol = 'flv' | 'wsFlv' | 'hls';

const PROTOCOLS: { key: Protocol; label: string }[] = [
    { key: 'flv', label: 'HTTP-FLV' },
    { key: 'wsFlv', label: 'WS-FLV' },
    { key: 'hls', label: 'HLS' },
];

/** 点播握手阶段，用于展示拉流进度 */
const HANDSHAKE = ['正在请求点播…', '正在与国标设备信令协商…', '正在等待首帧画面…'];

/** 按场景挑选画面底图：煤场/输煤类通道用堆场视角，其余用衡器区视角 */
function frameOf(camera: Camera, group: string): string {
    return /煤|皮带|输煤|堆|卸/.test(`${camera.name}${group}`) ? coalYardFrame : weighbridgeFrame;
}

/** 由通道号派生稳定的码流参数，避免每次打开都跳动 */
function streamStats(camera: Camera) {
    const seed = [...camera.channelId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return {
        resolution: seed % 3 === 0 ? '2560×1440' : '1920×1080',
        fps: 25,
        bitrate: 2048 + (seed % 9) * 256,
    };
}

function clockText(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function LivePreviewModal({
    open,
    camera,
    data,
    onClose,
}: {
    open: boolean;
    camera: Camera | null;
    data: DeviceDomainData;
    onClose: () => void;
}) {
    const [protocol, setProtocol] = useState<Protocol>('flv');
    const [phase, setPhase] = useState(0);
    const [live, setLive] = useState(false);
    const [muted, setMuted] = useState(true);
    const [fullscreen, setFullscreen] = useState(false);
    const [clock, setClock] = useState('');
    /** 每次重连自增，用于重跑握手流程 */
    const [attempt, setAttempt] = useState(0);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

    const group = camera ? groupName(data.groups, camera.groupId) : '';
    const deviceText = camera ? camera.deviceId || '—' : '—';
    const urls = camera ? buildStreamUrls(camera) : null;

    /** 点播前置条件：按接入方式各看一项，不满足则不进入拉流 */
    const blocked = !camera
        ? ''
        : camera.accessType === 'nonGb'
          ? camera.host
              ? ''
              : '未录入摄像头 IP，无法直连取流。请补全网络接入信息后重试。'
          : onlyDigits(camera.channelId).length !== 20
            ? '国标通道号不完整，无法定位通道。请补全 20 位通道号后重试。'
            : '';

    useEffect(() => {
        if (!open) return;
        setFullscreen(false);
        setProtocol('flv');
        setAttempt(0);
    }, [open]);

    /** 握手 → 出画；切换协议或重连都会重跑 */
    useEffect(() => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
        if (!open || !camera || blocked) {
            setLive(false);
            setPhase(0);
            return;
        }
        setLive(false);
        setPhase(0);
        HANDSHAKE.forEach((_, index) => {
            if (index === 0) return;
            timers.current.push(setTimeout(() => setPhase(index), index * 420));
        });
        timers.current.push(setTimeout(() => setLive(true), HANDSHAKE.length * 420));
        return () => {
            timers.current.forEach(clearTimeout);
            timers.current = [];
        };
    }, [open, camera?.id, protocol, attempt, blocked]);

    useEffect(() => {
        if (!open || !live) return;
        setClock(clockText());
        const id = setInterval(() => setClock(clockText()), 1000);
        return () => clearInterval(id);
    }, [open, live]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (fullscreen) setFullscreen(false);
                else onClose();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, fullscreen, onClose]);

    if (!open || !camera || !urls) return null;

    const stats = streamStats(camera);
    const activeUrl = urls[protocol];

    return createPortal(
        <div
            className="vdm-overlay vdm-overlay-live"
            style={{ zIndex: 1200 }}
            onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className={`vdm-live${fullscreen ? ' is-fullscreen' : ''}`}
                role="dialog"
                aria-modal="true"
                aria-label={`${camera.name} 实时监控`}
            >
                <div className="vdm-live-head">
                    <div className="vdm-live-title-wrap">
                        <span className="vdm-live-title">{camera.name}</span>
                        <span className="vdm-live-sub">
                            {group} · {dictLabel(CAMERA_TYPE_DICT, camera.cameraType)} · 通道 {camera.channelNo || '—'}
                        </span>
                    </div>
                    <button type="button" className="vdm-icon-close" onClick={onClose} aria-label="关闭">
                        <X size={16} />
                    </button>
                </div>

                <div className="vdm-live-stage">
                    {blocked ? (
                        <div className="vdm-live-state is-error">
                            <Zap size={26} />
                            <p className="vdm-live-state-title">无法加载实时画面</p>
                            <p className="vdm-live-state-desc">{blocked}</p>
                        </div>
                    ) : (
                        <>
                            <img className="vdm-live-frame" src={frameOf(camera, group)} alt={`${camera.name} 实时画面`} />
                            <div className="vdm-live-grain" aria-hidden="true" />

                            {live ? (
                                <>
                                    <div className="vdm-live-osd is-top-left">
                                        <span className="vdm-live-badge">
                                            <i className="vdm-live-dot" />
                                            LIVE
                                        </span>
                                        <span>{camera.name}</span>
                                    </div>
                                    <div className="vdm-live-osd is-top-right">{clock}</div>
                                    <div className="vdm-live-osd is-bottom-left">
                                        {deviceText} · {camera.channelId}
                                    </div>
                                    <div className="vdm-live-osd is-bottom-right">
                                        {stats.resolution} · {stats.fps}fps · {stats.bitrate}kbps ·{' '}
                                        {PROTOCOLS.find((item) => item.key === protocol)?.label}
                                    </div>
                                </>
                            ) : (
                                <div className="vdm-live-state">
                                    <span className="vdm-live-spinner" aria-hidden="true" />
                                    <p className="vdm-live-state-title">{HANDSHAKE[phase]}</p>
                                    <p className="vdm-live-state-desc">
                                        {PROTOCOLS.find((item) => item.key === protocol)?.label} 拉流 · 通道{' '}
                                        {camera.channelId}
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="vdm-live-toolbar">
                    <div className="vdm-live-protocols">
                        {PROTOCOLS.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                className={`vdm-live-proto${protocol === item.key ? ' is-active' : ''}`}
                                disabled={!!blocked}
                                onClick={() => setProtocol(item.key)}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <div className="vdm-live-tools">
                        <IconButton title="重新拉流" onClick={() => setAttempt((n) => n + 1)}>
                            <RefreshCw size={14} />
                        </IconButton>
                        <IconButton
                            title={muted ? '取消静音' : '静音'}
                            onClick={() => setMuted((m) => !m)}
                        >
                            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                        </IconButton>
                        <IconButton
                            title="抓图"
                            onClick={() => {
                                if (!live) {
                                    message.warning('画面尚未加载完成');
                                    return;
                                }
                                message.success(`已抓拍「${camera.name}」当前画面`);
                            }}
                        >
                            <CameraIcon size={14} />
                        </IconButton>
                        <IconButton
                            title={fullscreen ? '退出全屏' : '全屏'}
                            onClick={() => setFullscreen((f) => !f)}
                        >
                            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        </IconButton>
                    </div>
                </div>

                <div className="vdm-live-meta">
                    <dl>
                        <div>
                            <dt>国标设备 ID</dt>
                            <dd>{deviceText}</dd>
                        </div>
                        <div>
                            <dt>国标通道号</dt>
                            <dd>
                                <CopyText text={camera.channelId || '—'} mono />
                            </dd>
                        </div>
                        <div>
                            <dt>厂商</dt>
                            <dd>{dictLabel(VENDOR_DICT, camera.vendor) || '—'}</dd>
                        </div>
                        <div>
                            <dt>网络</dt>
                            <dd className="vdm-mono">
                                {camera.host ? `${camera.host}:${camera.port || '554'}` : '—'}
                            </dd>
                        </div>
                    </dl>
                    <div className="vdm-live-url">
                        <span>当前取流地址</span>
                        <CopyText text={activeUrl} mono />
                    </div>
                </div>

                <div className="vdm-live-foot">
                    <span className="vdm-live-foot-tip">
                        RTSP 源地址 <code>{urls.rtsp}</code> 需使用 VLC 等播放器打开。
                    </span>
                    <Button onClick={onClose}>关闭</Button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

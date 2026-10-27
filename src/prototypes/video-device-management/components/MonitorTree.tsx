/**
 * 视频监控左侧摄像头列表：分组树 + 摄像头
 *
 * 实时监控与视频回放共用同一套点播交互：分组行批量点播（按当前分屏数量播前几路），
 * 摄像头行点播到右侧选中的分屏窗口，正在播放的节点高亮。
 */
import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, PlayCircle, Video } from 'lucide-react';
import { CAMERA_TYPE_DICT, Camera, DeviceDomainData, GroupTreeNode, buildGroupTree, dictLabel } from '../data';
import { SearchInput } from './ui';

interface MonitorTreeProps {
    data: DeviceDomainData;
    /** 当前分屏窗口数，用于容量提示与批量点播路数 */
    capacity: number;
    /** 正在播放（实时或回放）的摄像头 */
    playingIds: string[];
    onPlayCamera: (cameraId: string) => void;
    onBatchPlay: (cameraIds: string[]) => void;
    /** 点播动作文案：实时监控为「点播」，视频回放为「回放」 */
    actionText?: string;
}

export function MonitorTree({
    data,
    capacity,
    playingIds,
    onPlayCamera,
    onBatchPlay,
    actionText = '点播',
}: MonitorTreeProps) {
    const [keyword, setKeyword] = useState('');
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    const tree = useMemo(() => buildGroupTree(data.groups), [data.groups]);
    const playing = useMemo(() => new Set(playingIds), [playingIds]);
    const key = keyword.trim();

    const camerasOf = (groupId: string): Camera[] =>
        data.cameras
            .filter((camera) => camera.groupId === groupId)
            .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'zh-CN'));

    const subtreeCameraIds = (node: GroupTreeNode): string[] => [
        ...camerasOf(node.id).map((camera) => camera.id),
        ...node.children.flatMap(subtreeCameraIds),
    ];

    /** 关键字命中：分组名命中则整组保留，否则只保留命中的摄像头 */
    const nodeMatched = (node: GroupTreeNode): boolean => {
        if (!key) return true;
        if (node.name.includes(key)) return true;
        if (camerasOf(node.id).some((camera) => camera.name.includes(key))) return true;
        return node.children.some(nodeMatched);
    };

    const toggleCollapse = (id: string) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const renderCamera = (camera: Camera, depth: number) => {
        const onAir = playing.has(camera.id);

        return (
            <div
                key={camera.id}
                className={`vdm-mon-leaf${onAir ? ' is-playing' : ''}`}
                style={{ paddingLeft: 10 + depth * 16 }}
                onClick={() => onPlayCamera(camera.id)}
                title={`${actionText}「${camera.name}」到选中分屏`}
            >
                <span className="vdm-mon-leaf-state">{onAir ? <i className="vdm-mon-live-dot" /> : null}</span>
                <Video size={13} className="vdm-mon-leaf-icon" />
                <span className="vdm-mon-leaf-name">{camera.name}</span>
                <span className="vdm-mon-leaf-tag">{dictLabel(CAMERA_TYPE_DICT, camera.cameraType)}</span>
                <button
                    type="button"
                    className="vdm-mon-play-btn"
                    title={`${actionText}到选中分屏`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onPlayCamera(camera.id);
                    }}
                >
                    <PlayCircle size={14} />
                </button>
            </div>
        );
    };

    const renderNodes = (nodes: GroupTreeNode[]): React.ReactNode =>
        nodes.filter(nodeMatched).map((node) => {
            const cameras = camerasOf(node.id).filter(
                (camera) => !key || node.name.includes(key) || camera.name.includes(key),
            );
            const groupCameraIds = subtreeCameraIds(node);
            const open = !collapsed.has(node.id) || !!key;
            const hasChildren = cameras.length > 0 || node.children.length > 0;
            const someOnAir = groupCameraIds.some((id) => playing.has(id));

            return (
                <React.Fragment key={node.id}>
                    <div
                        className={`vdm-mon-node${someOnAir ? ' is-partial' : ''}`}
                        style={{ paddingLeft: 8 + node.depth * 16 }}
                        onClick={() => hasChildren && toggleCollapse(node.id)}
                    >
                        {hasChildren ? (
                            <span className="vdm-tree-caret">
                                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </span>
                        ) : (
                            <span className="vdm-tree-caret is-empty" />
                        )}
                        <span className="vdm-mon-node-name">{node.name}</span>
                        <span className="vdm-tree-count">{groupCameraIds.length}</span>
                        <button
                            type="button"
                            className="vdm-mon-play-btn"
                            title={`批量${actionText}「${node.name}」，按当前分屏数量播放前几路`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onBatchPlay(groupCameraIds);
                            }}
                        >
                            <PlayCircle size={15} />
                        </button>
                    </div>
                    {open ? (
                        <>
                            {cameras.map((camera) => renderCamera(camera, node.depth + 1))}
                            {renderNodes(node.children)}
                        </>
                    ) : null}
                </React.Fragment>
            );
        });

    return (
        <aside className="vdm-tree-pane vdm-mon-pane">
            <div className="vdm-tree-head">
                <div className="vdm-tree-head-top">
                    <strong>摄像头列表</strong>
                    <span className="vdm-mon-capacity">
                        播放 {playingIds.length}/{capacity}
                    </span>
                </div>
                <SearchInput value={keyword} onChange={setKeyword} placeholder="搜索分组或摄像头名称" />
            </div>

            <div className="vdm-tree-body">{renderNodes(tree)}</div>

            <div className="vdm-mon-pane-foot">
                <span>分组按分屏数量批量{actionText}，摄像头{actionText}到选中分屏</span>
            </div>
        </aside>
    );
}

import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
    AuthMap,
    CAMERA_TREE,
    CameraNode,
    USERS,
    getDescendantLeafIds,
    unionCameraIds,
} from '../data';
import { Button, Checkbox, Modal } from './ui';

function CameraCheckTree({
    nodes,
    depth,
    checkedIds,
    onToggleLeaves,
}: {
    nodes: CameraNode[];
    depth: number;
    checkedIds: Set<string>;
    onToggleLeaves: (leafIds: string[], on: boolean) => void;
}) {
    return (
        <div className="vp-cam-tree">
            {nodes.map((node) => {
                const leaves = getDescendantLeafIds(node);
                const checked = leaves.every((id) => checkedIds.has(id));
                const indeterminate = !checked && leaves.some((id) => checkedIds.has(id));
                return (
                    <div key={node.id} className="vp-cam-tree-node">
                        <label className="vp-cam-tree-item" style={{ paddingLeft: 8 + depth * 16 }}>
                            <Checkbox
                                checked={checked}
                                indeterminate={indeterminate}
                                onChange={(v) => onToggleLeaves(leaves, v)}
                            />
                            <span className={node.children?.length ? 'vp-tree-group' : ''}>
                                {node.name}
                            </span>
                        </label>
                        {node.children?.length ? (
                            <CameraCheckTree
                                nodes={node.children}
                                depth={depth + 1}
                                checkedIds={checkedIds}
                                onToggleLeaves={onToggleLeaves}
                            />
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}

export function BatchAuthDrawer({
    open,
    userIds,
    auth,
    onClose,
    onConfirm,
}: {
    open: boolean;
    userIds: string[];
    auth: AuthMap;
    onClose: () => void;
    onConfirm: (nextAuth: AuthMap) => void;
}) {
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [confirmOpen, setConfirmOpen] = useState(false);

    const user = useMemo(
        () => (userIds[0] ? USERS.find((u) => u.id === userIds[0]) : undefined),
        [userIds],
    );

    useEffect(() => {
        if (!open) return;
        setChecked(new Set(unionCameraIds(auth, userIds)));
        setConfirmOpen(false);
    }, [open, userIds, auth]);

    const cameraCount = checked.size;

    const toggleLeaves = (leafIds: string[], on: boolean) => {
        setChecked((prev) => {
            const next = new Set(prev);
            leafIds.forEach((id) => (on ? next.add(id) : next.delete(id)));
            return next;
        });
    };

    const apply = () => {
        if (!user) return;
        const nextAuth: AuthMap = { ...auth, [user.id]: [...checked] };
        onConfirm(nextAuth);
        setConfirmOpen(false);
    };

    if (!open) return null;

    return (
        <>
            <div
                className="vp-overlay vp-overlay-drawer"
                onMouseDown={(e) => e.target === e.currentTarget && onClose()}
            >
                <div
                    className="vp-drawer vp-batch-drawer vp-batch-drawer--single"
                    style={{ width: 720 }}
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="vp-drawer-head">
                        <span className="vp-drawer-title">调整摄像头权限</span>
                        <button
                            type="button"
                            className="vp-icon-close"
                            onClick={onClose}
                            aria-label="关闭"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="vp-drawer-body vp-batch-body vp-batch-body--single">
                        <div className="vp-person-brief">
                            <div className="vp-person-brief-item">
                                <span>姓名</span>
                                <strong>{user?.name ?? '—'}</strong>
                            </div>
                            <div className="vp-person-brief-item">
                                <span>部门</span>
                                <strong>{user?.dept || '—'}</strong>
                            </div>
                        </div>

                        <section className="vp-batch-cams">
                            <div className="vp-batch-pane-title">
                                <span className="vp-batch-pane-title-main">
                                    分区 / 摄像头
                                    <em>已选中 {cameraCount} 路摄像头</em>
                                </span>
                                <button
                                    type="button"
                                    className="vp-batch-clear"
                                    disabled={cameraCount === 0}
                                    onClick={() => setChecked(new Set())}
                                >
                                    取消全部勾选
                                </button>
                            </div>
                            <p className="vp-batch-tip">
                                勾选需要授权给该用户的摄像头，确认后覆盖其原有授权
                            </p>
                            <div className="vp-batch-cam-scroll">
                                <CameraCheckTree
                                    nodes={CAMERA_TREE}
                                    depth={0}
                                    checkedIds={checked}
                                    onToggleLeaves={toggleLeaves}
                                />
                            </div>
                        </section>
                    </div>
                    <div className="vp-drawer-foot">
                        <div className="vp-drawer-actions">
                            <Button onClick={onClose}>取消</Button>
                            <Button
                                variant="primary"
                                disabled={!user}
                                onClick={() => setConfirmOpen(true)}
                            >
                                确认调整
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                open={confirmOpen}
                title="确认调整权限？"
                onClose={() => setConfirmOpen(false)}
                footer={
                    <div className="vp-drawer-actions">
                        <Button onClick={() => setConfirmOpen(false)}>取消</Button>
                        <Button variant="primary" onClick={apply}>
                            确认
                        </Button>
                    </div>
                }
            >
                <p>
                    将按当前勾选结果更新该用户的摄像头权限，共 <strong>{cameraCount}</strong>{' '}
                    路摄像头。是否继续？
                </p>
            </Modal>
        </>
    );
}

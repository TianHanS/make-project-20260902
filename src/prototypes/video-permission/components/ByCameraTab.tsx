import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Settings, UserPlus, Users } from 'lucide-react';
import {
    AuthMap,
    CAMERA_TREE,
    CameraNode,
    USERS,
    findCameraName,
    getDescendantLeafIds,
    usersForCamera,
} from '../data';
import { Button, Checkbox, Drawer, Input, message } from './ui';

function CameraRows({
    nodes,
    depth,
    expanded,
    toggleExpand,
    selectedIds,
    toggleSelect,
    auth,
    onAuthorize,
}: {
    nodes: CameraNode[];
    depth: number;
    expanded: Set<string>;
    toggleExpand: (id: string) => void;
    selectedIds: Set<string>;
    toggleSelect: (id: string, leafIds: string[]) => void;
    auth: AuthMap;
    onAuthorize: (cameraId: string) => void;
}) {
    return (
        <>
            {nodes.map((node) => {
                const hasChildren = !!node.children?.length;
                const leafIds = getDescendantLeafIds(node);
                const open = expanded.has(node.id);
                const users = hasChildren
                    ? []
                    : usersForCamera(auth, node.id);
                const checked = leafIds.every((id) => selectedIds.has(id));
                const indeterminate = !checked && leafIds.some((id) => selectedIds.has(id));

                return (
                    <React.Fragment key={node.id}>
                        <tr className="vp-row">
                            <td>
                                <Checkbox
                                    checked={checked}
                                    indeterminate={indeterminate}
                                    onChange={() => toggleSelect(node.id, leafIds)}
                                />
                            </td>
                            <td>
                                <div className="vp-tree-cell" style={{ paddingLeft: depth * 18 }}>
                                    {hasChildren ? (
                                        <button
                                            type="button"
                                            className="vp-tree-toggle"
                                            onClick={() => toggleExpand(node.id)}
                                        >
                                            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </button>
                                    ) : (
                                        <span className="vp-tree-spacer" />
                                    )}
                                    <span className={hasChildren ? 'vp-tree-group' : ''}>{node.name}</span>
                                </div>
                            </td>
                            <td>
                                {hasChildren ? (
                                    <span className="vp-muted">—</span>
                                ) : users.length ? (
                                    <span className="vp-user-chips">
                                        {users.slice(0, 4).map((u) => (
                                            <span key={u.id} className="vp-chip">
                                                {u.name}
                                            </span>
                                        ))}
                                        {users.length > 4 ? (
                                            <span className="vp-chip is-more">+{users.length - 4}</span>
                                        ) : null}
                                    </span>
                                ) : (
                                    <span className="vp-muted">未授权</span>
                                )}
                            </td>
                            <td>
                                <div className="vp-row-actions">
                                    <button
                                        type="button"
                                        className="vp-icon-btn"
                                        title="授权用户"
                                        onClick={() => onAuthorize(node.id)}
                                    >
                                        <UserPlus size={15} />
                                    </button>
                                    <button
                                        type="button"
                                        className="vp-icon-btn"
                                        title="设置"
                                        onClick={() => message.info('摄像头设置本期占位演示')}
                                    >
                                        <Settings size={15} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                        {hasChildren && open ? (
                            <CameraRows
                                nodes={node.children!}
                                depth={depth + 1}
                                expanded={expanded}
                                toggleExpand={toggleExpand}
                                selectedIds={selectedIds}
                                toggleSelect={toggleSelect}
                                auth={auth}
                                onAuthorize={onAuthorize}
                            />
                        ) : null}
                    </React.Fragment>
                );
            })}
        </>
    );
}

export function ByCameraTab({
    auth,
    onChangeAuth,
}: {
    auth: AuthMap;
    onChangeAuth: (next: AuthMap) => void;
}) {
    const [expanded, setExpanded] = useState<Set<string>>(
        () => new Set(['g-lab', 'g-yard', 'g-scale']),
    );
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [authCameraId, setAuthCameraId] = useState<string | null>(null);
    const [pickUsers, setPickUsers] = useState<Set<string>>(new Set());
    const [keyword, setKeyword] = useState('');

    const toggleExpand = (id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelect = (_id: string, leafIds: string[]) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            const allOn = leafIds.every((x) => next.has(x));
            leafIds.forEach((x) => (allOn ? next.delete(x) : next.add(x)));
            return next;
        });
    };

    const openAuthorize = (cameraId: string) => {
        setAuthCameraId(cameraId);
        const assigned = USERS.filter((u) => (auth[u.id] || []).includes(cameraId)).map((u) => u.id);
        setPickUsers(new Set(assigned));
        setKeyword('');
    };

    const filteredUsers = useMemo(() => {
        const q = keyword.trim();
        if (!q) return USERS.filter((u) => u.enabled);
        return USERS.filter(
            (u) =>
                u.enabled &&
                (u.name.includes(q) || u.loginName.includes(q) || u.dept.includes(q)),
        );
    }, [keyword]);

    const saveAuthorize = () => {
        if (!authCameraId) return;
        const next: AuthMap = { ...auth };
        for (const u of USERS) {
            const set = new Set(next[u.id] || []);
            if (pickUsers.has(u.id)) set.add(authCameraId);
            else set.delete(authCameraId);
            next[u.id] = [...set];
        }
        onChangeAuth(next);
        message.success(`已更新「${findCameraName(authCameraId)}」授权用户`);
        setAuthCameraId(null);
    };

    return (
        <div className="vp-panel">
            <div className="vp-toolbar">
                <Button
                    variant="primary"
                    icon={<Users size={15} />}
                    onClick={() => message.info('请先在列表中选择摄像头，或使用行内「授权用户」')}
                >
                    添加成员
                </Button>
                <span className="vp-toolbar-hint">按摄像头查看与维护授权；批量删改请切到「按人员授权」</span>
            </div>

            <div className="vp-table-wrap">
                <table className="vp-table">
                    <thead>
                        <tr>
                            <th style={{ width: 48 }} />
                            <th>摄像头名称</th>
                            <th>已授权用户</th>
                            <th style={{ width: 100 }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <CameraRows
                            nodes={CAMERA_TREE}
                            depth={0}
                            expanded={expanded}
                            toggleExpand={toggleExpand}
                            selectedIds={selectedIds}
                            toggleSelect={toggleSelect}
                            auth={auth}
                            onAuthorize={openAuthorize}
                        />
                    </tbody>
                </table>
            </div>

            <Drawer
                open={!!authCameraId}
                title={`授权用户 · ${authCameraId ? findCameraName(authCameraId) : ''}`}
                onClose={() => setAuthCameraId(null)}
                width={480}
                footer={
                    <div className="vp-drawer-actions">
                        <Button onClick={() => setAuthCameraId(null)}>取消</Button>
                        <Button variant="primary" onClick={saveAuthorize}>
                            确定
                        </Button>
                    </div>
                }
            >
                <Input value={keyword} onChange={setKeyword} placeholder="搜索姓名 / 登录名 / 部门" />
                <div className="vp-pick-list">
                    {filteredUsers.map((u) => (
                        <label key={u.id} className="vp-pick-item">
                            <Checkbox
                                checked={pickUsers.has(u.id)}
                                onChange={(v) => {
                                    setPickUsers((prev) => {
                                        const next = new Set(prev);
                                        if (v) next.add(u.id);
                                        else next.delete(u.id);
                                        return next;
                                    });
                                }}
                            />
                            <span className="vp-pick-main">
                                <strong>{u.name}</strong>
                                <em>
                                    {u.loginName} · {u.post}
                                </em>
                            </span>
                        </label>
                    ))}
                </div>
            </Drawer>
        </div>
    );
}

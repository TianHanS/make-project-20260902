/**
 * 左侧分组树：筛选摄像头 + 就地维护分组（含拖拽调整父级与排序）
 */
import React, { useMemo, useState } from 'react';
import {
    ChevronDown,
    ChevronRight,
    FolderPlus,
    Layers,
    Pencil,
    Trash2,
} from 'lucide-react';
import {
    CameraGroup,
    DeviceDomainData,
    GroupTreeNode,
    buildGroupTree,
    collectSubtreeIds,
    countCamerasByGroup,
} from '../data';
import { IconButton, SearchInput } from './ui';

export type DropPosition = 'inside' | 'before' | 'after';

export const ALL_GROUP_ID = '';

interface GroupTreeProps {
    data: DeviceDomainData;
    selectedId: string;
    onSelect: (groupId: string) => void;
    onCreate: (parentId: string | null) => void;
    onEdit: (group: CameraGroup) => void;
    onDelete: (group: CameraGroup) => void;
    onMove: (dragId: string, targetId: string, position: DropPosition) => void;
}

function matchKeyword(node: GroupTreeNode, keyword: string): boolean {
    if (!keyword) return true;
    if (node.name.includes(keyword)) return true;
    return node.children.some((child) => matchKeyword(child, keyword));
}

export function GroupTree({
    data,
    selectedId,
    onSelect,
    onCreate,
    onEdit,
    onDelete,
    onMove,
}: GroupTreeProps) {
    const tree = useMemo(() => buildGroupTree(data.groups), [data.groups]);
    const [keyword, setKeyword] = useState('');
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [dragId, setDragId] = useState<string | null>(null);
    const [dropHint, setDropHint] = useState<{ id: string; position: DropPosition } | null>(null);

    const toggle = (id: string) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const forbiddenIds = useMemo(
        () => (dragId ? collectSubtreeIds(data.groups, dragId) : new Set<string>()),
        [dragId, data.groups],
    );

    const resolvePosition = (e: React.DragEvent<HTMLDivElement>): DropPosition => {
        const rect = e.currentTarget.getBoundingClientRect();
        const offset = e.clientY - rect.top;
        if (offset < rect.height * 0.28) return 'before';
        if (offset > rect.height * 0.72) return 'after';
        return 'inside';
    };

    const renderNodes = (nodes: GroupTreeNode[]): React.ReactNode =>
        nodes
            .filter((node) => matchKeyword(node, keyword.trim()))
            .map((node) => {
                const hasChildren = node.children.length > 0;
                const open = !collapsed.has(node.id) || !!keyword.trim();
                const counts = countCamerasByGroup(data, node.id);
                const active = selectedId === node.id;
                const isDropTarget = dropHint?.id === node.id;
                const dragging = dragId === node.id;

                return (
                    <React.Fragment key={node.id}>
                        <div
                            className={[
                                'vdm-tree-node',
                                active ? 'is-active' : '',
                                dragging ? 'is-dragging' : '',
                                isDropTarget ? `is-drop-${dropHint?.position}` : '',
                            ]
                                .filter(Boolean)
                                .join(' ')}
                            style={{ paddingLeft: 8 + node.depth * 16 }}
                            draggable
                            onDragStart={(e) => {
                                setDragId(node.id);
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', node.id);
                            }}
                            onDragEnd={() => {
                                setDragId(null);
                                setDropHint(null);
                            }}
                            onDragOver={(e) => {
                                if (!dragId || forbiddenIds.has(node.id)) return;
                                e.preventDefault();
                                setDropHint({ id: node.id, position: resolvePosition(e) });
                            }}
                            onDragLeave={() => {
                                if (dropHint?.id === node.id) setDropHint(null);
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                if (!dragId || forbiddenIds.has(node.id)) return;
                                onMove(dragId, node.id, resolvePosition(e));
                                setDragId(null);
                                setDropHint(null);
                            }}
                            onClick={() => onSelect(node.id)}
                        >
                            {hasChildren ? (
                                <button
                                    type="button"
                                    className="vdm-tree-caret"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggle(node.id);
                                    }}
                                    aria-label={open ? '折叠' : '展开'}
                                >
                                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                            ) : (
                                <span className="vdm-tree-caret is-empty" />
                            )}

                            <span className="vdm-tree-name" title={node.name}>
                                {node.name}
                            </span>
                            <span
                                className="vdm-tree-count"
                                title={`本级 ${counts.own} 路 / 含下级 ${counts.total} 路`}
                            >
                                {counts.total}
                            </span>

                            <span className="vdm-tree-actions" onClick={(e) => e.stopPropagation()}>
                                <IconButton title="新增子分组" onClick={() => onCreate(node.id)}>
                                    <FolderPlus size={13} />
                                </IconButton>
                                <IconButton title="编辑分组" onClick={() => onEdit(node)}>
                                    <Pencil size={13} />
                                </IconButton>
                                <IconButton title="删除分组" danger onClick={() => onDelete(node)}>
                                    <Trash2 size={13} />
                                </IconButton>
                            </span>
                        </div>
                        {hasChildren && open ? renderNodes(node.children) : null}
                    </React.Fragment>
                );
            });

    return (
        <aside className="vdm-tree-pane">
            <div className="vdm-tree-head">
                <div className="vdm-tree-head-top">
                    <strong>摄像头分组</strong>
                    <IconButton title="新增根分组" onClick={() => onCreate(null)}>
                        <FolderPlus size={14} />
                    </IconButton>
                </div>
                <SearchInput value={keyword} onChange={setKeyword} placeholder="搜索分组名称" />
            </div>

            <div className="vdm-tree-body">
                <div
                    className={`vdm-tree-node is-all${selectedId === ALL_GROUP_ID ? ' is-active' : ''}`}
                    onClick={() => onSelect(ALL_GROUP_ID)}
                >
                    <span className="vdm-tree-caret is-empty" />
                    <Layers size={13} className="vdm-tree-all-icon" />
                    <span className="vdm-tree-name">全部摄像头</span>
                    <span className="vdm-tree-count">{data.cameras.length}</span>
                </div>
                {renderNodes(tree)}
            </div>

            <div className="vdm-tree-foot">
                <span>长按分组可拖拽调整父级与排序</span>
            </div>
        </aside>
    );
}

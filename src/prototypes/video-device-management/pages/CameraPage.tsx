/**
 * UR1.1 摄像头管理（含分组）
 * 左侧分组树 + 右侧摄像头列表，分组与摄像头在同一功能页完成。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { GripVertical, Pencil, Plus, Search, Trash2, Upload, Video } from 'lucide-react';
import {
    ACCESS_TYPE_DICT,
    CAMERA_TYPE_DICT,
    Camera,
    CameraGroup,
    DeviceDomainData,
    VENDOR_DICT,
    collectDeviceOptions,
    collectSubtreeIds,
    countCamerasByGroup,
    dictLabel,
    groupName,
    groupPathName,
    touchAudit,
} from '../data';
import {
    Button,
    Checkbox,
    ConfirmModal,
    ConfirmState,
    CopyText,
    EmptyRow,
    IconButton,
    Input,
    PAGE_SIZE_DEFAULT,
    Pagination,
    Select,
    TableWrap,
    message,
    useConfirm,
} from '../components/ui';
import { ALL_GROUP_ID, DropPosition, GroupTree } from '../components/GroupTree';
import { CameraFormDrawer } from '../components/CameraFormDrawer';
import { GroupFormDrawer } from '../components/GroupFormDrawer';
import { CameraImportDrawer } from '../components/CameraImportDrawer';
import { LivePreviewModal } from '../components/LivePreviewModal';

/** 拖拽后重算父级与同级排序 */
function moveGroup(
    groups: CameraGroup[],
    dragId: string,
    targetId: string,
    position: DropPosition,
): CameraGroup[] {
    const drag = groups.find((item) => item.id === dragId);
    const target = groups.find((item) => item.id === targetId);
    if (!drag || !target || dragId === targetId) return groups;
    if (collectSubtreeIds(groups, dragId).has(targetId)) return groups;

    const nextParentId = position === 'inside' ? target.id : target.parentId;
    const siblings = groups
        .filter((item) => item.id !== dragId && (item.parentId || null) === (nextParentId || null))
        .sort((a, b) => a.sort - b.sort);

    let ordered: CameraGroup[];
    if (position === 'inside') {
        ordered = [...siblings, { ...drag, parentId: nextParentId }];
    } else {
        const at = siblings.findIndex((item) => item.id === targetId);
        const insertAt = position === 'before' ? Math.max(at, 0) : at + 1;
        ordered = [...siblings];
        ordered.splice(insertAt, 0, { ...drag, parentId: nextParentId });
    }

    const sortMap = new Map(ordered.map((item, index) => [item.id, index + 1]));
    return groups.map((item) => {
        if (item.id === dragId) {
            return { ...item, parentId: nextParentId, sort: sortMap.get(dragId) ?? item.sort };
        }
        if (sortMap.has(item.id)) return { ...item, sort: sortMap.get(item.id)! };
        return item;
    });
}

/**
 * 拖拽后重算本分组内摄像头的排序号
 * ordered 为当前列表展示顺序（即该分组本级摄像头按排序号升序）
 */
function moveCamera(
    cameras: Camera[],
    ordered: Camera[],
    dragId: string,
    targetId: string,
    after: boolean,
): Camera[] {
    if (dragId === targetId) return cameras;
    const drag = ordered.find((item) => item.id === dragId);
    if (!drag || !ordered.some((item) => item.id === targetId)) return cameras;

    const next = ordered.filter((item) => item.id !== dragId);
    const targetAt = next.findIndex((item) => item.id === targetId);
    next.splice(after ? targetAt + 1 : targetAt, 0, drag);

    const sortMap = new Map(next.map((item, index) => [item.id, index + 1]));
    return cameras.map((item) => {
        const sort = sortMap.get(item.id);
        if (sort === undefined || sort === item.sort) return item;
        return { ...item, sort, ...touchAudit(item) };
    });
}

/** 字段顺序与列表列顺序保持一致：名称 → 种类 → 接入方式 → 国标设备 ID → 通道号 → 厂商 */
interface CameraFilters {
    name: string;
    type: string;
    accessType: string;
    device: string;
    channelNo: string;
    vendor: string;
    ownOnly: boolean;
}

const EMPTY_FILTERS: CameraFilters = {
    name: '',
    type: '',
    accessType: '',
    device: '',
    channelNo: '',
    vendor: '',
    ownOnly: false,
};

export function CameraPage({
    data,
    onChange,
}: {
    data: DeviceDomainData;
    onChange: (next: DeviceDomainData) => void;
}) {
    const [selectedGroupId, setSelectedGroupId] = useState<string>(ALL_GROUP_ID);
    /** filters 为输入中的草稿，query 为点「查询」后真正生效的条件；分组树切换即时生效 */
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [query, setQuery] = useState(EMPTY_FILTERS);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);

    const [cameraDrawer, setCameraDrawer] = useState<{ open: boolean; editing: Camera | null }>({
        open: false,
        editing: null,
    });
    const [groupDrawer, setGroupDrawer] = useState<{
        open: boolean;
        editing: CameraGroup | null;
        parentId: string | null;
    }>({ open: false, editing: null, parentId: null });
    const [importOpen, setImportOpen] = useState(false);
    const [previewCamera, setPreviewCamera] = useState<Camera | null>(null);
    /** 列表排序拖拽：dragReady 由拖拽手柄按下后置起，避免整行误拖 */
    const [dragReady, setDragReady] = useState(false);
    const [dragCameraId, setDragCameraId] = useState<string | null>(null);
    const [dropHint, setDropHint] = useState<{ id: string; after: boolean } | null>(null);
    const { confirmState, confirm, closeConfirm } = useConfirm();

    /** 所属设备下拉：候选来自摄像头表中已录入的设备 */
    const deviceOptions = useMemo(() => collectDeviceOptions(data), [data]);

    const runQuery = () => {
        setQuery(filters);
        setPage(1);
    };

    const resetQuery = () => {
        setFilters(EMPTY_FILTERS);
        setQuery(EMPTY_FILTERS);
        setPage(1);
    };

    const selectGroup = (groupId: string) => {
        setSelectedGroupId(groupId);
        setPage(1);
    };

    const visibleGroupIds = useMemo(() => {
        if (selectedGroupId === ALL_GROUP_ID) return null;
        return query.ownOnly ? new Set([selectedGroupId]) : collectSubtreeIds(data.groups, selectedGroupId);
    }, [selectedGroupId, query.ownOnly, data.groups]);

    const cameras = useMemo(() => {
        const name = query.name.trim();
        const channelNo = query.channelNo.trim();
        return data.cameras
            .filter((camera) => (visibleGroupIds ? visibleGroupIds.has(camera.groupId) : true))
            .filter((camera) => (name ? camera.name.includes(name) : true))
            .filter((camera) => (query.type ? camera.cameraType === query.type : true))
            .filter((camera) => (query.accessType ? camera.accessType === query.accessType : true))
            .filter((camera) => (query.device ? camera.deviceId === query.device : true))
            .filter((camera) => (channelNo ? camera.channelNo === channelNo : true))
            .filter((camera) => (query.vendor ? camera.vendor === query.vendor : true))
            .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'zh-CN'));
    }, [data, visibleGroupIds, query]);

    const pageCount = Math.max(1, Math.ceil(cameras.length / pageSize));
    const safePage = Math.min(page, pageCount);
    const pagedCameras = cameras.slice((safePage - 1) * pageSize, safePage * pageSize);

    /** 选中分组且仅加载本级时才出排序拖拽；其它筛选条件会让列表只剩子集，此时手柄禁用 */
    const reorderable = selectedGroupId !== ALL_GROUP_ID && query.ownOnly;
    const narrowedByFilters = !!(
        query.name.trim() ||
        query.type ||
        query.accessType ||
        query.device ||
        query.channelNo.trim() ||
        query.vendor
    );
    const canReorder = reorderable && !narrowedByFilters;

    const resolveDropAfter = (e: React.DragEvent<HTMLTableRowElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        return e.clientY - rect.top > rect.height / 2;
    };

    const endDrag = () => {
        setDragCameraId(null);
        setDropHint(null);
        setDragReady(false);
    };

    const dropCamera = (targetId: string, after: boolean) => {
        if (!dragCameraId) return;
        const next = moveCamera(data.cameras, cameras, dragCameraId, targetId, after);
        if (next !== data.cameras) {
            onChange({ ...data, cameras: next });
            message.success('本分组内摄像头排序已更新');
        }
        endDrag();
    };

    /* ---------------- 分组操作 ---------------- */

    const saveGroup = (group: CameraGroup) => {
        const exists = data.groups.some((item) => item.id === group.id);
        onChange({
            ...data,
            groups: exists ? data.groups.map((item) => (item.id === group.id ? group : item)) : [...data.groups, group],
        });
        setGroupDrawer({ open: false, editing: null, parentId: null });
        message.success(exists ? '分组已更新' : '分组已新增');
    };

    const deleteGroup = (group: CameraGroup) => {
        const hasChild = data.groups.some((item) => item.parentId === group.id);
        const counts = countCamerasByGroup(data, group.id);
        if (hasChild) {
            message.error(`「${group.name}」存在子分组，请先迁移或删除子分组`);
            return;
        }
        if (counts.own > 0) {
            message.error(`「${group.name}」下仍有 ${counts.own} 路摄像头，请先迁移`);
            return;
        }
        confirm({
            title: '删除分组',
            danger: true,
            okText: '删除',
            content: (
                <>
                    确认删除分组「<strong>{group.name}</strong>」？删除后不可恢复。
                </>
            ),
            onOk: () => {
                onChange({ ...data, groups: data.groups.filter((item) => item.id !== group.id) });
                if (selectedGroupId === group.id) setSelectedGroupId(ALL_GROUP_ID);
                message.success('分组已删除');
            },
        });
    };

    const handleMove = (dragId: string, targetId: string, position: DropPosition) => {
        const next = moveGroup(data.groups, dragId, targetId, position);
        if (next === data.groups) {
            message.warning('不能将分组挂到自身或其子孙分组下');
            return;
        }
        onChange({ ...data, groups: next });
        message.success('分组层级与排序已更新');
    };

    /* ---------------- 摄像头操作 ---------------- */

    /** 保存成功才关闭抽屉并提示结果；preview 时紧接着唤起点播窗口 */
    const saveCamera = (camera: Camera, options?: { preview?: boolean }) => {
        const exists = data.cameras.some((item) => item.id === camera.id);
        onChange({
            ...data,
            cameras: exists
                ? data.cameras.map((item) => (item.id === camera.id ? camera : item))
                : [...data.cameras, camera],
        });
        setCameraDrawer({ open: false, editing: null });
        message.success(`「${camera.name}」${exists ? '已保存' : '已新增'}`);
        if (options?.preview) setPreviewCamera(camera);
    };

    const deleteCamera = (camera: Camera) => {
        confirm({
            title: '删除摄像头',
            danger: true,
            okText: '删除',
            content: (
                <>
                    确认删除摄像头「<strong>{camera.name}</strong>」？
                    <br />
                    国标通道号 <code>{camera.channelId}</code> 将同时释放。
                </>
            ),
            onOk: () => {
                onChange({ ...data, cameras: data.cameras.filter((item) => item.id !== camera.id) });
                message.success('摄像头已删除');
            },
        });
    };

    const groupCounts = selectedGroupId ? countCamerasByGroup(data, selectedGroupId) : null;

    return (
        <div className="vdm-split">
            <GroupTree
                data={data}
                selectedId={selectedGroupId}
                onSelect={selectGroup}
                onCreate={(parentId) => setGroupDrawer({ open: true, editing: null, parentId })}
                onEdit={(group) => setGroupDrawer({ open: true, editing: group, parentId: group.parentId })}
                onDelete={deleteGroup}
                onMove={handleMove}
            />

            <section className="vdm-content">
                <header className="vdm-content-head">
                    <div className="vdm-content-title">
                        <h2>
                            {selectedGroupId === ALL_GROUP_ID ? '全部摄像头' : groupPathName(data.groups, selectedGroupId)}
                        </h2>
                        <span>
                            {groupCounts
                                ? `本级 ${groupCounts.own} 路 · 含下级 ${groupCounts.total} 路`
                                : `共 ${data.cameras.length} 路`}
                            {canReorder ? ' · 可按操作列手柄拖拽调整排序' : ''}
                        </span>
                    </div>
                    <div className="vdm-content-actions">
                        <Button icon={<Upload size={14} />} onClick={() => setImportOpen(true)}>
                            导入
                        </Button>
                        <Button
                            variant="primary"
                            icon={<Plus size={14} />}
                            onClick={() => setCameraDrawer({ open: true, editing: null })}
                        >
                            新增
                        </Button>
                    </div>
                </header>

                <div className="vdm-filter-bar">
                    <label className="vdm-filter-field">
                        <span>摄像头名称</span>
                        <Input
                            value={filters.name}
                            onChange={(value) => setFilters((prev) => ({ ...prev, name: value }))}
                            onEnter={runQuery}
                            placeholder="按名称筛选"
                        />
                    </label>
                    <label className="vdm-filter-field">
                        <span>种类</span>
                        <Select
                            value={filters.type}
                            onChange={(value) => setFilters((prev) => ({ ...prev, type: value }))}
                            allowClear
                            placeholder="全部种类"
                            options={CAMERA_TYPE_DICT}
                        />
                    </label>
                    <label className="vdm-filter-field">
                        <span>接入方式</span>
                        <Select
                            value={filters.accessType}
                            onChange={(value) => setFilters((prev) => ({ ...prev, accessType: value }))}
                            allowClear
                            placeholder="全部方式"
                            options={ACCESS_TYPE_DICT}
                        />
                    </label>
                    <label className="vdm-filter-field">
                        <span>国标设备 ID</span>
                        <Select
                            value={filters.device}
                            onChange={(value) => setFilters((prev) => ({ ...prev, device: value }))}
                            allowClear
                            placeholder="全部设备"
                            options={deviceOptions.map((item) => ({
                                value: item.deviceId,
                                label: item.deviceId,
                                desc: `${item.count} 路`,
                            }))}
                        />
                    </label>
                    <label className="vdm-filter-field">
                        <span>通道号</span>
                        <Input
                            value={filters.channelNo}
                            onChange={(value) => setFilters((prev) => ({ ...prev, channelNo: value }))}
                            onEnter={runQuery}
                            digitsOnly
                            placeholder="按通道号筛选"
                        />
                    </label>
                    <label className="vdm-filter-field">
                        <span>厂商</span>
                        <Select
                            value={filters.vendor}
                            onChange={(value) => setFilters((prev) => ({ ...prev, vendor: value }))}
                            allowClear
                            placeholder="全部厂商"
                            options={VENDOR_DICT}
                        />
                    </label>
                    <div className="vdm-filter-tail">
                        <Checkbox
                            checked={filters.ownOnly}
                            disabled={selectedGroupId === ALL_GROUP_ID}
                            onChange={(checked) => setFilters((prev) => ({ ...prev, ownOnly: checked }))}
                        >
                            仅展示本级
                        </Checkbox>
                        <Button variant="primary" icon={<Search size={14} />} onClick={runQuery}>
                            查询
                        </Button>
                        <Button onClick={resetQuery}>重置</Button>
                    </div>
                </div>

                <TableWrap minWidth={reorderable ? 1854 : 1824}>
                    <thead>
                        <tr>
                            <th style={{ width: 200 }}>名称</th>
                            <th style={{ width: 120 }}>分组</th>
                            <th style={{ width: 84 }}>种类</th>
                            <th style={{ width: 96 }}>接入方式</th>
                            <th style={{ width: 190 }}>国标设备 ID</th>
                            <th style={{ width: 190 }}>国标通道号</th>
                            <th style={{ width: 80 }}>通道号</th>
                            <th style={{ width: 160 }}>网络</th>
                            <th style={{ width: 100 }}>厂商</th>
                            <th style={{ width: 96 }}>更新人</th>
                            <th style={{ width: 160 }}>更新时间</th>
                            <th style={{ width: 96 }}>创建人</th>
                            <th style={{ width: 160 }}>创建时间</th>
                            <th className="vdm-col-actions" style={{ width: reorderable ? 158 : 128 }}>
                                操作
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {pagedCameras.length ? (
                            pagedCameras.map((camera) => {
                                const isDropTarget = dropHint?.id === camera.id && dragCameraId !== camera.id;
                                return (
                                    <tr
                                        key={camera.id}
                                        className={[
                                            'vdm-row',
                                            dragCameraId === camera.id ? 'is-dragging' : '',
                                            isDropTarget ? `is-drop-${dropHint?.after ? 'after' : 'before'}` : '',
                                        ]
                                            .filter(Boolean)
                                            .join(' ')}
                                        draggable={canReorder && dragReady}
                                        onDragStart={(e) => {
                                            setDragCameraId(camera.id);
                                            e.dataTransfer.effectAllowed = 'move';
                                            e.dataTransfer.setData('text/plain', camera.id);
                                        }}
                                        onDragEnd={endDrag}
                                        onDragOver={(e) => {
                                            if (!dragCameraId) return;
                                            e.preventDefault();
                                            setDropHint({ id: camera.id, after: resolveDropAfter(e) });
                                        }}
                                        onDragLeave={() =>
                                            setDropHint((prev) => (prev?.id === camera.id ? null : prev))
                                        }
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            dropCamera(camera.id, resolveDropAfter(e));
                                        }}
                                    >
                                        <td className="vdm-td-strong">{camera.name}</td>
                                        <td>{groupName(data.groups, camera.groupId)}</td>
                                        <td>{dictLabel(CAMERA_TYPE_DICT, camera.cameraType)}</td>
                                        <td>{dictLabel(ACCESS_TYPE_DICT, camera.accessType)}</td>
                                        <td>
                                            <CopyText text={camera.deviceId || '—'} mono />
                                        </td>
                                        <td>
                                            <CopyText text={camera.channelId || '—'} mono />
                                        </td>
                                        <td>{camera.channelNo || '—'}</td>
                                        <td className="vdm-mono">
                                            {camera.host ? `${camera.host}:${camera.port || '554'}` : '—'}
                                        </td>
                                        <td>{dictLabel(VENDOR_DICT, camera.vendor)}</td>
                                        <td>{camera.updatedBy}</td>
                                        <td className="vdm-muted">{camera.updatedAt}</td>
                                        <td>{camera.createdBy}</td>
                                        <td className="vdm-muted">{camera.createdAt}</td>
                                        <td className="vdm-col-actions">
                                            <div className="vdm-row-actions">
                                                {reorderable ? (
                                                    <span
                                                        className={`vdm-drag-handle${canReorder ? '' : ' is-disabled'}`}
                                                        title={
                                                            canReorder
                                                                ? '按住拖拽调整本分组内排序'
                                                                : '清除其它筛选条件后可拖拽排序'
                                                        }
                                                        onMouseDown={() => {
                                                            if (canReorder) setDragReady(true);
                                                        }}
                                                        onMouseUp={() => setDragReady(false)}
                                                    >
                                                        <GripVertical size={14} />
                                                    </span>
                                                ) : null}
                                                <IconButton
                                                    title="监控预览"
                                                    onClick={() => setPreviewCamera(camera)}
                                                >
                                                    <Video size={14} />
                                                </IconButton>
                                                <IconButton
                                                    title="编辑"
                                                    onClick={() => setCameraDrawer({ open: true, editing: camera })}
                                                >
                                                    <Pencil size={14} />
                                                </IconButton>
                                                <IconButton title="删除" danger onClick={() => deleteCamera(camera)}>
                                                    <Trash2 size={14} />
                                                </IconButton>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <EmptyRow colSpan={15} text="当前分组与筛选条件下暂无摄像头" />
                        )}
                    </tbody>
                </TableWrap>

                <Pagination
                    total={cameras.length}
                    page={safePage}
                    pageSize={pageSize}
                    onChange={(nextPage, nextSize) => {
                        setPage(nextPage);
                        setPageSize(nextSize);
                    }}
                />
            </section>

            <CameraFormDrawer
                open={cameraDrawer.open}
                data={data}
                editing={cameraDrawer.editing}
                defaultGroupId={selectedGroupId}
                onClose={() => setCameraDrawer({ open: false, editing: null })}
                onSubmit={saveCamera}
            />

            <GroupFormDrawer
                open={groupDrawer.open}
                data={data}
                editing={groupDrawer.editing}
                defaultParentId={groupDrawer.parentId}
                onClose={() => setGroupDrawer({ open: false, editing: null, parentId: null })}
                onSubmit={saveGroup}
            />

            <CameraImportDrawer
                open={importOpen}
                data={data}
                onClose={() => setImportOpen(false)}
                onImport={(cameras, createdGroups) => {
                    onChange({
                        ...data,
                        groups: [...data.groups, ...createdGroups],
                        cameras: [...data.cameras, ...cameras],
                    });
                }}
            />

            <LivePreviewModal
                open={!!previewCamera}
                camera={previewCamera}
                data={data}
                onClose={() => setPreviewCamera(null)}
            />

            <ConfirmModal state={confirmState as ConfirmState | null} onClose={closeConfirm} />
        </div>
    );
}

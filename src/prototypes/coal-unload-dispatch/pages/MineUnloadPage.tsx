/**
 * 页面：矿点卸煤管理（卸煤明细管理，含 LED 设定 / 更新）
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Inbox,
    MonitorCheck,
    MonitorPlay,
    Plus,
    Search,
    Settings2,
    Trash2,
    Wand2,
} from 'lucide-react';
import {
    Button,
    Checkbox,
    DatePicker,
    Drawer,
    Empty,
    Field,
    Input,
    Modal,
    Select,
    Tag,
    TextArea,
    message,
    useClickOutside,
} from '../components/ui';
import {
    MINE_POINTS,
    addDays,
    fmtDate,
    fmtNow,
    mineById,
    parseDate,
    predictMatches,
    type LedSettings,
    type UnloadDetail,
    type UnloadPoint,
    buildInitialDetails,
    buildInitialUnloadPoints,
    INITIAL_LED_SETTINGS,
    TODAY,
} from '../data';

type SortKey = 'short' | 'led' | 'full' | 'unloadPoint' | 'status' | 'operatedAt' | 'createdAt';

interface ColumnDef {
    key: string;
    title: string;
    sortable: boolean;
    always?: boolean;
    keyCol?: boolean; // 关键字段：靠前、放大、加粗
    width?: number;
}

const COLUMNS: ColumnDef[] = [
    { key: 'index', title: '序号', sortable: false, always: true, width: 56 },
    { key: 'short', title: '矿点名称（简称）', sortable: true, keyCol: true },
    { key: 'led', title: 'LED显示矿点名', sortable: true, keyCol: true },
    { key: 'full', title: '矿点名称', sortable: true, keyCol: true },
    { key: 'unloadPoint', title: '卸煤点', sortable: true, keyCol: true },
    { key: 'status', title: '状态', sortable: true },
    { key: 'planId', title: '计划id', sortable: true },
    { key: 'planSerial', title: '计划流水号', sortable: true },
    { key: 'operator', title: '操作人', sortable: false },
    { key: 'operatedAt', title: '操作时间', sortable: true },
    { key: 'createdBy', title: '创建人', sortable: false },
    { key: 'createdAt', title: '创建时间', sortable: true },
    { key: 'actions', title: '操作', sortable: false, always: true, width: 110 },
];

const TOGGLEABLE = COLUMNS.filter((c) => !c.always && c.key !== 'index');

function sortValue(r: UnloadDetail, key: SortKey): string {
    switch (key) {
        case 'short':
            return r.mineShortName || r.mineFullName;
        case 'led':
            return r.ledName;
        case 'full':
            return r.mineFullName;
        case 'unloadPoint':
            return r.unloadPoint;
        case 'status':
            return r.status;
        case 'operatedAt':
            return r.operatedAt;
        case 'createdAt':
            return r.createdAt;
        default:
            return '';
    }
}

interface MatchRow {
    detailId: string;
    mineLabel: string;
    ledName: string;
    pointName: string;
    reason: string;
}

export default function MineUnloadPage() {
    const [allDetails, setAllDetails] = useState<UnloadDetail[]>(() => buildInitialDetails());
    const [points] = useState<UnloadPoint[]>(() => buildInitialUnloadPoints());

    const [date, setDate] = useState<string>(TODAY);
    const [keyword, setKeyword] = useState('');
    const [pointFilter, setPointFilter] = useState('');
    const [sort, setSort] = useState<{ key: SortKey | null; order: 'asc' | 'desc' }>({ key: null, order: 'asc' });

    // 列设置（与筛选行同行）
    const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
    const [columnOpen, setColumnOpen] = useState(false);
    const colPopRef = useRef<HTMLDivElement>(null);
    useClickOutside(colPopRef, () => setColumnOpen(false));

    // 自动匹配（抽屉、每行可编辑）
    const [matchDrawerOpen, setMatchDrawerOpen] = useState(false);
    const [matchRows, setMatchRows] = useState<MatchRow[]>([]);

    // 人工新增
    const [newOpen, setNewOpen] = useState(false);
    const [newForm, setNewForm] = useState<{ mineId: string; ledName: string }>({ mineId: '', ledName: '' });
    const [newPointName, setNewPointName] = useState('');
    const [mineDrawerOpen, setMineDrawerOpen] = useState(false);
    const [mineSearch, setMineSearch] = useState('');
    const [minePickValue, setMinePickValue] = useState('');

    // 卸煤点选择（新增 / 行编辑 / 自动匹配共用抽屉）
    const [pointPicker, setPointPicker] = useState<
        { kind: 'new' } | { kind: 'edit'; rowId: string } | { kind: 'match'; rowId: string } | null
    >(null);
    const [pointPickValue, setPointPickValue] = useState('');

    // 行编辑
    const [editingRow, setEditingRow] = useState<string | null>(null);
    const [editingLed, setEditingLed] = useState('');
    const [editingPoint, setEditingPoint] = useState('');

    // 删除 / LED 名重复覆盖
    const [deleteTarget, setDeleteTarget] = useState<UnloadDetail | null>(null);
    const [dupModal, setDupModal] = useState<UnloadDetail | null>(null);

    // LED 设定 / 更新
    const [ledOpen, setLedOpen] = useState(false);
    const [ledSettings, setLedSettings] = useState<LedSettings>(INITIAL_LED_SETTINGS);

    const pointByName = useMemo(() => new Map(points.map((p) => [p.name, p])), [points]);
    const newMine = newForm.mineId ? mineById(newForm.mineId) : undefined;
    const newPoint = newPointName ? pointByName.get(newPointName) : undefined;

    /* 进入页面：自动同步今日及以后计划 */
    const syncedRef = useRef(false);
    useEffect(() => {
        if (syncedRef.current) return;
        syncedRef.current = true;
        const n = allDetails.filter((d) => d.date >= TODAY).length;
        message.info(`已自动同步今日及以后 ${n} 条来煤计划`);
    }, [allDetails]);

    /* ---------- 数据管道 ---------- */
    const visibleColumns = useMemo(
        () => COLUMNS.filter((c) => c.always || !hiddenCols.has(c.key)),
        [hiddenCols],
    );

    const groups = useMemo(() => {
        const filtered = allDetails.filter((r) => {
            if (r.date !== date) return false;
            if (pointFilter && r.unloadPoint !== pointFilter) return false;
            if (keyword.trim()) {
                const k = keyword.trim();
                const hit = [r.mineShortName, r.mineFullName, r.ledName].some((v) => v && v.includes(k));
                if (!hit) return false;
            }
            return true;
        });

        const sorted = [...filtered];
        if (sort.key) {
            sorted.sort((a, b) => {
                const cmp = sortValue(a, sort.key!).localeCompare(sortValue(b, sort.key!), 'zh-Hans-CN');
                return sort.order === 'asc' ? cmp : -cmp;
            });
        }

        const map = new Map<string, UnloadDetail[]>();
        for (const r of sorted) {
            const keyName = r.unloadPoint || '__unassigned__';
            if (!map.has(keyName)) map.set(keyName, []);
            map.get(keyName)!.push(r);
        }
        const entries = Array.from(map.entries());
        entries.sort((a, b) => {
            if (a[0] === '__unassigned__') return 1;
            if (b[0] === '__unassigned__') return -1;
            return a[0].localeCompare(b[0], 'zh-Hans-CN');
        });
        return entries.map(([keyName, rows]) => ({
            keyName: keyName === '__unassigned__' ? '' : keyName,
            rows,
        }));
    }, [allDetails, date, pointFilter, keyword, sort]);

    const unassignedCount = useMemo(
        () => allDetails.filter((r) => r.date === date && !r.unloadPoint).length,
        [allDetails, date],
    );

    /* ---------- 排序 / 日期 ---------- */
    const toggleSort = (key: SortKey) => {
        setSort((s) => {
            if (s.key !== key) return { key, order: 'asc' };
            if (s.order === 'asc') return { key, order: 'desc' };
            return { key: null, order: 'asc' };
        });
    };

    const shiftDate = (n: number) => {
        const d = parseDate(date) || new Date();
        setDate(fmtDate(addDays(d, n)));
    };

    /* ---------- 自动匹配：抽屉加载主列表样式、每行可编辑 ---------- */
    const openMatchDrawer = () => {
        if (unassignedCount === 0) {
            message.info('该日期下没有未分配卸煤点的矿点');
            return;
        }
        const preds = predictMatches(allDetails, date, points);
        setMatchRows(preds.map((p) => ({
            detailId: p.detailId,
            mineLabel: p.mineLabel,
            ledName: p.ledName,
            pointName: p.unloadPointId ? p.unloadPointName : '',
            reason: p.reason,
        })));
        setMatchDrawerOpen(true);
    };

    const setMatchRowPoint = (rowId: string, pointName: string) => {
        setMatchRows((list) => list.map((r) => (r.detailId === rowId ? { ...r, pointName } : r)));
    };

    const applyMatch = () => {
        const okRows = matchRows.filter((m) => m.pointName);
        if (okRows.length === 0) {
            message.warning('请至少为一行选择卸煤点');
            return;
        }
        setAllDetails((list) =>
            list.map((r) => {
                const m = okRows.find((x) => x.detailId === r.id);
                const p = m ? pointByName.get(m.pointName) : undefined;
                return m && p
                    ? {
                          ...r,
                          unloadPoint: p.name,
                          coalYard: p.coalYard,
                          zone: p.zone,
                          operator: '王工',
                          operatedAt: fmtNow(),
                      }
                    : r;
            }),
        );
        message.success(`已保存 ${okRows.length} 条匹配结果，并自动推送卸煤要求到 LED`);
        setMatchDrawerOpen(false);
    };

    /* ---------- 人工新增 ---------- */
    const openNew = () => {
        setNewForm({ mineId: '', ledName: '' });
        setNewPointName('');
        setNewOpen(true);
    };

    const confirmMineDrawer = () => {
        const m = mineById(minePickValue);
        if (m) {
            // 矿点/简称均为配置信息；无简称时 LED 名自动填充矿点名
            setNewForm({ mineId: m.id, ledName: m.shortName || m.fullName });
            setNewPointName('');
        }
        setMineDrawerOpen(false);
    };

    const confirmPointPicker = () => {
        if (!pointPicker) return;
        if (pointPicker.kind === 'new') {
            setNewPointName(pointPickValue);
        } else if (pointPicker.kind === 'edit') {
            setEditingPoint(pointPickValue);
        } else {
            setMatchRowPoint(pointPicker.rowId, pointPickValue);
        }
        setPointPicker(null);
    };

    const openPointPickerForNew = () => {
        setPointPickValue(newPointName);
        setPointPicker({ kind: 'new' });
    };

    const saveNew = () => {
        const ledName = newForm.ledName.trim();
        if (!ledName) {
            message.warning('请输入显示的LED矿点名');
            return;
        }
        if (!newPointName) {
            message.warning('请选择卸煤点');
            return;
        }
        const p = pointByName.get(newPointName);
        const existing = allDetails.find((r) => r.ledName === ledName);
        if (existing) {
            setDupModal(existing);
            return;
        }
        const now = fmtNow();
        const mine = newForm.mineId ? mineById(newForm.mineId) : undefined;
        const row: UnloadDetail = {
            id: `d${Date.now()}`,
            mineId: mine?.id || '',
            mineShortName: mine?.shortName || '',
            ledName,
            mineFullName: mine?.fullName || '',
            planId: '',
            planSerial: '',
            unloadPoint: p?.name || '',
            coalYard: p?.coalYard || '',
            zone: p?.zone || '',
            status: '未完结',
            operator: '王工',
            operatedAt: now,
            createdBy: '王工',
            createdAt: now,
            date,
        };
        setAllDetails((list) => [...list, row]);
        message.success('矿点卸煤要求已新增，并自动推送卸煤要求到 LED');
        setNewOpen(false);
    };

    const overwriteDuplicate = () => {
        if (!dupModal) return;
        const mine = newForm.mineId ? mineById(newForm.mineId) : undefined;
        const ledName = newForm.ledName.trim();
        const p = pointByName.get(newPointName);
        const now = fmtNow();
        setAllDetails((list) =>
            list.map((r) =>
                r.id === dupModal.id
                    ? {
                          ...r,
                          mineId: mine?.id || r.mineId,
                          mineShortName: mine?.shortName ?? r.mineShortName,
                          mineFullName: mine?.fullName ?? r.mineFullName,
                          ledName,
                          unloadPoint: p?.name || '',
                          coalYard: p?.coalYard || '',
                          zone: p?.zone || '',
                          status: '未完结',
                          operator: '王工',
                          operatedAt: now,
                      }
                    : r,
            ),
        );
        message.success('已覆盖原明细，并自动推送卸煤要求到 LED');
        setDupModal(null);
        setNewOpen(false);
    };

    /* ---------- 行编辑 ---------- */
    const startEdit = (r: UnloadDetail) => {
        setEditingRow(r.id);
        setEditingLed(r.ledName);
        setEditingPoint(r.unloadPoint);
    };

    const cancelEdit = () => {
        setEditingRow(null);
        setEditingLed('');
        setEditingPoint('');
    };

    const saveEdit = (r: UnloadDetail) => {
        const led = editingLed.trim();
        if (!led) {
            message.warning('LED显示矿点名不能为空');
            return;
        }
        if (allDetails.some((d) => d.ledName === led && d.id !== r.id)) {
            message.error(`LED显示矿点名「${led}」已存在`);
            return;
        }
        const p = pointByName.get(editingPoint);
        setAllDetails((list) =>
            list.map((d) =>
                d.id === r.id
                    ? {
                          ...d,
                          ledName: led,
                          unloadPoint: p?.name || '',
                          coalYard: p?.coalYard || '',
                          zone: p?.zone || '',
                          operator: '王工',
                          operatedAt: fmtNow(),
                      }
                    : d,
            ),
        );
        message.success('明细已更新，并自动推送卸煤要求到 LED');
        cancelEdit();
    };

    const openPointPickerForEdit = (r: UnloadDetail) => {
        setPointPickValue(editingPoint);
        setPointPicker({ kind: 'edit', rowId: r.id });
    };

    /* ---------- 删除 ---------- */
    const confirmDelete = () => {
        if (!deleteTarget) return;
        setAllDetails((list) => list.filter((r) => r.id !== deleteTarget.id));
        message.success('明细已删除');
        setDeleteTarget(null);
    };

    /* ---------- LED 设定 / 更新 ---------- */
    const saveLed = () => {
        message.success('LED 设定已保存，现场 LED 大屏已更新');
        setLedOpen(false);
    };

    const pushLedNow = () => {
        message.success('已更新现场 LED 大屏信息（当日卸煤明细已推送）');
    };

    /* ---------- 渲染辅助 ---------- */
    const renderCell = (r: UnloadDetail, col: ColumnDef, editing: boolean): React.ReactNode => {
        switch (col.key) {
            case 'short':
                return (
                    <span className={r.mineShortName ? 'cd-td-key' : 'cd-td-key cd-cell-muted'}>
                        {r.mineShortName || r.mineFullName}
                    </span>
                );
            case 'led':
                if (editing) {
                    return <Input className="cd-inline-input" value={editingLed} onChange={setEditingLed} placeholder="LED 显示矿点名" />;
                }
                return <span className="cd-cell-primary cd-td-key">{r.ledName || '—'}</span>;
            case 'full':
                return <span className="cd-td-key">{r.mineFullName}</span>;
            case 'planId':
                return <span className="cd-cell-mono">{r.planId || '—'}</span>;
            case 'planSerial':
                return <span className="cd-cell-mono">{r.planSerial || '—'}</span>;
            case 'unloadPoint':
                if (editing) {
                    return (
                        <button type="button" className="cd-toolbtn" onClick={() => openPointPickerForEdit(r)}>
                            {editingPoint || '点击选择卸煤点'}
                            <ChevronRight size={14} />
                        </button>
                    );
                }
                return r.unloadPoint ? (
                    <span className="cd-cell-strong cd-td-key">{r.unloadPoint}</span>
                ) : (
                    <Tag color="warning">未分配</Tag>
                );
            case 'status':
                return r.status === '计划完结' ? <Tag color="success">计划完结</Tag> : <Tag color="processing">未完结</Tag>;
            case 'operator':
                return <span>{r.operator}</span>;
            case 'operatedAt':
                return <span className="cd-cell-muted">{r.operatedAt}</span>;
            case 'createdBy':
                return <span>{r.createdBy}</span>;
            case 'createdAt':
                return <span className="cd-cell-muted">{r.createdAt}</span>;
            case 'actions':
                return editing ? (
                    <span className="cd-actions">
                        <button type="button" className="cd-link" onClick={() => saveEdit(r)}>
                            保存
                        </button>
                        <button type="button" className="cd-link cd-link-danger" onClick={cancelEdit}>
                            取消
                        </button>
                    </span>
                ) : (
                    <span className="cd-actions">
                        <button type="button" className="cd-link" onClick={() => startEdit(r)}>
                            编辑
                        </button>
                        <button type="button" className="cd-link cd-link-danger" onClick={() => setDeleteTarget(r)}>
                            删除
                        </button>
                    </span>
                );
            default:
                return null;
        }
    };

    let indexCursor = 0;

    const pointFilterOptions = useMemo(
        () => [{ value: '', label: '全部卸煤点' }, ...points.map((p) => ({ value: p.name, label: p.name })) ],
        [points],
    );

    const mineSearchOptions = useMemo(() => {
        const q = mineSearch.trim();
        if (!q) return MINE_POINTS;
        return MINE_POINTS.filter((m) => (m.fullName + m.shortName + m.origin).includes(q));
    }, [mineSearch]);

    const pointPickerTitle =
        pointPicker?.kind === 'match' ? '选择卸煤点（自动匹配）' : pointPicker?.kind === 'edit' ? '选择卸煤点（行编辑）' : '选择卸煤点';

    return (
        <div className="cd-page">
            <div className="cd-card">
                <div className="cd-card-head">
                    <h2 className="cd-card-title">矿点卸煤明细</h2>
                    <div className="cd-card-tools">
                        <Button variant="dashed" icon={<Wand2 size={15} />} onClick={openMatchDrawer}>
                            自动匹配卸煤点
                        </Button>
                        <Button variant="default" icon={<MonitorPlay size={15} />} onClick={() => setLedOpen(true)}>
                            LED 设定
                        </Button>
                        <Button
                            variant="default"
                            icon={<MonitorCheck size={15} />}
                            onClick={pushLedNow}
                            title="当日卸煤明细调整后将实时发送更新到现场大屏显示"
                        >
                            LED 更新
                        </Button>
                        <Button variant="primary" icon={<Plus size={15} />} onClick={openNew}>
                            新增
                        </Button>
                    </div>
                </div>

                <div className="cd-filter">
                    <div className="cd-filter-item">
                        <span className="cd-filter-label">矿点名称/简称</span>
                        <div className="cd-search">
                            <Search size={15} className="cd-search-icon" />
                            <Input value={keyword} onChange={setKeyword} placeholder="输入矿点名称或简称" />
                        </div>
                    </div>
                    <div className="cd-filter-item">
                        <span className="cd-filter-label">卸煤点</span>
                        <div style={{ width: 160 }}>
                            <Select value={pointFilter} options={pointFilterOptions} onChange={setPointFilter} placeholder="请选择" />
                        </div>
                    </div>
                    <div className="cd-filter-item">
                        <span className="cd-filter-label">来煤日期</span>
                        <div className="cd-date-group">
                            <button type="button" className="cd-toolbtn" onClick={() => shiftDate(-1)}>
                                <ChevronLeft size={14} />
                                前一日
                            </button>
                            <DatePicker value={date} onChange={setDate} />
                            <button type="button" className="cd-toolbtn" onClick={() => shiftDate(1)}>
                                后一日
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                    <span className="cd-filter-spacer" />
                    <div className="cd-pop" ref={colPopRef}>
                        <button type="button" className="cd-toolbtn" onClick={() => setColumnOpen((o) => !o)}>
                            <Settings2 size={15} />
                            列设置
                        </button>
                        {columnOpen ? (
                            <div className="cd-pop-panel">
                                <div className="cd-pop-title">定制展示列</div>
                                {TOGGLEABLE.map((c) => (
                                    <div
                                        key={c.key}
                                        className="cd-pop-item"
                                        onClick={() =>
                                            setHiddenCols((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(c.key)) next.delete(c.key);
                                                else next.add(c.key);
                                                return next;
                                            })
                                        }
                                    >
                                        <Checkbox checked={!hiddenCols.has(c.key)} onChange={() => {}}>
                                            {c.title}
                                        </Checkbox>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="cd-table-scroll">
                    {groups.length === 0 ? (
                        <Empty icon={<Inbox size={44} />} description="该日期及筛选条件下暂无卸煤明细" />
                    ) : (
                        <table className="cd-table">
                            <thead>
                                <tr>
                                    {visibleColumns.map((c) => {
                                        if (c.key === 'index') {
                                            return (
                                                <th key={c.key} style={{ width: c.width }}>
                                                    {c.title}
                                                </th>
                                            );
                                        }
                                        const activeSort = sort.key === (c.key as SortKey) ? sort.order : null;
                                        return (
                                            <th
                                                key={c.key}
                                                className={[c.sortable ? 'cd-th-sort' : '', c.keyCol ? 'cd-th-key' : ''].join(' ')}
                                                style={{ width: c.width }}
                                                onClick={() => (c.sortable ? toggleSort(c.key as SortKey) : undefined)}
                                            >
                                                <span className="cd-th-inner">
                                                    {c.title}
                                                    {c.sortable ? (
                                                        <span className={`cd-sort${activeSort ? ` is-${activeSort}` : ''}`}>
                                                            <i className="cd-sort-up" />
                                                            <i className="cd-sort-down" />
                                                        </span>
                                                    ) : null}
                                                </span>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {groups.map((g) => {
                                    const displayName = g.keyName || '未分配';
                                    const point = g.keyName ? pointByName.get(g.keyName) : undefined;
                                    return (
                                        <React.Fragment key={displayName}>
                                            <tr className="cd-group-tr">
                                                <td colSpan={visibleColumns.length}>
                                                    <span className="cd-group-label">
                                                        {displayName}
                                                        {g.keyName ? <Tag color="processing">已分配</Tag> : <Tag color="warning">待匹配</Tag>}
                                                        <span className="cd-group-count">
                                                            {point ? `· ${point.coalYard} / ${point.zone}` : '· 尚未指定卸煤点'} · 共 {g.rows.length} 条
                                                        </span>
                                                    </span>
                                                </td>
                                            </tr>
                                            {g.rows.map((r) => {
                                                const editing = editingRow === r.id;
                                                indexCursor += 1;
                                                const idx = indexCursor;
                                                return (
                                                    <tr className={editing ? 'cd-row is-editing' : 'cd-row'} key={r.id}>
                                                        {visibleColumns.map((c) => {
                                                            if (c.key === 'index') {
                                                                return (
                                                                    <td key={c.key} style={{ width: c.width }}>
                                                                        <span className="cd-cell-muted">{idx}</span>
                                                                    </td>
                                                                );
                                                            }
                                                            return (
                                                                <td key={c.key} style={{ width: c.width }}>
                                                                    {renderCell(r, c, editing)}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* 自动匹配：抽屉（按主列表加载，每行可编辑，批量保存） */}
            <Drawer
                open={matchDrawerOpen}
                title={`自动匹配卸煤点（${matchRows.length} 行可编辑）`}
                onClose={() => setMatchDrawerOpen(false)}
                width={760}
                footer={
                    <>
                        <Button variant="default" onClick={() => setMatchDrawerOpen(false)}>
                            取消
                        </Button>
                        <Button variant="primary" onClick={applyMatch} disabled={matchRows.length === 0}>
                            批量保存
                        </Button>
                    </>
                }
            >
                <div className="cd-confirm-text" style={{ marginBottom: 12 }}>
                    已按历史最近要求预填卸煤点，可直接修改每行「卸煤点」与「LED显示矿点名」，确认后批量保存并推送 LED。
                </div>
                <table className="cd-table">
                    <thead>
                        <tr>
                            <th style={{ width: 48 }}>序号</th>
                            <th>矿点名称（简称）</th>
                            <th>LED显示矿点名</th>
                            <th>卸煤点</th>
                            <th>匹配情况</th>
                        </tr>
                    </thead>
                    <tbody>
                        {matchRows.map((m, i) => (
                            <tr className="cd-row" key={m.detailId}>
                                <td><span className="cd-cell-muted">{i + 1}</span></td>
                                <td className="cd-td-key">{m.mineLabel}</td>
                                <td>
                                    <Input
                                        className="cd-inline-input"
                                        value={m.ledName}
                                        onChange={(v) => setMatchRows((list) => list.map((r) => (r.detailId === m.detailId ? { ...r, ledName: v } : r)))}
                                    />
                                </td>
                                <td>
                                    <button
                                        type="button"
                                        className="cd-toolbtn"
                                        onClick={() => {
                                            setPointPickValue(m.pointName);
                                            setPointPicker({ kind: 'match', rowId: m.detailId });
                                        }}
                                    >
                                        {m.pointName || '选择卸煤点'}
                                        <ChevronRight size={14} />
                                    </button>
                                </td>
                                <td>
                                    {m.pointName ? (
                                        <Tag color="success">已预填可修改</Tag>
                                    ) : m.reason ? (
                                        <Tag color="error">{m.reason}</Tag>
                                    ) : (
                                        <Tag color="warning">待选择</Tag>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Drawer>

            {/* 人工新增抽屉 */}
            <Drawer
                open={newOpen}
                title="新增矿点卸煤要求"
                onClose={() => setNewOpen(false)}
                width={520}
                footer={
                    <>
                        <Button variant="default" onClick={() => setNewOpen(false)}>
                            取消
                        </Button>
                        <Button variant="primary" onClick={saveNew}>
                            保存
                        </Button>
                    </>
                }
            >
                <Field label="矿点选择（选填）" extra="矿点与矿点简称为配置信息；无简称时 LED 名自动填充矿点名">
                    <div className="cd-readonly" style={{ justifyContent: 'space-between' }}>
                        <span className={newMine ? '' : 'is-empty'}>{
                            newMine ? `${newMine.fullName}（简称：${newMine.shortName || '空'}）` : '可不选矿点，直接录入 LED 名与卸煤点'
                        }</span>
                        <Button variant="link" size="small" onClick={() => setMineDrawerOpen(true)}>
                            选择矿点
                        </Button>
                    </div>
                </Field>
                <Field label="矿点简称">
                    <div className={newMine && newMine.shortName ? 'cd-readonly' : 'cd-readonly is-empty'}>
                        {newMine && newMine.shortName ? newMine.shortName : '（未选矿点或无简称）'}
                    </div>
                </Field>
                <Field label="显示的LED矿点名" required extra="选矿点后默认回填简称，无简称回填矿点名，可手工修改">
                    <Input value={newForm.ledName} onChange={(v) => setNewForm((f) => ({ ...f, ledName: v }))} placeholder="请输入LED显示矿点名" />
                </Field>
                <Field label="卸煤点" required>
                    <div className="cd-readonly" style={{ justifyContent: 'space-between' }}>
                        <span className={newPointName ? '' : 'is-empty'}>{newPointName || '尚未选择卸煤点'}</span>
                        <Button variant="link" size="small" onClick={openPointPickerForNew}>
                            选择卸煤点
                        </Button>
                    </div>
                </Field>
                <Field label="关联煤场">
                    <div className={newPoint ? 'cd-readonly' : 'cd-readonly is-empty'}>{newPoint ? newPoint.coalYard : '按所选卸煤点回显'}</div>
                </Field>
                <Field label="关联分区">
                    <div className={newPoint ? 'cd-readonly' : 'cd-readonly is-empty'}>{newPoint ? newPoint.zone : '按所选卸煤点回显'}</div>
                </Field>
            </Drawer>

            {/* 选择矿点抽屉（支持按矿点名模糊搜索） */}
            <Drawer
                open={mineDrawerOpen}
                title="选择矿点"
                onClose={() => setMineDrawerOpen(false)}
                width={500}
                footer={
                    <>
                        <Button variant="default" onClick={() => setMineDrawerOpen(false)}>
                            取消
                        </Button>
                        <Button variant="primary" onClick={confirmMineDrawer} disabled={!minePickValue}>
                            确认
                        </Button>
                    </>
                }
            >
                <div className="cd-search" style={{ width: '100%', marginBottom: 12 }}>
                    <Search size={15} className="cd-search-icon" />
                    <Input value={mineSearch} onChange={setMineSearch} placeholder="按矿点名模糊搜索" />
                </div>
                <div className="cd-picker">
                    {mineSearchOptions.map((m) => (
                        <div
                            key={m.id}
                            className={`cd-picker-item${minePickValue === m.id ? ' is-selected' : ''}`}
                            onClick={() => setMinePickValue(m.id)}
                        >
                            <span className="cd-picker-radio" />
                            <div>
                                <div className="cd-picker-main">{m.fullName}</div>
                                <div className="cd-picker-sub">
                                    简称：{m.shortName || '（空）'} · {m.origin} · 无简称时 LED 名自动填充矿点名
                                </div>
                            </div>
                        </div>
                    ))}
                    {mineSearchOptions.length === 0 ? (
                        <Empty description="未找到匹配矿点" />
                    ) : null}
                </div>
            </Drawer>

            {/* 选择卸煤点抽屉（新增 / 行编辑 / 自动匹配共用） */}
            <Drawer
                open={!!pointPicker}
                title={pointPickerTitle}
                onClose={() => setPointPicker(null)}
                width={480}
                footer={
                    <>
                        <Button variant="default" onClick={() => setPointPicker(null)}>
                            取消
                        </Button>
                        <Button variant="primary" onClick={confirmPointPicker} disabled={!pointPickValue}>
                            确认
                        </Button>
                    </>
                }
            >
                <div className="cd-picker">
                    {points.map((p) => (
                        <div
                            key={p.id}
                            className={`cd-picker-item${pointPickValue === p.name ? ' is-selected' : ''}`}
                            onClick={() => setPointPickValue(p.name)}
                        >
                            <span className="cd-picker-radio" />
                            <div>
                                <div className="cd-picker-main">{p.name}</div>
                                <div className="cd-picker-sub">
                                    {p.coalYard} / {p.zone}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Drawer>

            {/* 删除二次确认（保留小确认弹窗） */}
            <Modal
                open={!!deleteTarget}
                title="删除卸煤明细"
                onClose={() => setDeleteTarget(null)}
                width={400}
                footer={
                    <>
                        <Button variant="default" onClick={() => setDeleteTarget(null)}>
                            取消
                        </Button>
                        <Button variant="danger" onClick={confirmDelete}>
                            删除
                        </Button>
                    </>
                }
            >
                <div className="cd-confirm">
                    <span className="cd-confirm-icon is-danger">
                        <Trash2 size={14} />
                    </span>
                    <div>
                        <div className="cd-confirm-title">确认删除该矿点卸煤明细？</div>
                        <div className="cd-confirm-text">
                            即将删除「<strong>{deleteTarget?.ledName || deleteTarget?.mineFullName}</strong>」，删除后不可恢复。
                        </div>
                    </div>
                </div>
            </Modal>

            {/* LED 名重复覆盖确认（保留小确认弹窗） */}
            <Modal
                open={!!dupModal}
                title="LED显示矿点名已存在"
                onClose={() => setDupModal(null)}
                width={460}
                footer={
                    <>
                        <Button variant="default" onClick={() => setDupModal(null)}>
                            返回修改
                        </Button>
                        <Button variant="primary" onClick={overwriteDuplicate}>
                            覆盖原明细
                        </Button>
                    </>
                }
            >
                <div className="cd-confirm">
                    <span className="cd-confirm-icon is-warning">!</span>
                    <div>
                        <div className="cd-confirm-title">检测到重复的 LED 显示矿点名</div>
                        <div className="cd-confirm-text">
                            已有明细使用 LED 名「<strong>{dupModal?.ledName}</strong>」（矿点：
                            {dupModal?.mineFullName}）。覆盖将用当前表单内容替换该明细。
                        </div>
                    </div>
                </div>
            </Modal>

            {/* LED 设定抽屉 */}
            <Drawer
                open={ledOpen}
                title="LED 设定（更新现场大屏）"
                onClose={() => setLedOpen(false)}
                width={480}
                footer={
                    <>
                        <Button variant="default" onClick={() => setLedOpen(false)}>
                            取消
                        </Button>
                        <Button variant="primary" onClick={saveLed}>
                            保存并推送现场 LED
                        </Button>
                    </>
                }
            >
                <Field label="非接卸时段默认显示内容" extra="LED 在非接卸时段滚动展示此内容">
                    <TextArea
                        value={ledSettings.offDuty}
                        onChange={(v) => setLedSettings((s) => ({ ...s, offDuty: v }))}
                        placeholder="请输入非接卸时段的默认显示内容"
                        rows={5}
                    />
                </Field>
                <Field label="接待时段默认显示内容" extra="LED 在接待时段滚动展示此内容">
                    <TextArea
                        value={ledSettings.reception}
                        onChange={(v) => setLedSettings((s) => ({ ...s, reception: v }))}
                        placeholder="请输入接待时段的默认显示内容"
                        rows={5}
                    />
                </Field>
                <div className="cd-confirm-text">当日卸煤明细调整后将实时发送更新到现场大屏显示。</div>
            </Drawer>
        </div>
    );
}
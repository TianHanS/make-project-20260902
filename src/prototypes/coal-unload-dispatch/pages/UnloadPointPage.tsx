/**
 * 页面：卸煤点管理
 */
import React, { useMemo, useState } from 'react';
import { Inbox, Plus, Trash2 } from 'lucide-react';
import { Button, Drawer, Empty, Field, Input, Modal, Select, message } from '../components/ui';
import { COAL_YARDS, zonesOf, type UnloadPoint, buildInitialUnloadPoints, fmtNow } from '../data';

interface FormState {
    name: string;
    coalYard: string;
    zone: string;
}

export default function UnloadPointPage() {
    const [points, setPoints] = useState<UnloadPoint[]>(() => buildInitialUnloadPoints());
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>({ name: '', coalYard: '', zone: '' });
    const [deleteTarget, setDeleteTarget] = useState<UnloadPoint | null>(null);

    const yardOptions = useMemo(() => COAL_YARDS.map((y) => ({ value: y, label: y })), []);
    const zoneOptions = useMemo(
        () => (form.coalYard ? zonesOf(form.coalYard) : []).map((z) => ({ value: z, label: z })),
        [form.coalYard],
    );

    const openAdd = () => {
        setEditingId(null);
        setForm({ name: '', coalYard: '', zone: '' });
        setDrawerOpen(true);
    };

    const openEdit = (p: UnloadPoint) => {
        setEditingId(p.id);
        setForm({ name: p.name, coalYard: p.coalYard, zone: p.zone });
        setDrawerOpen(true);
    };

    const setField = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

    const onYardChange = (yard: string) => {
        setField({ coalYard: yard, zone: '' });
    };

    const onSave = () => {
        const name = form.name.trim();
        if (!name) {
            message.warning('请输入卸煤点名称');
            return;
        }
        const duplicate = points.some((p) => p.name.trim() === name && p.id !== editingId);
        if (duplicate) {
            message.error(`卸煤点名称「${name}」已存在，请勿重复`);
            return;
        }

        const now = fmtNow();
        if (editingId) {
            setPoints((list) =>
                list.map((p) =>
                    p.id === editingId
                        ? { ...p, name, coalYard: form.coalYard, zone: form.zone, updatedAt: now, updatedBy: '王工' }
                        : p,
                ),
            );
            message.success('卸煤点已更新');
        } else {
            const point: UnloadPoint = {
                id: `up${Date.now()}`,
                name,
                coalYard: form.coalYard,
                zone: form.zone,
                createdAt: now,
                createdBy: '王工',
                updatedAt: now,
                updatedBy: '王工',
            };
            setPoints((list) => [...list, point]);
            message.success('卸煤点已新增');
        }
        setDrawerOpen(false);
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        setPoints((list) => list.filter((p) => p.id !== deleteTarget.id));
        message.success(`已删除卸煤点「${deleteTarget.name}」`);
        setDeleteTarget(null);
    };

    const drawerFooter = (
        <>
            <Button variant="default" onClick={() => setDrawerOpen(false)}>
                取消
            </Button>
            <Button variant="primary" onClick={onSave}>
                保存
            </Button>
        </>
    );

    return (
        <div className="cd-page">
            <div className="cd-card">
                <div className="cd-card-head">
                    <h2 className="cd-card-title">卸煤点列表</h2>
                    <div className="cd-card-tools">
                        <Button variant="primary" icon={<Plus size={15} />} onClick={openAdd}>
                            新增卸煤点
                        </Button>
                    </div>
                </div>

                <div className="cd-table-scroll">
                    {points.length === 0 ? (
                        <Empty icon={<Inbox size={44} />} description="暂无卸煤点，点击右上角「新增卸煤点」维护" />
                    ) : (
                        <table className="cd-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 160 }}>卸煤点名称</th>
                                    <th style={{ width: 140 }}>关联煤场</th>
                                    <th style={{ width: 140 }}>关联分区</th>
                                    <th style={{ width: 170 }}>创建时间</th>
                                    <th style={{ width: 110 }}>创建人</th>
                                    <th style={{ width: 170 }}>更新时间</th>
                                    <th style={{ width: 110 }}>更新人</th>
                                    <th style={{ width: 120 }}>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {points.map((p) => (
                                    <tr className="cd-row" key={p.id}>
                                        <td className="cd-cell-strong">{p.name}</td>
                                        <td>{p.coalYard}</td>
                                        <td>{p.zone}</td>
                                        <td className="cd-cell-muted">{p.createdAt}</td>
                                        <td>{p.createdBy}</td>
                                        <td className="cd-cell-muted">{p.updatedAt}</td>
                                        <td>{p.updatedBy}</td>
                                        <td>
                                            <span className="cd-actions">
                                                <button type="button" className="cd-link" onClick={() => openEdit(p)}>
                                                    编辑
                                                </button>
                                                <button
                                                    type="button"
                                                    className="cd-link cd-link-danger"
                                                    onClick={() => setDeleteTarget(p)}
                                                >
                                                    删除
                                                </button>
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* 新增 / 编辑抽屉 */}
            <Drawer
                open={drawerOpen}
                title={editingId ? '编辑卸煤点' : '新增卸煤点'}
                onClose={() => setDrawerOpen(false)}
                footer={drawerFooter}
                width={480}
            >
                <Field label="卸煤点名称" required extra="名称全局唯一，不可重复">
                    <Input
                        value={form.name}
                        onChange={(v) => setField({ name: v })}
                        placeholder="请输入卸煤点名称"
                        maxLength={20}
                    />
                </Field>
                <Field label="关联煤场" required>
                    <Select
                        value={form.coalYard}
                        options={yardOptions}
                        onChange={onYardChange}
                        placeholder="请选择煤场"
                    />
                </Field>
                <Field label="关联分区" required extra={form.coalYard ? '' : '分区与煤场关联，先选择煤场'}>
                    <Select
                        value={form.zone}
                        options={zoneOptions}
                        onChange={(v) => setField({ zone: v })}
                        placeholder={form.coalYard ? '请选择分区' : '请先选择煤场'}
                        disabled={!form.coalYard}
                    />
                </Field>
            </Drawer>

            {/* 删除二次确认 */}
            <Modal
                open={!!deleteTarget}
                title="删除卸煤点"
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
                        <div className="cd-confirm-title">确认删除该卸煤点？</div>
                        <div className="cd-confirm-text">
                            即将删除「<strong>{deleteTarget?.name}</strong>
                            」，删除后不可恢复。
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
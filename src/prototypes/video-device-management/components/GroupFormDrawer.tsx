/**
 * 分组新增 / 编辑抽屉
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
    CameraGroup,
    DeviceDomainData,
    collectSubtreeIds,
    createAudit,
    isGroupNameTaken,
    nextId,
    touchAudit,
} from '../data';
import { flattenGroupOptions } from './CameraFormDrawer';
import {
    Button,
    Drawer,
    Field,
    Input,
    Textarea,
    TreeSelect,
    message,
} from './ui';

export function GroupFormDrawer({
    open,
    data,
    editing,
    defaultParentId,
    onClose,
    onSubmit,
}: {
    open: boolean;
    data: DeviceDomainData;
    editing: CameraGroup | null;
    defaultParentId: string | null;
    onClose: () => void;
    onSubmit: (group: CameraGroup) => void;
}) {
    const [name, setName] = useState('');
    const [parentId, setParentId] = useState('');
    const [sort, setSort] = useState('0');
    const [remark, setRemark] = useState('');
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (!open) return;
        setSubmitted(false);
        if (editing) {
            setName(editing.name);
            setParentId(editing.parentId || '');
            setSort(String(editing.sort));
            setRemark(editing.remark);
        } else {
            setName('');
            setParentId(defaultParentId || '');
            setSort('0');
            setRemark('');
        }
    }, [open, editing, defaultParentId]);

    /** 编辑时禁止把节点挂到自身或子孙下 */
    const parentNodes = useMemo(() => {
        const all = flattenGroupOptions(data);
        const forbidden = editing ? collectSubtreeIds(data.groups, editing.id) : new Set<string>();
        return [
            { value: '', label: '（作为根分组）', depth: 0 },
            ...all.map((node) => ({ ...node, disabled: forbidden.has(node.value) })),
        ];
    }, [data, editing]);

    const nameTaken = isGroupNameTaken(data, name, editing?.id);
    const errors = {
        name: !name.trim() ? '请输入分组名称' : nameTaken ? '分组名称已存在' : '',
        sort: !/^\d+$/.test(sort) ? '排序号需为非负整数' : '',
    };
    const hasError = Object.values(errors).some(Boolean);

    const submit = () => {
        setSubmitted(true);
        if (hasError) {
            message.error('请检查标红字段');
            return;
        }
        const base = {
            name: name.trim(),
            parentId: parentId || null,
            sort: Number(sort),
            remark,
        };
        if (editing) {
            onSubmit({ ...editing, ...base, ...touchAudit(editing) });
        } else {
            onSubmit({ id: nextId('grp'), ...base, ...createAudit() });
        }
    };

    return (
        <Drawer
            open={open}
            width={560}
            title={editing ? '编辑分组' : '新增分组'}
            onClose={onClose}
            footer={
                <div className="vdm-drawer-actions">
                    <Button onClick={onClose}>取消</Button>
                    <Button variant="primary" onClick={submit}>
                        保存
                    </Button>
                </div>
            }
        >
            <div className="vdm-form-grid is-single">
                <Field label="分组名称" required error={submitted ? errors.name : ''} full>
                    <Input value={name} onChange={setName} placeholder="如：计量区域" invalid={!!(submitted && errors.name)} />
                </Field>
                <Field label="父分组" hint="留空为根分组；不可挂到自身或子孙分组下" full>
                    <TreeSelect value={parentId} nodes={parentNodes} onChange={setParentId} placeholder="（作为根分组）" />
                </Field>
                <Field label="排序号" required error={submitted ? errors.sort : ''} hint="同层级内序号小的排前" full>
                    <Input value={sort} onChange={setSort} digitsOnly invalid={!!(submitted && errors.sort)} />
                </Field>
                <Field label="备注" full>
                    <Textarea value={remark} onChange={setRemark} rows={2} placeholder="选填" />
                </Field>
            </div>
        </Drawer>
    );
}

/**
 * 摄像头新增 / 编辑抽屉
 * 业务信息 + 通道信息 + 网络接入，按接入方式联动显示
 *
 * 国标设备不再单独建档：国标设备 ID 直接在本表单维护，下拉候选取自摄像头表中已录入的值；
 * 流媒体服务地址由部署文件配置，表单内不再录入。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { PlayCircle } from 'lucide-react';
import {
    ACCESS_TYPE_DICT,
    AccessType,
    CAMERA_TYPE_DICT,
    Camera,
    DeviceDomainData,
    VENDOR_DICT,
    buildGroupTree,
    collectDeviceOptions,
    collectHostOptions,
    collectSegmentOptions,
    createAudit,
    deriveChannelNo,
    isCameraNameTaken,
    isChannelIdTaken,
    isMacTaken,
    isSnTaken,
    joinGbCode,
    nextId,
    onlyDigits,
    splitGbCode,
    touchAudit,
} from '../data';
import {
    Button,
    ComboInput,
    Drawer,
    Field,
    FormSection,
    Input,
    RadioGroup,
    Select,
    Textarea,
    TreeSelect,
    TreeSelectNode,
    message,
} from './ui';
import { GbCodeInput, isGbCodeComplete, validateGbSegments } from './GbCodeInput';
import { IpInput, isValidIp } from './IpInput';

interface CameraFormState {
    name: string;
    groupId: string;
    cameraType: string;
    accessType: AccessType;
    deviceId: string;
    channelId: string;
    channelNo: string;
    host: string;
    port: string;
    username: string;
    password: string;
    vendor: string;
    sort: string;
    sn: string;
    mac: string;
    remark: string;
}

const EMPTY_FORM: CameraFormState = {
    name: '',
    groupId: '',
    cameraType: '',
    /** 现场多为 NVR 接入，默认兼容以便国标与网络信息都可录入 */
    accessType: 'compat',
    deviceId: '',
    channelId: '',
    channelNo: '',
    host: '',
    port: '554',
    username: '',
    password: '',
    vendor: '',
    sort: '',
    sn: '',
    mac: '',
    remark: '',
};

export function flattenGroupOptions(data: DeviceDomainData): TreeSelectNode[] {
    const out: TreeSelectNode[] = [];
    const walk = (nodes: ReturnType<typeof buildGroupTree>) => {
        nodes.forEach((node) => {
            out.push({ value: node.id, label: node.name, depth: node.depth });
            walk(node.children);
        });
    };
    walk(buildGroupTree(data.groups));
    return out;
}

export function CameraFormDrawer({
    open,
    data,
    editing,
    defaultGroupId,
    onClose,
    onSubmit,
}: {
    open: boolean;
    data: DeviceDomainData;
    editing: Camera | null;
    defaultGroupId: string;
    onClose: () => void;
    /** preview=true 时保存后直接唤起点播窗口 */
    onSubmit: (camera: Camera, options?: { preview?: boolean }) => void;
}) {
    const [form, setForm] = useState<CameraFormState>(EMPTY_FORM);
    const [submitted, setSubmitted] = useState(false);
    /** 失焦即校验的字段：不等保存也能给出结果 */
    const [touched, setTouched] = useState<Partial<Record<keyof CameraFormState, boolean>>>({});

    const groupNodes = useMemo(() => flattenGroupOptions(data), [data]);
    /** 下拉候选：全部来自摄像头表中已录入的值 */
    const deviceOptions = useMemo(() => collectDeviceOptions(data), [data]);
    const hostOptions = useMemo(() => collectHostOptions(data), [data]);

    useEffect(() => {
        if (!open) return;
        setSubmitted(false);
        setTouched({});
        if (editing) {
            setForm({
                name: editing.name,
                groupId: editing.groupId,
                cameraType: editing.cameraType,
                accessType: editing.accessType,
                deviceId: editing.deviceId,
                channelId: editing.channelId,
                channelNo: editing.channelNo,
                host: editing.host,
                port: editing.port,
                username: editing.username,
                password: editing.password,
                vendor: editing.vendor,
                sort: String(editing.sort),
                sn: editing.sn,
                mac: editing.mac,
                remark: editing.remark,
            });
        } else {
            setForm({ ...EMPTY_FORM, groupId: defaultGroupId });
        }
    }, [open, editing, defaultGroupId]);

    const needGb = form.accessType !== 'nonGb';
    const needNetwork = form.accessType !== 'gb';

    /** 从下拉选中已有国标设备 ID：继承编码前缀与网络默认值 */
    const pickDevice = (deviceId: string) => {
        const target = deviceOptions.find((item) => item.deviceId === deviceId);
        setForm((prev) => {
            if (!target) return { ...prev, deviceId };
            const deviceSeg = splitGbCode(target.deviceId);
            const prevSeg = splitGbCode(prev.channelId);
            const nextChannelId = joinGbCode({
                center: deviceSeg.center,
                industry: deviceSeg.industry,
                typeCode: prevSeg.typeCode || '132',
                net: deviceSeg.net,
                seq: prevSeg.seq,
            });
            return {
                ...prev,
                deviceId,
                channelId: nextChannelId,
                channelNo: deriveChannelNo(nextChannelId),
                host: prev.host || target.host,
                port: prev.port || target.port || '554',
                username: prev.username || target.username,
                password: prev.password || target.password,
            };
        });
    };

    /** 从下拉选中已录入的 IP：同步带出端口、账号、密码，带出后仍可改 */
    const pickHost = (host: string) => {
        const target = hostOptions.find((item) => item.host === host);
        setForm((prev) =>
            target
                ? {
                      ...prev,
                      host,
                      port: target.port || prev.port,
                      username: target.username || prev.username,
                      password: target.password || prev.password,
                  }
                : { ...prev, host },
        );
    };

    /** 国标通道号每次变化都重算逻辑通道号 */
    const applyChannelId = (code: string) => {
        setForm((prev) => ({ ...prev, channelId: code, channelNo: deriveChannelNo(code) }));
    };

    /** 排序号留空时按目标分组内末位续号 */
    const fallbackSort = useMemo(
        () =>
            data.cameras
                .filter((item) => item.groupId === form.groupId && item.id !== editing?.id)
                .reduce((max, item) => Math.max(max, item.sort), 0) + 1,
        [data.cameras, form.groupId, editing?.id],
    );

    const segErrors = validateGbSegments(splitGbCode(form.channelId));
    const channelComplete = isGbCodeComplete(form.channelId);
    const channelTaken = isChannelIdTaken(data, form.channelId, editing?.id);
    const nameTaken = isCameraNameTaken(data, form.name, editing?.id);
    const snTaken = isSnTaken(data, form.sn, editing?.id);
    const macTaken = isMacTaken(data, form.mac, editing?.id);
    const deviceDigits = onlyDigits(form.deviceId);

    const errors = {
        name: !form.name.trim() ? '请输入摄像头名称' : nameTaken ? '摄像头名称已存在' : '',
        groupId: !form.groupId ? '请选择摄像头分组' : '',
        cameraType: !form.cameraType ? '请选择摄像头种类' : '',
        deviceId: !needGb
            ? ''
            : !deviceDigits
              ? '请填写或选择国标设备 ID'
              : deviceDigits.length !== 20
                ? '国标设备 ID 需为 20 位数字'
                : '',
        channelId: !needGb
            ? ''
            : Object.keys(segErrors).length
              ? '国标通道号未填写完整'
              : channelTaken
                ? '该国标通道号已被占用'
                : '',
        // 非国标只靠通道号定位，兼容方式下可留空
        channelNo: form.accessType === 'nonGb' && !form.channelNo.trim() ? '请输入通道号' : '',
        vendor: !form.vendor ? '请选择厂商' : '',
        host: needNetwork && form.host && !isValidIp(form.host) ? 'IP 各段需为 0~255' : '',
        sort: form.sort.trim() && !/^\d+$/.test(form.sort.trim()) ? '排序号需为非负整数' : '',
        sn: snTaken ? 'SN 已被其他摄像头占用' : '',
        mac: macTaken ? 'MAC 已被其他摄像头占用' : '',
    };
    const hasError = Object.values(errors).some(Boolean);

    const submit = (preview = false) => {
        setSubmitted(true);
        if (hasError) {
            message.error('存在必填项或校验未通过，请检查标红字段');
            return;
        }
        const base = {
            name: form.name,
            groupId: form.groupId,
            accessType: form.accessType,
            deviceId: needGb ? deviceDigits : '',
            channelId: needGb ? form.channelId : '',
            channelNo: form.channelNo,
            host: needNetwork ? form.host : '',
            port: needNetwork ? form.port : '',
            username: needNetwork ? form.username : '',
            password: needNetwork ? form.password : '',
            vendor: form.vendor,
            cameraType: form.cameraType,
            sort: form.sort.trim() ? Number(form.sort.trim()) : fallbackSort,
            sn: form.sn,
            mac: form.mac,
            remark: form.remark,
        };
        if (editing) {
            onSubmit({ ...editing, ...base, ...touchAudit(editing) }, { preview });
        } else {
            onSubmit({ id: nextId('cam'), ...base, ...createAudit() }, { preview });
        }
    };

    const show = (key: keyof typeof errors) => (submitted || touched[key] ? errors[key] : '');
    /** 名称唯一性通过后给出正向反馈，与国标通道号的提示口径一致 */
    const nameUnique = (submitted || touched.name) && !!form.name.trim() && !nameTaken;

    return (
        <Drawer
            open={open}
            width={880}
            title={editing ? '编辑摄像头' : '新增摄像头'}
            onClose={onClose}
            footer={
                <div className="vdm-drawer-actions">
                    <Button onClick={onClose}>取消</Button>
                    <Button variant="ghost" onClick={() => submit(false)}>
                        保存
                    </Button>
                    <Button
                        variant="primary"
                        icon={<PlayCircle size={14} />}
                        onClick={() => submit(true)}
                    >
                        保存并预览监控
                    </Button>
                </div>
            }
        >
            <FormSection title="业务信息">
                <Field
                    label="摄像头名称"
                    required
                    error={show('name')}
                    success={nameUnique ? '校验通过：该名称在平台内唯一' : ''}
                    full
                >
                    <Input
                        value={form.name}
                        onChange={(v) => setForm((p) => ({ ...p, name: v }))}
                        onBlur={() => setTouched((p) => ({ ...p, name: true }))}
                        placeholder="如：1#汽车衡·车头枪机"
                        invalid={!!show('name')}
                    />
                </Field>
                <Field label="摄像头分组" required error={show('groupId')}>
                    <TreeSelect
                        value={form.groupId}
                        nodes={groupNodes}
                        onChange={(v) => setForm((p) => ({ ...p, groupId: v }))}
                        invalid={!!show('groupId')}
                    />
                </Field>
                <Field label="摄像头种类" required error={show('cameraType')}>
                    <Select
                        value={form.cameraType}
                        options={CAMERA_TYPE_DICT}
                        onChange={(v) => setForm((p) => ({ ...p, cameraType: v }))}
                        placeholder="请选择种类"
                        invalid={!!show('cameraType')}
                    />
                </Field>
                <Field
                    label="接入方式"
                    required
                    hint="国标只录国标信息，非国标只录网络接入与通道号，兼容两者都录"
                    full
                >
                    <RadioGroup
                        value={form.accessType}
                        options={ACCESS_TYPE_DICT.map((item) => ({
                            value: item.value as AccessType,
                            label: item.label,
                        }))}
                        onChange={(v) => setForm((p) => ({ ...p, accessType: v }))}
                    />
                </Field>
                <Field label="厂商" required error={show('vendor')}>
                    <Select
                        value={form.vendor}
                        options={VENDOR_DICT}
                        onChange={(v) => setForm((p) => ({ ...p, vendor: v }))}
                        placeholder="请选择厂商"
                        invalid={!!show('vendor')}
                    />
                </Field>
                <Field label="排序号" error={show('sort')} hint={`选填；留空按分组内末位排序（${fallbackSort}）`}>
                    <Input
                        value={form.sort}
                        onChange={(v) => setForm((p) => ({ ...p, sort: v }))}
                        digitsOnly
                        placeholder="留空自动排末位"
                        invalid={!!show('sort')}
                    />
                </Field>
                <Field label="SN" error={show('sn')} hint="选填；填写后需全平台唯一">
                    <Input
                        value={form.sn}
                        onChange={(v) => setForm((p) => ({ ...p, sn: v }))}
                        onBlur={() => setTouched((p) => ({ ...p, sn: true }))}
                        invalid={!!show('sn')}
                    />
                </Field>
                <Field label="MAC" error={show('mac')} hint="选填；填写后需全平台唯一">
                    <Input
                        value={form.mac}
                        onChange={(v) => setForm((p) => ({ ...p, mac: v }))}
                        onBlur={() => setTouched((p) => ({ ...p, mac: true }))}
                        invalid={!!show('mac')}
                    />
                </Field>
                <Field label="备注" full>
                    <Textarea
                        value={form.remark}
                        onChange={(v) => setForm((p) => ({ ...p, remark: v }))}
                        placeholder="选填"
                    />
                </Field>
            </FormSection>

            <FormSection title="通道信息">
                {needGb ? (
                    <Field
                        label="国标设备 ID"
                        required
                        error={show('deviceId')}
                        hint="共计 20 位数字；可直接输入，或点击加载已录入的国标设备 ID"
                    >
                        <ComboInput
                            value={form.deviceId}
                            options={deviceOptions.map((item) => ({
                                value: item.deviceId,
                                label: item.deviceId,
                                desc: `${item.count} 路在用`,
                            }))}
                            onChange={(v) => setForm((p) => ({ ...p, deviceId: onlyDigits(v).slice(0, 20) }))}
                            onPick={pickDevice}
                            placeholder="20 位国标设备 ID"
                            maxLength={20}
                            invalid={!!show('deviceId')}
                            emptyText="暂无已录入的国标设备 ID，可直接输入"
                        />
                    </Field>
                ) : null}

                {needGb ? (
                    <Field label="国标通道号" required error={show('channelId')} full>
                        <GbCodeInput
                            value={form.channelId}
                            onChange={applyChannelId}
                            options={{
                                center: collectSegmentOptions(data, 'center'),
                                typeCode: collectSegmentOptions(data, 'typeCode'),
                                net: collectSegmentOptions(data, 'net'),
                            }}
                            readOnlyKeys={['industry']}
                            uniqueState={channelComplete ? (channelTaken ? 'taken' : 'ok') : null}
                        />
                    </Field>
                ) : null}

                <Field
                    label="通道号"
                    required={form.accessType === 'nonGb'}
                    error={show('channelNo')}
                    hint="需根据硬盘录像机实际通道号录入"
                >
                    <Input
                        value={form.channelNo}
                        onChange={(v) => setForm((p) => ({ ...p, channelNo: v }))}
                        onBlur={() => setTouched((p) => ({ ...p, channelNo: true }))}
                        digitsOnly
                        invalid={!!show('channelNo')}
                    />
                </Field>
            </FormSection>

            {needNetwork ? (
                <FormSection title="网络接入">
                    <Field
                        label="摄像头 IP"
                        error={show('host')}
                        hint="可点击下拉选择已录入的 IP，选中后带出端口与账号密码"
                    >
                        <IpInput
                            value={form.host}
                            onChange={(v) => setForm((p) => ({ ...p, host: v }))}
                            invalid={!!show('host')}
                            options={hostOptions.map((item) => ({
                                value: item.host,
                                desc: `${item.count} 路在用`,
                            }))}
                            onPick={pickHost}
                        />
                    </Field>
                    <Field label="端口">
                        <Input
                            value={form.port}
                            onChange={(v) => setForm((p) => ({ ...p, port: v }))}
                            digitsOnly
                            maxLength={5}
                        />
                    </Field>
                    <Field label="账号">
                        <Input
                            value={form.username}
                            onChange={(v) => setForm((p) => ({ ...p, username: v }))}
                            noSpace
                        />
                    </Field>
                    <Field label="密码">
                        <Input
                            value={form.password}
                            onChange={(v) => setForm((p) => ({ ...p, password: v }))}
                            noSpace
                        />
                    </Field>
                </FormSection>
            ) : null}
        </Drawer>
    );
}

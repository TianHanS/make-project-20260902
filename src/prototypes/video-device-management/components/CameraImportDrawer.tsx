/**
 * 摄像头导入：下载模板 → 模板填写 → 数据导入 → 导入结果
 *
 * 解析与校验在 utils/cameraImport.ts；结果使用侧边抽屉（不用居中弹窗）。
 * 解析完成即保存校验通过的数据，异常数据不保存，仅供下载修正后重新导入。
 */
import React, { useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileUp, Loader2, Upload } from 'lucide-react';
import {
    Camera,
    CameraGroup,
    DeviceDomainData,
    IMPORT_COLUMNS,
    IMPORT_GUIDE,
    IMPORT_TEMPLATE_NOTICE,
} from '../data';
import { ImportRow, buildDemoCells, resolveImportGroups, toCamera, validateCells } from '../utils/cameraImport';
import { downloadXlsx } from '../utils/xlsx';
import { Button, Drawer, TableWrap, message } from './ui';

interface ImportResult {
    fileName: string;
    rows: ImportRow[];
}

const TEMPLATE_COL_WIDTHS = [24, 16, 10, 12, 24, 24, 10, 16, 8, 12, 14, 10, 16, 18, 16];

const RESULT_COLUMNS: { key: keyof ImportRow; label: string; width: number }[] = [
    { key: 'name', label: '摄像头名称', width: 200 },
    { key: 'groupName', label: '分组', width: 120 },
    { key: 'typeLabel', label: '种类', width: 72 },
    { key: 'accessLabel', label: '接入方式', width: 88 },
    { key: 'deviceId', label: '国标设备 ID', width: 190 },
    { key: 'channelId', label: '国标通道号', width: 190 },
    { key: 'channelNo', label: '通道号', width: 76 },
    { key: 'host', label: '摄像头 IP', width: 130 },
    { key: 'port', label: '端口', width: 68 },
    { key: 'username', label: '账号', width: 96 },
    { key: 'password', label: '密码', width: 96 },
    { key: 'vendorLabel', label: '厂商', width: 88 },
    { key: 'sn', label: 'SN', width: 130 },
    { key: 'mac', label: 'MAC', width: 150 },
    { key: 'remark', label: '备注', width: 140 },
];

const MONO_KEYS = new Set(['deviceId', 'channelId', 'host']);

export function CameraImportDrawer({
    open,
    data,
    onClose,
    onImport,
}: {
    open: boolean;
    data: DeviceDomainData;
    onClose: () => void;
    onImport: (cameras: Camera[], createdGroups: CameraGroup[]) => void;
}) {
    const [file, setFile] = useState<File | null>(null);
    const [parsing, setParsing] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [tab, setTab] = useState<'valid' | 'invalid'>('valid');
    /** 本次导入自动新建的一级分组名，用于在结果里说明分组落位 */
    const [createdGroups, setCreatedGroups] = useState<string[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);

    const validRows = useMemo(() => result?.rows.filter((row) => !row.errors.length) || [], [result]);
    const invalidRows = useMemo(() => result?.rows.filter((row) => row.errors.length) || [], [result]);

    const reset = () => {
        setFile(null);
        setParsing(false);
        setResult(null);
        setTab('valid');
        setCreatedGroups([]);
        if (fileRef.current) fileRef.current.value = '';
    };

    const closeAll = () => {
        reset();
        onClose();
    };

    const downloadTemplate = () => {
        const notice = [IMPORT_TEMPLATE_NOTICE, ...Array(IMPORT_COLUMNS.length - 1).fill('')];
        downloadXlsx('摄像头数据导入模板.xlsx', [notice, IMPORT_COLUMNS], {
            sheetName: 'Sheet1',
            colWidths: TEMPLATE_COL_WIDTHS,
        });
        message.success('模板已下载，请按模板内填写要求填报');
    };

    const downloadInvalid = () => {
        const rows = [
            ['异常原因', '模板行号', ...IMPORT_COLUMNS],
            ...invalidRows.map((row) => [
                row.errors.join('；'),
                String(row.rowNo),
                row.name,
                row.groupName,
                row.typeLabel,
                row.accessLabel,
                row.deviceId,
                row.channelId,
                row.channelNo,
                row.host,
                row.port,
                row.username,
                row.password,
                row.vendorLabel,
                row.sn,
                row.mac,
                row.remark,
            ]),
        ];
        downloadXlsx('摄像头导入异常数据.xlsx', rows, {
            sheetName: '异常数据',
            colWidths: [48, 10, ...TEMPLATE_COL_WIDTHS],
        });
        message.success(`已下载 ${invalidRows.length} 条异常数据`);
    };

    /**
     * 选择文件后直接上传解析：停留在抽屉内展示解析进度，完成后展示导入结果。
     * 校验通过的数据在解析完成时即写入，异常数据不保存；用户只需查看结果。
     * 原型不解析真实文件内容，统一按模板口径生成演示数据后走真实校验规则。
     */
    const startParse = (picked: File) => {
        setFile(picked);
        setResult(null);
        setParsing(true);
        if (fileRef.current) fileRef.current.value = '';

        window.setTimeout(() => {
            const rows = validateCells(buildDemoCells(data), data);
            const valid = rows.filter((row) => !row.errors.length);
            const invalid = rows.filter((row) => row.errors.length);
            setParsing(false);
            setTab(valid.length ? 'valid' : 'invalid');
            setResult({ fileName: picked.name, rows });

            const { created, groupIdByName } = resolveImportGroups(valid, data);
            if (valid.length) {
                onImport(
                    valid.map((row, index) => toCamera(row, data, data.cameras.length + index, groupIdByName)),
                    created,
                );
            }
            const groupTip = created.length ? `，自动新建 ${created.length} 个一级分组` : '';
            if (!valid.length) {
                message.error(`${invalid.length} 条数据校验异常，本次未保存任何数据`);
            } else if (invalid.length) {
                message.warning(`已保存 ${valid.length} 条，${invalid.length} 条异常数据未保存${groupTip}`);
            } else {
                message.success(`已保存 ${valid.length} 条摄像头${groupTip}`);
            }
            setCreatedGroups(created.map((item) => item.name));
        }, 1400);
    };

    const showTabs = validRows.length > 0 && invalidRows.length > 0;
    // 仅一类数据时直接展示该类，避免停在空 Tab
    const shownRows = showTabs ? (tab === 'valid' ? validRows : invalidRows) : invalidRows.length ? invalidRows : validRows;
    const showErrorCol = showTabs ? tab === 'invalid' : invalidRows.length > 0;
    const stepIndex = result ? 3 : parsing || file ? 2 : 0;
    const showingResult = !!result;

    const renderCell = (row: ImportRow, key: (typeof RESULT_COLUMNS)[number]['key']) => {
        if (key === 'password') return row.password ? '••••••' : '—';
        const value = row[key];
        return typeof value === 'string' && value ? value : '—';
    };

    const resultTable = (
        <div className="vdm-import">
            <p className={`vdm-import-stat${invalidRows.length ? ' is-warn' : ''}`}>
                {!validRows.length ? (
                    <>
                        导入未成功：共 <strong>{result?.rows.length || 0}</strong> 条数据全部校验异常，未保存任何数据；
                        请下载异常数据，修正后重新导入
                    </>
                ) : invalidRows.length ? (
                    <>
                        导入完成：共 <strong>{result?.rows.length || 0}</strong> 条，
                        <strong>{validRows.length}</strong> 条校验通过并已保存，
                        <strong>{invalidRows.length}</strong> 条异常数据未保存；请下载异常数据，修正后重新导入
                    </>
                ) : (
                    <>
                        导入完成：共 <strong>{result?.rows.length || 0}</strong> 条数据，全部校验通过并已保存
                    </>
                )}
                {createdGroups.length ? (
                    <>
                        。其中 <strong>{createdGroups.length}</strong> 个分组平台未维护，已自动建为一级分组：
                        {createdGroups.join('、')}
                    </>
                ) : null}
            </p>

            <div className="vdm-import-bar">
                {showTabs ? (
                    <div className="vdm-tabs" role="tablist">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={tab === 'valid'}
                            className={`vdm-tab${tab === 'valid' ? ' is-active' : ''}`}
                            onClick={() => setTab('valid')}
                        >
                            校验通过（{validRows.length}）
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={tab === 'invalid'}
                            className={`vdm-tab${tab === 'invalid' ? ' is-active' : ''}`}
                            onClick={() => setTab('invalid')}
                        >
                            异常数据（{invalidRows.length}）
                        </button>
                    </div>
                ) : (
                    <span className="vdm-import-hint">
                        {invalidRows.length
                            ? `异常数据（${invalidRows.length}）`
                            : `校验通过（${validRows.length}）`}
                    </span>
                )}
                {invalidRows.length ? (
                    <Button size="small" icon={<Download size={13} />} onClick={downloadInvalid}>
                        下载异常数据
                    </Button>
                ) : null}
            </div>

            <TableWrap
                minWidth={
                    RESULT_COLUMNS.reduce((sum, col) => sum + col.width, 80) + (showErrorCol ? 320 : 0)
                }
            >
                <thead>
                    <tr>
                        {showErrorCol ? <th style={{ width: 320 }}>异常原因</th> : null}
                        <th style={{ width: 72 }}>模板行号</th>
                        {RESULT_COLUMNS.map((col) => (
                            <th key={col.key} style={{ width: col.width }}>
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {shownRows.length ? (
                        shownRows.map((row) => (
                            <tr key={row.rowNo} className={`vdm-row${row.errors.length ? ' is-error' : ''}`}>
                                {showErrorCol ? (
                                    <td className="vdm-import-error">{row.errors.join('；')}</td>
                                ) : null}
                                <td className="vdm-muted">{row.rowNo}</td>
                                {RESULT_COLUMNS.map((col) => (
                                    <td key={col.key} className={MONO_KEYS.has(col.key) ? 'vdm-mono' : undefined}>
                                        {renderCell(row, col.key)}
                                    </td>
                                ))}
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td
                                colSpan={RESULT_COLUMNS.length + 1 + (showErrorCol ? 1 : 0)}
                                className="vdm-empty-cell"
                            >
                                暂无数据
                            </td>
                        </tr>
                    )}
                </tbody>
            </TableWrap>
        </div>
    );

    return (
        <>
            <Drawer
                open={open}
                width={showingResult ? 1180 : 720}
                title={showingResult ? '导入结果' : '摄像头导入'}
                onClose={closeAll}
                footer={
                    <div className="vdm-drawer-actions">
                        <Button onClick={closeAll}>关闭</Button>
                    </div>
                }
            >
                <ol className="vdm-steps">
                    {['下载模板', '模板填写', '数据导入', '导入结果'].map((text, index) => (
                        <li
                            key={text}
                            className={`vdm-step${index === stepIndex ? ' is-active' : ''}${index < stepIndex ? ' is-done' : ''}`}
                        >
                            <em>{index + 1}</em>
                            {text}
                        </li>
                    ))}
                </ol>

                {showingResult ? (
                    resultTable
                ) : (
                    <>
                        <section className="vdm-form-section">
                            <h4 className="vdm-form-section-title">导入说明</h4>
                            <p className="vdm-guide">{IMPORT_GUIDE}</p>
                        </section>

                        <section className="vdm-form-section">
                            <h4 className="vdm-form-section-title">模板下载</h4>
                            <div className="vdm-upload-row">
                                <FileSpreadsheet size={28} className="vdm-upload-icon" />
                                <div className="vdm-upload-main">
                                    <strong>摄像头数据导入模板.xlsx</strong>
                                    <span>含填写要求与 {IMPORT_COLUMNS.length} 个字段列，带 * 为必填</span>
                                </div>
                                <Button icon={<Download size={14} />} onClick={downloadTemplate}>
                                    下载模板
                                </Button>
                            </div>
                        </section>

                        <section className="vdm-form-section">
                            <h4 className="vdm-form-section-title">上传文件</h4>
                            {parsing ? (
                                <div className="vdm-parsing">
                                    <Loader2 size={18} className="vdm-spin" />
                                    <div className="vdm-parsing-main">
                                        <strong>正在导入解析数据…</strong>
                                        <span>{file?.name}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="vdm-upload-row">
                                    <FileUp size={28} className="vdm-upload-icon" />
                                    <div className="vdm-upload-main">
                                        <strong>尚未选择文件</strong>
                                        <span>支持 .xlsx / .xls / .csv，选择文件后自动上传解析并保存校验通过的数据</span>
                                    </div>
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept=".xlsx,.xls,.csv,.txt"
                                        className="vdm-file-input"
                                        onChange={(e) => {
                                            const picked = e.target.files?.[0];
                                            if (picked) startParse(picked);
                                        }}
                                    />
                                    <Button
                                        variant="primary"
                                        icon={<Upload size={14} />}
                                        onClick={() => fileRef.current?.click()}
                                    >
                                        选择文件
                                    </Button>
                                </div>
                            )}
                        </section>
                    </>
                )}
            </Drawer>
        </>
    );
}

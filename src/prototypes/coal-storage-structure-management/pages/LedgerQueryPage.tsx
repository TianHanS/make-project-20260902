/**
 * 页底四类台账：入库、出库、调整、盘煤。
 * 用 Tab 切换平铺表格，明细在右侧抽屉查看。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Descriptions, Drawer, Table, Tabs, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { YARDS, fmt } from '../data';
import {
  sortAdjustLines,
  type AdjustLine,
  type AdjustRecord,
  type InboundRecord,
  type LedgerState,
  type OutboundRecord,
  type SurveyRecord,
} from '../ledger';

export type LedgerPageId = 'inbound' | 'outbound' | 'adjust' | 'survey';

const PAGE_SIZE = 20;

const pager = {
  pageSize: PAGE_SIZE,
  showSizeChanger: false,
  showTotal: (total: number) => `共 ${total} 条`,
};

const auditColumns = <T extends { time: string; operator: string; createdAt: string; creator: string }>(): ColumnsType<T> => [
  { title: '操作时间', dataIndex: 'time', width: 168 },
  { title: '操作人', dataIndex: 'operator', width: 150 },
  { title: '创建时间', dataIndex: 'createdAt', width: 168 },
  { title: '创建人', dataIndex: 'creator', width: 150 },
];

const dashText = (value: string | null | undefined) => (value ? value : '—');

const dashNum = (value: number | null | undefined, digits = 0) =>
  value == null ? '—' : fmt(value, digits);

const adjustLineColumns = (showZone: boolean): ColumnsType<AdjustLine> => {
  const zoneCol: ColumnsType<AdjustLine> = showZone
    ? [{ title: '分区', dataIndex: 'zoneName', width: 88, fixed: 'left' }]
    : [];
  return [
    {
      title: '前后标识',
      dataIndex: 'phase',
      width: 88,
      fixed: 'left',
      render: (value: AdjustLine['phase']) => (value === 'before' ? '调整前' : '调整后'),
    },
    ...zoneCol,
    { title: '煤层编号', dataIndex: 'layerId', width: 120 },
    {
      title: '煤层序号',
      dataIndex: 'seq',
      width: 88,
      render: (value: number) => (value ? `第 ${value} 层` : '—'),
    },
    { title: '入厂登记编号', dataIndex: 'regNo', width: 230, render: dashText },
    { title: '车船号', dataIndex: 'shipName', width: 140, render: dashText },
    { title: '航次', dataIndex: 'voyage', width: 90, render: dashText },
    { title: '煤品种', dataIndex: 'coalVariety', width: 88, render: dashText },
    { title: '煤种', dataIndex: 'coalKind', width: 110, render: dashText },
    { title: '库存煤种', dataIndex: 'stockCoal', width: 110, render: dashText },
    { title: '密度 t/m³', dataIndex: 'density', width: 100, align: 'right', render: (value: number | null) => dashNum(value, 3) },
    { title: '体积 m³', dataIndex: 'volume', width: 100, align: 'right', render: (value: number | null) => dashNum(value) },
    { title: '煤量 t', dataIndex: 'mass', width: 110, align: 'right', render: (value: number | null) => dashNum(value, 3) },
    {
      title: '体积占比 %',
      dataIndex: 'volumeRatio',
      width: 110,
      align: 'right',
      render: (value: number | null) => (value == null ? '—' : fmt(value, 2)),
    },
    { title: '起始角度 °', dataIndex: 'pitchStart', width: 110, align: 'right', render: (value: number | null) => dashNum(value, 2) },
    { title: '结束角度 °', dataIndex: 'pitchEnd', width: 110, align: 'right', render: (value: number | null) => dashNum(value, 2) },
    { title: '起始高度 m', dataIndex: 'heightStart', width: 110, align: 'right', render: (value: number | null) => dashNum(value, 2) },
    { title: '结束高度 m', dataIndex: 'heightEnd', width: 110, align: 'right', render: (value: number | null) => dashNum(value, 2) },
    { title: '热值 kcal/kg', dataIndex: 'cv', width: 120, align: 'right', render: (value: number | null) => dashNum(value) },
    { title: '硫分 %', dataIndex: 'sulfur', width: 90, align: 'right', render: (value: number | null) => dashNum(value, 2) },
    { title: '灰分 %', dataIndex: 'ash', width: 90, align: 'right', render: (value: number | null) => dashNum(value, 2) },
    { title: '挥发分 %', dataIndex: 'volatile', width: 100, align: 'right', render: (value: number | null) => dashNum(value, 2) },
    { title: '水分 %', dataIndex: 'moisture', width: 90, align: 'right', render: (value: number | null) => dashNum(value, 2) },
  ];
};

const modeTag = (mode: 'manual' | 'auto') => (
  <Tag color={mode === 'auto' ? 'cyan' : 'gold'} style={{ marginInlineEnd: 0 }}>
    {mode === 'auto' ? '自动' : '人工'}
  </Tag>
);

interface Props {
  ledger: LedgerState;
  /** 传入时只显示该煤场；日志查询页自行筛选，不传 */
  yardId?: string;
  tab?: LedgerPageId;
  onTabChange?: (tab: LedgerPageId) => void;
  /** 日志查询页把 Tab 放在筛选条件之上，此处只渲染当前表 */
  showTabs?: boolean;
  /** 变化时把当前表回到第 1 页 */
  pageResetKey?: string;
}

type OpenDetail =
  | { kind: 'inbound'; row: InboundRecord }
  | { kind: 'outbound'; row: OutboundRecord }
  | { kind: 'adjust'; row: AdjustRecord }
  | { kind: 'survey'; row: SurveyRecord };

const LedgerPanel: React.FC<Props> = ({
  ledger,
  yardId,
  tab = 'inbound',
  onTabChange,
  showTabs = true,
  pageResetKey,
}) => {
  const [detail, setDetail] = useState<OpenDetail | null>(null);
  const [page, setPage] = useState(1);
  const yardName = (id: string) => YARDS.find((yard) => yard.id === id)?.shortName ?? id;
  const inYard = <T extends { yardId: string }>(rows: T[]) =>
    yardId ? rows.filter((row) => row.yardId === yardId) : rows;

  const inboundRows = useMemo(() => inYard(ledger.inbound), [ledger.inbound, yardId]);
  const outboundRows = useMemo(() => inYard(ledger.outbound), [ledger.outbound, yardId]);
  const adjustRows = useMemo(() => inYard(ledger.adjust), [ledger.adjust, yardId]);
  const surveyRows = useMemo(() => inYard(ledger.survey), [ledger.survey, yardId]);

  useEffect(() => {
    if (pageResetKey == null) return;
    setPage(1);
  }, [pageResetKey, tab]);

  const tablePager = pageResetKey == null
    ? pager
    : { ...pager, current: page, onChange: (next: number) => setPage(next) };

  const inboundColumns: ColumnsType<InboundRecord> = [
    ...auditColumns<InboundRecord>(),
    { title: '煤场', key: 'yard', width: 140, render: (_, row) => yardName(row.yardId) },
    { title: '处理方式', dataIndex: 'mode', width: 90, render: modeTag },
    { title: '入厂登记编号', dataIndex: 'regNo', width: 250, render: (value: string) => value || '待标记' },
    { title: '库存煤种', dataIndex: 'coalTypeName', width: 120 },
    {
      title: '入库煤量 t',
      dataIndex: 'totalMass',
      width: 120,
      align: 'right',
      render: (value: number) => <span className="cssm-num">{fmt(value, 3)}</span>,
    },
    { title: '说明', dataIndex: 'note', ellipsis: true },
    {
      title: '操作',
      key: 'op',
      width: 72,
      fixed: 'right',
      render: (_, row) => (
        <Button type="link" size="small" onClick={() => setDetail({ kind: 'inbound', row })}>
          查看
        </Button>
      ),
    },
  ];

  const outboundColumns: ColumnsType<OutboundRecord> = [
    ...auditColumns<OutboundRecord>(),
    { title: '煤场', key: 'yard', width: 140, render: (_, row) => yardName(row.yardId) },
    { title: '处理方式', dataIndex: 'mode', width: 90, render: modeTag },
    { title: '出库分区', dataIndex: 'zoneName', width: 110 },
    {
      title: '出库煤量 t',
      dataIndex: 'mass',
      width: 120,
      align: 'right',
      render: (value: number) => <span className="cssm-num">{fmt(value, 3)}</span>,
    },
    { title: '说明', dataIndex: 'note', ellipsis: true },
    {
      title: '操作',
      key: 'op',
      width: 72,
      fixed: 'right',
      render: (_, row) => (
        <Button type="link" size="small" onClick={() => setDetail({ kind: 'outbound', row })}>
          查看
        </Button>
      ),
    },
  ];

  const adjustColumns: ColumnsType<AdjustRecord> = [
    { title: '操作时间', dataIndex: 'time', width: 168 },
    { title: '操作人', dataIndex: 'operator', width: 150 },
    { title: '煤场', key: 'yard', width: 140, render: (_, row) => yardName(row.yardId) },
    { title: '分区', dataIndex: 'zoneName', width: 100 },
    { title: '调整类型', dataIndex: 'action', width: 140 },
    {
      title: '操作',
      key: 'op',
      width: 72,
      fixed: 'right',
      render: (_, row) => (
        <Button type="link" size="small" onClick={() => setDetail({ kind: 'adjust', row })}>
          查看
        </Button>
      ),
    },
  ];

  const surveyColumns: ColumnsType<SurveyRecord> = [
    { title: '盘煤时间', dataIndex: 'time', width: 180 },
    { title: '煤场编号', dataIndex: 'yardCode', width: 120 },
    { title: '煤场', dataIndex: 'yardName' },
    {
      title: '分区数',
      key: 'zones',
      width: 90,
      align: 'right',
      render: (_, row) => ledger.surveyDetails.filter((item) => item.recordId === row.id).length,
    },
    {
      title: '操作',
      key: 'op',
      width: 72,
      fixed: 'right',
      render: (_, row) => (
        <Button type="link" size="small" onClick={() => setDetail({ kind: 'survey', row })}>
          查看
        </Button>
      ),
    },
  ];

  const inboundDetail = detail?.kind === 'inbound' ? detail.row : null;
  const outboundDetail = detail?.kind === 'outbound' ? detail.row : null;
  const adjustDetail = detail?.kind === 'adjust' ? detail.row : null;
  const surveyDetail = detail?.kind === 'survey' ? detail.row : null;

  const titles: Record<LedgerPageId, string> = {
    inbound: '入库记录详情',
    outbound: '出库记录详情',
    adjust: '调整记录详情',
    survey: '盘煤记录详情',
  };

  const tabItems: { key: LedgerPageId; label: string; children: React.ReactNode }[] = [
    {
      key: 'inbound',
      label: `入库记录 ${inboundRows.length}`,
      children: (
        <Table<InboundRecord>
          rowKey="id"
          size="small"
          columns={inboundColumns}
          dataSource={inboundRows}
          pagination={tablePager}
          scroll={{ x: 1480 }}
        />
      ),
    },
    {
      key: 'outbound',
      label: `出库记录 ${outboundRows.length}`,
      children: (
        <Table<OutboundRecord>
          rowKey="id"
          size="small"
          columns={outboundColumns}
          dataSource={outboundRows}
          pagination={tablePager}
          scroll={{ x: 1360 }}
        />
      ),
    },
    {
      key: 'adjust',
      label: `调整记录 ${adjustRows.length}`,
      children: (
        <Table<AdjustRecord>
          rowKey="id"
          size="small"
          columns={adjustColumns}
          dataSource={adjustRows}
          pagination={tablePager}
          scroll={{ x: 1100 }}
        />
      ),
    },
    {
      key: 'survey',
      label: `盘煤记录 ${surveyRows.length}`,
      children: (
        <Table<SurveyRecord>
          rowKey="id"
          size="small"
          columns={surveyColumns}
          dataSource={surveyRows}
          pagination={tablePager}
          scroll={{ x: 640 }}
        />
      ),
    },
  ];

  return (
    <section className={showTabs ? 'cssm-ledger' : 'cssm-ledger is-plain'}>
      {showTabs ? (
        <Tabs
          activeKey={tab}
          onChange={(key) => onTabChange?.(key as LedgerPageId)}
          items={tabItems}
        />
      ) : (
        tabItems.find((item) => item.key === tab)?.children
      )}

      <Drawer
        title={detail ? titles[detail.kind] : '记录详情'}
        open={detail != null}
        onClose={() => setDetail(null)}
        size={detail?.kind === 'adjust' ? 'min(1200px, 96vw)' : 'min(760px, 96vw)'}
        destroyOnHidden
        footer={
          <div className="cssm-drawer-foot">
            <Button onClick={() => setDetail(null)}>关闭</Button>
          </div>
        }
      >
        {inboundDetail && (
          <>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="操作时间">{inboundDetail.time}</Descriptions.Item>
              <Descriptions.Item label="操作人">{inboundDetail.operator}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{inboundDetail.createdAt}</Descriptions.Item>
              <Descriptions.Item label="创建人">{inboundDetail.creator}</Descriptions.Item>
              <Descriptions.Item label="煤场">{yardName(inboundDetail.yardId)}</Descriptions.Item>
              <Descriptions.Item label="处理方式">{modeTag(inboundDetail.mode)}</Descriptions.Item>
              <Descriptions.Item label="入厂登记编号">{inboundDetail.regNo || '待标记'}</Descriptions.Item>
              <Descriptions.Item label="车船号">{inboundDetail.shipName || '—'}</Descriptions.Item>
              <Descriptions.Item label="航次">{inboundDetail.voyage || '—'}</Descriptions.Item>
              <Descriptions.Item label="库存煤种">{inboundDetail.coalTypeName}</Descriptions.Item>
              <Descriptions.Item label="计算密度">{fmt(inboundDetail.density, 3)} t/m³</Descriptions.Item>
              <Descriptions.Item label="入库煤量">{fmt(inboundDetail.totalMass, 3)} t</Descriptions.Item>
              <Descriptions.Item label="说明">{inboundDetail.note || '—'}</Descriptions.Item>
            </Descriptions>
            <h3 className="cssm-ledger-sub">分区明细</h3>
            <Table
              rowKey="id"
              size="small"
              pagination={pager}
              dataSource={ledger.inboundDetails.filter((item) => item.recordId === inboundDetail.id)}
              columns={[
                { title: '分区', dataIndex: 'zoneName', width: 90 },
                { title: '体积 m³', dataIndex: 'volume', align: 'right', render: (value: number) => fmt(value) },
                { title: '煤量 t', dataIndex: 'mass', align: 'right', render: (value: number) => fmt(value, 3) },
                ...(YARDS.find((item) => item.id === inboundDetail.yardId)?.hasSurvey
                  ? [
                      {
                        title: '俯仰角度',
                        key: 'pitch',
                        render: (_: unknown, item: { pitchFrom: number; pitchTo: number }) =>
                          `${item.pitchFrom.toFixed(1)}° ~ ${item.pitchTo.toFixed(1)}°`,
                      },
                      {
                        title: '煤层高度',
                        key: 'height',
                        render: (_: unknown, item: { heightFrom: number; heightTo: number }) =>
                          `${item.heightFrom.toFixed(2)} ~ ${item.heightTo.toFixed(2)} m`,
                      },
                    ]
                  : []),
              ]}
            />
          </>
        )}
        {outboundDetail && (
          <>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="操作时间">{outboundDetail.time}</Descriptions.Item>
              <Descriptions.Item label="操作人">{outboundDetail.operator}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{outboundDetail.createdAt}</Descriptions.Item>
              <Descriptions.Item label="创建人">{outboundDetail.creator}</Descriptions.Item>
              <Descriptions.Item label="煤场">{yardName(outboundDetail.yardId)}</Descriptions.Item>
              <Descriptions.Item label="处理方式">{modeTag(outboundDetail.mode)}</Descriptions.Item>
              <Descriptions.Item label="出库分区">{outboundDetail.zoneName}</Descriptions.Item>
              <Descriptions.Item label="出库煤量">{fmt(outboundDetail.mass, 3)} t</Descriptions.Item>
              <Descriptions.Item label="说明">{outboundDetail.note || '—'}</Descriptions.Item>
            </Descriptions>
            <h3 className="cssm-ledger-sub">扣减明细</h3>
            <Table
              rowKey="id"
              size="small"
              pagination={pager}
              dataSource={ledger.outboundDetails.filter((item) => item.recordId === outboundDetail.id)}
              columns={[
                { title: '煤层', dataIndex: 'seq', width: 90, render: (value: number) => (value ? `第 ${value} 层` : '—') },
                { title: '入厂登记编号', dataIndex: 'regNo', render: (value: string) => value || '待标记' },
                { title: '库存煤种', dataIndex: 'coalTypeName', width: 110 },
                { title: '扣减', dataIndex: 'cut', width: 90, render: (value: string) => (value === 'all' ? '全部扣减' : '部分扣减') },
                { title: '体积 m³', dataIndex: 'volume', align: 'right', width: 100, render: (value: number) => fmt(value) },
                { title: '煤量 t', dataIndex: 'mass', align: 'right', width: 100, render: (value: number) => fmt(value, 3) },
              ]}
            />
          </>
        )}
        {adjustDetail && (() => {
          const lines = sortAdjustLines(
            ledger.adjustDetails.filter((item) => item.recordId === adjustDetail.id),
          );
          const showZone = new Set(lines.map((item) => item.zoneName)).size > 1;
          return (
            <>
              <Descriptions size="small" column={2} bordered>
                <Descriptions.Item label="调整记录编号">{adjustDetail.id}</Descriptions.Item>
                <Descriptions.Item label="调整类型">{adjustDetail.action}</Descriptions.Item>
                <Descriptions.Item label="煤场">{yardName(adjustDetail.yardId)}</Descriptions.Item>
                <Descriptions.Item label="分区">{adjustDetail.zoneName}</Descriptions.Item>
                <Descriptions.Item label="操作人">{adjustDetail.operator}</Descriptions.Item>
                <Descriptions.Item label="操作时间">{adjustDetail.time}</Descriptions.Item>
                <Descriptions.Item label="创建人">{adjustDetail.creator}</Descriptions.Item>
                <Descriptions.Item label="创建时间">{adjustDetail.createdAt}</Descriptions.Item>
                <Descriptions.Item label="调整说明" span={2}>{adjustDetail.note || '—'}</Descriptions.Item>
              </Descriptions>
              <h3 className="cssm-ledger-sub">调整明细</h3>
              <Table
                className="cssm-adjust-lines"
                rowKey="id"
                size="small"
                pagination={lines.length > PAGE_SIZE ? pager : false}
                scroll={{ x: showZone ? 2540 : 2460 }}
                dataSource={lines}
                columns={adjustLineColumns(showZone)}
              />
            </>
          );
        })()}
        {surveyDetail && (
          <>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="盘煤时间">{surveyDetail.time}</Descriptions.Item>
              <Descriptions.Item label="煤场编号">{surveyDetail.yardCode}</Descriptions.Item>
              <Descriptions.Item label="煤场" span={2}>{surveyDetail.yardName}</Descriptions.Item>
            </Descriptions>
            <h3 className="cssm-ledger-sub">分区明细</h3>
            <Table
              rowKey="id"
              size="small"
              pagination={pager}
              dataSource={ledger.surveyDetails.filter((item) => item.recordId === surveyDetail.id)}
              columns={[
                { title: '分区编号', dataIndex: 'zoneCode', width: 90 },
                { title: '分区', dataIndex: 'zoneName', width: 90 },
                { title: '本次体积 m³', dataIndex: 'volume', align: 'right', render: (value: number) => fmt(value) },
                { title: '上次体积 m³', dataIndex: 'lastVolume', align: 'right', render: (value: number) => fmt(value) },
                { title: '变动量 m³', dataIndex: 'delta', align: 'right', render: (value: number) => fmt(value) },
                { title: '引用更新库存', dataIndex: 'applied', width: 120, render: (value: boolean) => (value ? '是' : '否') },
              ]}
            />
          </>
        )}
      </Drawer>
    </section>
  );
};

export default LedgerPanel;

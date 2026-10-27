/**
 * 盘煤记录查询
 *
 * 按当前煤场列出盘煤快照。未配置盘煤数据源的煤场为空。
 */

import React, { useMemo } from 'react';
import { Button, Drawer, Empty, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { buildSurveyRecords, fmt, type CoalYard, type CoalZone, type SurveyRecord } from '../data';

interface Props {
  open: boolean;
  yard: CoalYard;
  zones: CoalZone[];
  onClose: () => void;
}

const deltaText = (delta: number | null) => {
  if (delta == null) return '—';
  if (Math.abs(delta) < 0.5) return '无变动';
  const sign = delta > 0 ? '+' : '−';
  return `${sign}${fmt(Math.abs(delta))}`;
};

const SurveyRecordModal: React.FC<Props> = ({ open, yard, zones, onClose }) => {
  const records = useMemo(() => buildSurveyRecords(yard, zones), [yard, zones]);
  const mine = useMemo(
    () => zones.filter((zone) => zone.yardId === yard.id).sort((a, b) => a.code - b.code),
    [zones, yard.id],
  );

  const columns: ColumnsType<SurveyRecord> = [
    { title: '盘煤时间', dataIndex: 'surveyedAt', width: 168 },
    {
      title: '盘煤体积 m³',
      dataIndex: 'volume',
      width: 140,
      align: 'right',
      render: (value: number) => <span className="cssm-num">{fmt(value)}</span>,
    },
    {
      title: '相对上次 m³',
      dataIndex: 'delta',
      align: 'right',
      render: (value: number | null) => <span className="cssm-num">{deltaText(value)}</span>,
    },
  ];

  return (
    <Drawer
      title={`盘煤记录 · ${yard.shortName}`}
      open={open}
      onClose={onClose}
      size="min(720px, 94vw)"
      destroyOnHidden
      footer={
        <div className="cssm-drawer-foot">
          <Button onClick={onClose}>关闭</Button>
        </div>
      }
    >
      {records.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前煤场暂无盘煤记录" />
      ) : (
        <Table<SurveyRecord>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={records}
          pagination={false}
          expandable={{
            expandedRowRender: (record) => (
              <Table<CoalZone>
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={mine}
                scroll={{ y: 280 }}
                columns={[
                  { title: '分区', dataIndex: 'name', width: 88 },
                  {
                    title: '盘煤体积 m³',
                    key: 'volume',
                    align: 'right',
                    render: (_, zone) => (
                      <span className="cssm-num">
                        {fmt(record.snapshot === 'current' ? zone.surveyVolume : zone.lastSurveyVolume)}
                      </span>
                    ),
                  },
                ]}
              />
            ),
          }}
        />
      )}
    </Drawer>
  );
};

export default SurveyRecordModal;

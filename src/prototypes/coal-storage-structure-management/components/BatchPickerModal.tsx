/**
 * 来煤预报选择。按预报时间逆序，可按登记编号、车船号、航次搜索。
 * 从入库或标记表单上叠一层抽屉，不使用居中弹窗。
 */

import React, { useMemo, useState } from 'react';
import { Button, Drawer, Input, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { type ArrivalBatch, forecastView } from '../data';

interface Props {
  open: boolean;
  batches: ArrivalBatch[];
  onClose: () => void;
  onPick: (batch: ArrivalBatch) => void;
}

const BatchPickerModal: React.FC<Props> = ({ open, batches, onClose, onPick }) => {
  const [keyword, setKeyword] = useState('');
  const [picked, setPicked] = useState<string>();

  const rows = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    return [...batches]
      .sort((a, b) => b.unloadedAt.localeCompare(a.unloadedAt))
      .filter((batch) => {
        if (!text) return true;
        return [batch.regNo, batch.shipName, batch.voyage].join(' ').toLowerCase().includes(text);
      });
  }, [batches, keyword]);

  const columns: ColumnsType<ArrivalBatch> = [
    { title: '预报时间', dataIndex: 'unloadedAt', width: 110 },
    { title: '入厂登记编号', dataIndex: 'regNo', width: 220 },
    {
      title: '批次号',
      key: 'batchNo',
      width: 120,
      render: (_, row) => forecastView(row).batchNo,
    },
    { title: '车船号', dataIndex: 'shipName', width: 140 },
    { title: '航次', dataIndex: 'voyage', width: 80 },
    {
      title: '煤品种',
      key: 'variety',
      width: 80,
      render: (_, row) => forecastView(row).coalVariety,
    },
    {
      title: '煤种',
      key: 'kind',
      width: 100,
      render: (_, row) => forecastView(row).coalKind,
    },
    {
      title: '库存煤种',
      key: 'stock',
      width: 110,
      render: (_, row) => forecastView(row).stockCoalType || '未填写',
    },
  ];

  const confirm = () => {
    const batch = batches.find((item) => item.regNo === picked);
    if (batch) onPick(batch);
  };

  return (
    <Drawer
      title="选择来煤预报"
      open={open}
      size="min(920px, 94vw)"
      onClose={onClose}
      zIndex={2100}
      push={false}
      destroyOnHidden
      afterOpenChange={(visible) => {
        if (visible) {
          setKeyword('');
          setPicked(undefined);
        }
      }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" disabled={!picked} onClick={confirm}>
              确认
            </Button>
          </Space>
        </div>
      }
    >
      <Input.Search
        allowClear
        placeholder="登记编号、车船号、航次"
        style={{ marginBottom: 12, maxWidth: 320 }}
        onChange={(event) => setKeyword(event.target.value)}
      />
      <Table<ArrivalBatch>
        rowKey="regNo"
        size="small"
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 8, showSizeChanger: false }}
        rowSelection={{
          type: 'radio',
          selectedRowKeys: picked ? [picked] : [],
          onChange: (keys) => setPicked(String(keys[0])),
        }}
        onRow={(row) => ({
          onClick: () => setPicked(row.regNo),
          onDoubleClick: () => onPick(row),
        })}
        scroll={{ x: 860 }}
      />
    </Drawer>
  );
};

export default BatchPickerModal;

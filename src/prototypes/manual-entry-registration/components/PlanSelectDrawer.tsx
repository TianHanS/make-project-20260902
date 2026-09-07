/**
 * 人工选择来煤计划：右侧抽屉，支持供应商/矿点/煤种筛选，行单选
 */
import React, { useMemo, useState } from 'react';
import { Button, Drawer, Radio, Select, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PLANS,
  uniqueCoalTypes,
  uniqueMines,
  uniqueSuppliers,
  type CoalPlan,
} from '../data';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (plan: CoalPlan) => void;
}

const PlanSelectDrawer: React.FC<Props> = ({ open, onClose, onPick }) => {
  const [picked, setPicked] = useState<string>();
  const [supplier, setSupplier] = useState<string>();
  const [mine, setMine] = useState<string>();
  const [coalType, setCoalType] = useState<string>();

  const filtered = useMemo(
    () =>
      PLANS.filter((p) => {
        if (supplier && p.supplier !== supplier) return false;
        if (mine && p.mine !== mine) return false;
        if (coalType && p.coalType !== coalType) return false;
        return true;
      }),
    [supplier, mine, coalType],
  );

  const columns: ColumnsType<CoalPlan> = [
    {
      title: '',
      width: 48,
      render: (_, row) => <Radio checked={picked === row.id} onChange={() => setPicked(row.id)} />,
    },
    { title: '计划流水号', dataIndex: 'serialNo', width: 140 },
    { title: '车牌', dataIndex: 'plate', width: 100 },
    { title: '供应商', dataIndex: 'supplier', width: 140, ellipsis: true },
    { title: '矿点', dataIndex: 'mine', width: 100 },
    { title: '煤种', dataIndex: 'coalType', width: 80 },
    { title: '运输单位', dataIndex: 'transporter', width: 110 },
    { title: '卸煤区域', dataIndex: 'unloadArea', width: 120 },
    { title: '矿发净重 t', dataIndex: 'net', width: 90 },
  ];

  return (
    <Drawer
      title="人工选择计划"
      open={open}
      onClose={onClose}
      width={920}
      destroyOnHidden
      afterOpenChange={(v) => {
        if (!v) {
          setPicked(undefined);
          setSupplier(undefined);
          setMine(undefined);
          setCoalType(undefined);
        }
      }}
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            disabled={!picked}
            onClick={() => {
              const plan = PLANS.find((p) => p.id === picked);
              if (plan) onPick(plan);
            }}
          >
            确认回填
          </Button>
        </Space>
      }
    >
      <Space wrap style={{ marginBottom: 12 }}>
        <Select
          allowClear
          placeholder="供应商"
          style={{ width: 160 }}
          value={supplier}
          options={uniqueSuppliers().map((v) => ({ value: v, label: v }))}
          onChange={setSupplier}
        />
        <Select
          allowClear
          placeholder="矿点"
          style={{ width: 140 }}
          value={mine}
          options={uniqueMines().map((v) => ({ value: v, label: v }))}
          onChange={setMine}
        />
        <Select
          allowClear
          placeholder="煤种"
          style={{ width: 120 }}
          value={coalType}
          options={uniqueCoalTypes().map((v) => ({ value: v, label: v }))}
          onChange={setCoalType}
        />
      </Space>
      <Table
        rowKey="id"
        size="small"
        pagination={false}
        columns={columns}
        dataSource={filtered}
        scroll={{ x: 900 }}
        onRow={(row) => ({
          onClick: () => setPicked(row.id),
          style: { cursor: 'pointer', background: picked === row.id ? 'rgba(22,119,255,0.06)' : undefined },
        })}
      />
    </Drawer>
  );
};

export default PlanSelectDrawer;

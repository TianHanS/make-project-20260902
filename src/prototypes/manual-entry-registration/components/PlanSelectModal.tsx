/**
 * 选择来煤计划
 */
import React, { useState } from 'react';
import { Button, Modal, Radio, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PLANS, type CoalPlan } from '../data';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (plan: CoalPlan) => void;
}

const PlanSelectModal: React.FC<Props> = ({ open, onClose, onPick }) => {
  const [picked, setPicked] = useState<string>();

  const columns: ColumnsType<CoalPlan> = [
    {
      title: '',
      width: 48,
      render: (_, row) => <Radio checked={picked === row.id} onChange={() => setPicked(row.id)} />,
    },
    { title: '计划流水号', dataIndex: 'serialNo', width: 140 },
    { title: '车牌', dataIndex: 'plate', width: 110 },
    { title: '供应商', dataIndex: 'supplier', width: 150 },
    { title: '矿点', dataIndex: 'mine', width: 110 },
    { title: '煤种', dataIndex: 'coalType', width: 90 },
    { title: '运输单位', dataIndex: 'transporter', width: 120 },
    { title: '卸煤区域', dataIndex: 'unloadArea', width: 130 },
    { title: '矿发净重 t', dataIndex: 'net', width: 100 },
  ];

  return (
    <Modal
      title="选择来煤计划"
      open={open}
      onCancel={onClose}
      width={1080}
      destroyOnHidden
      afterOpenChange={(v) => {
        if (!v) setPicked(undefined);
      }}
      footer={
        <Button
          type="primary"
          disabled={!picked}
          onClick={() => {
            const plan = PLANS.find((p) => p.id === picked);
            if (plan) onPick(plan);
          }}
        >
          确定回填
        </Button>
      }
    >
      <Table
        rowKey="id"
        size="small"
        pagination={false}
        columns={columns}
        dataSource={PLANS}
        onRow={(row) => ({
          onClick: () => setPicked(row.id),
          style: { cursor: 'pointer' },
        })}
      />
    </Modal>
  );
};

export default PlanSelectModal;

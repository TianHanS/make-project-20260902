/**
 * 允许车辆入厂登记：禁止入厂时人工确认放行
 */
import React, { useState } from 'react';
import { Button, Descriptions, Drawer, Input, Space, Tag, message } from 'antd';
import type { EntryPermit } from '../data';

export const ALLOW_ENTRY_TOOLTIP =
  '车辆是否允许入厂是由云驿平台在车辆到厂前自动同步到三大项目。禁止入厂的车辆代表需封签核验或存在在途其他风险，也有可能是由于网络原因云驿未自动同步车辆状态为允许入厂。';

export const REASON_PRESETS = [
  '网络异常未自动同步允许入厂状态',
  '核验后无误人工手动放行',
] as const;

interface Props {
  open: boolean;
  plate?: string;
  supplier?: string;
  gross?: number | null;
  tare?: number | null;
  net?: number | null;
  permit?: EntryPermit;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

const weightText = (n?: number | null) =>
  n === undefined || n === null || Number.isNaN(Number(n)) ? '—' : `${Number(n)} t`;

const AllowEntryDrawer: React.FC<Props> = ({
  open,
  plate,
  supplier,
  gross,
  tare,
  net,
  permit,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');

  const submit = () => {
    const text = reason.trim();
    if (!text) {
      message.warning('请填写允许入厂原因');
      return;
    }
    onConfirm(text);
    setReason('');
  };

  return (
    <Drawer
      title="允许车辆入厂登记"
      open={open}
      onClose={onClose}
      width={520}
      destroyOnHidden
      afterOpenChange={(visible) => {
        if (!visible) setReason('');
      }}
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={submit}>
            确认允许入厂
          </Button>
        </Space>
      }
    >
      <Descriptions size="small" column={1} bordered>
        <Descriptions.Item label="车牌号码">{plate || '—'}</Descriptions.Item>
        <Descriptions.Item label="供应商">{supplier || '—'}</Descriptions.Item>
        <Descriptions.Item label="矿发毛重">{weightText(gross)}</Descriptions.Item>
        <Descriptions.Item label="矿发皮重">{weightText(tare)}</Descriptions.Item>
        <Descriptions.Item label="矿发净重">{weightText(net)}</Descriptions.Item>
        <Descriptions.Item label="允许入厂">
          {permit === 'allowed' ? (
            <Tag color="success">是</Tag>
          ) : permit === 'forbidden' ? (
            <Tag color="error">否</Tag>
          ) : (
            '—'
          )}
        </Descriptions.Item>
      </Descriptions>

      <div className="mer-allow-reason">
        <label className="mer-allow-reason-label" htmlFor="allow-reason">
          原因
        </label>
        <Input.TextArea
          id="allow-reason"
          rows={3}
          value={reason}
          placeholder="请填写人工允许入厂原因"
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="mer-allow-presets">
          <span className="mer-allow-presets-label">快捷输入</span>
          <Space wrap size={[6, 6]}>
            {REASON_PRESETS.map((text) => (
              <Button key={text} size="small" onClick={() => setReason(text)}>
                {text}
              </Button>
            ))}
          </Space>
        </div>
      </div>
    </Drawer>
  );
};

export default AllowEntryDrawer;

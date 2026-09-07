/**
 * 扫码枪 / 矿发卡输入。按钮进入加载后聚焦输入，支持粘贴与示例填充。
 */
import React, { useState } from 'react';
import { Alert, Button, Input, Modal, Space } from 'antd';

export type ScanKind = 'plan-qr' | 'yunyi' | 'mine-card';

interface Props {
  open: boolean;
  kind: ScanKind;
  loading: boolean;
  samples: { label: string; value: string }[];
  onClose: () => void;
  onSubmit: (raw: string) => void;
}

const TITLE: Record<ScanKind, string> = {
  'plan-qr': '扫描计划二维码',
  yunyi: '扫描云驿二维码',
  'mine-card': '读取矿发卡',
};

const HINT: Record<ScanKind, string> = {
  'plan-qr': '将扫码枪对准计划二维码。读取结果为计划 ID，查询后来煤信息回填到表单。',
  yunyi:
    '二维码格式：计划流水号|运输任务单号|车牌号码|发货时间|矿发毛重|矿发皮重|矿发净重|计划ID|当前时间|发站时间。当前时间与系统时间相差超过 15 分钟视为失效。',
  'mine-card':
    '矿发卡解析规则：录入车牌OreadWriteOaObO卡内车牌O计划idO毛重O皮重O。读出后比对表单车牌与卡内车牌。',
};

const ScanModal: React.FC<Props> = ({ open, kind, loading, samples, onClose, onSubmit }) => {
  const [value, setValue] = useState('');

  return (
    <Modal
      title={TITLE[kind]}
      open={open}
      onCancel={onClose}
      okText="解析并回填"
      okButtonProps={{ disabled: !value.trim(), loading }}
      onOk={() => onSubmit(value)}
      destroyOnHidden
      afterOpenChange={(v) => {
        if (!v) setValue('');
      }}
    >
      <p className="mer-scan-hint">{HINT[kind]}</p>
      {loading ? <Alert type="info" showIcon message="正在读取扫码枪 / 读卡器，请稍候…" /> : null}
      <Input.TextArea
        autoFocus
        rows={4}
        value={value}
        disabled={loading}
        placeholder="扫码枪内容将出现在此处，也可粘贴"
        onChange={(e) => setValue(e.target.value)}
        onPressEnter={(e) => {
          if (e.shiftKey) return;
          e.preventDefault();
          if (value.trim()) onSubmit(value);
        }}
      />
      <Space wrap style={{ marginTop: 12 }}>
        {samples.map((s) => (
          <Button key={s.label} size="small" onClick={() => setValue(s.value)}>
            {s.label}
          </Button>
        ))}
      </Space>
    </Modal>
  );
};

export default ScanModal;

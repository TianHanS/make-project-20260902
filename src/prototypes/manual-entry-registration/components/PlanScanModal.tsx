/**
 * 计划码扫码弹窗：ESC 或关闭退出扫描
 */
import React, { useEffect, useRef, useState } from 'react';
import { Button, Modal, Space } from 'antd';
import { PLANS } from '../data';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (planId: string) => void;
}

const PlanScanModal: React.FC<Props> = ({ open, onClose, onSubmit }) => {
  const [buffer, setBuffer] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setBuffer('');
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const finish = (raw: string) => {
    const id = raw.trim();
    if (!id) return;
    onSubmit(id);
    onClose();
  };

  return (
    <Modal
      title="计划码扫码"
      open={open}
      onCancel={onClose}
      footer={null}
      width={440}
      destroyOnHidden
      centered
    >
      <input
        ref={inputRef}
        className="mer-hidden-scan-input"
        value={buffer}
        aria-label="计划码扫码输入"
        onChange={(e) => setBuffer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && buffer.trim()) finish(buffer.trim());
        }}
      />
      <div className="mer-yunyi-scan">
        <div className="mer-yunyi-scan-frame">
          <span className="mer-yunyi-scan-corner tl" />
          <span className="mer-yunyi-scan-corner tr" />
          <span className="mer-yunyi-scan-corner bl" />
          <span className="mer-yunyi-scan-corner br" />
          <span className="mer-yunyi-scan-line" />
        </div>
        <p className="mer-yunyi-scan-title">请扫描计划二维码</p>
        <p className="mer-yunyi-scan-desc">可通过 Esc 快捷键或关闭弹窗退出扫描</p>
        <Space wrap className="mer-yunyi-scan-demo">
          {PLANS.slice(0, 2).map((p) => (
            <Button key={p.id} size="small" onClick={() => finish(p.id)}>
              模拟：{p.serialNo}
            </Button>
          ))}
        </Space>
      </div>
    </Modal>
  );
};

export default PlanScanModal;

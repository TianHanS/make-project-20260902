/**
 * 云驿扫码弹窗：扫描司机手机运单二维码
 */
import React, { useEffect, useRef, useState } from 'react';
import { Button, Modal, Spin } from 'antd';
import { CheckCircleFilled, ScanOutlined } from '@ant-design/icons';
import { yunyiExpiredSample, yunyiSample } from '../data';

type Phase = 'scanning' | 'success';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (raw: string) => void;
}

const YunyiScanModal: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const [phase, setPhase] = useState<Phase>('scanning');
  const inputRef = useRef<HTMLInputElement>(null);
  const [buffer, setBuffer] = useState('');

  useEffect(() => {
    if (!open) {
      setPhase('scanning');
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
    setPhase('success');
    window.setTimeout(() => {
      onSuccess(raw);
      onClose();
    }, 650);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && buffer.trim()) {
      finish(buffer.trim());
      setBuffer('');
    }
  };

  return (
    <Modal
      title="云驿扫码"
      open={open}
      onCancel={onClose}
      footer={null}
      width={460}
      destroyOnHidden
      centered
    >
      <input
        ref={inputRef}
        className="mer-hidden-scan-input"
        value={buffer}
        aria-label="云驿扫码输入"
        onChange={(e) => setBuffer(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      {phase === 'scanning' ? (
        <div className="mer-yunyi-scan">
          <div className="mer-yunyi-scan-frame">
            <span className="mer-yunyi-scan-corner tl" />
            <span className="mer-yunyi-scan-corner tr" />
            <span className="mer-yunyi-scan-corner bl" />
            <span className="mer-yunyi-scan-corner br" />
            <span className="mer-yunyi-scan-line" />
            <ScanOutlined className="mer-yunyi-scan-icon" />
          </div>
          <p className="mer-yunyi-scan-title">请扫描司机手机运单二维码</p>
          <p className="mer-yunyi-scan-desc">可通过 Esc 快捷键或关闭弹窗退出扫描</p>
          <Spin size="small" />
          <Button type="dashed" size="small" className="mer-yunyi-scan-demo" onClick={() => finish(yunyiSample())}>
            模拟扫码成功
          </Button>
          <Button type="link" size="small" danger onClick={() => finish(yunyiExpiredSample())}>
            模拟失效二维码
          </Button>
        </div>
      ) : (
        <div className="mer-yunyi-scan mer-yunyi-scan-ok">
          <CheckCircleFilled className="mer-yunyi-scan-ok-icon" />
          <p>扫码成功，正在加载…</p>
        </div>
      )}
    </Modal>
  );
};

export default YunyiScanModal;

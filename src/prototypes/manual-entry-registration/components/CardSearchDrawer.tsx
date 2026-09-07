/**
 * 煤样卡读卡查询：仅展示读卡结果，不回填表单
 */
import React, { useEffect, useRef, useState } from 'react';
import { Button, Descriptions, Drawer, Result, Spin, message } from 'antd';
import { CheckCircleFilled, CreditCardOutlined } from '@ant-design/icons';
import { findPlan, findPreEntry, type CoalPlan } from '../data';

type Phase = 'idle' | 'reading' | 'success' | 'timeout';

export interface CardQueryResult {
  cardNo: string;
  plate: string;
  serialNo: string;
  enterAt: string;
  plan: CoalPlan;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const MOCK_CARDS = [
  { cardNo: 'MC-8821-A', plate: '蒙A90005', serialNo: 'RCJ202608250018', enterAt: '2026-08-25 08:46:22' },
  { cardNo: 'MC-8822-B', plate: '桂A8T216', serialNo: 'RCJ202608250012', enterAt: '2026-08-25 07:21:09' },
];

const CardSearchDrawer: React.FC<Props> = ({ open, onClose }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<CardQueryResult | null>(null);
  const timeoutRef = useRef<number>();
  const successRef = useRef<number>();

  const clearTimers = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (successRef.current) window.clearTimeout(successRef.current);
  };

  const reset = () => {
    clearTimers();
    setPhase('idle');
    setResult(null);
  };

  useEffect(() => {
    if (!open) reset();
    return () => clearTimers();
  }, [open]);

  const startRead = () => {
    clearTimers();
    setResult(null);
    setPhase('reading');
    timeoutRef.current = window.setTimeout(() => {
      setPhase('timeout');
      message.warning('未读取到卡片信息！');
    }, 5000);

    successRef.current = window.setTimeout(() => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      const mock = MOCK_CARDS[Math.floor(Math.random() * MOCK_CARDS.length)];
      const pre = findPreEntry(mock.plate);
      const plan = pre ? findPlan(pre.planId) : undefined;
      if (!plan) {
        setPhase('timeout');
        message.warning('未读取到卡片信息！');
        return;
      }
      setResult({ ...mock, plan });
      setPhase('success');
    }, 1800);
  };

  return (
    <Drawer
      title="煤样卡查询"
      open={open}
      onClose={onClose}
      width={480}
      destroyOnHidden
      footer={
        <div className="mer-card-read-footer">
          <Button onClick={onClose}>关闭</Button>
        </div>
      }
    >
      <div className="mer-card-read">
        {phase === 'reading' && (
          <div className="mer-card-read-anim">
            <div className="mer-card-read-ring">
              <Spin indicator={<CreditCardOutlined spin style={{ fontSize: 32 }} />} />
            </div>
            <p className="mer-card-read-status">正在读卡…</p>
            <p className="mer-card-read-hint">请将煤样卡放置在读卡器感应区，读卡过程中请勿移动卡片</p>
          </div>
        )}

        {phase === 'timeout' && (
          <Result
            status="warning"
            title="未读取到卡片信息！"
            subTitle="请检查卡片是否放置正确，或点击重新读卡"
          />
        )}

        {phase === 'success' && result && (
          <>
            <div className="mer-card-read-success-hd">
              <CheckCircleFilled className="mer-card-read-ok-icon" />
              <span>读卡成功</span>
            </div>
            <Descriptions size="small" column={1} bordered className="mer-card-read-desc">
              <Descriptions.Item label="煤样卡号">{result.cardNo}</Descriptions.Item>
              <Descriptions.Item label="车牌号码">{result.plate}</Descriptions.Item>
              <Descriptions.Item label="入厂流水号">{result.serialNo}</Descriptions.Item>
              <Descriptions.Item label="入厂时间">{result.enterAt}</Descriptions.Item>
              <Descriptions.Item label="供应商">{result.plan.supplier}</Descriptions.Item>
              <Descriptions.Item label="矿点">{result.plan.mine}</Descriptions.Item>
              <Descriptions.Item label="煤种">{result.plan.coalType}</Descriptions.Item>
              <Descriptions.Item label="运输单位">{result.plan.transporter}</Descriptions.Item>
              <Descriptions.Item label="卸煤区域">{result.plan.unloadArea}</Descriptions.Item>
            </Descriptions>
          </>
        )}

        {phase === 'idle' && (
          <div className="mer-card-read-idle">
            <CreditCardOutlined className="mer-card-read-idle-icon" />
            <p className="mer-card-read-status">等待读卡</p>
            <p className="mer-card-read-hint">点击下方按钮开始读卡，或将卡片放置在读卡器上</p>
          </div>
        )}

        <Button
          type="primary"
          block
          className="mer-card-read-btn"
          loading={phase === 'reading'}
          onClick={startRead}
        >
          {phase === 'reading' ? '重新读卡' : result ? '读取其他卡片' : '读卡查询'}
        </Button>
      </div>
    </Drawer>
  );
};

export default CardSearchDrawer;

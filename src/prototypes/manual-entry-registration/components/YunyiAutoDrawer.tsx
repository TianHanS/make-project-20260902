/**
 * 云驿自动读码登记：右侧抽屉持续等待扫码 → 解析校验 → 展示运单 → 自动登记 → 保留结果等待下一车
 */
import React, { useEffect, useRef, useState } from 'react';
import { Button, Descriptions, Drawer, Space, Tag, message } from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  ScanOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  findPlan,
  yunyiExpiredSample,
  yunyiSample,
  type CoalPlan,
  type SiteConfig,
} from '../data';
import { isYunyiFresh, parseYunyi, type YunyiPayload } from '../parse';

type Phase = 'waiting' | 'parsing' | 'registering' | 'done';

export interface AutoWaybillResult {
  plate: string;
  taskNo: string;
  serialNo: string;
  supplier: string;
  mine: string;
  coalType: string;
  transporter: string;
  unloadArea: string;
  gross: number;
  tare: number;
  net: number;
  planId: string;
  shipTime: string;
  registerAt: string;
  success: boolean;
  mode: 'enter' | 'preEnter';
  failReason?: string;
}

interface Props {
  open: boolean;
  site: SiteConfig;
  onClose: () => void;
  /** 登记成功时回调，用于刷新入厂车辆列表 */
  onRegistered: (payload: {
    mode: 'enter' | 'preEnter';
    plan: CoalPlan;
    parsed: YunyiPayload;
    success: boolean;
    failReason?: string;
  }) => void;
}

const YunyiAutoDrawer: React.FC<Props> = ({ open, site, onClose, onRegistered }) => {
  const [phase, setPhase] = useState<Phase>('waiting');
  const [buffer, setBuffer] = useState('');
  const [waybill, setWaybill] = useState<AutoWaybillResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  const mode = site.GOABLE_AotoYunYiRegister;
  const modeLabel = mode === 'preEnter' ? '预入厂登记' : '入厂登记';

  const resetWaiting = () => {
    busyRef.current = false;
    setPhase('waiting');
    setBuffer('');
    window.setTimeout(() => inputRef.current?.focus(), 80);
  };

  useEffect(() => {
    if (!open) {
      setPhase('waiting');
      setBuffer('');
      setWaybill(null);
      busyRef.current = false;
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [open]);

  const processRaw = async (raw: string) => {
    if (busyRef.current || !raw.trim()) return;
    busyRef.current = true;
    setPhase('parsing');

    const parsed = parseYunyi(raw);
    if (!parsed) {
      message.error('二维码格式无法解析');
      resetWaiting();
      return;
    }
    if (!isYunyiFresh(parsed.qrTime)) {
      message.error('二维码失效，请刷新！');
      resetWaiting();
      return;
    }

    message.success('扫码成功');
    await new Promise((r) => window.setTimeout(r, 400));

    const plan = findPlan(parsed.planId);
    if (!plan) {
      message.error('未查询到计划信息');
      resetWaiting();
      return;
    }

    const preview: AutoWaybillResult = {
      plate: parsed.plate || plan.plate,
      taskNo: parsed.taskNo || plan.taskNo,
      serialNo: parsed.serialNo || plan.serialNo,
      supplier: plan.supplier,
      mine: plan.mine,
      coalType: plan.coalType,
      transporter: plan.transporter,
      unloadArea: plan.unloadArea,
      gross: parsed.gross ?? plan.gross,
      tare: parsed.tare ?? plan.tare,
      net: parsed.net ?? plan.net,
      planId: plan.id,
      shipTime: parsed.stationTime || plan.shipTime,
      registerAt: '',
      success: false,
      mode,
    };
    setWaybill(preview);
    setPhase('registering');
    message.loading({ content: '正在登记！', key: 'auto-reg', duration: 0 });

    await new Promise((r) => window.setTimeout(r, 1200));

    // 原型：偶发失败便于演示失败态
    const success = Math.random() > 0.12;
    const failReason = success ? undefined : '车辆未允许入厂或计划状态异常';
    const registerAt = dayjs().format('YYYY-MM-DD HH:mm:ss');

    message.destroy('auto-reg');
    if (success) {
      message.success(mode === 'preEnter' ? '预登记成功' : '登记成功');
    } else {
      message.error(`登记失败：${failReason}`);
    }

    setWaybill({
      ...preview,
      registerAt,
      success,
      failReason,
    });
    setPhase('done');

    onRegistered({ mode, plan, parsed, success, failReason });

    // 保留运单展示，动画回到等待下一车
    await new Promise((r) => window.setTimeout(r, 900));
    resetWaiting();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && buffer.trim()) {
      const raw = buffer.trim();
      setBuffer('');
      void processRaw(raw);
    }
  };

  return (
    <Drawer
      title={
        <span>
          云驿自动读码登记
          <Tag color="processing" style={{ marginLeft: 8 }}>
            {modeLabel}
          </Tag>
        </span>
      }
      open={open}
      onClose={onClose}
      width={480}
      destroyOnHidden
      maskClosable
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>退出自动模式</Button>
        </Space>
      }
    >
      <input
        ref={inputRef}
        className="mer-hidden-scan-input"
        value={buffer}
        aria-label="云驿自动扫码输入"
        onChange={(e) => setBuffer(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (open && phase === 'waiting') {
            window.setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
      />

      <div className="mer-yunyi-auto">
        {(phase === 'waiting' || phase === 'parsing') && (
          <div className="mer-yunyi-scan">
            <div className="mer-yunyi-scan-frame">
              <span className="mer-yunyi-scan-corner tl" />
              <span className="mer-yunyi-scan-corner tr" />
              <span className="mer-yunyi-scan-corner bl" />
              <span className="mer-yunyi-scan-corner br" />
              <span className="mer-yunyi-scan-line" />
              <ScanOutlined className="mer-yunyi-scan-icon" />
            </div>
            <p className="mer-yunyi-scan-title">请扫描司机云驿二维码</p>
            <p className="mer-yunyi-scan-desc">
              请保持页面置顶；点击抽屉外或「退出自动模式」可结束识别
            </p>
            <Space wrap className="mer-yunyi-scan-demo">
              <Button
                type="dashed"
                size="small"
                disabled={phase !== 'waiting'}
                onClick={() => void processRaw(yunyiSample())}
              >
                模拟扫码成功
              </Button>
              <Button
                type="link"
                size="small"
                danger
                disabled={phase !== 'waiting'}
                onClick={() => void processRaw(yunyiExpiredSample())}
              >
                模拟失效码
              </Button>
            </Space>
          </div>
        )}

        {phase === 'registering' && (
          <div className="mer-yunyi-auto-status">
            <ScanOutlined spin style={{ fontSize: 28, color: '#1677ff' }} />
            <p>正在登记！</p>
          </div>
        )}

        {phase === 'done' && waybill && (
          <div className="mer-yunyi-auto-status">
            {waybill.success ? (
              <CheckCircleFilled style={{ fontSize: 36, color: '#52c41a' }} />
            ) : (
              <CloseCircleFilled style={{ fontSize: 36, color: '#ff4d4f' }} />
            )}
            <p>{waybill.success ? '登记完成，准备下一车…' : '登记失败，准备下一车…'}</p>
          </div>
        )}

        {waybill && (
          <div className="mer-yunyi-waybill">
            <div className="mer-yunyi-waybill-hd">
              <span>车辆运单信息</span>
              {waybill.registerAt ? (
                waybill.success ? (
                  <Tag color="success">登记成功</Tag>
                ) : (
                  <Tag color="error">登记失败</Tag>
                )
              ) : (
                <Tag color="processing">识别中</Tag>
              )}
            </div>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="车牌号码">{waybill.plate}</Descriptions.Item>
              <Descriptions.Item label="运单编号">{waybill.taskNo}</Descriptions.Item>
              <Descriptions.Item label="计划流水号">{waybill.serialNo}</Descriptions.Item>
              <Descriptions.Item label="供应商">{waybill.supplier}</Descriptions.Item>
              <Descriptions.Item label="矿点">{waybill.mine}</Descriptions.Item>
              <Descriptions.Item label="煤种">{waybill.coalType}</Descriptions.Item>
              <Descriptions.Item label="运输单位">{waybill.transporter}</Descriptions.Item>
              <Descriptions.Item label="卸煤区域">{waybill.unloadArea}</Descriptions.Item>
              <Descriptions.Item label="矿发毛/皮/净">
                {waybill.gross} / {waybill.tare} / {waybill.net} t
              </Descriptions.Item>
              <Descriptions.Item label="发站时间">{waybill.shipTime}</Descriptions.Item>
              <Descriptions.Item label="登记类型">
                {waybill.mode === 'preEnter' ? '预入厂登记' : '入厂登记'}
              </Descriptions.Item>
              {waybill.registerAt && (
                <Descriptions.Item label="登记时间">{waybill.registerAt}</Descriptions.Item>
              )}
              {waybill.failReason && (
                <Descriptions.Item label="失败原因">
                  <span className="mer-yunyi-fail">{waybill.failReason}</span>
                </Descriptions.Item>
              )}
            </Descriptions>
            <p className="mer-yunyi-waybill-tip">运单信息不自动清空，便于现场核对上一车结果。</p>
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default YunyiAutoDrawer;

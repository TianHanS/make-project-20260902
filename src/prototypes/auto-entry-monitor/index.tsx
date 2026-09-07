/**
 * @name 自动入厂监测
 * @mode axure
 *
 * 参考资料：
 * - /rules/development-standards.md
 * - /skills/axure-export-workflow/SKILL.md
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ConfigProvider, Segmented, message } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import './style.css';
import GatePointCard from './components/GatePointCard';
import {
  LIVE_PLATES,
  SAMPLE_POS,
  SYSTEMS,
  WEIGH_POS,
  createInitialGates,
  createInitialLogs,
  createInitialRecords,
  formatClock,
  formatDateTime,
  nextLogId,
  type GatePoint,
  type RunLog,
  type SystemInfo,
} from './data';

const LIVE_EVENTS: Array<{
  level: RunLog['level'];
  kind: RunLog['kind'];
  build: (plate: string, sample: string, weigh: string) => string;
  register?: boolean;
}> = [
  { level: 'normal', kind: 'recognize', build: (plate) => `识别车辆 ${plate}，置信度 ${96 + Math.floor(Math.random() * 4)}%` },
  {
    level: 'normal',
    kind: 'register-ok',
    register: true,
    build: (plate, sample, weigh) => `登记成功 ${plate}，采样位 ${sample}，过衡位 ${weigh}`,
  },
  { level: 'normal', kind: 'inspect', build: (plate) => `车辆抽检 ${plate}，已引导至抽检区` },
  { level: 'exception', kind: 'abnormal', build: (plate) => `车辆异常 ${plate}：预入厂状态异常，已拦截` },
  { level: 'exception', kind: 'cut-in', build: (plate) => `车辆插队 ${plate}：未按排队序号驶入识别区` },
  { level: 'exception', kind: 'register-fail', build: (plate) => `登记失败 ${plate}：未匹配到来煤计划` },
];

function ledTextFor(gate: GatePoint, enabled: boolean): string {
  if (gate.recognizer === 'offline') return '设备离线  暂停自动入厂';
  if (!enabled) return '自动入厂已关闭  请转人工通道';
  if (gate.currentPlate) return `欢迎入厂  ${gate.currentPlate}  请按引导行驶`;
  return '请排队等候  保持车距';
}

const Component: React.FC = () => {
  const [now, setNow] = useState(() => new Date());
  const [systemId, setSystemId] = useState(SYSTEMS[0].id);
  const [gates, setGates] = useState<GatePoint[]>(() => createInitialGates());
  const [logs, setLogs] = useState<RunLog[]>(() => createInitialLogs(new Date()));
  const [records, setRecords] = useState(() => createInitialRecords(new Date()));
  const gatesRef = useRef(gates);
  gatesRef.current = gates;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const system = SYSTEMS.find((item) => item.id === systemId) as SystemInfo;
  const visibleGates = system.gateIds
    .map((id) => gates.find((gate) => gate.id === id))
    .filter((gate): gate is GatePoint => Boolean(gate));

  const applyToggle = useCallback((gate: GatePoint, next: boolean) => {
    const action = next ? '启用' : '停用';
    setGates((list) =>
      list.map((item) =>
        item.id === gate.id
          ? { ...item, serviceEnabled: next, ledText: ledTextFor(item, next) }
          : item,
      ),
    );
    setLogs((list) => [
      {
        id: nextLogId(),
        gateId: gate.id,
        time: formatDateTime(new Date()),
        level: 'normal',
        kind: 'service',
        message: `已${action}自动入厂登记服务`,
      },
      ...list,
    ]);
    message.success(`「${gate.name}」自动入厂登记服务已${action}`);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const liveGates = gatesRef.current.filter(
        (gate) => gate.systemId === systemId && gate.serviceEnabled && gate.recognizer === 'online',
      );
      if (liveGates.length === 0) return;
      const target = liveGates[Math.floor(Math.random() * liveGates.length)];
      const event = LIVE_EVENTS[Math.floor(Math.random() * LIVE_EVENTS.length)];
      const plate = LIVE_PLATES[Math.floor(Math.random() * LIVE_PLATES.length)];
      const sample = SAMPLE_POS[Math.floor(Math.random() * SAMPLE_POS.length)];
      const weigh = WEIGH_POS[Math.floor(Math.random() * WEIGH_POS.length)];
      const stamp = formatDateTime(new Date());

      setLogs((list) => [
        {
          id: nextLogId(),
          gateId: target.id,
          time: stamp,
          level: event.level,
          kind: event.kind,
          plate,
          message: event.build(plate, sample, weigh),
        },
        ...list,
      ]);

      if (event.register) {
        setRecords((list) => [
          {
            id: nextLogId(),
            gateId: target.id,
            plate,
            enterAt: stamp,
            samplePos: sample,
            weighPos: weigh,
          },
          ...list,
        ]);
      }

      setGates((currentGates) =>
        currentGates.map((gate) =>
          gate.id === target.id
            ? {
                ...gate,
                currentPlate: plate,
                ledText: event.kind === 'inspect'
                  ? `抽检车辆  请停靠抽检区  ${plate}`
                  : event.kind === 'register-fail' || event.kind === 'abnormal' || event.kind === 'cut-in'
                    ? `请停车等待  ${plate}`
                    : `欢迎入厂  ${plate}  请按引导行驶`,
              }
            : gate,
        ),
      );
    }, 7000);
    return () => window.clearInterval(timer);
  }, [systemId]);

  return (
    <ConfigProvider locale={zhCN}>
      <div className="aem-root">
        <div className="aem-toolbar">
          <Segmented
            className="aem-system-switch"
            value={systemId}
            options={SYSTEMS.map((item) => ({
              label: (
                <span className="aem-system-opt">
                  <span className="aem-system-name">{item.name}</span>
                  <span className="aem-system-gates">
                    {item.id === 'system-a' ? '入厂点 1# · 2#' : '入厂点 3# · 4#'}
                  </span>
                </span>
              ),
              value: item.id,
            }))}
            onChange={(value) => setSystemId(String(value))}
          />
        </div>

        <div className="aem-body">
          {visibleGates.map((gate) => (
            <GatePointCard
              key={gate.id}
              gate={gate}
              clock={formatClock(now)}
              logs={logs.filter((item) => item.gateId === gate.id)}
              records={records.filter((item) => item.gateId === gate.id)}
              onToggleService={(next) => applyToggle(gate, next)}
            />
          ))}
        </div>
      </div>
    </ConfigProvider>
  );
};

export default Component;

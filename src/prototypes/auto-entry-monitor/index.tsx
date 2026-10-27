/**
 * @name 自动入厂监测
 * @mode axure
 *
 * 参考资料：
 * - /rules/development-standards.md
 * - /skills/axure-export-workflow/SKILL.md
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './style.css';
import GatePointCard from './components/GatePointCard';
import { MessageHost, Segmented, message } from './components/ui';
import {
  CURRENT_DEVICE_IP,
  LIVE_PLATES,
  SAMPLE_POS,
  SYSTEMS,
  WEIGH_POS,
  createInitialGates,
  createInitialLogs,
  createInitialRecords,
  createInitialSamplerQueues,
  formatClock,
  formatDateTime,
  nextLogId,
  refreshSamplerQueues,
  type ControlAction,
  type GatePoint,
  type RunLog,
  type SamplerQueueStat,
  type SystemInfo,
} from './data';
import { AnnotationViewer, type AnnotationSourceDocument } from '@axhub/annotation';
import annotationSourceDocument from './annotation-source.json';

const QUEUE_REFRESH_MS = 30_000;

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
  const boot = useRef(new Date()).current;
  const [now, setNow] = useState(() => new Date());
  const [systemId, setSystemId] = useState(SYSTEMS[0].id);
  const [gates, setGates] = useState<GatePoint[]>(() => createInitialGates(boot));
  const [logs, setLogs] = useState<RunLog[]>(() => createInitialLogs(boot));
  const [records, setRecords] = useState(() => createInitialRecords(boot));
  const [queues, setQueues] = useState<SamplerQueueStat[]>(() => createInitialSamplerQueues());
  const [queueRefreshAt, setQueueRefreshAt] = useState(() => formatDateTime(boot));
  const [queueRefreshing, setQueueRefreshing] = useState(false);

  const gatesRef = useRef(gates);
  gatesRef.current = gates;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const applyQueueRefresh = useCallback((reason?: 'manual' | 'timer' | 'push') => {
    setQueueRefreshing(true);
    setQueues((list) => refreshSamplerQueues(list));
    setQueueRefreshAt(formatDateTime(new Date()));
    window.setTimeout(() => setQueueRefreshing(false), 280);
    if (reason === 'manual') message.success('采样排队已刷新');
    if (reason === 'push') message.info('登记失败，已推送刷新采样排队');
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => applyQueueRefresh('timer'), QUEUE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [applyQueueRefresh]);

  const system = SYSTEMS.find((item) => item.id === systemId) as SystemInfo;
  const visibleGates = system.gateIds
    .map((id) => gates.find((gate) => gate.id === id))
    .filter((gate): gate is GatePoint => Boolean(gate));

  const applyToggle = useCallback((gate: GatePoint, next: boolean) => {
    const action = next ? '启用' : '停用';
    const stamp = formatDateTime(new Date());

    setGates((list) =>
      list.map((item) =>
        item.id === gate.id
          ? {
              ...item,
              serviceEnabled: next,
              serviceEnabledAt: next ? stamp : null,
              ledText: ledTextFor(item, next),
              currentPlate: next ? item.currentPlate : '',
            }
          : item,
      ),
    );

    // 停用：清空并隐藏该点日志/记录；启用：清空历史，仅从启用时刻起接收新数据
    setRecords((list) => list.filter((item) => item.gateId !== gate.id));
    setLogs((list) => {
      const others = list.filter((item) => item.gateId !== gate.id);
      if (!next) return others;
      return [
        {
          id: nextLogId(),
          gateId: gate.id,
          time: stamp,
          level: 'normal' as const,
          kind: 'service' as const,
          message: `已${action}自动入厂登记服务`,
        },
        ...others,
      ];
    });

    message.success(`「${gate.name}」自动入厂登记服务已${action}`);
  }, []);

  const applyControl = useCallback((gate: GatePoint, action: ControlAction) => {
    const stamp = formatDateTime(new Date());
    const ledHint =
      action.kind === 'raise'
        ? `道闸已抬杆  ${gate.currentPlate || '请通行'}`.trim()
        : action.kind === 'lower'
          ? '道闸已落杆  请停车等候'
          : `已执行 ${action.label}`;

    setGates((list) =>
      list.map((item) => (item.id === gate.id ? { ...item, ledText: ledHint } : item)),
    );
    setLogs((list) => [
      {
        id: nextLogId(),
        gateId: gate.id,
        time: stamp,
        level: 'normal',
        kind: 'control',
        message: `现场控制：已下发「${action.label}」`,
      },
      ...list,
    ]);
    message.success(`「${gate.name}」已下发「${action.label}」`);
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

      // 仅在服务启用后追加新日志/记录
      if (!target.serviceEnabled || !target.serviceEnabledAt) return;

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
        // 登记成功：对应采样机待采样数 +1（不超过最大）
        setQueues((list) =>
          list.map((item) => {
            if (item.gateId !== target.id || item.samplerName !== sample) return item;
            return {
              ...item,
              waitingCount: Math.min(item.maxQueue, item.waitingCount + 1),
            };
          }),
        );
      }

      if (event.kind === 'register-fail') {
        applyQueueRefresh('push');
      }

      setGates((currentGates) =>
        currentGates.map((gate) =>
          gate.id === target.id
            ? {
                ...gate,
                currentPlate: plate,
                ledText:
                  event.kind === 'inspect'
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
  }, [systemId, applyQueueRefresh]);

  return (
    <>
      <div className="aem-root">
        <MessageHost />
        <div className="aem-toolbar">
          <span className="aem-device-ip" title="进入页面按模块允许控制 IP 校验本机权限">
            本机 IP {CURRENT_DEVICE_IP}
          </span>
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
            onChange={setSystemId}
          />
        </div>

        <div className="aem-body">
          {visibleGates.map((gate) => (
            <GatePointCard
              key={gate.id}
              gate={gate}
              clock={formatClock(now)}
              logs={
                gate.serviceEnabled
                  ? logs.filter((item) => item.gateId === gate.id)
                  : []
              }
              records={
                gate.serviceEnabled
                  ? records.filter((item) => item.gateId === gate.id)
                  : []
              }
              queues={queues.filter((item) => item.gateId === gate.id)}
              queueRefreshAt={queueRefreshAt}
              queueRefreshing={queueRefreshing}
              onToggleService={(next) => applyToggle(gate, next)}
              onControlAction={(action) => applyControl(gate, action)}
              onRefreshQueue={() => applyQueueRefresh('manual')}
            />
          ))}
        </div>
      </div>
      <AnnotationViewer
        source={annotationSourceDocument as unknown as AnnotationSourceDocument}
        options={{
          currentPageId: (() => {
            const hashPageId = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('page');
            const searchPageId = new URLSearchParams(window.location.search.replace(/^\?/, '')).get('page');
            const pageId = hashPageId || searchPageId;
            return typeof pageId === 'string' && /^[a-z0-9-]+$/u.test(pageId)
              ? pageId
              : 'auto-entry-monitor';
          })(),
          onDirectoryRoute: (node) => {
            if (typeof node.route === 'string' && /^[a-z0-9-]+$/u.test(node.route)) {
              window.location.hash = `page=${node.route}`;
            }
          },
          toolbarEdge: 'right',
          showToolbar: true,
          showThemeToggle: true,
          showColorFilter: true,
          emptyWhenNoData: true,
        }}
      />
    </>
  );
};

export default Component;

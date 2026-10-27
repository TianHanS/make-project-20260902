/**
 * 单个入厂点：采样排队条 · 左设备监测 · 中运行日志 · 右入厂登记记录
 */
import React, { useMemo, useState } from 'react';
import VideoMonitor from './VideoMonitor';
import SampleQueueBar from './SampleQueueBar';
import { Popconfirm, Segmented, Switch, Tag, Tooltip } from './ui';
import {
  LOG_KIND_LABEL,
  NO_CONTROL_TIP,
  gateDeviceStatus,
  hasControlPermission,
  type ControlAction,
  type EntryRecord,
  type GatePoint,
  type LogLevel,
  type RunLog,
  type SamplerQueueStat,
} from '../data';

function DeviceDot({ label, online }: { label: string; online: boolean }) {
  return (
    <span className="aem-device-dot">
      <i className={`aem-dot ${online ? 'on' : 'off'}`} aria-hidden />
      <span>{label}</span>
    </span>
  );
}

export default function GatePointCard({
  gate,
  logs,
  records,
  queues,
  queueRefreshAt,
  queueRefreshing,
  clock,
  onToggleService,
  onControlAction,
  onRefreshQueue,
}: {
  gate: GatePoint;
  logs: RunLog[];
  records: EntryRecord[];
  queues: SamplerQueueStat[];
  queueRefreshAt: string;
  queueRefreshing?: boolean;
  clock: string;
  onToggleService: (next: boolean) => void;
  onControlAction: (action: ControlAction) => void;
  onRefreshQueue: () => void;
}) {
  const [logFilter, setLogFilter] = useState<'all' | LogLevel>('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingEnabled, setPendingEnabled] = useState<boolean | null>(null);
  const [pendingControl, setPendingControl] = useState<ControlAction | null>(null);

  const pointStatus = gateDeviceStatus(gate);
  const canControl = hasControlPermission(gate);
  const deviceOffline = gate.recognizer === 'offline';
  const controlDisabled = !canControl || deviceOffline;
  const serviceDisabled = !canControl;

  const controlDisableTip = !canControl
    ? NO_CONTROL_TIP
    : deviceOffline
      ? '设备离线，暂不可下发控制'
      : '';

  const filteredLogs = useMemo(
    () => (logFilter === 'all' ? logs : logs.filter((item) => item.level === logFilter)),
    [logs, logFilter],
  );

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => b.enterAt.localeCompare(a.enterAt)),
    [records],
  );

  const pendingAction = pendingEnabled ? '启用' : '停用';
  const confirmTitle = `${pendingAction}自动入厂登记服务`;
  const confirmDesc = pendingEnabled
    ? `确认启用「${gate.name}」？启用后将恢复车号识别与自动登记，并仅拉取启用后的新日志与登记记录。`
    : `确认停用「${gate.name}」？停用后该点不再自动识别登记，运行日志与入厂登记记录将清空隐藏。`;

  const handleSwitchChange = (checked: boolean) => {
    if (serviceDisabled) return;
    setPendingControl(null);
    setPendingEnabled(checked);
    setConfirmOpen(true);
  };

  const handleControlClick = (action: ControlAction) => {
    if (controlDisabled) return;
    setPendingEnabled(null);
    setPendingControl(action);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (pendingControl) {
      onControlAction(pendingControl);
    } else if (pendingEnabled !== null) {
      onToggleService(pendingEnabled);
    }
    setConfirmOpen(false);
    setPendingEnabled(null);
    setPendingControl(null);
  };

  const handleCancel = () => {
    setConfirmOpen(false);
    setPendingEnabled(null);
    setPendingControl(null);
  };

  const controlConfirmTitle = pendingControl ? `确认${pendingControl.label}` : confirmTitle;
  const controlConfirmDesc = pendingControl
    ? `将向「${gate.name}」下发「${pendingControl.label}」指令，请确认现场安全后再执行。`
    : confirmDesc;
  const controlOkText = pendingControl ? `确认${pendingControl.label}` : `确认${pendingAction}`;
  const controlDanger = pendingControl ? pendingControl.kind === 'lower' : !pendingEnabled;

  return (
    <section className="aem-gate">
      <div className="aem-gate-title-row">
        <div className="aem-gate-title">{gate.name}</div>
        {!canControl ? (
          <span className="aem-gate-perm-tag" title={NO_CONTROL_TIP}>
            无控制权限
          </span>
        ) : null}
      </div>

      <SampleQueueBar
        queues={queues}
        lastRefreshAt={queueRefreshAt}
        refreshing={queueRefreshing}
        onRefresh={onRefreshQueue}
      />

      <div className="aem-gate-bd">
        <div className="aem-col aem-col-device">
          <h3 className="aem-col-title">设备监测</h3>
          <div className="aem-device-toolbar">
            <div className="aem-device-status">
              <DeviceDot label="车号识别" online={gate.recognizer === 'online'} />
              <DeviceDot label="LED" online={gate.led === 'online'} />
            </div>
            {gate.controlActions.length > 0 ? (
              <div className="aem-control-ops" aria-label="控制操作">
                {gate.controlActions.map((action) => (
                  <Popconfirm
                    key={action.id}
                    open={confirmOpen && pendingControl?.id === action.id}
                    title={controlConfirmTitle}
                    description={controlConfirmDesc}
                    okText={controlOkText}
                    cancelText="取消"
                    danger={controlDanger}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                  >
                    <Tooltip title={controlDisableTip} disabled={controlDisabled}>
                      <button
                        type="button"
                        className={`aem-btn aem-control-btn aem-control-btn-${action.kind}`}
                        disabled={controlDisabled}
                        onClick={() => handleControlClick(action)}
                      >
                        {action.label}
                      </button>
                    </Tooltip>
                  </Popconfirm>
                ))}
              </div>
            ) : null}
          </div>
          <div className="aem-col-subtitle">车号识别实时监控</div>
          <div className="aem-monitor-stack">
            <VideoMonitor
              cameraName={gate.cameraName}
              clock={clock}
              plate={gate.currentPlate}
              deviceStatus={pointStatus}
              serviceEnabled={gate.serviceEnabled}
            />
            <div className={`aem-led ${gate.led === 'offline' ? 'off' : ''}`} title={gate.ledText}>
              <span className="aem-led-label">LED</span>
              <span className="aem-led-text">{gate.ledText}</span>
            </div>
          </div>
        </div>

        <div className="aem-col aem-col-logs">
          <div className="aem-col-head">
            <h3 className="aem-col-title">运行日志</h3>
            <div className="aem-service-row">
              <span className="aem-service-label">自动入厂</span>
              <Popconfirm
                open={confirmOpen && pendingControl === null && pendingEnabled !== null}
                title={confirmTitle}
                description={confirmDesc}
                okText={`确认${pendingAction}`}
                cancelText="取消"
                danger={!pendingEnabled}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
              >
                <Tooltip title={NO_CONTROL_TIP} disabled={serviceDisabled}>
                  <span>
                    <Switch
                      checked={gate.serviceEnabled}
                      checkedChildren="启用"
                      unCheckedChildren="停用"
                      disabled={serviceDisabled}
                      onChange={handleSwitchChange}
                    />
                  </span>
                </Tooltip>
              </Popconfirm>
            </div>
          </div>
          {gate.serviceEnabled ? (
            <>
              <div className="aem-log-filter">
                <Segmented
                  size="small"
                  value={logFilter}
                  onChange={setLogFilter}
                  options={[
                    { label: '全部', value: 'all' },
                    { label: '正常', value: 'normal' },
                    { label: '异常', value: 'exception' },
                  ]}
                />
              </div>
              <div className="aem-col-scroll aem-logs">
                {filteredLogs.length === 0 ? (
                  <div className="aem-log aem-log-empty">暂无启用后的运行日志</div>
                ) : (
                  filteredLogs.map((item) => (
                    <div key={item.id} className={`aem-log ${item.level}`}>
                      <span className="time">{item.time.slice(11)}</span>
                      <Tag
                        color={
                          item.level === 'exception'
                            ? 'error'
                            : item.kind === 'inspect'
                              ? 'warning'
                              : 'default'
                        }
                      >
                        {LOG_KIND_LABEL[item.kind]}
                      </Tag>
                      <span className="msg">{item.message}</span>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="aem-panel-cleared">服务已停用，运行日志已清空隐藏</div>
          )}
        </div>

        <div className="aem-col aem-col-records">
          <h3 className="aem-col-title">入厂登记记录</h3>
          {gate.serviceEnabled ? (
            <>
              <p className="aem-col-desc">本入厂点按入厂时间逆序 · 仅展示启用后新记录</p>
              <div className="aem-records-wrap">
                <div className="aem-table-scroll">
                  <table className="aem-table">
                    <thead>
                      <tr>
                        <th style={{ width: 96 }}>车牌号</th>
                        <th style={{ width: 148 }}>入厂时间</th>
                        <th>采样位</th>
                        <th>过衡位</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRecords.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="aem-table-empty">
                            暂无启用后的入厂登记记录
                          </td>
                        </tr>
                      ) : (
                        sortedRecords.map((row) => (
                          <tr key={row.id}>
                            <td>{row.plate}</td>
                            <td>{row.enterAt}</td>
                            <td className="aem-ellipsis" title={row.samplePos}>
                              {row.samplePos}
                            </td>
                            <td className="aem-ellipsis" title={row.weighPos}>
                              {row.weighPos}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="aem-col-desc">本入厂点按入厂时间逆序</p>
              <div className="aem-panel-cleared">服务已停用，入厂登记记录已清空隐藏</div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

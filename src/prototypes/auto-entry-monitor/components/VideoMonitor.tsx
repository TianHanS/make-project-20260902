/**
 * 车号识别监控画面（模拟实时视频）
 */
import React from 'react';
import type { DeviceStatus } from '../data';

export default function VideoMonitor({
  cameraName,
  clock,
  plate,
  deviceStatus,
  serviceEnabled,
}: {
  cameraName: string;
  clock: string;
  plate: string;
  deviceStatus: DeviceStatus;
  serviceEnabled: boolean;
}) {
  const offline = deviceStatus === 'offline';
  const stopped = !serviceEnabled && !offline;
  const showPlate = Boolean(plate) && !offline;

  return (
    <div className="aem-cam" aria-label={`${cameraName} 监控画面`}>
      <div className="aem-cam-scene">
        <div className="aem-cam-car" />
        {showPlate ? <div className="aem-cam-plate">{plate}</div> : null}
        {!offline && serviceEnabled ? <div className="aem-cam-scan" /> : null}
      </div>
      <div className="aem-cam-hud">
        <div>
          <div>{cameraName}</div>
          <div style={{ marginTop: 4, opacity: 0.75 }}>{clock.slice(11, 19)}</div>
        </div>
        <div className="aem-cam-rec">
          <i />
          {offline ? 'NO SIGNAL' : 'REC'}
        </div>
      </div>
      {offline ? (
        <div className="aem-cam-mask">
          <strong>设备离线</strong>
          <span>车号识别器未连接，无法获取监控画面</span>
        </div>
      ) : null}
      {stopped ? (
        <div className="aem-cam-mask">
          <strong>自动入厂服务已停用</strong>
          <span>该发卡点不再自动识别登记，请转人工入厂</span>
        </div>
      ) : null}
    </div>
  );
}

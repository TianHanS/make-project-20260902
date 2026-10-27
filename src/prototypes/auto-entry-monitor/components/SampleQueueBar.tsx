/**
 * 入厂点采样排队：按采样机展示队列最大数 / 已入厂登记待采样数；已满提示；手动刷新
 */
import React from 'react';
import { isSamplerFull, type SamplerQueueStat } from '../data';

export default function SampleQueueBar({
  queues,
  lastRefreshAt,
  refreshing,
  onRefresh,
}: {
  queues: SamplerQueueStat[];
  lastRefreshAt: string;
  refreshing?: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="aem-queue-bar">
      <div className="aem-queue-bar-head">
        <span className="aem-queue-bar-title">采样排队</span>
        <span className="aem-queue-bar-meta" title="定时 30s 自动刷新；登记失败时后端推送即时刷新">
          最近刷新 {lastRefreshAt.slice(11) || '--:--:--'}
        </span>
        <button
          type="button"
          className="aem-btn aem-queue-refresh"
          disabled={refreshing}
          onClick={onRefresh}
        >
          {refreshing ? '刷新中…' : '刷新'}
        </button>
      </div>
      {queues.length === 0 ? (
        <div className="aem-queue-empty">本入厂点暂无已启用采样队列</div>
      ) : (
        <div className="aem-queue-list" role="list">
          {queues.map((item) => {
            const full = isSamplerFull(item);
            return (
              <div
                key={item.id}
                className={`aem-queue-chip ${full ? 'full' : ''}`.trim()}
                role="listitem"
                title={`${item.samplerName}：待采样 ${item.waitingCount} / 队列最大 ${item.maxQueue}`}
              >
                <span className="aem-queue-name">{item.samplerName}</span>
                <span className="aem-queue-count">
                  <strong>{item.waitingCount}</strong>
                  <span className="aem-queue-sep">/</span>
                  {item.maxQueue}
                </span>
                {full ? <span className="aem-queue-full-tag">已满</span> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

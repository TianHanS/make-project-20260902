/**
 * @name 煤场日志查询
 * @mode axure
 *
 * 四类日志分 Tab。筛选条件随当前 Tab 变化，列表按操作时间倒序。
 */
import React, { useMemo, useState } from 'react';
import { App, Button, ConfigProvider, DatePicker, Input, Select, Tabs } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import '../coal-storage-structure-management/style.css';
import './style.css';
import LedgerPanel, { type LedgerPageId } from '../coal-storage-structure-management/pages/LedgerQueryPage';
import { enabledYards } from '../coal-storage-structure-management/data';
import {
  ADJUST_ACTIONS,
  createInitialLedger,
  type AdjustAction,
  type AdjustRecord,
  type InboundRecord,
  type LedgerState,
  type OutboundRecord,
} from '../coal-storage-structure-management/ledger';

dayjs.extend(customParseFormat);

const { RangePicker } = DatePicker;

interface ActorQuery {
  start: Dayjs | null;
  end: Dayjs | null;
  yardId?: string;
  operator: string;
}

type ActorRow = Pick<InboundRecord | OutboundRecord, 'time' | 'yardId' | 'operator'>;

const EMPTY_QUERY: ActorQuery = {
  start: null,
  end: null,
  yardId: undefined,
  operator: '',
};

const byTimeDesc = <T extends { time: string }>(rows: T[]) =>
  [...rows].sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0));

const matchActor = (row: ActorRow, query: ActorQuery) => {
  const start = query.start?.format('YYYY-MM-DD HH:mm:ss');
  const end = query.end?.format('YYYY-MM-DD HH:mm:ss');
  if (start && row.time < start) return false;
  if (end && row.time > end) return false;
  if (query.yardId && row.yardId !== query.yardId) return false;
  const operator = query.operator.trim();
  if (operator && !row.operator.includes(operator)) return false;
  return true;
};

const queryKey = (query: ActorQuery) =>
  `${query.yardId ?? ''}:${query.operator}:${query.start?.valueOf() ?? ''}:${query.end?.valueOf() ?? ''}`;

interface SurveyQuery {
  start: Dayjs | null;
  end: Dayjs | null;
  yardId?: string;
}

const EMPTY_SURVEY_QUERY: SurveyQuery = {
  start: null,
  end: null,
  yardId: undefined,
};

/** 盘煤时间有的只记到分，比较时补齐到秒，避免整分记录被秒级起止挡在范围外 */
const surveyStamp = (value: string) =>
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value) ? `${value}:00` : value;

const matchSurvey = (row: { time: string; yardId: string }, query: SurveyQuery) => {
  const time = surveyStamp(row.time);
  const start = query.start?.format('YYYY-MM-DD HH:mm:ss');
  const end = query.end?.format('YYYY-MM-DD HH:mm:ss');
  if (start && time < start) return false;
  if (end && time > end) return false;
  if (query.yardId && row.yardId !== query.yardId) return false;
  return true;
};

interface AdjustQuery {
  start: Dayjs | null;
  end: Dayjs | null;
  operator: string;
  yardId?: string;
  zone: string;
  action?: AdjustAction;
}

const EMPTY_ADJUST_QUERY: AdjustQuery = {
  start: null,
  end: null,
  operator: '',
  yardId: undefined,
  zone: '',
  action: undefined,
};

const matchAdjust = (row: AdjustRecord, query: AdjustQuery) => {
  const start = query.start?.format('YYYY-MM-DD HH:mm:ss');
  const end = query.end?.format('YYYY-MM-DD HH:mm:ss');
  if (start && row.time < start) return false;
  if (end && row.time > end) return false;
  const operator = query.operator.trim();
  if (operator && !row.operator.includes(operator)) return false;
  if (query.yardId && row.yardId !== query.yardId) return false;
  const zone = query.zone.trim();
  if (zone && !row.zoneName.includes(zone)) return false;
  if (query.action && row.action !== query.action) return false;
  return true;
};

const LogQuery: React.FC = () => {
  const [ledger] = useState(createInitialLedger);
  const [tab, setTab] = useState<LedgerPageId>('inbound');
  const [inboundDraft, setInboundDraft] = useState<ActorQuery>(EMPTY_QUERY);
  const [inboundApplied, setInboundApplied] = useState<ActorQuery>(EMPTY_QUERY);
  const [outboundDraft, setOutboundDraft] = useState<ActorQuery>(EMPTY_QUERY);
  const [outboundApplied, setOutboundApplied] = useState<ActorQuery>(EMPTY_QUERY);
  const [adjustDraft, setAdjustDraft] = useState<AdjustQuery>(EMPTY_ADJUST_QUERY);
  const [adjustApplied, setAdjustApplied] = useState<AdjustQuery>(EMPTY_ADJUST_QUERY);
  const [surveyDraft, setSurveyDraft] = useState<SurveyQuery>(EMPTY_SURVEY_QUERY);
  const [surveyApplied, setSurveyApplied] = useState<SurveyQuery>(EMPTY_SURVEY_QUERY);

  const viewLedger = useMemo<LedgerState>(() => ({
    ...ledger,
    inbound: byTimeDesc(ledger.inbound.filter((row) => matchActor(row, inboundApplied))),
    outbound: byTimeDesc(ledger.outbound.filter((row) => matchActor(row, outboundApplied))),
    adjust: byTimeDesc(ledger.adjust.filter((row) => matchAdjust(row, adjustApplied))),
    survey: byTimeDesc(ledger.survey.filter((row) => matchSurvey(row, surveyApplied))),
  }), [ledger, inboundApplied, outboundApplied, adjustApplied, surveyApplied]);

  const actorDraft = tab === 'outbound' ? outboundDraft : inboundDraft;
  const setActorDraft = tab === 'outbound' ? setOutboundDraft : setInboundDraft;

  const applyActor = () => {
    const inputs = document.querySelectorAll<HTMLInputElement>('.cyl-filters .ant-picker-input input');
    const parseAt = (text: string | undefined) => {
      const value = text?.trim();
      if (!value) return null;
      const parsed = dayjs(value, 'YYYY-MM-DD HH:mm:ss', true);
      return parsed.isValid() ? parsed : null;
    };
    const next: ActorQuery = {
      start: parseAt(inputs[0]?.value) ?? actorDraft.start,
      end: parseAt(inputs[1]?.value) ?? actorDraft.end,
      yardId: actorDraft.yardId,
      operator: actorDraft.operator.trim(),
    };
    setActorDraft(next);
    if (tab === 'outbound') setOutboundApplied(next);
    else setInboundApplied(next);
  };
  const resetActor = () => {
    setActorDraft(EMPTY_QUERY);
    if (tab === 'outbound') setOutboundApplied(EMPTY_QUERY);
    else setInboundApplied(EMPTY_QUERY);
  };

  const applyAdjust = () => {
    const inputs = document.querySelectorAll<HTMLInputElement>('.cyl-filters .ant-picker-input input');
    const parseAt = (text: string | undefined) => {
      const value = text?.trim();
      if (!value) return null;
      const parsed = dayjs(value, 'YYYY-MM-DD HH:mm:ss', true);
      return parsed.isValid() ? parsed : null;
    };
    const next: AdjustQuery = {
      start: parseAt(inputs[0]?.value) ?? adjustDraft.start,
      end: parseAt(inputs[1]?.value) ?? adjustDraft.end,
      operator: adjustDraft.operator.trim(),
      yardId: adjustDraft.yardId,
      zone: adjustDraft.zone.trim(),
      action: adjustDraft.action,
    };
    setAdjustDraft(next);
    setAdjustApplied(next);
  };

  const applySurvey = () => {
    const inputs = document.querySelectorAll<HTMLInputElement>('.cyl-filters .ant-picker-input input');
    const parseAt = (text: string | undefined) => {
      const value = text?.trim();
      if (!value) return null;
      const parsed = dayjs(value, 'YYYY-MM-DD HH:mm:ss', true);
      return parsed.isValid() ? parsed : null;
    };
    const next: SurveyQuery = {
      start: parseAt(inputs[0]?.value) ?? surveyDraft.start,
      end: parseAt(inputs[1]?.value) ?? surveyDraft.end,
      yardId: surveyDraft.yardId,
    };
    setSurveyDraft(next);
    setSurveyApplied(next);
  };

  return (
    <div className="cssm-root cyl-page">
      <section className="cyl-board">
        <div className="cyl-tabs">
          <Tabs
            activeKey={tab}
            onChange={(key) => setTab(key as LedgerPageId)}
            items={[
              { key: 'inbound', label: '入库记录' },
              { key: 'outbound', label: '出库记录' },
              { key: 'adjust', label: '调整记录' },
              { key: 'survey', label: '盘煤记录' },
            ]}
          />
        </div>
        {(tab === 'inbound' || tab === 'outbound') && (
          <form
            key={tab}
            className="cyl-filters"
            onSubmit={(event) => {
              event.preventDefault();
              applyActor();
            }}
          >
            <label className="cyl-field">
              <span>操作时间</span>
              <RangePicker
                showTime
                format="YYYY-MM-DD HH:mm:ss"
                placeholder={['开始时间', '结束时间']}
                value={actorDraft.start && actorDraft.end ? [actorDraft.start, actorDraft.end] : null}
                onCalendarChange={(values) => {
                  setActorDraft((prev) => ({
                    ...prev,
                    start: values?.[0] ?? null,
                    end: values?.[1] ?? null,
                  }));
                }}
                onChange={(next) => {
                  setActorDraft((prev) => ({
                    ...prev,
                    start: next?.[0] ?? null,
                    end: next?.[1] ?? null,
                  }));
                }}
              />
            </label>
            <label className="cyl-field">
              <span>煤场</span>
              <Select
                allowClear
                placeholder="全部"
                style={{ width: 200 }}
                value={actorDraft.yardId}
                onChange={(yardId) => setActorDraft((prev) => ({ ...prev, yardId: yardId || undefined }))}
                options={enabledYards().map((yard) => ({
                  value: yard.id,
                  label: yard.shortName,
                }))}
              />
            </label>
            <label className="cyl-field">
              <span>操作人</span>
              <Input
                allowClear
                placeholder="模糊匹配"
                style={{ width: 180 }}
                value={actorDraft.operator}
                onChange={(event) => setActorDraft((prev) => ({ ...prev, operator: event.target.value }))}
              />
            </label>
            <div className="cyl-filter-actions">
              <Button type="primary" htmlType="submit">查询</Button>
              <Button htmlType="button" onClick={resetActor}>重置</Button>
            </div>
          </form>
        )}
        {tab === 'adjust' && (
          <form
            className="cyl-filters"
            onSubmit={(event) => {
              event.preventDefault();
              applyAdjust();
            }}
          >
            <label className="cyl-field">
              <span>操作时间</span>
              <RangePicker
                showTime
                format="YYYY-MM-DD HH:mm:ss"
                placeholder={['开始时间', '结束时间']}
                value={adjustDraft.start && adjustDraft.end ? [adjustDraft.start, adjustDraft.end] : null}
                onCalendarChange={(values) => {
                  setAdjustDraft((prev) => ({
                    ...prev,
                    start: values?.[0] ?? null,
                    end: values?.[1] ?? null,
                  }));
                }}
                onChange={(next) => {
                  setAdjustDraft((prev) => ({
                    ...prev,
                    start: next?.[0] ?? null,
                    end: next?.[1] ?? null,
                  }));
                }}
              />
            </label>
            <label className="cyl-field">
              <span>操作人</span>
              <Input
                allowClear
                placeholder="模糊匹配"
                style={{ width: 180 }}
                value={adjustDraft.operator}
                onChange={(event) => setAdjustDraft((prev) => ({ ...prev, operator: event.target.value }))}
              />
            </label>
            <label className="cyl-field">
              <span>煤场</span>
              <Select
                allowClear
                placeholder="全部"
                style={{ width: 200 }}
                value={adjustDraft.yardId}
                onChange={(yardId) => setAdjustDraft((prev) => ({ ...prev, yardId: yardId || undefined }))}
                options={enabledYards().map((yard) => ({
                  value: yard.id,
                  label: yard.shortName,
                }))}
              />
            </label>
            <label className="cyl-field">
              <span>分区</span>
              <Input
                allowClear
                placeholder="模糊匹配"
                style={{ width: 140 }}
                value={adjustDraft.zone}
                onChange={(event) => setAdjustDraft((prev) => ({ ...prev, zone: event.target.value }))}
              />
            </label>
            <label className="cyl-field">
              <span>调整类型</span>
              <Select
                allowClear
                placeholder="全部"
                style={{ width: 160 }}
                value={adjustDraft.action}
                onChange={(action) => setAdjustDraft((prev) => ({ ...prev, action: action || undefined }))}
                options={ADJUST_ACTIONS.map((action) => ({ value: action, label: action }))}
              />
            </label>
            <div className="cyl-filter-actions">
              <Button type="primary" htmlType="submit">查询</Button>
              <Button
                htmlType="button"
                onClick={() => {
                  setAdjustDraft(EMPTY_ADJUST_QUERY);
                  setAdjustApplied(EMPTY_ADJUST_QUERY);
                }}
              >
                重置
              </Button>
            </div>
          </form>
        )}
        {tab === 'survey' && (
          <form
            className="cyl-filters"
            onSubmit={(event) => {
              event.preventDefault();
              applySurvey();
            }}
          >
            <label className="cyl-field">
              <span>盘煤时间</span>
              <RangePicker
                showTime
                format="YYYY-MM-DD HH:mm:ss"
                placeholder={['开始时间', '结束时间']}
                value={surveyDraft.start && surveyDraft.end ? [surveyDraft.start, surveyDraft.end] : null}
                onCalendarChange={(values) => {
                  setSurveyDraft((prev) => ({
                    ...prev,
                    start: values?.[0] ?? null,
                    end: values?.[1] ?? null,
                  }));
                }}
                onChange={(next) => {
                  setSurveyDraft((prev) => ({
                    ...prev,
                    start: next?.[0] ?? null,
                    end: next?.[1] ?? null,
                  }));
                }}
              />
            </label>
            <label className="cyl-field">
              <span>煤场</span>
              <Select
                allowClear
                placeholder="全部"
                style={{ width: 200 }}
                value={surveyDraft.yardId}
                onChange={(yardId) => setSurveyDraft((prev) => ({ ...prev, yardId: yardId || undefined }))}
                options={enabledYards().map((yard) => ({
                  value: yard.id,
                  label: yard.shortName,
                }))}
              />
            </label>
            <div className="cyl-filter-actions">
              <Button type="primary" htmlType="submit">查询</Button>
              <Button
                htmlType="button"
                onClick={() => {
                  setSurveyDraft(EMPTY_SURVEY_QUERY);
                  setSurveyApplied(EMPTY_SURVEY_QUERY);
                }}
              >
                重置
              </Button>
            </div>
          </form>
        )}
        <LedgerPanel
          ledger={viewLedger}
          tab={tab}
          showTabs={false}
          pageResetKey={tab === 'adjust'
            ? `adjust:${adjustApplied.yardId ?? ''}:${adjustApplied.operator}:${adjustApplied.zone}:${adjustApplied.action ?? ''}:${adjustApplied.start?.valueOf() ?? ''}:${adjustApplied.end?.valueOf() ?? ''}`
            : tab === 'survey'
              ? `survey:${surveyApplied.yardId ?? ''}:${surveyApplied.start?.valueOf() ?? ''}:${surveyApplied.end?.valueOf() ?? ''}`
              : `${tab}:${queryKey(tab === 'outbound' ? outboundApplied : inboundApplied)}`}
        />
      </section>
    </div>
  );
};

const Component: React.FC = () => (
  <ConfigProvider
    locale={zhCN}
    theme={{
      token: {
        colorPrimary: '#1677ff',
        borderRadius: 6,
        fontFamily: '"PingFang SC", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif',
      },
    }}
  >
    <App>
      <LogQuery />
    </App>
  </ConfigProvider>
);

export default Component;

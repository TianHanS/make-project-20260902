/**
 * @name 来煤预报查询
 *
 * 按入厂登记编号、车船名、预报到港日期、航次、供应商查询来煤预报。
 * 行内配置库存煤种和全局唯一色值。
 */
import React, { useMemo, useState } from 'react';
import { App, Button, ConfigProvider, DatePicker, Input, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import zhCN from 'antd/locale/zh_CN';
import dayjs, { type Dayjs } from 'dayjs';
import CoalConfigDrawer from './components/CoalConfigDrawer';
import {
  INITIAL_FORECASTS,
  assignStockCoal,
  buildCatalog,
  clearStockCoal,
  validateStockAssignment,
  type ForecastRow,
  type StockCoal,
} from './data';
import './style.css';

const { RangePicker } = DatePicker;

interface QueryDraft {
  regNo: string;
  vessel: string;
  voyage: string;
  supplier: string;
  start: Dayjs | null;
  end: Dayjs | null;
}

const EMPTY_QUERY: QueryDraft = {
  regNo: '',
  vessel: '',
  voyage: '',
  supplier: '',
  start: null,
  end: null,
};

const includesText = (source: string, keyword: string) => {
  const text = keyword.trim();
  return !text || source.toLowerCase().includes(text.toLowerCase());
};

const CoalArrivalForecast: React.FC = () => {
  const { message } = App.useApp();
  const [rows, setRows] = useState<ForecastRow[]>(() => INITIAL_FORECASTS.map((item) => ({ ...item })));
  const [coals, setCoals] = useState<StockCoal[]>(() => buildCatalog(INITIAL_FORECASTS));
  const [draft, setDraft] = useState<QueryDraft>(EMPTY_QUERY);
  const [applied, setApplied] = useState<QueryDraft>(EMPTY_QUERY);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editingId, setEditingId] = useState<string | null>(null);

  const colorOf = useMemo(() => {
    const map = new Map(coals.map((item) => [item.name, item.color]));
    return (name: string | null) => (name ? map.get(name) ?? '' : '');
  }, [coals]);

  const filtered = useMemo(() => rows.filter((item) => {
    if (!includesText(item.regNo, applied.regNo)) return false;
    if (!includesText(item.vessel, applied.vessel)) return false;
    if (!includesText(item.voyage, applied.voyage)) return false;
    if (!includesText(item.supplier, applied.supplier)) return false;
    const start = applied.start?.format('YYYY-MM-DD');
    const end = applied.end?.format('YYYY-MM-DD');
    if (start && item.forecastDate < start) return false;
    if (end && item.forecastDate > end) return false;
    return true;
  }), [rows, applied]);

  const editing = rows.find((item) => item.id === editingId) ?? null;

  const applyQuery = () => {
    setApplied({
      ...draft,
      regNo: draft.regNo.trim(),
      vessel: draft.vessel.trim(),
      voyage: draft.voyage.trim(),
      supplier: draft.supplier.trim(),
    });
    setPage(1);
  };

  const resetQuery = () => {
    setDraft(EMPTY_QUERY);
    setApplied(EMPTY_QUERY);
    setPage(1);
  };

  const handleSave = (name: string, color: string) => {
    if (!editing) return;
    const result = validateStockAssignment(name, color, coals);
    if (!result.ok) {
      message.error(result.message);
      return;
    }
    const previous = coals.find((item) => item.name === result.name);
    const next = assignStockCoal(rows, coals, editing.id, result.name, result.color);
    setRows(next.rows);
    setCoals(next.coals);
    const count = next.rows.filter((item) => item.stockCoalName === result.name).length;
    if (!previous) message.success(`已新增库存煤种「${result.name}」，并配置到本条预报`);
    else if (previous.color !== result.color) message.success(`已更新「${result.name}」色值，同步 ${count} 条预报`);
    else message.success(`已配置库存煤种「${result.name}」`);
    setEditingId(null);
  };

  const handleClear = () => {
    if (!editing?.stockCoalName) return;
    const currentName = editing.stockCoalName;
    const next = clearStockCoal(rows, coals, editing.id);
    setRows(next.rows);
    setCoals(next.coals);
    const removed = !next.coals.some((item) => item.name === currentName);
    message.success(removed ? `已清除配置，「${currentName}」已无预报使用，色值已释放` : '已清除本条预报的库存煤种');
    setEditingId(null);
  };

  const columns: ColumnsType<ForecastRow> = [
    {
      title: '序号',
      width: 64,
      align: 'center',
      render: (_, __, index) => (page - 1) * pageSize + index + 1,
    },
    { title: '入厂登记编号', dataIndex: 'regNo', width: 248 },
    { title: '车船名', dataIndex: 'vessel', width: 140 },
    { title: '航次', dataIndex: 'voyage', width: 88 },
    { title: '煤品种', dataIndex: 'variety', width: 110 },
    {
      title: '煤种',
      dataIndex: 'coalKind',
      width: 220,
      ellipsis: { showTitle: false },
      render: (text: string) => (
        <Tooltip placement="topLeft" title={text}>
          {text}
        </Tooltip>
      ),
    },
    {
      title: '运单量(t)',
      dataIndex: 'waybillTons',
      width: 110,
      align: 'right',
      render: (value: number) => String(value),
    },
    { title: '计划编号', dataIndex: 'planNo', width: 148 },
    {
      title: '供应商名称',
      dataIndex: 'supplier',
      width: 220,
      ellipsis: true,
    },
    { title: '预报时间', dataIndex: 'forecastDate', width: 120 },
    {
      title: '库存煤种',
      dataIndex: 'stockCoalName',
      width: 120,
      render: (value: string | null) => value || <span className="caf-empty">—</span>,
    },
    {
      title: '库存煤种色值',
      key: 'stockColor',
      width: 148,
      render: (_, record) => {
        const color = colorOf(record.stockCoalName);
        if (!color) return <span className="caf-empty">—</span>;
        return (
          <span className="caf-color">
            <i style={{ background: color }} />
            <span>{color}</span>
          </span>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 148,
      fixed: 'right',
      render: (_, record) => (
        <div className="caf-ops">
          <Button type="link" size="small" onClick={() => setEditingId(record.id)}>煤种配置</Button>
          <Button
            type="link"
            size="small"
            onClick={() => message.info('卸煤管理沿用现有业务页面，本页演示煤种配置。')}
          >
            卸煤管理
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="caf-page">
      <header className="caf-head">
        <h1>来煤预报查询</h1>
        <Button type="link" onClick={() => setFiltersOpen((open) => !open)}>
          {filtersOpen ? '收起' : '展开'}
        </Button>
      </header>

      {filtersOpen && (
        <form
          className="caf-filters"
          onSubmit={(event) => {
            event.preventDefault();
            applyQuery();
          }}
        >
          <Input
            allowClear
            placeholder="入厂登记编号"
            style={{ width: 220 }}
            value={draft.regNo}
            onChange={(event) => setDraft((prev) => ({ ...prev, regNo: event.target.value }))}
          />
          <Input
            allowClear
            placeholder="车船名"
            style={{ width: 140 }}
            value={draft.vessel}
            onChange={(event) => setDraft((prev) => ({ ...prev, vessel: event.target.value }))}
          />
          <RangePicker
            placeholder={['预报到港日期', '预报到港日期']}
            value={draft.start || draft.end ? [draft.start, draft.end] : null}
            onChange={(next) => {
              setDraft((prev) => ({
                ...prev,
                start: next?.[0] ?? null,
                end: next?.[1] ?? null,
              }));
            }}
          />
          <Input
            allowClear
            placeholder="航次"
            style={{ width: 120 }}
            value={draft.voyage}
            onChange={(event) => setDraft((prev) => ({ ...prev, voyage: event.target.value }))}
          />
          <Input
            allowClear
            placeholder="供应商名称"
            style={{ width: 200 }}
            value={draft.supplier}
            onChange={(event) => setDraft((prev) => ({ ...prev, supplier: event.target.value }))}
          />
          <Button type="primary" htmlType="submit">查询</Button>
          <Button htmlType="button" onClick={resetQuery}>重置</Button>
        </form>
      )}

      <div className="caf-table-wrap">
        <Table<ForecastRow>
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={filtered}
          scroll={{ x: 1880 }}
          pagination={{
            current: page,
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (nextPage, nextSize) => {
              setPage(nextSize === pageSize ? nextPage : 1);
              setPageSize(nextSize);
            },
          }}
          locale={{ emptyText: '暂无来煤预报' }}
        />
      </div>

      <CoalConfigDrawer
        row={editing}
        coals={coals}
        rows={rows}
        onClose={() => setEditingId(null)}
        onSave={handleSave}
        onClear={handleClear}
      />
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
      components: {
        Table: {
          headerBg: '#f0f5ff',
          headerColor: 'rgba(0, 0, 0, 0.88)',
          headerBorderRadius: 0,
        },
      },
    }}
  >
    <App>
      <CoalArrivalForecast />
    </App>
  </ConfigProvider>
);

export default Component;

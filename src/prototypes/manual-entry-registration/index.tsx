/**
 * @name 燃煤入厂登记
 * @mode axure
 *
 * 参考资料：
 * - /rules/design-guide.md
 * - /rules/development-standards.md
 * - /src/themes/antd-new/DESIGN-SPEC.md
 * - /skills/default-design-guide-minimal/SKILL.md
 * - /skills/axure-export-workflow/SKILL.md
 * - 用户提供的人工入厂登记业务规约
 */
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  ConfigProvider,
  Empty,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  message,
} from 'antd';
import {
  ClearOutlined,
  CreditCardOutlined,
  PlusSquareOutlined,
  QrcodeOutlined,
  ScanOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import dayjs, { type Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import './style.css';
import CardSearchDrawer from './components/CardSearchDrawer';
import FormFieldRow from './components/FormFieldRow';
import ModuleNav from './components/ModuleNav';
import PlanSelectDrawer from './components/PlanSelectDrawer';
import PlanScanModal from './components/PlanScanModal';
import PlateInput from './components/PlateInput';
import YunyiScanModal from './components/YunyiScanModal';
import YunyiAutoDrawer from './components/YunyiAutoDrawer';
import {
  INITIAL_RECORDS,
  MODULE_LABELS,
  MODULE_MENUS,
  SAMPLE_METHODS,
  SAMPLE_POSITIONS,
  SITES,
  WEIGH_POSITIONS,
  findPlan,
  getModuleFieldConfig,
  getModuleOperationConfig,
  isFieldEditable,
  isFieldVisible,
  isOperationEnabled,
  lookupVehicleByPlate,
  nextSerial,
  readCachedSiteId,
  writeCachedSiteId,
  type CoalPlan,
  type EntryRecord,
  type FieldKey,
  type ModuleCode,
  type OperationKey,
} from './data';
import { applyPlan, isYunyiFresh, parseYunyi, type YunyiPayload } from './parse';

interface FormValues {
  plate?: string;
  vehicleCard?: string;
  supplier?: string;
  mine?: string;
  coalType?: string;
  transporter?: string;
  productName?: string;
  gross?: number | null;
  tare?: number | null;
  net?: number | null;
  shipTime?: Dayjs | null;
  station?: string;
  samplePos?: string;
  weighPos?: string;
  unloadArea?: string;
  sampleMethod?: string;
  entryCard?: string;
  planId?: string;
  taskNo?: string;
}

const emptyForm = (): FormValues => ({
  plate: undefined,
  vehicleCard: undefined,
  supplier: undefined,
  mine: undefined,
  coalType: undefined,
  transporter: undefined,
  productName: undefined,
  gross: null,
  tare: null,
  net: null,
  shipTime: null,
  station: undefined,
  samplePos: SAMPLE_POSITIONS[0],
  weighPos: WEIGH_POSITIONS[0],
  unloadArea: undefined,
  sampleMethod: '机械采样',
  entryCard: undefined,
  planId: undefined,
  taskNo: undefined,
});

const Component: React.FC = () => {
  const cachedSite = readCachedSiteId();
  const defaultSite = SITES.find((s) => s.id === cachedSite) ?? SITES[0];

  const permittedModules = MODULE_MENUS.filter((m) => m.permitted);
  const defaultModule = permittedModules[0]?.code ?? 'coal-entry';

  const [siteId, setSiteId] = useState(defaultSite.id);
  const [moduleCode, setModuleCode] = useState<ModuleCode>(defaultModule);
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [records, setRecords] = useState<EntryRecord[]>(INITIAL_RECORDS);
  const [submitting, setSubmitting] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [yunyiOpen, setYunyiOpen] = useState(false);
  const [yunyiAutoOpen, setYunyiAutoOpen] = useState(false);
  const [planScanOpen, setPlanScanOpen] = useState(false);
  const [cardSearchOpen, setCardSearchOpen] = useState(false);
  const [writingCardId, setWritingCardId] = useState<string | null>(null);
  const listBodyRef = useRef<HTMLDivElement>(null);
  const [tableY, setTableY] = useState(180);

  const site = SITES.find((s) => s.id === siteId)!;
  const fieldCfg = useMemo(() => getModuleFieldConfig(site.moduleCode), [site.moduleCode]);
  const opCfg = useMemo(() => getModuleOperationConfig(site.moduleCode), [site.moduleCode]);

  const patch = (next: Partial<FormValues>) => setValues((prev) => ({ ...prev, ...next }));

  const isCoalEntry = moduleCode === 'coal-entry';

  const fillPlan = (plan: CoalPlan) => {
    const base = applyPlan(plan);
    setValues((prev) => ({
      ...prev,
      ...base,
      shipTime: plan.shipTime ? dayjs(plan.shipTime) : null,
      gross: plan.gross,
      tare: plan.tare,
      net: plan.net,
      samplePos: plan.samplePos || prev.samplePos || SAMPLE_POSITIONS[0],
      weighPos: plan.weighPos || prev.weighPos || WEIGH_POSITIONS[0],
      sampleMethod: prev.sampleMethod || '机械采样',
      taskNo: plan.taskNo,
    }));
  };

  const fillFromPlate = (plate: string) => {
    const hit = lookupVehicleByPlate(plate);
    if (hit) {
      const { plan, pre } = hit;
      fillPlan(plan);
      patch({
        plate: plan.plate,
        vehicleCard: pre?.vehicleCard,
        entryCard: pre?.entryCard || undefined,
      });
      message.success(`已加载 ${plan.plate} 关联信息`);
    } else {
      patch({ plate });
      message.warning('未查到该车牌关联信息');
    }
  };

  const handlePlanPick = (plan: CoalPlan) => {
    fillPlan(plan);
    setPlanOpen(false);
    message.success('计划信息已回填');
  };

  const handlePlanScan = (planId: string) => {
    const plan = findPlan(planId);
    if (!plan) {
      message.error('未查询到计划信息');
      return;
    }
    fillPlan(plan);
    message.success('计划码扫码成功');
  };

  const handleYunyiScan = (raw: string) => {
    const parsed = parseYunyi(raw);
    if (!parsed) {
      message.error('二维码格式无法解析');
      return;
    }
    if (!isYunyiFresh(parsed.qrTime)) {
      message.error('二维码失效，请刷新！');
      return;
    }
    const plan = findPlan(parsed.planId);
    if (!plan) {
      message.error('未查询到计划信息');
      return;
    }
    const base = applyPlan(plan);
    setValues((prev) => ({
      ...prev,
      ...base,
      plate: parsed.plate,
      shipTime: parsed.stationTime ? dayjs(parsed.stationTime) : dayjs(plan.shipTime),
      gross: parsed.gross,
      tare: parsed.tare,
      net: parsed.net,
      taskNo: parsed.taskNo,
      sampleMethod: prev.sampleMethod || '机械采样',
      samplePos: prev.samplePos || plan.samplePos,
      weighPos: prev.weighPos || plan.weighPos,
    }));
    message.success('扫码成功');
  };

  /** 云驿自动模式：登记成功写入列表；表单回显运单但不清空，便于核对 */
  const handleYunyiAutoRegistered = (payload: {
    mode: 'enter' | 'preEnter';
    plan: CoalPlan;
    parsed: YunyiPayload;
    success: boolean;
    failReason?: string;
  }) => {
    const { mode, plan, parsed, success } = payload;
    const base = applyPlan(plan);
    setValues({
      ...emptyForm(),
      ...base,
      plate: parsed.plate || plan.plate,
      shipTime: parsed.stationTime ? dayjs(parsed.stationTime) : dayjs(plan.shipTime),
      gross: parsed.gross ?? plan.gross,
      tare: parsed.tare ?? plan.tare,
      net: parsed.net ?? plan.net,
      taskNo: parsed.taskNo || plan.taskNo,
      sampleMethod: '机械采样',
      samplePos: plan.samplePos || SAMPLE_POSITIONS[0],
      weighPos: plan.weighPos || WEIGH_POSITIONS[0],
    });

    if (!success) return;

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const row: EntryRecord = {
      id: `R${Date.now()}`,
      serialNo: nextSerial(records),
      plate: parsed.plate || plan.plate,
      supplier: plan.supplier,
      mine: plan.mine,
      coalType: plan.coalType,
      sampleMethod: '机械采样',
      net: Number(parsed.net ?? plan.net),
      weighPos: plan.weighPos || '—',
      samplePos: plan.samplePos || '—',
      enterAt: now,
      status: 'registered',
      entryCard: '',
      siteId: site.id,
      taskNo: parsed.taskNo || plan.taskNo,
    };
    setRecords((list) => [row, ...list]);
    if (mode === 'preEnter') {
      // 预登记同样记入列表，便于原型演示
    }
  };

  const validateForm = (): boolean => {
    if (!values.plate?.trim()) {
      message.error('请填写车牌号码');
      return false;
    }
    if (values.net == null || Number.isNaN(Number(values.net))) {
      message.error('请填写矿发净重');
      return false;
    }
    return true;
  };

  const doSubmit = async (mode: 'normal' | 'pre' | 'withCard') => {
    if (!validateForm()) return;
    setSubmitting(true);
    await new Promise((r) => window.setTimeout(r, 800));
    setSubmitting(false);

    const plate = values.plate!.trim();
    const serialNo = nextSerial(records);
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const row: EntryRecord = {
      id: `R${Date.now()}`,
      serialNo,
      plate,
      supplier: values.supplier || '—',
      mine: values.mine || '—',
      coalType: values.coalType || '—',
      sampleMethod: values.sampleMethod || '机械采样',
      net: Number(values.net),
      weighPos: values.weighPos || '—',
      samplePos: values.samplePos || '—',
      enterAt: now,
      status: 'registered',
      entryCard: values.entryCard || '',
      siteId: site.id,
      taskNo: values.taskNo,
    };

    if (mode === 'withCard') {
      message.loading({ content: '正在写卡，请勿移动卡片', key: 'write', duration: 0 });
      await new Promise((r) => window.setTimeout(r, 1200));
      message.destroy('write');
      row.entryCard = `YC-${Date.now().toString().slice(-6)}`;
      message.success('写卡成功');
    }

    setRecords((list) => [row, ...list]);
    setValues(emptyForm());
    message.success(mode === 'pre' ? '预登记成功' : '登记成功');
  };

  const reissueCard = async (row: EntryRecord) => {
    setWritingCardId(row.id);
    message.loading({ content: '正在写卡，请勿移动卡片', key: 'reissue', duration: 0 });
    const ok = await new Promise<boolean>((resolve) => {
      window.setTimeout(() => resolve(Math.random() > 0.15), 2200);
    });
    message.destroy('reissue');
    setWritingCardId(null);
    if (!ok) {
      message.error('写卡失败');
      return;
    }
    const card = `YC-R${Date.now().toString().slice(-5)}`;
    setRecords((list) =>
      list.map((r) => (r.id === row.id ? { ...r, entryCard: card } : r)),
    );
    message.success('补发煤样卡成功');
  };

  const handleSiteChange = (id: string) => {
    setSiteId(id);
    writeCachedSiteId(id);
    setValues(emptyForm());
  };

  const showOp = (key: OperationKey) => isOperationEnabled(key, opCfg);
  const showField = (key: FieldKey) => isFieldVisible(key, fieldCfg);
  const editField = (key: FieldKey) => isFieldEditable(key, fieldCfg);

  const listOpsVisible = showOp('OPERATION_cardNo1Write');
  const filteredRecords = useMemo(
    () =>
      records
        .filter((r) => r.siteId === site.id)
        .sort((a, b) => dayjs(b.enterAt).valueOf() - dayjs(a.enterAt).valueOf()),
    [records, site.id],
  );

  useLayoutEffect(() => {
    const el = listBodyRef.current;
    if (!el) return;
    const sync = () => {
      const head = el.querySelector('.ant-table-thead') as HTMLElement | null;
      const headH = head?.offsetHeight ?? 39;
      setTableY(Math.max(120, el.clientHeight - headH - 2));
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [filteredRecords.length, siteId, moduleCode]);

  const columns: ColumnsType<EntryRecord> = [
    { title: '序号', width: 56, render: (_, __, i) => i + 1 },
    { title: '流水号', dataIndex: 'serialNo', width: 150 },
    { title: '车牌号', dataIndex: 'plate', width: 100 },
    { title: '供应商', dataIndex: 'supplier', width: 140, ellipsis: true },
    { title: '矿点', dataIndex: 'mine', width: 100 },
    { title: '煤种', dataIndex: 'coalType', width: 80 },
    { title: '采样方式', dataIndex: 'sampleMethod', width: 90 },
    { title: '矿发净重(t)', dataIndex: 'net', width: 100 },
    { title: '过衡位', dataIndex: 'weighPos', width: 100 },
    { title: '采样位', dataIndex: 'samplePos', width: 120 },
    { title: '入厂时间', dataIndex: 'enterAt', width: 160 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (s: EntryRecord['status']) =>
        s === 'exited' ? <Tag>已出厂</Tag> : <Tag color="processing">在厂</Tag>,
    },
    ...(listOpsVisible
      ? [
          {
            title: '操作',
            width: 110,
            fixed: 'right' as const,
            render: (_: unknown, row: EntryRecord) =>
              row.status === 'exited' ? (
                '—'
              ) : (
                <Button
                  type="link"
                  size="small"
                  loading={writingCardId === row.id}
                  onClick={() => reissueCard(row)}
                >
                  补发煤样卡
                </Button>
              ),
          },
        ]
      : []),
  ];

  const weightText = (n?: number | null) =>
    n === undefined || n === null || Number.isNaN(Number(n)) ? undefined : `${Number(n).toFixed(2)} t`;

  const renderCoalEntryForm = () => (
    <>
      <div className="mer-card-bd">
        {(showField('FIELD_vehicleNo') || showField('FIELD_cardNo')) && (
          <div className="mer-form-identity-row">
            {showField('FIELD_vehicleNo') && (
              <PlateInput
                value={values.plate}
                onChange={(plate) => patch({ plate })}
                onSelect={fillFromPlate}
              />
            )}
            {showField('FIELD_cardNo') && (
              <FormFieldRow label="车辆卡号" value={values.vehicleCard} />
            )}
          </div>
        )}
        <div className="mer-form-grid">
          <div>
            <p className="mer-col-title">来煤信息</p>
            <FormFieldRow label="供应商" value={values.supplier} />
            <FormFieldRow label="矿点" value={values.mine} />
            <FormFieldRow label="煤种" value={values.coalType} />
            <FormFieldRow label="运输单位" value={values.transporter} />
            <FormFieldRow label="品名" value={values.productName} />
          </div>
          <div>
            <p className="mer-col-title">矿发信息</p>
            {showField('FIELD_mineHairGrossWeight') && (
              <FormFieldRow
                label="矿发毛重"
                required
                editable={editField('FIELD_mineHairGrossWeight')}
                value={weightText(values.gross)}
                numberValue={values.gross}
                onNumberChange={(gross) => patch({ gross })}
              />
            )}
            {showField('FIELD_mineHairTare') && (
              <FormFieldRow
                label="矿发皮重"
                editable={editField('FIELD_mineHairTare')}
                value={weightText(values.tare)}
                numberValue={values.tare}
                onNumberChange={(tare) => patch({ tare })}
              />
            )}
            {showField('FIELD_ticketHeight') && (
              <FormFieldRow
                label="矿发净重"
                required
                editable={editField('FIELD_ticketHeight')}
                value={weightText(values.net)}
                numberValue={values.net}
                onNumberChange={(net) => patch({ net })}
              />
            )}
            <FormFieldRow label="发站" value={values.station} />
            {showField('FIELD_fromDate') && (
              <FormFieldRow
                label="发站时间"
                value={values.shipTime ? values.shipTime.format('YYYY-MM-DD HH:mm:ss') : undefined}
              />
            )}
          </div>
          <div>
            <p className="mer-col-title">入厂信息</p>
            {showField('FIELD_simplingSource') && (
              <FormFieldRow
                label="采样方式"
                required
                editable={editField('FIELD_simplingSource')}
                value={values.sampleMethod}
                selectValue={values.sampleMethod}
                selectOptions={[...SAMPLE_METHODS]}
                onSelectChange={(sampleMethod) => patch({ sampleMethod })}
              />
            )}
            {showField('FIELD_simplingName') && (
              <FormFieldRow
                label="采样位"
                editable={editField('FIELD_simplingName')}
                value={values.samplePos}
                selectValue={values.samplePos}
                selectOptions={SAMPLE_POSITIONS}
                onSelectChange={(samplePos) => patch({ samplePos })}
              />
            )}
            {showField('FIELD_poundName') && (
              <FormFieldRow
                label="过衡位"
                editable={editField('FIELD_poundName')}
                value={values.weighPos}
                selectValue={values.weighPos}
                selectOptions={WEIGH_POSITIONS}
                onSelectChange={(weighPos) => patch({ weighPos })}
              />
            )}
            <FormFieldRow label="卸煤区域" value={values.unloadArea} required />
            {showField('FIELD_cardNo1') && (
              <FormFieldRow label="入厂卡/煤样卡" value={values.entryCard} />
            )}
          </div>
        </div>
      </div>

      <div className="mer-footer-actions">
        <Space wrap>
          {showOp('OPERATION_enterComfire') && (
            <Button type="primary" loading={submitting} onClick={() => doSubmit('normal')}>
              确认登记
            </Button>
          )}
          {showOp('OPERATION_preEnterComfire') && (
            <Button loading={submitting} onClick={() => doSubmit('pre')}>
              确认预登记
            </Button>
          )}
          {showOp('OPERATION_cardNo1WriteAndenterComfire') && (
            <Button type="primary" ghost loading={submitting} onClick={() => doSubmit('withCard')}>
              确认登记并发卡
            </Button>
          )}
          <Button icon={<ClearOutlined />} onClick={() => setValues(emptyForm())}>
            清除重置
          </Button>
        </Space>
      </div>
    </>
  );

  const renderModuleBody = () => {
    if (isCoalEntry) return renderCoalEntryForm();

    return (
      <div className="mer-module-placeholder">
        <Empty description="暂未开发" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  };

  const moduleTitle = MODULE_LABELS[moduleCode];

  return (
    <ConfigProvider locale={zhCN} componentSize="small">
      <div className="mer-root">
        <header className="mer-context-bar">
          <div className="mer-context-site">
            <span className="mer-site-label">入厂点</span>
            <Select
              className="mer-site-dropdown"
              value={siteId}
              options={SITES.map((s) => ({ value: s.id, label: s.name }))}
              onChange={handleSiteChange}
            />
          </div>
          <ModuleNav
            menus={permittedModules}
            active={moduleCode}
            onChange={(code) => {
              setModuleCode(code);
              setValues(emptyForm());
            }}
          />
          {isCoalEntry && showOp('OPERATION_yunYiCodeAuto') && (
            <Popconfirm
              title="确认启用读码自动登记模式？"
              description={
                <div className="mer-auto-confirm-desc">
                  请保持页面置顶，收起浏览器、操作键盘或可通过鼠标点击退出扫码自动登记识别模式
                  <div className="mer-auto-confirm-mode">
                    当前配置：
                    {site.GOABLE_AotoYunYiRegister === 'preEnter' ? '预入厂登记' : '入厂登记'}
                    （GOABLE_AotoYunYiRegister）
                  </div>
                </div>
              }
              okText="确认启用"
              cancelText="取消"
              onConfirm={() => setYunyiAutoOpen(true)}
            >
              <Button
                type="primary"
                ghost
                icon={<ThunderboltOutlined />}
                className="mer-auto-tag"
              >
                云驿自动模式
              </Button>
            </Popconfirm>
          )}
        </header>

        <section className="mer-card mer-form-card">
          <div className="mer-card-hd">
            <div className="mer-card-title">
              <h2>{moduleTitle}</h2>
              <Tag color="processing" className="mer-current-site">
                {site.name}
              </Tag>
            </div>
            {isCoalEntry && (
              <div className="mer-card-actions">
                <span className="mer-action-group-label">数据获取</span>
                <div className="mer-action-group">
                  {showOp('OPERATION_manualSelectPlan') && (
                    <Button icon={<PlusSquareOutlined />} onClick={() => setPlanOpen(true)}>
                      人工选择计划
                    </Button>
                  )}
                  {showOp('OPERATION_planCode') && (
                    <Button icon={<QrcodeOutlined />} onClick={() => setPlanScanOpen(true)}>
                      计划码扫码
                    </Button>
                  )}
                  {showOp('OPERATION_yunYiCode') && (
                    <Button icon={<ScanOutlined />} onClick={() => setYunyiOpen(true)}>
                      云驿扫码
                    </Button>
                  )}
                  {showOp('OPERATION_cardNo1Search') && (
                    <Button icon={<CreditCardOutlined />} onClick={() => setCardSearchOpen(true)}>
                      煤样卡查询
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
          {renderModuleBody()}
        </section>

        {isCoalEntry && (
          <section className="mer-card mer-list-card">
            <div className="mer-card-hd">
              <h2>入厂车辆列表</h2>
              <span className="mer-list-count">共 {filteredRecords.length} 条 · 按入厂时间倒序</span>
            </div>
            <div className="mer-list-body" ref={listBodyRef}>
              <Table
                rowKey="id"
                size="small"
                columns={columns}
                dataSource={filteredRecords}
                pagination={false}
                scroll={{ x: 1280, y: tableY }}
              />
            </div>
          </section>
        )}

        <PlanSelectDrawer open={planOpen} onClose={() => setPlanOpen(false)} onPick={handlePlanPick} />
        <YunyiScanModal open={yunyiOpen} onClose={() => setYunyiOpen(false)} onSuccess={handleYunyiScan} />
        <YunyiAutoDrawer
          open={yunyiAutoOpen}
          site={site}
          onClose={() => setYunyiAutoOpen(false)}
          onRegistered={handleYunyiAutoRegistered}
        />
        <PlanScanModal
          open={planScanOpen}
          onClose={() => setPlanScanOpen(false)}
          onSubmit={handlePlanScan}
        />
        <CardSearchDrawer open={cardSearchOpen} onClose={() => setCardSearchOpen(false)} />

        {submitting && (
          <div className="mer-global-spin">
            <Spin tip="正在提交登记…" />
          </div>
        )}
      </div>
    </ConfigProvider>
  );
};

export default Component;

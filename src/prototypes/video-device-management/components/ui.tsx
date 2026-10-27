/**
 * 设备管理业务域 · 轻量后台 UI 套件（vdm- 前缀）
 * 风格对齐项目内既有后台原型（Ant Design 浅色）。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Inbox, Plus, Search, X } from 'lucide-react';

export function useClickOutside<T extends HTMLElement>(
    ref: React.RefObject<T | null>,
    handler: () => void,
) {
    useEffect(() => {
        const fn = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) handler();
        };
        document.addEventListener('mousedown', fn);
        return () => document.removeEventListener('mousedown', fn);
    }, [ref, handler]);
}

export function Button({
    variant = 'default',
    size = 'default',
    disabled = false,
    icon,
    children,
    onClick,
    title,
    className = '',
}: {
    /** ghost：主色描边的次级按钮，用于与主按钮并列的第二动作 */
    variant?: 'primary' | 'ghost' | 'default' | 'dashed' | 'text' | 'link' | 'danger';
    size?: 'small' | 'default';
    disabled?: boolean;
    icon?: React.ReactNode;
    children?: React.ReactNode;
    onClick?: () => void;
    title?: string;
    className?: string;
}) {
    const cls = ['vdm-btn', `vdm-btn-${variant}`, size === 'small' ? 'vdm-btn-sm' : 'vdm-btn-md', className]
        .filter(Boolean)
        .join(' ');
    return (
        <button type="button" className={cls} onClick={onClick} disabled={disabled} title={title}>
            {icon ? <span className="vdm-btn-icon">{icon}</span> : null}
            {children != null ? <span>{children}</span> : null}
        </button>
    );
}

export function IconButton({
    title,
    onClick,
    children,
    danger = false,
    disabled = false,
}: {
    title: string;
    onClick?: () => void;
    children: React.ReactNode;
    danger?: boolean;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            className={`vdm-icon-btn${danger ? ' is-danger' : ''}`}
            title={title}
            aria-label={title}
            onClick={onClick}
            disabled={disabled}
        >
            {children}
        </button>
    );
}

export function Input({
    value,
    onChange,
    placeholder,
    disabled = false,
    invalid = false,
    maxLength,
    digitsOnly = false,
    noSpace = false,
    onBlur,
    onEnter,
    suffix,
    readOnly = false,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
    invalid?: boolean;
    maxLength?: number;
    digitsOnly?: boolean;
    noSpace?: boolean;
    onBlur?: () => void;
    /** 回车提交，用于筛选栏直接触发查询 */
    onEnter?: () => void;
    suffix?: React.ReactNode;
    readOnly?: boolean;
}) {
    const handle = (raw: string) => {
        let next = raw;
        if (digitsOnly) next = next.replace(/\D/g, '');
        if (noSpace) next = next.replace(/\s/g, '');
        if (typeof maxLength === 'number') next = next.slice(0, maxLength);
        onChange(next);
    };
    return (
        <span className={`vdm-input-wrap${invalid ? ' is-invalid' : ''}${disabled || readOnly ? ' is-disabled' : ''}`}>
            <input
                className="vdm-input"
                value={value}
                disabled={disabled}
                readOnly={readOnly}
                placeholder={placeholder}
                onChange={(e) => handle(e.target.value)}
                onBlur={onBlur}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && onEnter) {
                        e.preventDefault();
                        onEnter();
                    }
                }}
            />
            {suffix ? <span className="vdm-input-suffix">{suffix}</span> : null}
        </span>
    );
}

export function Textarea({
    value,
    onChange,
    placeholder,
    maxLength,
    rows = 3,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    maxLength?: number;
    rows?: number;
}) {
    return (
        <textarea
            className="vdm-textarea"
            value={value}
            rows={rows}
            placeholder={placeholder}
            onChange={(e) => onChange(typeof maxLength === 'number' ? e.target.value.slice(0, maxLength) : e.target.value)}
        />
    );
}

export function SearchInput({
    value,
    onChange,
    placeholder,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    return (
        <span className="vdm-search">
            <Search size={14} />
            <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
            {value ? (
                <button type="button" onClick={() => onChange('')} aria-label="清空">
                    <X size={12} />
                </button>
            ) : null}
        </span>
    );
}

export interface SelectOption {
    value: string;
    label: string;
    desc?: string;
    disabled?: boolean;
}

/**
 * 可输入可选择的输入框：候选来自台账中已录入的值，
 * 既能直接手填新值，也能从下拉里挑一个已有值复用。
 */
export function ComboInput({
    value,
    options,
    onChange,
    onPick,
    placeholder,
    invalid = false,
    maxLength,
    emptyText = '暂无可选值，可直接输入',
}: {
    value: string;
    options: SelectOption[];
    onChange: (v: string) => void;
    /** 从下拉中选中既有值（区别于手工输入，便于联动回填） */
    onPick?: (v: string) => void;
    placeholder?: string;
    invalid?: boolean;
    maxLength?: number;
    emptyText?: string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, () => setOpen(false));

    const keyword = value.trim();
    const matched = keyword
        ? options.filter((item) => item.value.includes(keyword) || item.label.includes(keyword))
        : options;
    const list = matched.length ? matched : options;

    return (
        <div className={`vdm-combo${open ? ' is-open' : ''}${invalid ? ' is-invalid' : ''}`} ref={ref}>
            <span className="vdm-input-wrap">
                <input
                    className="vdm-input"
                    value={value}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={() => setOpen(true)}
                />
                <button
                    type="button"
                    className="vdm-combo-toggle"
                    aria-label="展开已有值"
                    onClick={() => setOpen((o) => !o)}
                >
                    <ChevronDown size={14} />
                </button>
            </span>
            {open ? (
                <div className="vdm-select-dropdown">
                    {list.length ? (
                        list.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                className={`vdm-select-option${item.value === value ? ' is-active' : ''}`}
                                onClick={() => {
                                    (onPick || onChange)(item.value);
                                    setOpen(false);
                                }}
                            >
                                <span>{item.label}</span>
                                {item.desc ? <em>{item.desc}</em> : null}
                            </button>
                        ))
                    ) : (
                        <div className="vdm-select-empty">{emptyText}</div>
                    )}
                </div>
            ) : null}
        </div>
    );
}

export function Select({
    value,
    options,
    onChange,
    placeholder = '请选择',
    allowClear = false,
    disabled = false,
    invalid = false,
    createLabel,
    onCreate,
    emptyText = '暂无数据',
}: {
    value: string;
    options: SelectOption[];
    onChange: (v: string) => void;
    placeholder?: string;
    allowClear?: boolean;
    disabled?: boolean;
    invalid?: boolean;
    createLabel?: string;
    onCreate?: () => void;
    emptyText?: string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, () => setOpen(false));
    const cur = options.find((o) => o.value === value);
    return (
        <div className={`vdm-select${open ? ' is-open' : ''}${invalid ? ' is-invalid' : ''}`} ref={ref}>
            <button
                type="button"
                className="vdm-select-trigger"
                disabled={disabled}
                onClick={() => setOpen((o) => !o)}
            >
                <span className={cur ? '' : 'is-placeholder'}>{cur?.label || placeholder}</span>
                <span className="vdm-select-icons">
                    {allowClear && value ? (
                        <span
                            className="vdm-select-clear"
                            role="button"
                            aria-label="清除"
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onChange('');
                            }}
                        >
                            <X size={12} />
                        </span>
                    ) : null}
                    <ChevronDown size={14} />
                </span>
            </button>
            {open ? (
                <div className="vdm-select-dropdown">
                    {options.length ? (
                        options.map((o) => (
                            <button
                                key={o.value}
                                type="button"
                                disabled={o.disabled}
                                className={`vdm-select-option${o.value === value ? ' is-active' : ''}`}
                                onClick={() => {
                                    onChange(o.value);
                                    setOpen(false);
                                }}
                            >
                                <span>{o.label}</span>
                                {o.desc ? <em>{o.desc}</em> : null}
                            </button>
                        ))
                    ) : (
                        <div className="vdm-select-empty">{emptyText}</div>
                    )}
                    {onCreate ? (
                        <button
                            type="button"
                            className="vdm-select-create"
                            onClick={() => {
                                setOpen(false);
                                onCreate();
                            }}
                        >
                            <Plus size={13} />
                            {createLabel || '新建'}
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export interface TreeSelectNode {
    value: string;
    label: string;
    depth: number;
    disabled?: boolean;
}

export function TreeSelect({
    value,
    nodes,
    onChange,
    placeholder = '请选择分组',
    invalid = false,
}: {
    value: string;
    nodes: TreeSelectNode[];
    onChange: (v: string) => void;
    placeholder?: string;
    invalid?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, () => setOpen(false));
    const cur = nodes.find((n) => n.value === value);
    return (
        <div className={`vdm-select${open ? ' is-open' : ''}${invalid ? ' is-invalid' : ''}`} ref={ref}>
            <button type="button" className="vdm-select-trigger" onClick={() => setOpen((o) => !o)}>
                <span className={cur ? '' : 'is-placeholder'}>{cur?.label || placeholder}</span>
                <ChevronDown size={14} />
            </button>
            {open ? (
                <div className="vdm-select-dropdown">
                    {nodes.map((n) => (
                        <button
                            key={n.value}
                            type="button"
                            disabled={n.disabled}
                            className={`vdm-select-option${n.value === value ? ' is-active' : ''}`}
                            style={{ paddingLeft: 12 + n.depth * 16 }}
                            onClick={() => {
                                onChange(n.value);
                                setOpen(false);
                            }}
                        >
                            <span>{n.label}</span>
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

export function Checkbox({
    checked,
    onChange,
    children,
    disabled = false,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    children?: React.ReactNode;
    disabled?: boolean;
}) {
    return (
        <label className={`vdm-checkbox${disabled ? ' is-disabled' : ''}`}>
            <span
                className={`vdm-cb-box${checked ? ' is-checked' : ''}`}
                onClick={(e) => {
                    e.preventDefault();
                    if (!disabled) onChange(!checked);
                }}
            >
                {checked ? <Check size={11} /> : null}
            </span>
            {children != null ? <span className="vdm-checkbox-label">{children}</span> : null}
        </label>
    );
}

export function RadioGroup<T extends string | boolean>({
    value,
    options,
    onChange,
}: {
    value: T;
    options: { value: T; label: string }[];
    onChange: (v: T) => void;
}) {
    return (
        <div className="vdm-radio-group">
            {options.map((o) => (
                <label key={String(o.value)} className={`vdm-radio${o.value === value ? ' is-active' : ''}`}>
                    <span className="vdm-radio-dot" onClick={() => onChange(o.value)} />
                    <span onClick={() => onChange(o.value)}>{o.label}</span>
                </label>
            ))}
        </div>
    );
}

export function Field({
    label,
    required = false,
    error,
    success,
    hint,
    children,
    full = false,
}: {
    label: string;
    required?: boolean;
    error?: string;
    /** 校验通过后的正向反馈，如唯一性校验结果 */
    success?: string;
    hint?: React.ReactNode;
    children: React.ReactNode;
    full?: boolean;
}) {
    return (
        <div className={`vdm-field${full ? ' is-full' : ''}`}>
            <label className="vdm-field-label">
                {required ? <em>*</em> : null}
                {label}
            </label>
            <div className="vdm-field-control">
                {children}
                {error ? (
                    <p className="vdm-field-error">{error}</p>
                ) : success ? (
                    <p className="vdm-field-success">{success}</p>
                ) : hint ? (
                    <p className="vdm-field-hint">{hint}</p>
                ) : null}
            </div>
        </div>
    );
}

export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="vdm-form-section">
            <h4 className="vdm-form-section-title">{title}</h4>
            <div className="vdm-form-grid">{children}</div>
        </section>
    );
}

export function Tag({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'blue' | 'gold' }) {
    return <span className={`vdm-tag vdm-tag-${tone}`}>{children}</span>;
}

export function CopyText({ text, mono = false }: { text: string; mono?: boolean }) {
    const copy = () => {
        if (!text || text === '—') return;
        try {
            navigator.clipboard?.writeText(text);
            message.success('已复制');
        } catch {
            message.warning('当前环境不支持复制');
        }
    };
    return (
        <button type="button" className={`vdm-copy${mono ? ' is-mono' : ''}`} onClick={copy} title="点击复制">
            {text || '—'}
        </button>
    );
}

export function Drawer({
    open,
    title,
    subTitle,
    onClose,
    footer,
    width = 760,
    children,
}: {
    open: boolean;
    title: React.ReactNode;
    subTitle?: React.ReactNode;
    onClose: () => void;
    footer?: React.ReactNode;
    width?: number;
    children: React.ReactNode;
}) {
    if (!open) return null;
    return createPortal(
        <div
            className="vdm-overlay vdm-overlay-drawer"
            style={{ zIndex: 1000 }}
            onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="vdm-drawer" style={{ width }} role="dialog" aria-modal="true">
                <div className="vdm-drawer-head">
                    <div className="vdm-drawer-title-wrap">
                        <span className="vdm-drawer-title">{title}</span>
                        {subTitle ? <span className="vdm-drawer-sub">{subTitle}</span> : null}
                    </div>
                    <button type="button" className="vdm-icon-close" onClick={onClose} aria-label="关闭">
                        <X size={16} />
                    </button>
                </div>
                <div className="vdm-drawer-body">{children}</div>
                {footer != null ? <div className="vdm-drawer-foot">{footer}</div> : null}
            </div>
        </div>,
        document.body,
    );
}

export function Modal({
    open,
    title,
    onClose,
    footer,
    children,
    width = 460,
    zIndex = 1000,
}: {
    open: boolean;
    title: React.ReactNode;
    onClose: () => void;
    footer?: React.ReactNode;
    children: React.ReactNode;
    width?: number;
    zIndex?: number;
}) {
    if (!open) return null;
    return createPortal(
        <div
            className="vdm-overlay"
            style={{ zIndex }}
            onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="vdm-modal" style={{ width }} role="dialog" aria-modal="true">
                <div className="vdm-modal-head">
                    <span className="vdm-modal-title">{title}</span>
                    <button type="button" className="vdm-icon-close" onClick={onClose} aria-label="关闭">
                        <X size={16} />
                    </button>
                </div>
                <div className="vdm-modal-body">{children}</div>
                {footer != null ? <div className="vdm-modal-foot">{footer}</div> : null}
            </div>
        </div>,
        document.body,
    );
}

export interface ConfirmState {
    title: string;
    content: React.ReactNode;
    okText?: string;
    danger?: boolean;
    onOk: () => void;
}

export function ConfirmModal({
    state,
    onClose,
    zIndex,
}: {
    state: ConfirmState | null;
    onClose: () => void;
    zIndex?: number;
}) {
    return (
        <Modal
            open={!!state}
            title={state?.title || ''}
            zIndex={zIndex}
            onClose={onClose}
            footer={
                <div className="vdm-modal-actions">
                    <Button onClick={onClose}>取消</Button>
                    <Button
                        variant={state?.danger ? 'danger' : 'primary'}
                        onClick={() => {
                            state?.onOk();
                            onClose();
                        }}
                    >
                        {state?.okText || '确认'}
                    </Button>
                </div>
            }
        >
            <div className="vdm-confirm-body">{state?.content}</div>
        </Modal>
    );
}

export function TableWrap({ children, minWidth }: { children: React.ReactNode; minWidth?: number }) {
    return (
        <div className="vdm-table-wrap">
            <table className="vdm-table" style={minWidth ? { minWidth } : undefined}>
                {children}
            </table>
        </div>
    );
}

export function EmptyRow({ colSpan, text = '暂无数据' }: { colSpan: number; text?: string }) {
    return (
        <tr>
            <td className="vdm-empty-cell" colSpan={colSpan}>
                <span className="vdm-empty-inner">
                    <Inbox size={26} strokeWidth={1.5} />
                    {text}
                </span>
            </td>
        </tr>
    );
}

export const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_OPTIONS = [20, 50, 100];

/** 页码槽位：超过 7 页时首尾固定、当前页居中，其余折叠 */
function pageSlots(current: number, count: number): (number | 'gap')[] {
    if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
    const slots: (number | 'gap')[] = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(count - 1, current + 1);
    if (start > 2) slots.push('gap');
    for (let i = start; i <= end; i += 1) slots.push(i);
    if (end < count - 1) slots.push('gap');
    slots.push(count);
    return slots;
}

/** 列表分页：默认每页 20 条 */
export function Pagination({
    total,
    page,
    pageSize,
    onChange,
}: {
    total: number;
    page: number;
    pageSize: number;
    onChange: (page: number, pageSize: number) => void;
}) {
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(Math.max(page, 1), pageCount);
    const from = total ? (current - 1) * pageSize + 1 : 0;
    const to = Math.min(current * pageSize, total);

    return (
        <div className="vdm-pagination">
            <span className="vdm-pagination-total">
                共 {total} 条{total ? ` · 当前 ${from}-${to}` : ''}
            </span>
            <div className="vdm-pagination-pages">
                <button
                    type="button"
                    className="vdm-page-btn"
                    disabled={current <= 1}
                    aria-label="上一页"
                    onClick={() => onChange(current - 1, pageSize)}
                >
                    <ChevronLeft size={14} />
                </button>
                {pageSlots(current, pageCount).map((slot, index) =>
                    slot === 'gap' ? (
                        <span key={`gap-${index}`} className="vdm-page-gap">
                            ···
                        </span>
                    ) : (
                        <button
                            key={slot}
                            type="button"
                            className={`vdm-page-btn${slot === current ? ' is-active' : ''}`}
                            onClick={() => onChange(slot, pageSize)}
                        >
                            {slot}
                        </button>
                    ),
                )}
                <button
                    type="button"
                    className="vdm-page-btn"
                    disabled={current >= pageCount}
                    aria-label="下一页"
                    onClick={() => onChange(current + 1, pageSize)}
                >
                    <ChevronRight size={14} />
                </button>
            </div>
            <div className="vdm-pagination-size">
                <Select
                    value={String(pageSize)}
                    options={PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: `${size} 条/页` }))}
                    onChange={(value) => onChange(1, Number(value))}
                />
            </div>
        </div>
    );
}

export function Collapsible({
    open,
    onToggle,
    label,
    children,
}: {
    open: boolean;
    onToggle: () => void;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="vdm-collapsible">
            <button type="button" className="vdm-collapsible-head" onClick={onToggle}>
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {label}
            </button>
            {open ? <div className="vdm-collapsible-body">{children}</div> : null}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* 全局轻提示                                                          */
/* ------------------------------------------------------------------ */

type MsgType = 'success' | 'info' | 'warning' | 'error';
interface Msg {
    id: number;
    type: MsgType;
    content: string;
}
type Listener = (msgs: Msg[]) => void;
let idSeq = 0;
let msgStore: Msg[] = [];
const listeners = new Set<Listener>();

function pushMsg(type: MsgType, content: string) {
    const id = ++idSeq;
    msgStore = [...msgStore, { id, type, content }];
    listeners.forEach((l) => l([...msgStore]));
    window.setTimeout(() => {
        msgStore = msgStore.filter((m) => m.id !== id);
        listeners.forEach((l) => l([...msgStore]));
    }, 2800);
}

export const message = {
    success: (c: string) => pushMsg('success', c),
    info: (c: string) => pushMsg('info', c),
    warning: (c: string) => pushMsg('warning', c),
    error: (c: string) => pushMsg('error', c),
};

export function MessageHost() {
    const [msgs, setMsgs] = useState<Msg[]>([]);
    useEffect(() => {
        listeners.add(setMsgs);
        return () => {
            listeners.delete(setMsgs);
        };
    }, []);
    return (
        <div className="vdm-msg-host">
            {msgs.map((m) => (
                <div key={m.id} className={`vdm-msg vdm-msg-${m.type}`}>
                    {m.content}
                </div>
            ))}
        </div>
    );
}

/** 受控确认弹窗的简易状态钩子 */
export function useConfirm() {
    const [state, setState] = useState<ConfirmState | null>(null);
    const api = useMemo(
        () => ({
            open: (next: ConfirmState) => setState(next),
            close: () => setState(null),
        }),
        [],
    );
    return { confirmState: state, confirm: api.open, closeConfirm: api.close };
}

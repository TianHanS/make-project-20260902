/**
 * 国标 20 位编码分段录入控件
 *
 * 结构：中心编码 8 + 行业编码 2 + 类型编码 3 + 网络标识 1 + 序号 6
 * 目标：避免运维直接手敲 20 位长码出错。
 */
import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
    GB_SEGMENT_META,
    GbCodeSegments,
    joinGbCode,
    onlyDigits,
    splitGbCode,
} from '../data';
import { useClickOutside } from './ui';

export type SegmentKey = keyof GbCodeSegments;

export interface GbCodeInputProps {
    value: string;
    onChange: (code: string) => void;
    /** 各段可选的已录入候选值 */
    options?: Partial<Record<SegmentKey, string[]>>;
    /** 只读段（如行业编码继承国标设备） */
    readOnlyKeys?: SegmentKey[];
    /** 唯一性校验结果：null 表示未完成校验 */
    uniqueState?: 'ok' | 'taken' | null;
    disabled?: boolean;
}

/** 分段校验：返回每段的缺位提示 */
export function validateGbSegments(seg: GbCodeSegments): Partial<Record<SegmentKey, string>> {
    const errors: Partial<Record<SegmentKey, string>> = {};
    GB_SEGMENT_META.forEach((meta) => {
        const raw = seg[meta.key] || '';
        if (!raw.length) {
            errors[meta.key] = `${meta.label}未填写，需 ${meta.len} 位`;
            return;
        }
        if (raw.length < meta.len) {
            errors[meta.key] = `${meta.label}还缺 ${meta.len - raw.length} 位`;
            return;
        }
        if (meta.key === 'seq' && /^0+$/.test(raw)) {
            errors.seq = '序号不得为 000000';
        }
    });
    return errors;
}

export function isGbCodeComplete(code: string): boolean {
    return onlyDigits(code).length === 20 && !/^0+$/.test(splitGbCode(code).seq);
}

function SegmentBox({
    meta,
    value,
    invalid,
    readOnly,
    disabled,
    options,
    onChangeSegment,
    onFilled,
    onPrev,
    onPasteCode,
    onEnter,
    inputRef,
}: {
    meta: (typeof GB_SEGMENT_META)[number];
    value: string;
    invalid: boolean;
    readOnly: boolean;
    disabled: boolean;
    options: string[];
    onChangeSegment: (next: string) => void;
    onFilled: () => void;
    onPrev: () => void;
    onPasteCode: (digits: string) => void;
    onEnter: () => void;
    inputRef: (el: HTMLInputElement | null) => void;
}) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    useClickOutside(wrapRef, () => setOpen(false));

    return (
        <div className="vdm-seg" ref={wrapRef} style={{ flexGrow: meta.len }}>
            <span className="vdm-seg-label">
                {meta.label}
                <em>{meta.len}位</em>
            </span>
            <div className={`vdm-seg-box${invalid ? ' is-invalid' : ''}${readOnly || disabled ? ' is-readonly' : ''}`}>
                <input
                    ref={inputRef}
                    className="vdm-seg-input"
                    value={value}
                    readOnly={readOnly || disabled}
                    inputMode="numeric"
                    placeholder={'0'.repeat(meta.len)}
                    title={meta.hint}
                    onChange={(e) => {
                        if (readOnly || disabled) return;
                        const next = onlyDigits(e.target.value).slice(0, meta.len);
                        onChangeSegment(next);
                        if (next.length === meta.len) onFilled();
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !value) onPrev();
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            onEnter();
                        }
                    }}
                    onPaste={(e) => {
                        const digits = onlyDigits(e.clipboardData.getData('text'));
                        if (digits.length >= 20) {
                            e.preventDefault();
                            onPasteCode(digits.slice(0, 20));
                        }
                    }}
                />
                {options.length && !readOnly && !disabled ? (
                    <button
                        type="button"
                        className="vdm-seg-caret"
                        aria-label={`选择${meta.label}`}
                        onClick={() => setOpen((o) => !o)}
                    >
                        <ChevronDown size={12} />
                    </button>
                ) : null}
                {open ? (
                    <div className="vdm-seg-dropdown">
                        <div className="vdm-seg-dropdown-title">已录入的{meta.label}</div>
                        {options.map((opt) => (
                            <button
                                key={opt}
                                type="button"
                                className={`vdm-seg-option${opt === value ? ' is-active' : ''}`}
                                onClick={() => {
                                    onChangeSegment(opt);
                                    setOpen(false);
                                    onFilled();
                                }}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export function GbCodeInput({
    value,
    onChange,
    options = {},
    readOnlyKeys = [],
    uniqueState = null,
    disabled = false,
}: GbCodeInputProps) {
    const seg = splitGbCode(value);
    const [touched, setTouched] = useState(false);
    const refs = useRef<Record<string, HTMLInputElement | null>>({});
    const errors = validateGbSegments(seg);
    const full = joinGbCode(seg);
    const complete = full.length === 20;

    useEffect(() => {
        if (complete) setTouched(true);
    }, [complete]);

    const setSegment = (key: SegmentKey, next: string) => {
        onChange(joinGbCode({ ...seg, [key]: next }));
    };

    /** 序号左补零到 6 位 */
    const padSeq = () => {
        const padded = padSeqOnBlur(value);
        if (padded !== value) onChange(padded);
    };

    /** 完成输入：补齐序号并收起焦点，无需再点其它字段 */
    const commit = () => {
        setTouched(true);
        padSeq();
        (document.activeElement as HTMLElement | null)?.blur();
    };
    const commitEnabled = !disabled && !!seg.seq;

    const focusByIndex = (index: number) => {
        const meta = GB_SEGMENT_META[index];
        if (!meta) return;
        if (readOnlyKeys.includes(meta.key)) {
            focusByIndex(index + (index >= GB_SEGMENT_META.length - 1 ? -1 : 1));
            return;
        }
        const el = refs.current[meta.key];
        if (el) {
            el.focus();
            el.select();
        }
    };

    return (
        <div className="vdm-gbcode">
            <div
                className="vdm-gbcode-row"
                onBlur={(e) => {
                    setTouched(true);
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) padSeq();
                }}
            >
                {GB_SEGMENT_META.map((meta, index) => (
                    <React.Fragment key={meta.key}>
                        {index > 0 ? <span className="vdm-seg-divider">-</span> : null}
                        <SegmentBox
                            meta={meta}
                            value={seg[meta.key]}
                            invalid={touched && !!errors[meta.key]}
                            readOnly={readOnlyKeys.includes(meta.key)}
                            disabled={disabled}
                            options={options[meta.key] || []}
                            inputRef={(el) => {
                                refs.current[meta.key] = el;
                            }}
                            onChangeSegment={(next) => setSegment(meta.key, next)}
                            onFilled={() => focusByIndex(index + 1)}
                            onPrev={() => focusByIndex(index - 1)}
                            onEnter={commit}
                            onPasteCode={(digits) => {
                                onChange(digits);
                                setTouched(true);
                            }}
                        />
                    </React.Fragment>
                ))}
                <button
                    type="button"
                    className={`vdm-seg-done${complete ? ' is-done' : ''}`}
                    disabled={!commitEnabled}
                    title={complete ? '编码已填满 20 位' : '完成输入：序号自动补足 6 位'}
                    aria-label="完成编码输入"
                    onClick={commit}
                >
                    <Check size={14} />
                </button>
            </div>

            <div className="vdm-gbcode-foot">
                <div className="vdm-gbcode-full">
                    <span>完整通道号</span>
                    <strong className={complete ? '' : 'is-partial'}>{full || '—'}</strong>
                    <em>{full.length}/20</em>
                </div>
            </div>

            {touched && Object.keys(errors).length ? (
                <ul className="vdm-gbcode-errors">
                    {GB_SEGMENT_META.filter((meta) => errors[meta.key]).map((meta) => (
                        <li key={meta.key}>{errors[meta.key]}</li>
                    ))}
                </ul>
            ) : null}

            {complete && !Object.keys(errors).length && uniqueState ? (
                <p className={`vdm-gbcode-unique is-${uniqueState}`}>
                    {uniqueState === 'ok' ? '校验通过：该通道号在平台内唯一' : '该通道号已被其他摄像头占用，请更换序号'}
                </p>
            ) : null}
        </div>
    );
}

/** 序号失焦时按 6 位左补零 */
export function padSeqOnBlur(code: string): string {
    const seg = splitGbCode(code);
    if (!seg.seq || seg.seq.length === 6) return code;
    return joinGbCode({ ...seg, seq: seg.seq.padStart(6, '0') });
}

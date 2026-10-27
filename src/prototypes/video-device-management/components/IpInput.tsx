/**
 * IP / IP+端口 分段录入控件
 *
 * - IP：四段，纯数字，段满或输入「.」自动跳下一段
 * - 地址：四段 IP + 端口，共五段
 */
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { onlyDigits } from '../data';

function parseValue(value: string, withPort: boolean): string[] {
    const raw = String(value || '').trim();
    const [ipPart = '', portPart = ''] = raw.split(':');
    const ipSegments = ipPart ? ipPart.split('.') : [];
    const segments = [0, 1, 2, 3].map((index) => onlyDigits(ipSegments[index] || ''));
    return withPort ? [...segments, onlyDigits(portPart)] : segments;
}

function joinValue(segments: string[], withPort: boolean): string {
    const ip = segments.slice(0, 4);
    const hasIp = ip.some((part) => part.length > 0);
    const ipText = hasIp ? ip.join('.') : '';
    if (!withPort) return ipText;
    const port = segments[4] || '';
    if (!ipText && !port) return '';
    return port ? `${ipText}:${port}` : ipText;
}

export function isValidIpSegment(part: string): boolean {
    if (!part.length) return false;
    const num = Number(part);
    return Number.isInteger(num) && num >= 0 && num <= 255;
}

export function isValidIp(value: string): boolean {
    const segments = parseValue(value, false);
    return segments.every(isValidIpSegment);
}

export function isValidAddress(value: string): boolean {
    const segments = parseValue(value, true);
    if (!segments.slice(0, 4).every(isValidIpSegment)) return false;
    const port = Number(segments[4]);
    return Number.isInteger(port) && port > 0 && port <= 65535;
}

export function IpInput({
    value,
    onChange,
    withPort = false,
    invalid = false,
    disabled = false,
    placeholderHint,
    options,
    onPick,
}: {
    value: string;
    onChange: (next: string) => void;
    withPort?: boolean;
    invalid?: boolean;
    disabled?: boolean;
    placeholderHint?: string;
    /** 已录入的 IP 候选，唯一不重复 */
    options?: Array<{ value: string; desc?: string }>;
    /** 从候选中选中，用于带出端口与账号密码 */
    onPick?: (next: string) => void;
}) {
    const segments = parseValue(value, withPort);
    const refs = useRef<Array<HTMLInputElement | null>>([]);
    const count = withPort ? 5 : 4;
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDocDown = (event: MouseEvent) => {
            if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDocDown);
        return () => document.removeEventListener('mousedown', onDocDown);
    }, [open]);

    const focusAt = (index: number) => {
        const el = refs.current[index];
        if (el) {
            el.focus();
            el.select();
        }
    };

    const setSegment = (index: number, next: string) => {
        const nextSegments = segments.slice();
        nextSegments[index] = next;
        onChange(joinValue(nextSegments, withPort));
    };

    const isPortIndex = (index: number) => withPort && index === 4;

    return (
        <div
            className={`vdm-ip${invalid ? ' is-invalid' : ''}${disabled ? ' is-disabled' : ''}${options ? ' has-options' : ''}${open ? ' is-open' : ''}`}
            ref={wrapRef}
        >
            {Array.from({ length: count }).map((_, index) => {
                const maxLen = isPortIndex(index) ? 5 : 3;
                const segInvalid =
                    !disabled &&
                    segments[index].length > 0 &&
                    (isPortIndex(index) ? Number(segments[index]) > 65535 : !isValidIpSegment(segments[index]));
                return (
                    <React.Fragment key={index}>
                        {index > 0 ? (
                            <span className="vdm-ip-dot">{isPortIndex(index) ? ':' : '.'}</span>
                        ) : null}
                        <input
                            ref={(el) => {
                                refs.current[index] = el;
                            }}
                            className={`vdm-ip-seg${isPortIndex(index) ? ' is-port' : ''}${segInvalid ? ' is-invalid' : ''}`}
                            value={segments[index]}
                            disabled={disabled}
                            inputMode="numeric"
                            placeholder={isPortIndex(index) ? '端口' : '0'}
                            onChange={(e) => {
                                const next = onlyDigits(e.target.value).slice(0, maxLen);
                                setSegment(index, next);
                                if (!isPortIndex(index) && next.length === maxLen) focusAt(index + 1);
                            }}
                            onKeyDown={(e) => {
                                if ((e.key === '.' || e.key === ':') && !isPortIndex(index)) {
                                    e.preventDefault();
                                    focusAt(index + 1);
                                }
                                if (e.key === 'Backspace' && !segments[index] && index > 0) focusAt(index - 1);
                            }}
                            onPaste={(e) => {
                                const text = e.clipboardData.getData('text').trim();
                                if (/[.:]/.test(text)) {
                                    e.preventDefault();
                                    const pasted = parseValue(text, withPort);
                                    onChange(joinValue(pasted, withPort));
                                }
                            }}
                        />
                    </React.Fragment>
                );
            })}
            {options ? (
                <>
                    <button
                        type="button"
                        className="vdm-ip-toggle"
                        aria-label="选择已录入的 IP"
                        disabled={disabled}
                        onClick={() => setOpen((o) => !o)}
                    >
                        <ChevronDown size={14} />
                    </button>
                    {open ? (
                        <div className="vdm-select-dropdown vdm-ip-dropdown">
                            {options.length ? (
                                options.map((item) => (
                                    <button
                                        key={item.value}
                                        type="button"
                                        className={`vdm-select-option${item.value === value ? ' is-active' : ''}`}
                                        onClick={() => {
                                            (onPick || onChange)(item.value);
                                            setOpen(false);
                                        }}
                                    >
                                        <span>{item.value}</span>
                                        {item.desc ? <em>{item.desc}</em> : null}
                                    </button>
                                ))
                            ) : (
                                <div className="vdm-select-empty">暂无已录入的 IP，可直接输入</div>
                            )}
                        </div>
                    ) : null}
                </>
            ) : null}
            {placeholderHint ? <span className="vdm-ip-hint">{placeholderHint}</span> : null}
        </div>
    );
}

/**
 * 极简 XLSX 生成（无第三方依赖）
 *
 * 只覆盖「一个工作表 + 纯文本单元格」的导出场景：模板下载与异常数据下载。
 * 采用 ZIP store（不压缩）方式打包 OOXML 部件，Excel / WPS 可直接打开。
 */

const encoder = new TextEncoder();

let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
    if (crcTable) return crcTable;
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
        let c = i;
        for (let k = 0; k < 8; k += 1) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[i] = c >>> 0;
    }
    crcTable = table;
    return table;
}

function crc32(bytes: Uint8Array): number {
    const table = getCrcTable();
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) {
        crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/** 0 -> A, 25 -> Z, 26 -> AA */
function columnName(index: number): string {
    let rest = index;
    let name = '';
    do {
        name = String.fromCharCode(65 + (rest % 26)) + name;
        rest = Math.floor(rest / 26) - 1;
    } while (rest >= 0);
    return name;
}

interface ZipEntry {
    name: string;
    bytes: Uint8Array;
}

function buildZip(entries: ZipEntry[]): Blob {
    const chunks: Uint8Array[] = [];
    const central: Uint8Array[] = [];
    let offset = 0;

    // 固定 DOS 时间戳，避免导出文件因时间不同产生噪声差异
    const dosTime = 0;
    const dosDate = (2026 - 1980) << 9 | (1 << 5) | 1;

    entries.forEach((entry) => {
        const nameBytes = encoder.encode(entry.name);
        const crc = crc32(entry.bytes);
        const size = entry.bytes.length;

        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034b50, true);
        local.setUint16(4, 20, true);
        local.setUint16(6, 0x0800, true); // UTF-8 文件名
        local.setUint16(8, 0, true); // store
        local.setUint16(10, dosTime, true);
        local.setUint16(12, dosDate, true);
        local.setUint32(14, crc, true);
        local.setUint32(18, size, true);
        local.setUint32(22, size, true);
        local.setUint16(26, nameBytes.length, true);
        local.setUint16(28, 0, true);

        chunks.push(new Uint8Array(local.buffer), nameBytes, entry.bytes);

        const dir = new DataView(new ArrayBuffer(46));
        dir.setUint32(0, 0x02014b50, true);
        dir.setUint16(4, 20, true);
        dir.setUint16(6, 20, true);
        dir.setUint16(8, 0x0800, true);
        dir.setUint16(10, 0, true);
        dir.setUint16(12, dosTime, true);
        dir.setUint16(14, dosDate, true);
        dir.setUint32(16, crc, true);
        dir.setUint32(20, size, true);
        dir.setUint32(24, size, true);
        dir.setUint16(28, nameBytes.length, true);
        dir.setUint16(30, 0, true);
        dir.setUint16(32, 0, true);
        dir.setUint16(34, 0, true);
        dir.setUint16(36, 0, true);
        dir.setUint32(38, 0, true);
        dir.setUint32(42, offset, true);

        central.push(new Uint8Array(dir.buffer), nameBytes);
        offset += 30 + nameBytes.length + size;
    });

    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);

    const parts = [...chunks, ...central, new Uint8Array(end.buffer)];
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const merged = new Uint8Array(total);
    let cursor = 0;
    parts.forEach((part) => {
        merged.set(part, cursor);
        cursor += part.length;
    });

    return new Blob([merged.buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
}

function sheetXml(rows: string[][], colWidths?: number[]): string {
    const cols = colWidths?.length
        ? `<cols>${colWidths
              .map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`)
              .join('')}</cols>`
        : '';
    const body = rows
        .map((row, rowIndex) => {
            const cells = row
                .map((value, colIndex) => {
                    const text = value == null ? '' : String(value);
                    if (!text) return '';
                    return `<c r="${columnName(colIndex)}${rowIndex + 1}" t="inlineStr" s="0"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
                })
                .join('');
            return `<row r="${rowIndex + 1}">${cells}</row>`;
        })
        .join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${body}</sheetData></worksheet>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

// 单一单元格样式：自动换行 + 顶端对齐，便于显示模板注意事项
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="宋体"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="常规" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

function workbookXml(sheetName: string): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

/** 生成单表 xlsx 并触发浏览器下载 */
export function downloadXlsx(
    fileName: string,
    rows: string[][],
    options?: { sheetName?: string; colWidths?: number[] },
) {
    const blob = buildZip([
        { name: '[Content_Types].xml', bytes: encoder.encode(CONTENT_TYPES) },
        { name: '_rels/.rels', bytes: encoder.encode(ROOT_RELS) },
        { name: 'xl/workbook.xml', bytes: encoder.encode(workbookXml(options?.sheetName || 'Sheet1')) },
        { name: 'xl/_rels/workbook.xml.rels', bytes: encoder.encode(WORKBOOK_RELS) },
        { name: 'xl/styles.xml', bytes: encoder.encode(STYLES) },
        {
            name: 'xl/worksheets/sheet1.xml',
            bytes: encoder.encode(sheetXml(rows, options?.colWidths)),
        },
    ]);

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

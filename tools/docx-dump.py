"""按关键字定位 docx 段落区间并输出纯文本，供需求文档改写时核对上下文。"""
import sys
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph


def iter_blocks(doc):
    body = doc.element.body
    for child in body.iterchildren():
        if child.tag.endswith('}p'):
            yield Paragraph(child, doc)
        elif child.tag.endswith('}tbl'):
            yield Table(child, doc)


def block_text(block):
    if isinstance(block, Paragraph):
        return block.style.name, block.text
    rows = []
    for row in block.rows:
        rows.append(' | '.join(c.text.replace('\n', ' ') for c in row.cells))
    return 'TABLE', '\n'.join(rows)


def main():
    path = sys.argv[1]
    start_kw = sys.argv[2]
    end_kw = sys.argv[3] if len(sys.argv) > 3 else None
    doc = Document(path)
    blocks = list(iter_blocks(doc))
    start = None
    for i, b in enumerate(blocks):
        style, text = block_text(b)
        if start_kw in text:
            start = i
            break
    if start is None:
        print('NOT FOUND:', start_kw)
        return
    end = len(blocks)
    if end_kw:
        for j in range(start + 1, len(blocks)):
            style, text = block_text(blocks[j])
            if end_kw in text:
                end = j + 1
                break
    for k in range(start, end):
        style, text = block_text(blocks[k])
        print(f'[{k}] <{style}> {text}')


if __name__ == '__main__':
    main()

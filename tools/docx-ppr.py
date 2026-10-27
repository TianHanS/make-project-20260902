"""输出指定 body 子元素区间的段落样式与 pPr XML，用于新增段落时复用原有编号/缩进。"""
import sys
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph


def main():
    path, start, end = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    doc = Document(path)
    body = doc.element.body
    children = list(body.iterchildren())
    for i in range(start, min(end, len(children))):
        el = children[i]
        if el.tag.endswith('}p'):
            p = Paragraph(el, doc)
            ppr = p._p.pPr
            print(f'--- [{i}] style={p.style.name!r} text={p.text[:40]!r}')
            print(ppr.xml.strip() if ppr is not None else '(no pPr)')
        elif el.tag.endswith('}tbl'):
            t = Table(el, doc)
            print(f'--- [{i}] TABLE style={t.style.name!r} rows={len(t.rows)} cols={len(t.columns)}')
            print(t._tbl.tblPr.xml.strip())
        else:
            print(f'--- [{i}] {el.tag}')


if __name__ == '__main__':
    main()

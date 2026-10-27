"""紧凑输出段落的 pStyle / numId / ilvl / ind，便于复用列表层级。"""
import sys
from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph


def main():
    path, start, end = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    doc = Document(path)
    children = list(doc.element.body.iterchildren())
    for i in range(start, min(end, len(children))):
        el = children[i]
        if el.tag.endswith('}tbl'):
            t = Table(el, doc)
            print(f'[{i}] TABLE style={t.style.name!r} rows={len(t.rows)} cols={len(t.columns)}')
            continue
        if not el.tag.endswith('}p'):
            print(f'[{i}] {el.tag}')
            continue
        p = Paragraph(el, doc)
        ppr = el.find(qn('w:pPr'))
        style = pstyle = numid = ilvl = ind = None
        if ppr is not None:
            ps = ppr.find(qn('w:pStyle'))
            pstyle = ps.get(qn('w:val')) if ps is not None else None
            numpr = ppr.find(qn('w:numPr'))
            if numpr is not None:
                n = numpr.find(qn('w:numId'))
                l = numpr.find(qn('w:ilvl'))
                numid = n.get(qn('w:val')) if n is not None else None
                ilvl = l.get(qn('w:val')) if l is not None else None
            i2 = ppr.find(qn('w:ind'))
            if i2 is not None:
                ind = dict((k.split('}')[1], v) for k, v in i2.attrib.items())
        print(f'[{i}] style={p.style.name!r} pStyle={pstyle} numId={numid} ilvl={ilvl} ind={ind} text={p.text[:42]!r}')


if __name__ == '__main__':
    main()

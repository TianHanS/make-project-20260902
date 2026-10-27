"""输出指定 body 索引处表格的 tblPr / tblGrid 与前两行 XML，用于复用表格格式。"""
import sys
from docx import Document
from docx.oxml.ns import qn

path, idx = sys.argv[1], int(sys.argv[2])
doc = Document(path)
el = list(doc.element.body.iterchildren())[idx]
assert el.tag.endswith('}tbl'), el.tag
print('--- tblPr ---')
print(el.find(qn('w:tblPr')).xml)
print('--- tblGrid ---')
print(el.find(qn('w:tblGrid')).xml)
rows = el.findall(qn('w:tr'))
print('--- rows:', len(rows))
for r in rows[:2]:
    print(r.xml[:4000])
    print('=====')

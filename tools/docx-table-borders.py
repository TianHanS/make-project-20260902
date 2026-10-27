"""对比表格各行首个单元格的边框设置，判断能否直接克隆行作为模板。"""
import re
import sys
from docx import Document
from docx.oxml.ns import qn

path, idx = sys.argv[1], int(sys.argv[2])
doc = Document(path)
el = list(doc.element.body.iterchildren())[idx]
rows = el.findall(qn('w:tr'))
for i in (0, 1, 2, len(rows) - 1):
    tr = rows[i]
    tc = tr.findall(qn('w:tc'))[0]
    tcpr = tc.find(qn('w:tcPr'))
    xml = re.sub(r'xmlns:[a-zA-Z0-9]+="[^"]*"', '', tcpr.xml).replace('w:', '')
    xml = re.sub(r'\s+', ' ', xml)
    texts = [' / '.join(p.text for p in c.findall(qn('w:p'))) for c in tr.findall(qn('w:tc'))]
    print(f'row {i}: {texts}')
    print('   ', xml)

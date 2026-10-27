"""查看指定 numId 对应的多级编号定义（各 ilvl 的编号格式与文本）。"""
import sys
from docx import Document
from docx.oxml.ns import qn


def main():
    path = sys.argv[1]
    want = set(sys.argv[2:])
    doc = Document(path)
    numbering = doc.part.numbering_part.element
    num_map = {}
    for num in numbering.findall(qn('w:num')):
        nid = num.get(qn('w:numId'))
        aid = num.find(qn('w:abstractNumId')).get(qn('w:val'))
        num_map[nid] = aid
    abstracts = {}
    for a in numbering.findall(qn('w:abstractNum')):
        abstracts[a.get(qn('w:abstractNumId'))] = a
    for nid in sorted(want, key=int):
        aid = num_map.get(nid)
        print(f'numId={nid} -> abstractNumId={aid}')
        a = abstracts.get(aid)
        if a is None:
            print('  (missing abstractNum)')
            continue
        for lvl in a.findall(qn('w:lvl')):
            ilvl = lvl.get(qn('w:ilvl'))
            fmt = lvl.find(qn('w:numFmt'))
            txt = lvl.find(qn('w:lvlText'))
            start = lvl.find(qn('w:start'))
            restart = lvl.find(qn('w:lvlRestart'))
            print(
                f"  ilvl={ilvl} fmt={fmt.get(qn('w:val')) if fmt is not None else None}"
                f" text={txt.get(qn('w:val')) if txt is not None else None}"
                f" start={start.get(qn('w:val')) if start is not None else None}"
                f" restart={restart.get(qn('w:val')) if restart is not None else None}"
            )


if __name__ == '__main__':
    main()

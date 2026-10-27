"""把原型主规格 HTML 的指定页面转成纯文本，便于核对需求事实。"""
import html
import re
import sys

path = sys.argv[1]
pages = sys.argv[2:] or ['overview', 'pages', 'params', 'interaction', 'design']
src = open(path, encoding='utf-8').read()

for page in pages:
    m = re.search(r'<article class="spec-page" data-spec-page="%s"[^>]*>(.*?)</article>' % page, src, re.S)
    if not m:
        print('MISSING', page)
        continue
    t = m.group(1)
    t = re.sub(r'<(script|style).*?</\1>', '', t, flags=re.S)
    t = re.sub(r'</t[dh]>', ' | ', t)
    t = re.sub(r'</tr>', '\n', t)
    t = re.sub(r'<li>', '- ', t)
    t = re.sub(r'</(li|p|h1|h2|h3|div|section|ul|table)>', '\n', t)
    t = re.sub(r'<[^>]+>', '', t)
    t = html.unescape(t)
    t = re.sub(r'[ \t]*\n[ \t]*', '\n', t)
    t = re.sub(r'\n{2,}', '\n', t)
    print('==== PAGE %s ====' % page)
    print(t.strip())

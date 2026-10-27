# -*- coding: utf-8 -*-
"""
按当前 auto-entry-config-form 原型与主规格，重写
UR 8.1.10自动化配置-自动计量 章节正文。

保留 Heading 4 标题；删除其后至 UR8.2 之前的全部内容；
按原文风格插入【场景】【业务规约】【验收】【非功能】及列表/表格。
"""
from __future__ import annotations

import copy
import sys
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

SRC = Path(
    r"D:\03工作-DATANG\1、智慧燃料集控平台\17、集控V4.0\03需求"
    r"\DTXY_RDM003 智慧燃料集控平台软件需求说明书.docx"
)


def body_children(doc):
    return list(doc.element.body.iterchildren())


def find_heading(children, text):
    for i, el in enumerate(children):
        if not el.tag.endswith("}p"):
            continue
        p = Paragraph(el, None)
        if p.text.strip() == text:
            return i
    raise SystemExit(f"heading not found: {text}")


def clone_pPr(template_el):
    pPr = template_el.find(qn("w:pPr"))
    return copy.deepcopy(pPr) if pPr is not None else None


def set_num(pPr, num_id: int, ilvl: int):
    """在已有 pPr 上写入/覆盖 numPr。"""
    numPr = pPr.find(qn("w:numPr"))
    if numPr is None:
        numPr = pPr.makeelement(qn("w:numPr"), {})
        # 插到 pStyle 之后
        style = pPr.find(qn("w:pStyle"))
        if style is not None:
            style.addnext(numPr)
        else:
            pPr.insert(0, numPr)
    else:
        for child in list(numPr):
            numPr.remove(child)

    ilvl_el = numPr.makeelement(qn("w:ilvl"), {qn("w:val"): str(ilvl)})
    nid_el = numPr.makeelement(qn("w:numId"), {qn("w:val"): str(num_id)})
    numPr.append(ilvl_el)
    numPr.append(nid_el)


def set_ind(pPr, left: int, hanging: int = 360):
    ind = pPr.find(qn("w:ind"))
    if ind is None:
        ind = pPr.makeelement(qn("w:ind"), {})
        pPr.append(ind)
    ind.set(qn("w:left"), str(left))
    ind.set(qn("w:leftChars"), "0")
    ind.set(qn("w:hanging"), str(hanging))
    ind.set(qn("w:firstLineChars"), "0")
    if qn("w:firstLine") in ind.attrib:
        del ind.attrib[qn("w:firstLine")]


def make_run(text: str, size: str | None = None):
    """构造带东亚字体提示的 run。"""
    from lxml import etree

    r = etree.Element(qn("w:r"))
    rPr = etree.SubElement(r, qn("w:rPr"))
    rFonts = etree.SubElement(rPr, qn("w:rFonts"))
    rFonts.set(qn("w:hint"), "eastAsia")
    if size:
        sz = etree.SubElement(rPr, qn("w:sz"))
        sz.set(qn("w:val"), size)
        szCs = etree.SubElement(rPr, qn("w:szCs"))
        szCs.set(qn("w:val"), size)
    t = etree.SubElement(r, qn("w:t"))
    t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    t.text = text
    return r


def make_paragraph(template_el, text: str, *, num_id: int | None = None, ilvl: int = 0, left: int | None = None):
    """基于模板段落克隆结构并写入文本。"""
    p = copy.deepcopy(template_el)
    # 清掉旧 runs / bookmark 等，保留 pPr
    for child in list(p):
        if child.tag != qn("w:pPr"):
            p.remove(child)
    pPr = p.find(qn("w:pPr"))
    if pPr is None:
        from lxml import etree

        pPr = etree.SubElement(p, qn("w:pPr"))
    if num_id is not None:
        set_num(pPr, num_id, ilvl)
        if left is not None:
            set_ind(pPr, left)
    else:
        # 去掉编号
        numPr = pPr.find(qn("w:numPr"))
        if numPr is not None:
            pPr.remove(numPr)
    p.append(make_run(text))
    return p


def clear_cell_paras(tc):
    for child in list(tc):
        if child.tag == qn("w:p"):
            tc.remove(child)


def set_cell_text(tc, text: str, *, header: bool = False):
    """用表格模板里第一个段落的 pPr 写单元格文本。"""
    clear_cell_paras(tc)
    from lxml import etree

    # 从 tcPr 后追加段落
    p = etree.Element(qn("w:p"))
    pPr = etree.SubElement(p, qn("w:pPr"))
    # 简化单元格段落属性
    spacing = etree.SubElement(pPr, qn("w:spacing"))
    spacing.set(qn("w:before"), "0")
    spacing.set(qn("w:after"), "0")
    spacing.set(qn("w:beforeAutospacing"), "0")
    spacing.set(qn("w:afterAutospacing"), "0")
    jc = etree.SubElement(pPr, qn("w:jc"))
    jc.set(qn("w:val"), "left")
    rPr = etree.SubElement(pPr, qn("w:rPr"))
    rFonts = etree.SubElement(rPr, qn("w:rFonts"))
    rFonts.set(qn("w:hint"), "eastAsia")
    rFonts.set(qn("w:ascii"), "微软雅黑")
    rFonts.set(qn("w:hAnsi"), "微软雅黑")
    rFonts.set(qn("w:eastAsia"), "微软雅黑")
    rFonts.set(qn("w:cs"), "微软雅黑")
    sz = etree.SubElement(rPr, qn("w:sz"))
    sz.set(qn("w:val"), "16")
    szCs = etree.SubElement(rPr, qn("w:szCs"))
    szCs.set(qn("w:val"), "16")

    # 表头加粗
    if header:
        b = etree.SubElement(rPr, qn("w:b"))
        b.set(qn("w:val"), "1")

    p.append(make_run(text, size="16"))
    tc.append(p)


def set_cell_bottom_border(tc, on: bool):
    tcPr = tc.find(qn("w:tcPr"))
    if tcPr is None:
        return
    borders = tcPr.find(qn("w:tcBorders"))
    if borders is None:
        return
    bottom = borders.find(qn("w:bottom"))
    if bottom is None:
        bottom = borders.makeelement(qn("w:bottom"), {})
        borders.append(bottom)
    if on:
        bottom.set(qn("w:val"), "single")
        bottom.set(qn("w:color"), "000000")
        bottom.set(qn("w:sz"), "4")
        bottom.set(qn("w:space"), "0")
    else:
        bottom.set(qn("w:val"), "nil")


def set_cell_shd(tc, fill: str | None):
    tcPr = tc.find(qn("w:tcPr"))
    if tcPr is None:
        return
    shd = tcPr.find(qn("w:shd"))
    if shd is None:
        shd = tcPr.makeelement(qn("w:shd"), {})
        tcPr.append(shd)
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    if fill:
        shd.set(qn("w:fill"), fill)
        shd.set(qn("w:themeFill"), "accent1")
        shd.set(qn("w:themeFillTint"), "66")
    else:
        shd.set(qn("w:fill"), "auto")
        for attr in (qn("w:themeFill"), qn("w:themeFillTint")):
            if attr in shd.attrib:
                del shd.attrib[attr]


def rebuild_table(table_el, rows_data: list[tuple[str, str, str]]):
    """清空并按 rows_data 重建表格行；第一行视为表头。"""
    existing = table_el.findall(qn("w:tr"))
    if not existing:
        raise SystemExit("table has no rows")
    header_tpl = existing[0]
    body_tpl = existing[1] if len(existing) > 1 else existing[0]
    # 删掉旧行
    for tr in existing:
        table_el.remove(tr)

    for i, (c0, c1, c2) in enumerate(rows_data):
        is_header = i == 0
        is_last = i == len(rows_data) - 1
        # 分组标题行：第 1 列非空且非首行 → 用表头底色
        is_group = (not is_header) and bool(c0.strip())
        tr = copy.deepcopy(header_tpl if (is_header or is_group) else body_tpl)
        cells = tr.findall(qn("w:tc"))
        texts = [c0, c1, c2]
        for j, tc in enumerate(cells[:3]):
            set_cell_text(tc, texts[j], header=is_header or (is_group and j == 0))
            set_cell_bottom_border(tc, is_last)
            if is_header or (is_group and j == 0):
                set_cell_shd(tc, "B4C6E7")
            else:
                set_cell_shd(tc, None)
        table_el.append(tr)
    return table_el


# ---------------------------------------------------------------------------
# 正文内容（以原型 / 主规格为准）
# ---------------------------------------------------------------------------

STORY = (
    "现场实施人员，根据汽车计量模块（模块类型 WBM）现场实际设备布置与计量业务要求，"
    "在自动化配置中完成无人值守计量流程配置：先配置设备布局及计量要求，系统按规则自动编排执行流程与默认参数，"
    "再对流程编排做微调，最后在高级参数中确认各子流程阈值、文案、消息通知及非流程参数。"
)

FLOW_LINES = [
    "设备布局及计量要求（基础配置）",
    "        ↓ 保存并重新设定，按规则自动编排",
    "执行流程（计量前 / 计量中 / 计量完成）+ 步骤顺序",
    "        ↓",
    "高级参数配置（子流程参数、消息通知、非流程参数）",
]

# (text, num_id, ilvl, left)  left 为 None 时沿用模板缩进
# num_id: 140 一级 1. 2.；142/143/144/145 二级 1) 2)；142 ilvl=1 为 a. b.
L0 = (140, 0, 780)
L1 = (142, 0, 1200)  # 设备布局下的二级
L1b = (142, 1, 1620)  # 三级 a.
L2 = (143, 0, 1200)  # 流程编排二级
L3 = (144, 0, 1200)  # 高级参数二级
L4 = (145, 0, 1200)  # 非流程二级
L1c = (141, 0, 1200)  # 功能包括下的二级（圆点/另序）

BUSINESS: list[tuple] = [
    ("无人值守计量流程配置：模块类型 WBM 汽车计量；", *L0),
    ("可用操作：流程配置、控制设置（控制设置为占位，本期不展开真实控制面板）；流程是否已维护通过「流程配置」按钮状态表达，未维护显示小红点；", *L0),
    ("流程配置入口：点击「流程配置」打开右侧抽屉；抽屉内三个 Tab 依次为「设备布局及计量要求」「流程编排」「高级参数配置」；打开抽屉一律默认落在「设备布局及计量要求」Tab（无论是否已配置）；未完成「保存并重新设定」生成执行流程前，后两个 Tab 置灰不可进入；", *L0),
    ("流程配置功能包括：", *L0),
    ("快速配置：设备布局及计量要求配置（即基础配置）；", *L1c),
    ("配置功能：设备布局及计量要求、流程编排、高级参数配置；无独立「基础参数」Tab；", *L1c),
    ("抽屉底栏为唯一一级操作区：设备布局及计量要求 Tab 上为「关闭 / 保存 / 保存并重新设定」；流程编排、高级参数配置 Tab 上为「关闭 / 保存」；Tab 内容区内不再单独放置操作行；", *L0),
    # ---- 设备布局 ----
    ("设备布局及计量要求配置表单：用户通过此表单配置模块下各设备安装位置与场景业务要求，同模块内同一设备不可重复关联；可不关联；表单约束如下：", *L0),
    ("页面提示：设备布局及计量要求即基础配置。点击「保存并重新设定」将按最新要求重新匹配执行流程及参数；仅「保存」则只保存布局与场景，不改动已有流程编排；", *L1),
    ("具体表单参数约束：", *L1),
    ("__TABLE__",),
    ("保存并重新设定：二次确认「是否确认配置？」；确认后根据配置加载编排流程及参数配置，并提示「已按最新要求重新匹配执行流程与参数」，随后进入「流程编排」Tab；", *L1),
    ("确认后进入流程编排 Tab 页面；", *L1b),
    ("保存：仅保存设备布局及计量要求内容，不会重新编排流程，也不改动已有高级参数；保存成功提示「已保存设备布局及计量要求（未改动流程与参数）」；", *L1),
    ("保存后停留在本 Tab；", *L1b),
    ("本 Tab 存在未保存改动时，禁止切换至其他 Tab，提示「需保存已改动参数」；", *L1),
    # ---- 流程编排 ----
    ("流程编排：", *L0),
    ("子流程库：根据衡器类型、上磅流程、单向过磅及场景业务要求，按规则加载默认执行流程；子流程信息及参数口径见共享文档「自动化配置项管理」https://www.kdocs.cn/l/cqxX0gNCNX0n；", *L2),
    ("子流程库：可选子流程属性包括流程名称、分类、流程说明；按固定默认排序展示；", *L2),
    ("子流程库：分类筛选为「计量子流程」「设备控制」复选（可同时勾选）；同类型子流程允许重复加入执行流程；", *L2),
    ("子流程库不含「车辆停放位置核验」与「异常放行控制」：前者相关参数（红外对射次数/间隔、前后限位提示等）在「非流程参数配置」中维护；后者与非流程「异常结束放行」重复，只保留非流程配置；", *L2),
    ("从子流程库添加：落入该子流程默认所属大类；带强制排序号的按号找位次（插到第一个更大号之前），无号的落该大类末尾；添加成功提示「已添加「XX」到「计量前 / 计量中 / 计量完成」」；", *L2),
    ("执行流程按「计量前 / 计量中 / 计量完成」三个大类分框展示，框头显示本类步数；设备控制类子流程不单独成框，「来车道闸控制」默认落计量前、「对向道闸控制」默认落计量完成；步序号全局连续（1…N），跨框累计；", *L2),
    ("强制归属父级分类（不可跨类）：车辆识别及核验、已上磅判断、车辆二次核验、车辆稳定（熄火）核验、司机下车核验、重量取值、计量超量程及处理、计量数据上传、磅单打印、车辆已下磅核验、设备复位，只能在本大类内调序；拖到其他大类时拒绝并提示「「XX」只能在「计量前 / 计量中 / 计量完成」内调整」；", *L2),
    ("可跨类子流程：空磅核验、计量抓拍、来车道闸控制、对向道闸控制，可拖拽至任意大类；", *L2),
    ("强制排序（类内不可逆序，中间可插入其他子流程）：计量前为 车辆识别及核验 1 → 已上磅判断 2 → 车辆稳定（熄火）核验 3；计量中为 重量取值 1 → 计量数据上传 2；带号卡片显示「顺序 N」；违规拖拽拒绝并提示「「A」需排在「B」之前」，且不改动执行流；", *L2),
    ("拖拽落位：落在某个子流程上＝插到它前面；落在框内空白处＝落到该大类末尾；框在拖入时高亮为放置目标；", *L2),
    ("必选子流程（含「计量抓拍」）在执行流程中不显示删除按钮，禁止删除；可选子流程点击删除即移除，并提示已移除；", *L2),
    ("变更标记：以上次保存（或上次重新匹配）的执行流程为基线，新增步骤标记「新增」，调序步骤标记「调序 · 原第 N 步」；标题旁汇总「新增 N 步 / 调序 M 步」，未保存时注「保存后生效」；", *L2),
    ("流程编排保存：保存最新执行流程；按最新编排重载对应子流程的默认参数配置，并提示用户已根据配置自动设定参数默认值；", *L2),
    ("当流程编排 Tab 下执行流程相对上次保存存在更新时，禁止切换 Tab，提示「流程编排存在更新，请先保存执行流程！」；", *L2),
    ("尚未完成设备布局及计量要求确认、未生成执行流程时，进入流程编排 / 高级参数配置被拒绝，提示「请先在「设备布局及计量要求」中保存并重新设定，生成执行流程」；", *L2),
    # ---- 高级参数 ----
    ("高级参数配置：配置已编排执行子流程对应的参数与消息通知；Tab 旁小图标悬停提示：如需改动更多流程信息、各环节消息通知内容，可调整对应参数以达到需要的流程效果；", *L0),
    ("左侧执行流程快捷导航：按计量前 / 计量中 / 计量完成分段，序号与流程编排一致，可点击定位至对应子流程配置块；", *L3),
    ("按子流程分块展示：流程序号、流程名称、流程说明、配置参数（0 至多个）、消息通知配置（0 至多组）；顶栏可勾选「仅显示配置参数」或「仅显示消息配置」（二者互斥）；", *L3),
    ("配置参数、消息默认值按自动化配置项（Excel）对应各子流程加载；消息通知支持广播 / LED 分通道启用与内容、占位符插入及「发送测试」；", *L3),
    ("流程编排重新匹配或保存后新增的子流程，在高级参数中标记待确认，提示用户对新增参数予以确认；", *L3),
    ("参数保存：提示保存结果；若仍有校验项未通过，提示「已保存草稿，但仍有校验项：…」；全部通过则提示「配置已保存」；", *L3),
    ("高级参数配置 — 非流程参数配置：", *L0),
    ("以二级抽屉打开，加载与具体子流程无绑定关系的参数，按默认值初始化，用户仅做更新编辑；单独保存，提示「非流程参数已更新」；", *L4),
    ("非流程参数卡片包括：车辆停放位置核验、异常结束放行、启动计量设定、退出计量设定、计量自动启停设定、全局设定、动态切换模式等；不含「自动卸煤」；", *L4),
    ("动态切换模式：「是否启用模式切换」（启用 / 不启用，默认不启用）与「支持模式」（多选重衡 / 轻衡 / 混用衡，默认重衡 + 轻衡）；启用后才展开支持模式及各切换道闸、LED、默认模式等参数；道闸参数按「切换重衡时 / 切换轻衡时 / 切换混用衡时」分块，仅显示已勾选支持模式对应的子块；「默认切换模式」可选项收敛为已勾选类型；", *L4),
    ("相关参数及约束见共享文档「自动化配置项管理」https://www.kdocs.cn/l/cqxX0gNCNX0n；", *L4),
    # ---- 业务 / 字段 / 异常 汇总口径 ----
    ("业务约束汇总：", *L0),
    # 395/396 为脚本运行时新建的编号实例，避免接到布局二级序号后面
    ("至少勾选一种计量车种，否则保存设备布局及计量要求失败，提示「请至少勾选一种计量车种」；", 395, 0, 1200),
    ("执行流程必须包含全部必选子流程（含计量抓拍）；缺少时保存校验提示「缺少必选子流程「XX」」；", 395, 0, 1200),
    ("尚未完成「保存并重新设定」生成流程时，整体校验提示「尚未完成设备布局及计量要求确认，请先生成流程」；", 395, 0, 1200),
    ("是否编排「磅单打印」子流程，由磅单打印多选勾选结果派生：任一打印项勾选则编排，全部不选则不编排；", 395, 0, 1200),
    ("异常处理汇总：", *L0),
    ("违规跨类拖拽、强制排序逆序：拒绝落位并给出明确提示，执行流保持不变；", 396, 0, 1200),
    ("未保存改动切 Tab、流程编排有未保存更新切 Tab、未生成流程进入后两 Tab：均拦截并提示对应文案；", 396, 0, 1200),
    ("设备下拉中已被其他槽位占用的设备置灰不可选；车牌识别器 / 读卡器未选设备时，主辅角色单选置灰；", 396, 0, 1200),
    ("本模块未关联摄像头时，抓拍摄像头选择禁用并提示「本模块未关联摄像头」；未勾选计量车种时，磅单打印区提示先勾选车种；", 396, 0, 1200),
]

TABLE_ROWS = [
    ("分组", "字段", "约束"),
    ("场景选择", "衡器类型", "单选必填。1、重衡；2、轻衡；3、混用衡；4、可切换衡。切换衡器类型时，按类型重置「是否单向过磅」默认值，并同步调整设备布局可见方向。"),
    ("", "上磅流程", "单选必填。1、先识别后上磅；2、先上磅后识别。影响默认执行流程编排（如是否包含空磅核验、来车道闸等）。"),
    ("设备布局", "是否单向过磅", "开关。重衡、轻衡默认开启；混用衡、可切换衡默认关闭。开启后：重衡仅加载进厂方向，轻衡仅加载出厂方向，另一方向设备关联清空；关闭后恢复双向并回填空侧默认设备（避开已占用设备）。"),
    ("", "进厂方向 / 出厂方向 · 道闸", "下拉单选，可清除（不关联）。选项为本模块下道闸设备；同模块已占用设备不可重复选择。"),
    ("", "进厂方向 / 出厂方向 · 车牌识别器（向外）", "下拉单选，可清除。选项为本模块车牌识别器；选定后可指定主设备 / 辅助设备（默认主设备）；未选设备时角色单选置灰。"),
    ("", "进厂方向 / 出厂方向 · 车牌识别器（向内）", "下拉单选，可清除。选定后可指定主辅角色（默认辅助设备）；未选设备时角色单选置灰。"),
    ("", "进厂方向 / 出厂方向 · 读卡器", "下拉单选，可清除。选定后可指定主辅角色（默认辅助设备）；未选设备时角色单选置灰。"),
    ("", "主辅识别说明", "选择主要识别设备；主设备异常时按辅助设备识别来车；主辅均正常时相互验证。不限制每个方向只能有一个主设备。混用衡以重车进厂方向作为「进厂方向」。"),
    ("场景业务要求", "计量车种", "多选必填。1、燃煤；2、物资；3、搬倒；4、生物质。默认勾选燃煤。至少勾选一种，否则保存失败。"),
    ("", "是否要求司机下车计量", "开关，默认否。开启后按模块是否配置下车光电信号自动匹配下车校验方式：有光电信号按光电方式加载，否则按司机体重判断加载；并影响是否编排「司机下车核验」子流程。"),
    ("", "是否启用车辆二次一致性校验", "开关。默认：进厂或出厂方向布置了向内车牌识别器或读卡器时启用，否则不启用；用户可改。影响是否编排「车辆二次核验」子流程。"),
    ("", "抓拍摄像头选择", "多选本模块关联的摄像头，可不选为空；无关联摄像头时控件禁用。是否编排「计量抓拍」：该子流程为必选，执行流程中恒含且不可删除。"),
    ("", "磅单打印", "按已勾选计量车种加载可选项（煤车 / 出厂物资 / 入厂物资 / 生物质磅单打印），多选、默认均不选；无独立「是否磅单打印」开关。取消某车种时清掉对应打印勾选。任一打印项勾选则派生编排「磅单打印」子流程。"),
]


def ensure_num_instance(doc, num_id: int, abstract_id: str):
    """若 numId 不存在，则新增一条指向指定 abstractNum 的编号实例（序号从 1 起）。"""
    numbering = doc.part.numbering_part.element
    for n in numbering.findall(qn("w:num")):
        if n.get(qn("w:numId")) == str(num_id):
            return
    from lxml import etree

    num = etree.Element(qn("w:num"))
    num.set(qn("w:numId"), str(num_id))
    abs_el = etree.SubElement(num, qn("w:abstractNumId"))
    abs_el.set(qn("w:val"), abstract_id)
    numbering.append(num)


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else SRC
    doc = Document(str(SRC))
    # 复用原 142 的 abstractNum（%1) 样式），新建独立实例避免序号串接
    ensure_num_instance(doc, 395, "187")
    ensure_num_instance(doc, 396, "187")
    children = body_children(doc)
    start = find_heading(children, "UR 8.1.10自动化配置-自动计量")
    end = find_heading(children, "UR8.2 点表配置")
    print(f"section range: {start} .. {end - 1} (exclusive end={end})")

    # 模板段落：Normal 首行缩进、List 一级、List 二级、空 list
    tpl_normal = children[1471]  # 【场景/用户故事】
    tpl_list0 = children[1481]  # numId 140
    tpl_list1 = children[1488]  # numId 142
    tpl_list1b = children[1493]  # numId 142 ilvl=1
    tpl_list1c = children[1485]  # numId 141
    tpl_list2 = children[1498]  # numId 143
    tpl_list3 = children[1508]  # numId 144
    tpl_list4 = children[1515]  # numId 145
    tpl_accept_label = children[1466]  # 【验收标准】 from previous section-ish; use 1456 area
    # 用本章后邻接的验收样式：从前一节取
    tpl_accept = None
    for i in range(1466, 1470):
        if Paragraph(children[i], doc).text.strip().startswith("【验收标准】"):
            tpl_accept = children[i]
            break
    if tpl_accept is None:
        tpl_accept = children[1456]
    tpl_accept_body = children[1457]
    tpl_nfr_label = children[1458]
    tpl_nfr_body = children[1459]
    table_el = children[1490]
    assert table_el.tag.endswith("}tbl")

    # 删除 start+1 .. end-1
    to_remove = children[start + 1 : end]
    for el in to_remove:
        doc.element.body.remove(el)

    # 在 end 标题前插入新内容（end 元素仍在 body 中）
    anchor = children[end]  # UR8.2 标题元素

    def insert_before(el):
        anchor.addprevious(el)

    # 【场景/用户故事】
    insert_before(make_paragraph(tpl_normal, "【场景/用户故事】"))
    insert_before(make_paragraph(tpl_normal, STORY))
    insert_before(make_paragraph(tpl_normal, ""))
    for line in FLOW_LINES:
        insert_before(make_paragraph(tpl_normal, line))
    insert_before(make_paragraph(tpl_normal, ""))
    insert_before(make_paragraph(tpl_normal, "【业务规约/业务过程】"))

    # 业务列表 + 表格
    new_table = copy.deepcopy(table_el)
    rebuild_table(new_table, TABLE_ROWS)

    for item in BUSINESS:
        if item[0] == "__TABLE__":
            insert_before(new_table)
            continue
        text, num_id, ilvl, left = item
        if num_id == 140:
            tpl = tpl_list0
        elif num_id == 141:
            tpl = tpl_list1c
        elif num_id == 142 and ilvl == 1:
            tpl = tpl_list1b
        elif num_id in (142, 395, 396):
            tpl = tpl_list1
        elif num_id == 143:
            tpl = tpl_list2
        elif num_id == 144:
            tpl = tpl_list3
        elif num_id == 145:
            tpl = tpl_list4
        else:
            tpl = tpl_list0
        insert_before(make_paragraph(tpl, text, num_id=num_id, ilvl=ilvl, left=left))

    # 【验收标准】
    insert_before(make_paragraph(tpl_accept, "【验收标准】"))
    insert_before(
        make_paragraph(
            tpl_accept_body,
            "\t1）满足业务规约：三 Tab 主流程、表单约束、强制归属/强制排序、保存与切 Tab 拦截、异常提示口径与本文一致。",
        )
    )
    insert_before(
        make_paragraph(
            tpl_accept_body,
            "\t2）空配置打开落在「设备布局及计量要求」；「保存并重新设定」后进入流程编排并可配置高级参数；仅「保存」留在布局 Tab 且不改流程。",
        )
    )
    insert_before(
        make_paragraph(
            tpl_accept_body,
            "\t3）执行流程三大类分框、全局连续编号、违规拖拽拒绝、必选步骤不可删，行为符合本文描述。",
        )
    )

    # 【特殊非功能性需求】
    insert_before(make_paragraph(tpl_nfr_label, "【特殊非功能性需求】"))
    insert_before(make_paragraph(tpl_nfr_body, "\t无"))

    doc.save(str(out))
    print(f"saved: {out}")


if __name__ == "__main__":
    main()

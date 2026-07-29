"""生成本地母乳喂养记录 App 的各页面截图，用于 README 文档。
用法：在已安装 playwright + chromium 的 python 环境中运行
  python screenshot.py
截图输出到 ./screenshots/
"""
import time, os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = "file:///" + os.path.join(HERE, "index.html").replace("\\", "/")
OUT = os.path.join(HERE, "screenshots")
os.makedirs(OUT, exist_ok=True)

now = time.time() * 1000
baby = {"name": "小汤圆", "sex": "F", "birth": "2026-04-15", "avatar": None}
sessions = [
    {"id": "s1", "side": "L", "start": int(now - 3600e3 * 3), "end": int(now - 3600e3 * 3 + 15 * 60e3), "updatedAt": int(now)},
    {"id": "s2", "side": "R", "start": int(now - 3600e3 * 2), "end": int(now - 3600e3 * 2 + 12 * 60e3), "updatedAt": int(now)},
    {"id": "s3", "side": "B", "start": int(now - 3600e3 * 1), "end": int(now - 3600e3 * 1 + 20 * 60e3), "updatedAt": int(now)},
]
growth = [
    {"id": "g1", "date": int(now - 86400e3 * 30), "weight": 3.4, "height": 50, "updatedAt": int(now)},
    {"id": "g2", "date": int(now - 86400e3 * 15), "weight": 4.1, "height": 54, "updatedAt": int(now)},
    {"id": "g3", "date": int(now - 86400e3 * 2),  "weight": 4.8, "height": 57, "updatedAt": int(now)},
]

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page.goto(SRC)
    page.evaluate("""(args)=>{
        localStorage.setItem('bf_baby_info_v1', JSON.stringify(args.baby));
        localStorage.setItem('bf_sessions_v1', JSON.stringify(args.sessions));
        localStorage.setItem('bf_growth_v1', JSON.stringify(args.growth));
    }""", {"baby": baby, "sessions": sessions, "growth": growth})
    page.reload()
    page.wait_for_timeout(1200)
    page.evaluate("render(); renderGrowth(); renderBabyInfo(); showPage('feed');")
    page.wait_for_timeout(800)
    page.screenshot(path=os.path.join(OUT, "01-feed.png"))

    # 成长页
    page.evaluate("showPage('grow')")
    page.wait_for_timeout(800)
    page.screenshot(path=os.path.join(OUT, "02-grow.png"))

    # 补记喂养弹窗
    page.evaluate("document.getElementById('overlay').classList.add('show')")
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(OUT, "03-add-feed.png"))
    page.evaluate("document.getElementById('overlay').classList.remove('show')")

    # 宝宝信息编辑弹窗
    page.evaluate("openBabyEdit()")
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(OUT, "04-baby.png"))

    browser.close()
print("SCREENSHOTS_DONE ->", OUT)

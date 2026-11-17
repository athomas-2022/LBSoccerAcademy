"""Build docs/common-terms-card.html from dashboard/src/terms.js.

The card is a one-page, front-only print of the Common Terms guide for coaches'
bags. It uses the guide's own wording (each meaning cut to its first sentence),
so regenerate it whenever terms.js changes:

    python docs/make-common-terms-card.py

then print docs/common-terms-card.html to PDF (Letter, no margins, background
graphics on), or run the Chrome command at the bottom of this file.
"""
import html, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = (ROOT / "dashboard/src/terms.js").read_text(encoding="utf-8")
T = json.loads(src[src.index("{"):src.rindex("}") + 1])
S = {s["h"]: s for s in T["sections"]}

def first(text, n=1):
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return " ".join(parts[:n])

def rows(section, pick=None, n=1, col=1):
    out = []
    for r in S[section]["rows"]:
        if pick is None or r[0] in pick:
            out.append((r[0], first(r[col], n)))
    if pick:
        missing = set(pick) - {t for t, _ in out}
        assert not missing, (section, missing)
    return out

e = html.escape
def block(title, items, cls=""):
    lis = "".join(f"<li><b>{e(t)}</b> {e(m)}</li>" for t, m in items)
    return f'<section class="blk {cls}"><h2>{e(title)}</h2><ul>{lis}</ul></section>'

idea = [(r[0], first(r[1]) + " " + r[2]) for r in S["The one idea"]["rows"]]
cues = S["Say these: cues by age"]["rows"]
levels = S["The tactics levels"]["rows"]

blocks = [
    block("With the ball", rows("When we have the ball", ["Support", "Check to the space", "Possess (keep it)", "Width", "Depth", "Bounce pass", "Up, back, through", "Forward, square, forward", "Go long"])),
    block("Without the ball", rows("When we don't have the ball", n=2)),
    block("Calls", rows("What players say to each other", n=2)),
    block("Positions", rows("Positions", n=2), "pos"),
    block("Moments", rows("Moments in the game", ["Transition", "Counter", "Rest defense", "The extra player", "Build, don't just boot it", "Play the score"])),
    block("On the field", rows("Where we are on the field", ["Thirds", "Between the lines", "Build-out line"])),
    block("Restarts", rows("Restarts", n=2)),
    block("Habits and skills", rows("Habits we coach all the time", ["Scan", "Head on a swivel"]) + rows("Skills and drills", ["First touch into space", "Little touches", "Shield", "Take them on"])),
]

idea_html = "".join(f'<div class="idea"><b>{e(t)}</b><span>{e(m)}</span></div>' for t, m in idea)
cue_html = "".join(f'<div class="cue"><b>{e(r[0])}</b><span>{e(r[1])}</span></div>' for r in cues)
lvl_html = "".join(f"<tr><th>{e(r[0])}</th><td>{e(r[1])}</td><td>{e(r[2])}</td></tr>" for r in levels)

page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>LB Soccer: Common Terms — Coach's Card</title>
<style>
  @font-face{{font-family:Montserrat;src:url(../assets/fonts/Montserrat-Regular.woff2) format("woff2");font-weight:400}}
  @font-face{{font-family:Montserrat;src:url(../assets/fonts/Montserrat-SemiBold.woff2) format("woff2");font-weight:600}}
  @font-face{{font-family:Montserrat;src:url(../assets/fonts/Montserrat-ExtraBold.woff2) format("woff2");font-weight:800}}
  @page{{size:letter;margin:0}}
  :root{{--blue:#003DA5;--navy:#0A2540;--red:#C8102E;--ink:#16233D;--ink-2:#48566E;--line:#D9E2F0;--tint:#EEF3FB}}
  *{{box-sizing:border-box}}
  html{{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  body{{margin:0;font-family:Montserrat,"Segoe UI",Arial,sans-serif;color:var(--ink);font-size:7.05pt;line-height:1.27}}
  .sheet{{width:8.5in;height:11in;padding:.32in .36in;display:flex;flex-direction:column;gap:.09in;overflow:hidden}}
  .mast{{display:flex;align-items:center;gap:.14in;background:var(--blue);color:#fff;border-radius:8px;padding:.08in .16in}}
  .mast img{{width:.5in;height:.5in}}
  .mast .eb{{font-size:6.5pt;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#BCD4F5}}
  .mast h1{{margin:0;font-size:15pt;font-weight:800;letter-spacing:-.01em}}
  .mast p{{margin:1px 0 0;font-size:7.4pt;color:#DCE8FB}}
  .top{{display:grid;grid-template-columns:1fr 1.35fr;gap:.12in}}
  .card{{border:1px solid var(--line);border-radius:7px;padding:.06in .1in;background:var(--tint)}}
  .card h2,.blk h2{{margin:0 0 .03in;font-size:7.6pt;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--red)}}
  .idea{{display:flex;gap:.08in;margin:.02in 0}}
  .idea b{{flex:0 0 1.05in;color:var(--blue);font-size:9pt;font-weight:800}}
  .cue{{display:flex;gap:.08in;margin:.02in 0}}
  .cue b{{flex:0 0 .95in;color:var(--navy);font-weight:800}}
  table{{width:100%;border-collapse:collapse}}
  th,td{{text-align:left;vertical-align:top;padding:1px 4px;border-top:1px solid var(--line)}}
  thead th{{border:0;font-size:6.4pt;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}}
  tbody th{{color:var(--blue);white-space:nowrap}}
  .cols{{columns:3;column-gap:.16in;flex:1}}
  .blk{{break-inside:avoid;margin:0 0 .08in}}
  .blk ul{{list-style:none;margin:0;padding:0}}
  .blk li{{margin:0 0 .025in;color:var(--ink-2)}}
  .blk li b{{color:var(--navy);font-weight:800}}
  .foot{{display:flex;justify-content:space-between;border-top:2px solid var(--blue);padding-top:.05in;font-size:6.8pt;color:var(--ink-2)}}
  .foot b{{color:var(--navy)}}
</style>
</head>
<body>
<div class="sheet">
  <header class="mast">
    <img src="../assets/logos/Crest-180.png" alt="" />
    <div><div class="eb">Coach's card</div><h1>LB Soccer: Common Terms</h1><p>{e(T["intro"])}</p></div>
  </header>
  <div class="top">
    <div class="card"><h2>The one idea</h2>{idea_html}</div>
    <div class="card"><h2>Say these: cues by age</h2>{cue_html}</div>
  </div>
  <div class="card"><h2>The tactics levels</h2><table><thead><tr><th></th><th>Offense</th><th>Defense</th></tr></thead><tbody>{lvl_html}</tbody></table></div>
  <div class="cols">{"".join(blocks)}</div>
  <footer class="foot"><span><b>LB Soccer / the Eagles</b> · Grassroot K–2 · Rising 3–5 · Next XI 6–8 · the full guide is in the dashboard's Training library</span><span>Teams move up a level by readiness, not grade.</span></footer>
</div>
</body>
</html>
"""
out = ROOT / "docs/common-terms-card.html"
out.write_text(page, encoding="utf-8")
print("wrote", out)

# PDF:
#   chrome --headless --disable-gpu --no-pdf-header-footer --print-to-pdf=docs/common-terms-card.pdf docs/common-terms-card.html

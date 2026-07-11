# LB Soccer Academy — Everything in one place

Last updated 2026-07-11. This folder gathers **everything created for the Academy**.
The two websites can't live in here (they'd break the live hosting), so they stay at
the project root — links below.

---

## 🌐 Live websites (hosted on GitHub Pages)

| What | Link |
|------|------|
| **Public "Every Kid Plays" site** — share this with families | https://athomas-2022.github.io/LBSoccerAcademy/public/ |
| **Coach's Dashboard** — your internal tool | https://athomas-2022.github.io/LBSoccerAcademy/ |

*Source lives at the project root (`public/` and `index.html` + `src/`). Edit there,
then `git push` and the live site updates in ~1 minute.*

---

## 🖨️ Flyers  → `flyers/`

Print-ready, one page each (8.5×11"), fully self-contained. Open the **.pdf** to print
or email; the **.html** is the editable source. Each has a **QR code** to the site.

| Flyer | Use it for | Files |
|-------|-----------|-------|
| **Every Kid Plays** | Recruiting / sign-ups | `every-kid-plays-flyer.pdf` / `.html` |
| **Donate Gear** | Asking the community for gear | `gear-donation-flyer.pdf` / `.html` |
| **Free Gear Closet** | Telling families gear is free | `gear-closet-flyer.pdf` / `.html` |
| **Back the Program** | Recruiting business sponsors | `sponsor-flyer.pdf` / `.html` |
| **Coaches & Volunteers Wanted** | Recruiting coaches/helpers | `coaches-wanted-flyer.pdf` / `.html` |

---

## 📱 Social media graphics  → `social/`

Square **1080×1080 PNG**s ready to post to Instagram/Facebook (with the `.html` source
if you want to tweak). Each has a QR code where relevant.

| Post | Files |
|------|-------|
| **Every Kid Plays** (announcement) | `social-every-kid-plays.png` |
| **Sign Up — It's Free** (QR) | `social-sign-up.png` |
| **Back the Program** (sponsors, red) | `social-back-the-program.png` |
| **Gear Drive** (donations, green) | `social-gear-drive.png` |

---

## 📱 Parent-alerts guide  → `guides/`

How families join alerts via **Remind** (class `@6ee4bkk`) and how you message everyone.
`parent-alerts-setup-guide.pdf` (print/share) and `.html` (has a Save-as-PDF button).

---

## ⚙️ Backend script  → `backend/`

`google-apps-script.gs` — optional Google Apps Script that auto-collects sign-ups into a
Google Sheet. Not required (the site emails sign-ups to the office by default). Never put
real Twilio keys in this file if the repo is public.

---

## 📄 Strategy & design  → `strategy/`

`PRODUCT.md` (strategy), `DESIGN.md` (visual system), `README.md` (repo overview).

---

## Key facts baked into everything

- **Contact:** athomas@Liberty-Benton.org
- **Alerts (Remind):** class code **@6ee4bkk** · join `remind.com/join/6ee4bkk` · text `@6ee4bkk` to `81010`
- **Session calendar:** shared Google Calendar (wired into the site's "Add to calendar" button)
- **Brand:** LB blue `#003DA5`, Montserrat, Block-LB / Eagle logos in `assets/logos/`

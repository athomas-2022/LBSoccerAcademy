/* ============================================================
   THE LB SOCCER ACADEMY — Coach's Dashboard
   Program constants (from the LBHS Complete Playbook) + sample data.
   Exposed as globals for a zero-build, file://-friendly app.
   ============================================================ */

/* Grade helpers: grade 0 = Kindergarten. School year begins fall 2027 cohort. */
function gradYearFor(grade) { return 2027 + (12 - grade); }
var GRADE_LABELS = ["K", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];

var STATUSES = {
  prospect: { label: "Prospect", tone: "neutral", help: "Athletic kid we've spotted, not yet in the program." },
  active:   { label: "Active",   tone: "good",    help: "Playing with us right now." },
  atrisk:   { label: "At risk",  tone: "danger",  help: "Drifting — a kid we could lose. Reach out now." },
  lost:     { label: "Lost",     tone: "muted",   help: "Left the program. Every one is a hole we can't backfill." }
};

var TIERS = [
  { key: "grassroot", name: "Grassroot Eagles", grades: "K–2", focus: "Fun, coordination, ball love" },
  { key: "academy",   name: "Eagles Academy",   grades: "3–5", focus: "Real skill: dribbling, passing, 1v1" },
  { key: "nextxi",    name: "Next XI Eagles",   grades: "6–8", focus: "Our system: shape, patterns, set pieces" }
];

/* The 360-day launch plan — 12 phases (Playbook Part 4). */
var PHASES = [
  { n: 1,  days: "1–30",    title: "Win the Gatekeeper",      goal: "Sharpen the pitch, get the AD's blessing.",
    tasks: ["Write the one-page vision + three numbers", "Meet the AD: blessing, facility nod, booster path", "Identify & approach your co-organizer"] },
  { n: 2,  days: "31–60",   title: "Open the School Doors",   goal: "Secure access to the young kids; lock the co-organizer.",
    tasks: ["Meet elementary/MS principals — flyer + space", "Meet PE teachers; start the athletic-kid list", "Lock the co-organizer into a defined lane"] },
  { n: 3,  days: "61–90",   title: "Lock the Soccer Community", goal: "Turn the soccer world into your funnel; set the launch date.",
    tasks: ["Rec league partnership", "SET THE LAUNCH DATE in writing", "Connect youth/MS + club coaches"] },
  { n: 4,  days: "91–120",  title: "Stand Up Funding",        goal: "Get the money vehicle live and land first sponsors.",
    tasks: ["Finalize booster / 501(c)(3)", "Build sponsor list; run the drive", "Approach gear brands for in-kind"] },
  { n: 5,  days: "121–150", title: "Build the Machine",       goal: "Turn plans into infrastructure.",
    tasks: ["Finalize the session plan (schedule, tiers, roster cap)", "Launch gear drive & set up the gear closet", "Build registration + Every Kid Plays flyer"] },
  { n: 6,  days: "151–180", title: "Fill the Funnel",         goal: "Get kids signed up; select the varsity coaches.",
    tasks: ["OPEN REGISTRATION; push everywhere", "Post coach application + select coaches", "Host a spring Youth Night"] },
  { n: 7,  days: "181–210", title: "Final Prep & Train",      goal: "Everything ready; train coaches to the Standard.",
    tasks: ["Push registration; confirm scholarships", "Run the 90-min varsity coach training", "Finalize launch logistics & sponsor recognition"] },
  { n: 8,  days: "211–240", title: "Launch the Program",      goal: "Deliver first sessions kids love; capture the data.",
    tasks: ["RUN THE FIRST SESSIONS — max touches, real fun", "Capture every kid's name, grade & contact", "Thank sponsors & coaches publicly; debrief"] },
  { n: 9,  days: "241–270", title: "Get Year-Round Rolling",  goal: "Turn the launch into an ongoing program.",
    tasks: ["Launch Grassroot & Next XI sessions", "Invite every kid free; build the map", "First in-season Youth Night"] },
  { n: 10, days: "271–300", title: "Ride the Season",         goal: "Keep the flywheel spinning all season.",
    tasks: ["Recurring Youth Nights; give kids game roles", "Feature little kids on socials; keep clinics current", "Mid-season sponsor thank-you"] },
  { n: 11, days: "301–330", title: "Sustain & Measure",       goal: "Carry momentum through the off-season; start measuring.",
    tasks: ["Log every kid who drifted & why", "Launch winter futsal in the fieldhouse", "Pull capture & retention numbers"] },
  { n: 12, days: "331–360", title: "Review & Lock Year Two",  goal: "Measure honestly, thank everyone, set up year two.",
    tasks: ["Full review; thank & re-ask every sponsor", "Write the year-two plan; lock next season's dates", "Document everything"] }
];

var SPONSOR_TIERS = [
  { key: "champion",  name: "Champion",  min: 1000, does: "Keeps a whole group playing all year" },
  { key: "eagle",     name: "Eagle",     min: 500,  does: "Stocks the gear closet for a season" },
  { key: "supporter", name: "Supporter", min: 250,  does: "Keeps a kid playing all season" },
  { key: "friend",    name: "Friend",    min: 100,  does: "Outfits a kid head-to-toe" },
  { key: "inkind",    name: "In-kind",   min: 0,    does: "Goods & services — cleats, printing, water" }
];
function tierForAmount(amt) {
  for (var i = 0; i < SPONSOR_TIERS.length; i++) { if (amt >= SPONSOR_TIERS[i].min && SPONSOR_TIERS[i].min > 0) return SPONSOR_TIERS[i]; }
  return SPONSOR_TIERS[SPONSOR_TIERS.length - 1];
}

/* ---- Sample roster (loadable; the real coach starts empty) ---- */
function A(first, last, grade, program, sports, status, note, email, phone) {
  return { id: "s-" + first.toLowerCase() + "-" + last.toLowerCase(),
    first: first, last: last, grade: grade, gradYear: gradYearFor(grade),
    program: program, sports: sports, status: status, note: note || "",
    email: email || "", phone: phone || "",
    updated: "2026-06-01" };
}
var SAMPLE = {
  athletes: [
    A("Mateo", "Alvarez", 1, "Boys", ["Soccer"], "active", "", "alvarez.family@example.com", "419-555-0148"),
    A("Ava", "Bishop", 2, "Girls", ["Soccer", "Gymnastics"], "active", "", "bishop.home@example.com", "419-555-0102"),
    A("Liam", "Carter", 0, "Boys", ["Soccer"], "active", "", "carters@example.com", "419-555-0175"),
    A("Sofia", "Delgado", 4, "Girls", ["Soccer"], "active", "", "delgado4@example.com", ""),
    A("Noah", "Emerson", 3, "Boys", ["Soccer", "Baseball"], "atrisk", "Missed the last 3 Saturdays — dad said schedule got busy. Call this week.", "emerson.dad@example.com", "419-555-0190"),
    A("Emma", "Fischer", 5, "Girls", ["Soccer"], "active", "", "fischer.emma@example.com", "419-555-0121"),
    A("Jackson", "Grant", 6, "Boys", ["Basketball"], "prospect", "Fast, great feet in PE — Coach Reyes flagged him. Never played soccer. Future center back?"),
    A("Olivia", "Hughes", 7, "Girls", ["Soccer", "Track"], "active"),
    A("Ethan", "Ito", 8, "Boys", ["Soccer"], "active", "Already knows the system — arrives as a freshman next year."),
    A("Mia", "Jenkins", 2, "Girls", ["Soccer"], "atrisk", "Best friend quit; hasn't come since. Pair her with Ava's group."),
    A("Lucas", "Keller", 4, "Boys", ["Soccer", "Wrestling"], "active"),
    A("Harper", "Lang", 1, "Girls", ["Soccer"], "active"),
    A("Owen", "Marsh", 6, "Boys", ["Soccer"], "lost", "Went to travel club in Findlay. Keep the door open."),
    A("Isabella", "Nguyen", 3, "Girls", ["Soccer", "Dance"], "active"),
    A("Caleb", "Ortiz", 5, "Boys", ["Football", "Track"], "prospect", "PE teacher says the best athlete in 5th grade. Convert him."),
    A("Zoe", "Parker", 8, "Girls", ["Soccer"], "active", "Next XI leader — bring her to Youth Nights as a role model.")
  ],
  sponsors: [
    { id: "sp-1", name: "Findlay Family Dental", amount: 1000, note: "PA shout-outs; framed thanks delivered." },
    { id: "sp-2", name: "Eagle Auto & Tire", amount: 500, note: "Banner up at the field." },
    { id: "sp-3", name: "Rise & Grind Coffee", amount: 250, note: "Covering a kid's season." },
    { id: "sp-4", name: "Benton Hardware", amount: 250, note: "" },
    { id: "sp-5", name: "Liberty Insurance Group", amount: 100, note: "" },
    { id: "sp-6", name: "Northgate Sporting Goods", amount: 0, note: "In-kind: 20 pairs of cleats for the gear closet." }
  ],
  phasesDone: [1, 2, 3, 4],
  settings: { districtAthletes: 240 }
};

window.LBSA = {
  GRADE_LABELS: GRADE_LABELS, STATUSES: STATUSES, TIERS: TIERS, PHASES: PHASES,
  SPONSOR_TIERS: SPONSOR_TIERS, SAMPLE: SAMPLE,
  gradYearFor: gradYearFor, tierForAmount: tierForAmount
};

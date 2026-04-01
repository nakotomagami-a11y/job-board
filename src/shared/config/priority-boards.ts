// Master list of job boards — ordered by priority and volume
// Claude uses these when searching for jobs

// Tier 1: Mega aggregators — highest volume, always check first
export const TIER1_BOARDS = [
  "LinkedIn Jobs (linkedin.com/jobs)",
  "Indeed (indeed.com)",
  "Glassdoor (glassdoor.com)",
  "Google Jobs (google.com/jobs)",
  "ZipRecruiter (ziprecruiter.com)",
];

// Tier 2: Remote-first boards — strong for tech/frontend
export const TIER2_BOARDS = [
  "WeWorkRemotely (weworkremotely.com)",
  "RemoteOK (remoteok.com)",
  "arc.dev (arc.dev/remote-jobs)",
  "FlexJobs (flexjobs.com)",
  "Working Nomads (workingnomads.com)",
  "Himalayas (himalayas.app)",
  "Remote.co (remote.co)",
  "Remotive (remotive.com)",
  "JustRemote (justremote.co)",
  "Remote Rocketship (remoterocketship.com)",
  "DailyRemote (dailyremote.com)",
  "Jobspresso (jobspresso.co)",
  "Remote100K (remote100k.com)",
  "NoDesk (nodesk.co)",
  "Jobicy (jobicy.com)",
  "Dynamite Jobs (dynamitejobs.com)",
];

// Tier 3: Startup & tech focused
export const TIER3_BOARDS = [
  "Wellfound / AngelList (wellfound.com)",
  "Y Combinator Work at a Startup (workatastartup.com)",
  "startup.jobs (startup.jobs)",
  "Built In (builtin.com)",
  "Otta (otta.com)",
  "Dice (dice.com)",
  "The Muse (themuse.com)",
  "Hired (hired.com)",
  "Triplebyte (triplebyte.com)",
  "Turing (turing.com/jobs)",
  "Toptal (toptal.com/careers)",
  "Contra (contra.com)",
  "HiringCafe (hiring.cafe)",
  "Weekday (jobs.weekday.works)",
];

// Tier 4: ATS platforms — search by keyword on their public boards
export const TIER4_BOARDS = [
  "Greenhouse boards (boards.greenhouse.io or job-boards.greenhouse.io)",
  "Lever boards (jobs.lever.co)",
  "Ashby boards (jobs.ashbyhq.com)",
  "Workable (apply.workable.com)",
  "SmartRecruiters (careers.smartrecruiters.com)",
  "BambooHR (bamboohr.com/jobs)",
];

// Tier 5: React / Frontend specific
export const TIER5_BOARDS = [
  "reactjobs.io (reactjobs.io)",
  "Hacker News Who is Hiring (hnhiring.com/technologies/react)",
  "JavaScript Job Board (javascriptjob.xyz)",
  "Frontend Focus Jobs (frontendfoc.us/jobs)",
  "CSS-Tricks Jobs Board (css-tricks.com/jobs)",
  "Smashing Magazine Jobs (smashingmagazine.com/jobs)",
];

// Tier 6: Industry specific / niche
export const TIER6_BOARDS = [
  "web3.career (web3.career)",
  "CryptoJobsList (cryptojobslist.com)",
  "crypto.jobs (crypto.jobs)",
  "CryptocurrencyJobs (cryptocurrencyjobs.co)",
  "HireWeb3 (hireweb3.io)",
  "Remote3 (remote3.co)",
  "Hitmarker Gaming (hitmarker.net)",
  "Work With Indies (workwithindies.com)",
  "RemoteGameJobs (remotegamejobs.com)",
  "Indie Dragoness Game Dev Jobs (indiedragoness.dev/game-dev-jobs)",
  "AI Jobs (aijobs.net)",
  "ML Jobs Board (mljobs.org)",
];

// Tier 7: European focused
export const TIER7_BOARDS = [
  "EU Remote Jobs (euremotejobs.com)",
  "Remote Rocketship Europe (remoterocketship.com/country/europe)",
  "The Hub (thehub.io)",
  "Landing.jobs (landing.jobs)",
  "SwissDevJobs (swissdevjobs.ch)",
  "Berlin Startup Jobs (berlinstartupjobs.com)",
  "No Fluff Jobs Poland (nofluffjobs.com)",
  "Just Join IT Poland (justjoin.it)",
  "Welcome to the Jungle France (welcometothejungle.com)",
  "MeetFrank Baltics (meetfrank.com)",
  "Arbeitnow (arbeitnow.com)",
];

export const ALL_BOARDS = [
  ...TIER1_BOARDS, ...TIER2_BOARDS, ...TIER3_BOARDS,
  ...TIER4_BOARDS, ...TIER5_BOARDS, ...TIER6_BOARDS, ...TIER7_BOARDS,
];

// Total: 75+ boards

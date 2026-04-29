const fs = require('fs');
const p = 'C:/Users/Saphire/Documents/Lab/job-board/data/user/jobs.json';
const jobs = JSON.parse(fs.readFileSync(p, 'utf8'));
const before = jobs.length;
const filtered = jobs.filter(function(x) {
  return !(x.source && x.source.toLowerCase().includes('dailyremote'));
});
fs.writeFileSync(p, JSON.stringify(filtered, null, 2));
console.log('Removed ' + (before - filtered.length) + ' DailyRemote jobs. Remaining: ' + filtered.length);

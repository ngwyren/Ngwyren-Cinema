/**
 * Ngwyren Cinema - Daily Automated Movie Updater, Deduplicator & Web Maintenance Runner
 * Runs twice daily (00:00 & 12:00 ICT) via GitHub Actions (.github/workflows/daily-update.yml)
 * Crawls new 1080p/4K .m3u8 movies, deduplicates keeping highest quality, and audits schedule & JS syntax.
 */

const { spawn } = require('child_process');
const path = require('path');

const scriptPath = path.resolve(__dirname, 'maintain_and_update.py');

console.log('=== NGWYREN CINEMA SCHEDULED AUTO-UPDATE & WEB MAINTENANCE ===');
console.log(`Executing maintenance engine: ${scriptPath}`);

const proc = spawn('python3', [scriptPath], { stdio: 'inherit' });

proc.on('close', (code) => {
  if (code === 0) {
    console.log('\n[SUCCESS] Catalog updated, deduplicated (best quality), and verified.');
  } else {
    console.error(`\n[ERROR] Maintenance process exited with code ${code}`);
    process.exit(code);
  }
});

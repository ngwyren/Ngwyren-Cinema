/**
 * Ngwyren Cinema - Daily Automated Movie Updater
 * Runs daily at midnight (00:00 ICT / 17:00 UTC) via GitHub Actions
 * Syncs full catalog & showtimes from yanhh3d.ee, animevietsub.sale & PhimAPI
 */

const { spawn } = require('child_process');
const path = require('path');

const scriptPath = path.resolve(__dirname, 'ingest_catalogs.py');

console.log('=== NGWYREN CINEMA DAILY AUTO-UPDATE (12:00 AM MIDNIGHT) ===');
console.log(`Executing crawler: ${scriptPath}`);

const proc = spawn('python3', [scriptPath], { stdio: 'inherit' });

proc.on('close', (code) => {
  if (code === 0) {
    console.log('\n[SUCCESS] Daily catalog and showtimes updated successfully.');
  } else {
    console.error(`\n[ERROR] Update process exited with code ${code}`);
    process.exit(code);
  }
});

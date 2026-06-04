const { execSync } = require('child_process');
const fs = require('fs');

console.log('Running cross-platform Playwright installation...');

if (fs.existsSync('/ms-playwright') || process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === '1') {
  console.log('Playwright browsers already pre-installed or download skipped. Skipping installation.');
  process.exit(0);
}

try {
  if (process.platform === 'linux') {
    console.log('Linux environment detected. Installing Chromium with dependencies...');
    execSync('npx playwright install chromium --with-deps', { stdio: 'inherit' });
  } else {
    console.log('Non-linux environment detected. Installing Chromium...');
    execSync('npx playwright install chromium', { stdio: 'inherit' });
  }
} catch (error) {
  console.error('Error during Playwright installation:', error.message);
}

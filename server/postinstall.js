const { execSync } = require('child_process');

console.log('Running cross-platform Playwright installation...');

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

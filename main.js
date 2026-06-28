const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;

// Helper to find absolute path of system node binary
function findNodePath() {
  return process.execPath;
}

// Helper to post-process Playwright generated code to insert sleeps and screenshots
function postProcessCode(code, options) {
  if (!options) return code;
  const { addSleep, addScreenshots, screenshotPath } = options;
  if (!addSleep && !addScreenshots) return code;

  const lines = code.split('\n');
  const processedLines = [];
  let step = 1;
  let hasPathImport = false;
  let hasFsImport = false;

  for (let line of lines) {
    if (line.includes("require('path')")) hasPathImport = true;
    if (line.includes("require('fs')")) hasFsImport = true;

    processedLines.push(line);

    // Identify standard automation lines: await page.click(...), await locator.click(...), await page.goto(...)
    // Exclude launch, newPage, screenshot, waitForTimeout, and close statements
    if (line.trim().startsWith('await ') && 
        (line.includes('page.') || line.includes('locator(') || line.includes('frameLocator(')) && 
        !line.includes('launch') && 
        !line.includes('newPage') && 
        !line.includes('close') && 
        !line.includes('screenshot') && 
        !line.includes('waitForTimeout')) {
      
      let pageVar = 'page';
      const pageMatch = line.match(/(page\d*)\./);
      if (pageMatch) {
        pageVar = pageMatch[1];
      }
      
      const indent = line.match(/^\s*/)[0];
      
      // 1. Take screenshot if requested
      if (addScreenshots && screenshotPath) {
        const cleanPath = screenshotPath.replace(/\\/g, '/'); // forward slashes are safe on macOS/Unix
        processedLines.push(`${indent}await ${pageVar}.screenshot({ path: path.join('${cleanPath}', \`screenshot_\${Date.now()}_step_\${screenshotStep++}.png\`) });`);
      }
      
      // 2. Add 2s wait if requested
      if (addSleep) {
        processedLines.push(`${indent}await ${pageVar}.waitForTimeout(2000);`);
      }
    }
  }

  // Inject imports and folder creation at the top (under first few lines)
  const setupLines = [];
  if (addScreenshots && screenshotPath) {
    if (!hasPathImport) setupLines.push("const path = require('path');");
    if (!hasFsImport) setupLines.push("const fs = require('fs');");
    const cleanPath = screenshotPath.replace(/\\/g, '/');
    setupLines.push(`if (!fs.existsSync('${cleanPath}')) fs.mkdirSync('${cleanPath}', { recursive: true });`);
    setupLines.push(`let screenshotStep = 1;\n`);
  }

  if (setupLines.length > 0) {
    processedLines.unshift(...setupLines);
  }

  return processedLines.join('\n');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    titleBarStyle: 'hiddenInset', // beautiful macOS titlebar style
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  
  // Open devtools during development if needed
  if (!isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Paths setup
const PROJECT_DIR = __dirname;
const isPackaged = app.isPackaged;
const DATA_DIR = isPackaged 
  ? path.join(app.getPath('userData'), 'AgniTestPilotData') 
  : PROJECT_DIR;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const TESTS_DIR = path.join(DATA_DIR, 'tests');
const DATA_FILE = path.join(DATA_DIR, 'tests.json');

if (!fs.existsSync(TESTS_DIR)) {
  fs.mkdirSync(TESTS_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));
}

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DEFAULT_SETTINGS = {
  screenshotPath: path.join(DATA_DIR, 'screenshots'),
  defaultHeadless: false,
  reportPath: ''
};

if (!fs.existsSync(SETTINGS_FILE)) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
}

function readSettings() {
  try {
    const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    if (!parsed.reportPath) {
      try {
        parsed.reportPath = app.getPath('downloads');
      } catch (e) {
        parsed.reportPath = '';
      }
    }
    return parsed;
  } catch (error) {
    const settings = { ...DEFAULT_SETTINGS };
    try {
      settings.reportPath = app.getPath('downloads');
    } catch (e) {}
    return settings;
  }
}

function writeSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Error writing settings:', error);
  }
}

// Utility to read tests metadata
function readTestsData() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading tests data:', error);
    return [];
  }
}

// Utility to read history metadata
function readHistoryData() {
  try {
    const data = fs.readFileSync(HISTORY_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Utility to write history metadata
function writeHistoryData(data) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing history data:', error);
  }
}

// Utility to write tests metadata
function writeTestsData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing tests data:', error);
  }
}

// IPC Handling

// Get all tests
ipcMain.handle('get-tests', async () => {
  return readTestsData();
});

// Start Recording
ipcMain.handle('start-recording', async (event, { name, description, startUrl, env, options }) => {
  return new Promise((resolve) => {
    const id = Date.now().toString(); // unique ID
    const testFileName = `test_${id}.js`;
    const testFilePath = path.join(TESTS_DIR, testFileName);

    // Clean up env variables to avoid Electron conflicts
    const envVars = { ...process.env };
    envVars.ELECTRON_RUN_AS_NODE = '1';
    delete envVars.ELECTRON_NO_ASAR;
    delete envVars.NODE_OPTIONS;
    
    // Inject standard paths to PATH so spawned commands can find node
    const additionalPaths = process.platform === 'win32'
      ? ';C:\\Program Files\\nodejs;C:\\Program Files (x86)\\nodejs'
      : ':/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin';
    if (!envVars.PATH) {
      envVars.PATH = additionalPaths.substring(1);
    } else {
      envVars.PATH += additionalPaths;
    }

    const playwrightCli = path.join(PROJECT_DIR, 'node_modules', 'playwright', 'cli.js');
    const args = [playwrightCli, 'codegen', '--target=javascript'];
    if (startUrl) {
      args.push(startUrl);
    }
    args.push('-o', testFilePath);

    const nodeExecutable = findNodePath();
    console.log('Spawning Playwright Codegen via Node:', nodeExecutable, args.join(' '));

    // Spawn the playwright codegen process
    const child = spawn(nodeExecutable, args, {
      cwd: PROJECT_DIR,
      shell: false,
      env: envVars
    });

    child.stdout.on('data', (data) => {
      console.log(`[Codegen stdout]: ${data}`);
    });

    child.stderr.on('data', (data) => {
      console.error(`[Codegen stderr]: ${data}`);
    });

    child.on('close', (code) => {
      console.log(`Playwright codegen process exited with code ${code}`);
      
      // Check if file was created and has content
      if (fs.existsSync(testFilePath) && fs.statSync(testFilePath).size > 0) {
        // Read file contents
        let rawCode = fs.readFileSync(testFilePath, 'utf8');
        let codeContent = rawCode;
        
        // Post-process the code content
        if (options) {
          codeContent = postProcessCode(rawCode, options);
          fs.writeFileSync(testFilePath, codeContent);
        }

        const tests = readTestsData();
        const newTest = {
          id,
          name: name || `Recorded Test ${tests.length + 1}`,
          description: description || 'No description provided.',
          filePath: path.join('tests', testFileName),
          startUrl: startUrl || '',
          env: env || 'dev',
          rawCode,
          options: options || null,
          createdAt: new Date().toISOString(),
          lastRunStatus: 'Not Run',
          lastRunTime: null,
          duration: null
        };
        
        tests.push(newTest);
        writeTestsData(tests);

        resolve({ success: true, test: newTest });
      } else {
        // Clean up empty file if created
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
        resolve({ success: false, error: 'No interactions recorded or recording aborted.' });
      }
    });

    child.on('error', (err) => {
      console.error('Failed to start recording process:', err);
      resolve({ success: false, error: `Process error: ${err.message}` });
    });
  });
});

// Re-record Test
ipcMain.handle('rerecord-test', async (event, { testId }) => {
  const tests = readTestsData();
  const testIndex = tests.findIndex(t => t.id === testId);
  if (testIndex === -1) {
    return { success: false, error: 'Test not found' };
  }

  const test = tests[testIndex];
  const absoluteFilePath = path.join(DATA_DIR, test.filePath);

  return new Promise((resolve) => {
    // Clean up env variables to avoid Electron conflicts
    const env = { ...process.env };
    env.ELECTRON_RUN_AS_NODE = '1';
    delete env.ELECTRON_NO_ASAR;
    delete env.NODE_OPTIONS;
    
    // Inject standard paths to PATH so spawned commands can find node
    const additionalPaths = process.platform === 'win32'
      ? ';C:\\Program Files\\nodejs;C:\\Program Files (x86)\\nodejs'
      : ':/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin';
    if (!env.PATH) {
      env.PATH = additionalPaths.substring(1);
    } else {
      env.PATH += additionalPaths;
    }

    const playwrightCli = path.join(PROJECT_DIR, 'node_modules', 'playwright', 'cli.js');
    const args = [playwrightCli, 'codegen', '--target=javascript'];
    if (test.startUrl) {
      args.push(test.startUrl);
    }
    args.push('-o', absoluteFilePath);

    const nodeExecutable = findNodePath();
    console.log('Spawning Playwright Codegen for re-recording:', nodeExecutable, args.join(' '));

    const child = spawn(nodeExecutable, args, {
      cwd: PROJECT_DIR,
      shell: false,
      env
    });

    child.on('close', (code) => {
      console.log(`Re-recording codegen process exited with code ${code}`);
      
      if (fs.existsSync(absoluteFilePath) && fs.statSync(absoluteFilePath).size > 0) {
        let codeContent = fs.readFileSync(absoluteFilePath, 'utf8');
        
        if (test.options) {
          codeContent = postProcessCode(codeContent, test.options);
          fs.writeFileSync(absoluteFilePath, codeContent);
        }

        const updatedTests = readTestsData();
        const currentIdx = updatedTests.findIndex(t => t.id === testId);
        if (currentIdx !== -1) {
          updatedTests[currentIdx].createdAt = new Date().toISOString(); // update timestamp
          updatedTests[currentIdx].lastRunStatus = 'Not Run';
          writeTestsData(updatedTests);
        }

        resolve({ success: true, test: updatedTests[currentIdx] });
      } else {
        resolve({ success: false, error: 'No actions recorded during re-record.' });
      }
    });

    child.on('error', (err) => {
      console.error('Failed to start re-recording process:', err);
      resolve({ success: false, error: err.message });
    });
  });
});

// Get History
ipcMain.handle('get-history', async () => {
  return readHistoryData();
});

// Clear History
ipcMain.handle('clear-history', async () => {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get settings
ipcMain.handle('get-settings', async () => {
  return readSettings();
});

// Save settings
ipcMain.handle('save-settings', async (event, settings) => {
  writeSettings(settings);
  return { success: true };
});

// Run Test
let activeRunners = new Map();

ipcMain.handle('run-test', async (event, { testId, headless }) => {
  const tests = readTestsData();
  const testIndex = tests.findIndex(t => t.id === testId);
  if (testIndex === -1) {
    return { success: false, error: 'Test not found' };
  }

  const test = tests[testIndex];
  const absoluteFilePath = path.join(DATA_DIR, test.filePath);

  if (!fs.existsSync(absoluteFilePath)) {
    return { success: false, error: 'Test file does not exist on disk' };
  }

  const runId = Date.now().toString(); // unique execution ID

  return new Promise((resolve) => {
    let content = fs.readFileSync(absoluteFilePath, 'utf8');

    // 1. Dynamic Screenshot Routing to unique folder screenshots/<testId>/<runId>
    if (test.options && test.options.addScreenshots && test.options.screenshotPath) {
      const cleanBase = test.options.screenshotPath.replace(/\\/g, '/');
      const cleanTarget = path.join(cleanBase, testId, runId).replace(/\\/g, '/');
      content = content.replaceAll(cleanBase, cleanTarget);
    }

    // 2. Adjust headless configuration if checked
    if (headless) {
      content = content.replace(/headless:\s*false/g, 'headless: true');
      if (!content.includes('headless:')) {
        content = content.replace(/chromium\.launch\(\{/g, 'chromium.launch({ headless: true,');
      }
    }

    // Always create a temp runner file with the runId to keep runs isolated
    const runFilePath = path.join(TESTS_DIR, `temp_run_${testId}_${runId}.js`);
    fs.writeFileSync(runFilePath, content);

    console.log(`Running test: ${test.name} [Run ID: ${runId}] using path ${runFilePath}`);
    const startTime = Date.now();

    // Clean up env variables to avoid Electron conflicts
    const env = { ...process.env };
    env.ELECTRON_RUN_AS_NODE = '1';
    delete env.ELECTRON_NO_ASAR;
    delete env.NODE_OPTIONS;
    env.NODE_PATH = path.join(PROJECT_DIR, 'node_modules');
    
    // Inject standard paths to PATH so spawned commands can find node
    const additionalPaths = process.platform === 'win32'
      ? ';C:\\Program Files\\nodejs;C:\\Program Files (x86)\\nodejs'
      : ':/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin';
    if (!env.PATH) {
      env.PATH = additionalPaths.substring(1);
    } else {
      env.PATH += additionalPaths;
    }

    const nodeExecutable = findNodePath();
    const child = spawn(nodeExecutable, [runFilePath], {
      cwd: PROJECT_DIR,
      shell: false,
      env
    });

    activeRunners.set(testId, child);

    child.stdout.on('data', (data) => {
      mainWindow.webContents.send('test-log', { testId, data: data.toString(), type: 'stdout' });
    });

    child.stderr.on('data', (data) => {
      mainWindow.webContents.send('test-log', { testId, data: data.toString(), type: 'stderr' });
    });

    child.on('close', (code) => {
      activeRunners.delete(testId);
      const endTime = Date.now();
      const runDuration = ((endTime - startTime) / 1000).toFixed(2); // seconds

      // Clean up temp run file
      if (fs.existsSync(runFilePath)) {
        try {
          fs.unlinkSync(runFilePath);
        } catch (e) {
          console.error('Failed to clean up temp run file:', e);
        }
      }

      let status = 'Failed';
      if (code === 0) {
        status = 'Passed';
      }

      // Update test metadata status
      const updatedTests = readTestsData();
      const currentTestIndex = updatedTests.findIndex(t => t.id === testId);
      if (currentTestIndex !== -1) {
        updatedTests[currentTestIndex].lastRunStatus = status;
        updatedTests[currentTestIndex].lastRunTime = new Date().toISOString();
        updatedTests[currentTestIndex].duration = runDuration;
        writeTestsData(updatedTests);
      }

      // Collect screenshots generated for this run
      const screenshots = [];
      if (test.options && test.options.addScreenshots && test.options.screenshotPath) {
        const runScreenshotDir = path.join(test.options.screenshotPath, testId, runId);
        if (fs.existsSync(runScreenshotDir)) {
          const files = fs.readdirSync(runScreenshotDir);
          // Sort step numbers correctly
          files.sort((a, b) => {
            const numA = parseInt(a.match(/step_(\d+)/)?.[1] || '0');
            const numB = parseInt(b.match(/step_(\d+)/)?.[1] || '0');
            return numA - numB;
          });
          
          files.forEach(file => {
            if (file.endsWith('.png')) {
              // Store relative path from project root for browser loading
              const relativePath = path.relative(PROJECT_DIR, path.join(runScreenshotDir, file));
              screenshots.push(relativePath);
            }
          });
        }
      }

      // Save execution entry in history.json
      const history = readHistoryData();
      history.unshift({
        runId,
        testId,
        testName: test.name,
        timestamp: new Date().toISOString(),
        status,
        duration: runDuration,
        screenshots
      });
      writeHistoryData(history);

      mainWindow.webContents.send('test-finished', { 
        testId, 
        runId,
        status, 
        duration: runDuration,
        exitCode: code 
      });

      resolve({ success: code === 0, status, duration: runDuration, runId });
    });

    child.on('error', (err) => {
      activeRunners.delete(testId);
      resolve({ success: false, error: err.message });
    });
  });
});

// Stop Running Test
ipcMain.handle('stop-test', async (event, { testId }) => {
  const child = activeRunners.get(testId);
  if (child) {
    child.kill('SIGINT');
    return { success: true };
  }
  return { success: false, error: 'No active run found for this test' };
});

// Delete Test
ipcMain.handle('delete-test', async (event, testId) => {
  const tests = readTestsData();
  const testIndex = tests.findIndex(t => t.id === testId);
  if (testIndex === -1) {
    return { success: false, error: 'Test not found' };
  }

  const test = tests[testIndex];
  const absoluteFilePath = path.join(DATA_DIR, test.filePath);

  if (fs.existsSync(absoluteFilePath)) {
    fs.unlinkSync(absoluteFilePath);
  }

  tests.splice(testIndex, 1);
  writeTestsData(tests);
  return { success: true };
});

// Update Test Info & Option Configurations (Dynamically re-post-process JavaScript files)
ipcMain.handle('update-test', async (event, { testId, name, description, env, startUrl, options }) => {
  const tests = readTestsData();
  const testIndex = tests.findIndex(t => t.id === testId);
  if (testIndex === -1) {
    return { success: false, error: 'Test not found' };
  }

  const test = tests[testIndex];
  test.name = name;
  test.description = description;
  test.env = env;
  test.startUrl = startUrl;
  test.options = options;

  // Re-process the code file using rawCode and the new options!
  if (test.rawCode) {
    try {
      const processedCode = postProcessCode(test.rawCode, options);
      fs.writeFileSync(path.join(DATA_DIR, test.filePath), processedCode);
      console.log(`Re-compiled test code file for scenario id: ${testId}`);
    } catch (e) {
      console.error('Failed to update code file during edit:', e);
    }
  }

  writeTestsData(tests);
  return { success: true, test };
});

// Read Test Code
ipcMain.handle('read-test-code', async (event, testId) => {
  const tests = readTestsData();
  const test = tests.find(t => t.id === testId);
  if (!test) return { success: false, error: 'Test not found' };

  try {
    const code = fs.readFileSync(path.join(DATA_DIR, test.filePath), 'utf8');
    return { success: true, code };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Generate HTML Report
ipcMain.handle('generate-report', async (event, { runId }) => {
  const history = readHistoryData();
  const run = history.find(r => r.runId === runId);
  if (!run) return { success: false, error: 'Run not found' };

  const tests = readTestsData();
  const test = tests.find(t => t.id === run.testId);

  const settings = readSettings();
  const reportsDir = settings.reportPath || app.getPath('downloads');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, `report_${runId}.html`);

  let screenshotGalleryHtml = '';
  if (run.screenshots && run.screenshots.length > 0) {
    run.screenshots.forEach((src, idx) => {
      const absoluteSrc = path.join(PROJECT_DIR, src);
      screenshotGalleryHtml += `
        <div class="card">
          <img src="file://${absoluteSrc}" alt="Step ${idx + 1}">
          <div class="meta">Step ${idx + 1} Checkpoint</div>
        </div>
      `;
    });
  } else {
    screenshotGalleryHtml = '<p style="color: #94a3b8; text-align: center; grid-column: 1 / span 3; padding: 20px;">No screenshots were captured for this run.</p>';
  }

  const htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Agni Audit Report - Run ${runId}</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        background-color: #0f121d;
        color: #e2e8f0;
        margin: 0;
        padding: 40px;
      }
      .header {
        border-bottom: 2px solid #2a3042;
        padding-bottom: 20px;
        margin-bottom: 30px;
      }
      .title {
        font-size: 28px;
        color: #fa5541;
        margin: 0;
      }
      .subtitle {
        font-size: 14px;
        color: #94a3b8;
      }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 20px;
        margin-bottom: 40px;
      }
      .stat-card {
        background-color: #151a2d;
        border: 1px solid #2a3042;
        border-radius: 12px;
        padding: 20px;
        text-align: center;
      }
      .stat-val {
        font-size: 22px;
        font-weight: bold;
        color: #fff;
        word-break: break-all;
      }
      .stat-lbl {
        font-size: 11px;
        color: #94a3b8;
        text-transform: uppercase;
        margin-top: 4px;
      }
      .gallery {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 24px;
      }
      .card {
        background-color: #151a2d;
        border: 1px solid #2a3042;
        border-radius: 12px;
        overflow: hidden;
      }
      .card img {
        width: 100%;
        height: 160px;
        object-fit: cover;
      }
      .card .meta {
        padding: 12px;
        font-size: 12px;
        text-align: center;
        background-color: rgba(0,0,0,0.2);
        color: #cbd5e1;
      }
      .badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: bold;
      }
      .badge-passed {
        background-color: rgba(16, 185, 129, 0.2);
        color: #10b981;
      }
      .badge-failed {
        background-color: rgba(239, 68, 68, 0.2);
        color: #ef4444;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1 class="title">🔥 Agni Execution Audit Report</h1>
      <p class="subtitle">Execution Run ID: ${runId} | Generated on ${new Date().toLocaleString()}</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-val">${test ? test.name : 'Unknown Scenario'}</div>
        <div class="stat-lbl">Scenario Name</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${new Date(run.timestamp).toLocaleDateString()}</div>
        <div class="stat-lbl">Run Date</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">
          <span class="badge ${run.status === 'Passed' ? 'badge-passed' : 'badge-failed'}">${run.status}</span>
        </div>
        <div class="stat-lbl">Status</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${run.duration}s</div>
        <div class="stat-lbl">Duration</div>
      </div>
    </div>

    <h2>Captured Screenshot Checkpoints</h2>
    <div class="gallery">
      ${screenshotGalleryHtml}
    </div>
  </body>
  </html>
  `;

  fs.writeFileSync(reportPath, htmlContent);
  
  // Automatically launch report in browser
  const { shell } = require('electron');
  shell.openPath(reportPath);

  return { success: true, reportPath };
});

// Generate Holistic Audit Report
ipcMain.handle('generate-holistic-report', async () => {
  const tests = readTestsData();
  const history = readHistoryData();

  const settings = readSettings();
  const reportsDir = settings.reportPath || app.getPath('downloads');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, `holistic_report_${Date.now()}.html`);

  // Calculate success stats
  const totalRuns = history.length;
  const passedRuns = history.filter(r => r.status === 'Passed').length;
  const successRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0;
  
  const totalDuration = history.reduce((acc, r) => acc + parseFloat(r.duration || 0), 0);
  const avgDuration = totalRuns > 0 ? (totalDuration / totalRuns).toFixed(2) : '0.00';

  // Build Scenario List items
  let scenariosListHtml = '';
  if (tests.length > 0) {
    tests.forEach(test => {
      scenariosListHtml += `
        <tr>
          <td><strong>${test.name}</strong></td>
          <td>${test.description || 'No description'}</td>
          <td><span class="badge ${test.lastRunStatus === 'Passed' ? 'badge-passed' : test.lastRunStatus === 'Failed' ? 'badge-failed' : 'badge-notrun'}">${test.lastRunStatus}</span></td>
          <td>${test.duration ? test.duration + 's' : '--'}</td>
        </tr>
      `;
    });
  } else {
    scenariosListHtml = '<tr><td colspan="4" style="text-align:center;">No scenarios recorded.</td></tr>';
  }

  // Build Recent Activity items
  let recentRunsHtml = '';
  if (history.length > 0) {
    history.slice(0, 10).forEach(run => {
      recentRunsHtml += `
        <tr>
          <td><code>${run.runId}</code></td>
          <td>${run.testName}</td>
          <td>${new Date(run.timestamp).toLocaleString()}</td>
          <td><span class="badge ${run.status === 'Passed' ? 'badge-passed' : 'badge-failed'}">${run.status}</span></td>
          <td>${run.duration}s</td>
        </tr>
      `;
    });
  } else {
    recentRunsHtml = '<tr><td colspan="5" style="text-align:center;">No test executions found.</td></tr>';
  }

  const htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Agni QA - Holistic Executive Audit Report</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        background-color: #0f121d;
        color: #e2e8f0;
        margin: 0;
        padding: 40px;
      }
      .header {
        border-bottom: 2px solid #2a3042;
        padding-bottom: 20px;
        margin-bottom: 30px;
      }
      .title {
        font-size: 32px;
        color: #fa5541;
        margin: 0;
      }
      .subtitle {
        font-size: 14px;
        color: #94a3b8;
      }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 20px;
        margin-bottom: 40px;
      }
      .stat-card {
        background-color: #151a2d;
        border: 1px solid #2a3042;
        border-radius: 12px;
        padding: 20px;
        text-align: center;
      }
      .stat-val {
        font-size: 28px;
        font-weight: bold;
        color: #fff;
      }
      .stat-lbl {
        font-size: 11px;
        color: #94a3b8;
        text-transform: uppercase;
        margin-top: 4px;
      }
      .section-title {
        font-size: 20px;
        margin-top: 40px;
        margin-bottom: 16px;
        color: #fff;
        border-left: 4px solid #fa5541;
        padding-left: 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 40px;
      }
      th, td {
        padding: 12px 16px;
        text-align: left;
        border-bottom: 1px solid #2a3042;
      }
      th {
        background-color: #151a2d;
        color: #94a3b8;
        font-size: 12px;
        text-transform: uppercase;
        font-weight: 600;
      }
      tr:hover td {
        background-color: rgba(255,255,255,0.02);
      }
      .badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: bold;
      }
      .badge-passed {
        background-color: rgba(16, 185, 129, 0.2);
        color: #10b981;
      }
      .badge-failed {
        background-color: rgba(239, 68, 68, 0.2);
        color: #ef4444;
      }
      .badge-notrun {
        background-color: rgba(148, 163, 184, 0.2);
        color: #94a3b8;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1 class="title">🔥 Agni Holistic Executive Audit Report</h1>
      <p class="subtitle">Comprehensive QA insights for all recorded tests & history | Generated on ${new Date().toLocaleString()}</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-val">${tests.length}</div>
        <div class="stat-lbl">Recorded Scenarios</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${totalRuns}</div>
        <div class="stat-lbl">Total Run Executions</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${successRate}%</div>
        <div class="stat-lbl">Overall Success Rate</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${avgDuration}s</div>
        <div class="stat-lbl">Average Test Duration</div>
      </div>
    </div>

    <h2 class="section-title">Recorded Scenarios Overview</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 25%;">Scenario Name</th>
          <th style="width: 45%;">Description</th>
          <th style="width: 15%;">Latest Status</th>
          <th style="width: 15%;">Last Duration</th>
        </tr>
      </thead>
      <tbody>
        ${scenariosListHtml}
      </tbody>
    </table>

    <h2 class="section-title">Recent Run History (Last 10 Executions)</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 20%;">Run ID</th>
          <th style="width: 30%;">Scenario Name</th>
          <th style="width: 25%;">Execution Time</th>
          <th style="width: 15%;">Status</th>
          <th style="width: 10%;">Duration</th>
        </tr>
      </thead>
      <tbody>
        ${recentRunsHtml}
      </tbody>
    </table>
  </body>
  </html>
  `;

  fs.writeFileSync(reportPath, htmlContent);
  
  const { shell } = require('electron');
  shell.openPath(reportPath);

  return { success: true, reportPath };
});

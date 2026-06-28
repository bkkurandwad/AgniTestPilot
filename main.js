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

  // Strip any previous screenshot/sleep injections to ensure absolute idempotency
  const cleanCode = code
    .replace(/\r/g, '')
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return !trimmed.includes('screenshotStep') && 
             !trimmed.includes('fs.mkdirSync') &&
             !trimmed.includes('waitForTimeout(2000)');
    })
    .join('\n');

  const lines = cleanCode.split('\n');
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

// Helper to parse recorded code for interactive input fields (fill, type calls)
function parseInputsFromCode(code) {
  const inputs = [];
  if (!code) return inputs;
  
  const lines = code.split('\n');
  lines.forEach((line) => {
    const trimmed = line.trim();
    
    // Scan for fill/type statements
    if (trimmed.startsWith('await ') && 
        (trimmed.includes('.fill(') || trimmed.includes('.type(')) && 
        !trimmed.includes('screenshot') && 
        !trimmed.includes('waitForTimeout')) {
      
      let selector = '';
      let originalValue = '';
      
      // Pattern 1: await page.fill('selector', 'value')
      if (trimmed.includes('page.fill(')) {
        const match = trimmed.match(/page(?:\d*)\.fill\(\s*(['"`])(.*?)\1\s*,\s*(['"`])(.*?)\3\s*\)/);
        if (match) {
          selector = match[2];
          originalValue = match[4];
        }
      } 
      // Pattern 2: await page.locator('selector').fill('value')
      else if (trimmed.includes('.locator(')) {
        const locMatch = trimmed.match(/locator\(\s*(['"`])(.*?)\1\s*\)/);
        const valMatch = trimmed.match(/\.(fill|type)\(\s*(['"`])(.*?)\2\s*\)/);
        if (locMatch && valMatch) {
          selector = locMatch[2];
          originalValue = valMatch[3];
        }
      }
      // Pattern 3: await page.getByPlaceholder('placeholder').fill('value')
      else if (trimmed.includes('.getByPlaceholder(')) {
        const placeholderMatch = trimmed.match(/getByPlaceholder\(\s*(['"`])(.*?)\1\s*\)/);
        const valMatch = trimmed.match(/\.(fill|type)\(\s*(['"`])(.*?)\2\s*\)/);
        if (placeholderMatch && valMatch) {
          selector = `Placeholder: "${placeholderMatch[2]}"`;
          originalValue = valMatch[3];
        }
      }
      // Pattern 4: await page.getByLabel('label').fill('value')
      else if (trimmed.includes('.getByLabel(')) {
        const labelMatch = trimmed.match(/getByLabel\(\s*(['"`])(.*?)\1\s*\)/);
        const valMatch = trimmed.match(/\.(fill|type)\(\s*(['"`])(.*?)\2\s*\)/);
        if (labelMatch && valMatch) {
          selector = `Label: "${labelMatch[2]}"`;
          originalValue = valMatch[3];
        }
      }
      // Pattern 5: await page.getByRole('role', ...).fill('value')
      else if (trimmed.includes('.getByRole(')) {
        const roleWithNameMatch = trimmed.match(/getByRole\(\s*(['"`])(.*?)\1\s*,\s*\{\s*name:\s*(['"`])(.*?)\3\s*\}\s*\)/);
        const valMatch = trimmed.match(/\.(fill|type)\(\s*(['"`])(.*?)\2\s*\)/);
        if (roleWithNameMatch && valMatch) {
          selector = `Role: ${roleWithNameMatch[2]} (Name: "${roleWithNameMatch[4]}")`;
          originalValue = valMatch[3];
        } else {
          const roleMatch = trimmed.match(/getByRole\(\s*(['"`])(.*?)\1\s*[,)]/);
          if (roleMatch && valMatch) {
            selector = `Role: ${roleMatch[2]}`;
            originalValue = valMatch[3];
          }
        }
      }
      // Fallback selector parse
      else {
        const match = trimmed.match(/page(?:\d*)\.([a-zA-Z0-9]+)\(\s*(['"`])(.*?)\2\s*\)\s*\.\s*(fill|type)\(\s*(['"`])(.*?)\5\s*\)/);
        if (match) {
          selector = `${match[1]}: "${match[3]}"`;
          originalValue = match[6];
        }
      }
      
      if (selector) {
        // Prevent duplicate selectors in the same script
        const exists = inputs.some(inp => inp.selector === selector);
        if (!exists) {
          inputs.push({
            selector,
            originalValue,
            lineContent: trimmed
          });
        }
      }
    }
  });
  
  return inputs;
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
  // Set App User Model ID for Windows shortcuts and notifications to match package.json appId
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.agni.testpilot');
  }
  
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
  reportPath: '',
  environments: ['dev', 'prod']
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
    if (!parsed.environments || !Array.isArray(parsed.environments)) {
      parsed.environments = ['dev', 'prod'];
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

// Helper to synchronize/auto-heal parameters database entries using the latest parser
function syncTestParameters(test) {
  let code = test.rawCode;
  if (!code && test.filePath) {
    const absolutePath = path.join(DATA_DIR, test.filePath);
    if (fs.existsSync(absolutePath)) {
      code = fs.readFileSync(absolutePath, 'utf8');
    }
  }
  if (!code) return test.parameters || [];
  
  const parsedInputs = parseInputsFromCode(code);
  const currentParams = test.parameters || [];
  const mergedParams = [];
  
  parsedInputs.forEach((inp, idx) => {
    // Check if there is an existing parameter with the same selector
    const existing = currentParams.find(p => p.selector === inp.selector);
    if (existing) {
      mergedParams.push({
        ...existing,
        lineContent: inp.lineContent,
        originalValue: inp.originalValue
      });
    } else {
      mergedParams.push({
        id: `param_${Date.now()}_${idx}`,
        selector: inp.selector,
        originalValue: inp.originalValue,
        lineContent: inp.lineContent,
        envRules: {}
      });
    }
  });
  
  return mergedParams;
}

// Get all tests
ipcMain.handle('get-tests', async () => {
  const tests = readTestsData();
  let changed = false;
  const syncedTests = tests.map(test => {
    const syncedParams = syncTestParameters(test);
    const originalParamCount = (test.parameters || []).length;
    // Check if lengths differ or any selector is missing to trigger saving
    const hasDiff = syncedParams.length !== originalParamCount || 
      syncedParams.some((p, i) => !test.parameters[i] || test.parameters[i].selector !== p.selector);
      
    if (hasDiff) {
      test.parameters = syncedParams;
      changed = true;
    }
    return test;
  });
  if (changed) {
    writeTestsData(syncedTests);
  }
  return syncedTests;
});

// Start Recording
ipcMain.handle('start-recording', async (event, { name, description, startUrls, recordEnv, options }) => {
  return new Promise((resolve) => {
    const id = Date.now().toString(); // unique ID
    const testFileName = `test_${id}.js`;
    const testFilePath = path.join(TESTS_DIR, testFileName);

    const activeEnv = recordEnv || 'dev';
    const launchUrl = (startUrls && startUrls[activeEnv]) || '';

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
    if (launchUrl) {
      args.push(launchUrl);
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
        const parsedInputs = parseInputsFromCode(codeContent);
        const parameters = parsedInputs.map((inp, idx) => ({
          id: `param_${Date.now()}_${idx}`,
          selector: inp.selector,
          originalValue: inp.originalValue,
          lineContent: inp.lineContent,
          envRules: {}
        }));

        const newTest = {
          id,
          name: name || `Recorded Test ${tests.length + 1}`,
          description: description || 'No description provided.',
          filePath: path.join('tests', testFileName),
          startUrl: (startUrls && startUrls[activeEnv]) || '',
          startUrls: startUrls || {},
          env: activeEnv,
          rawCode: rawCode,
          options: options || null,
          parameters,
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
        let rawCode = fs.readFileSync(absoluteFilePath, 'utf8');
        let codeContent = rawCode;
        
        if (test.options) {
          codeContent = postProcessCode(rawCode, test.options);
          fs.writeFileSync(absoluteFilePath, codeContent);
        }

        const updatedTests = readTestsData();
        const currentIdx = updatedTests.findIndex(t => t.id === testId);
        if (currentIdx !== -1) {
          const parsedInputs = parseInputsFromCode(codeContent);
          const parameters = parsedInputs.map((inp, idx) => ({
            id: `param_${Date.now()}_${idx}`,
            selector: inp.selector,
            originalValue: inp.originalValue,
            lineContent: inp.lineContent,
            envRules: {}
          }));
          
          updatedTests[currentIdx].createdAt = new Date().toISOString(); // update timestamp
          updatedTests[currentIdx].lastRunStatus = 'Not Run';
          updatedTests[currentIdx].parameters = parameters;
          updatedTests[currentIdx].rawCode = rawCode;
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

ipcMain.handle('run-test', async (event, { testId, headless, runEnv }) => {
  const tests = readTestsData();
  const test = tests.find(t => t.id === testId);
  if (!test) {
    return { success: false, error: 'Test not found' };
  }

  const absoluteFilePath = path.join(DATA_DIR, test.filePath);

  if (!fs.existsSync(absoluteFilePath)) {
    return { success: false, error: 'Test file does not exist on disk' };
  }

  const runId = Date.now().toString(); // unique execution ID

  // Evaluate parameter rules and build environment variables injection
  const evaluatedParams = {};
  const parameters = test.parameters || [];
  const activeEnv = runEnv || 'dev';
  
  parameters.forEach(param => {
    const rule = (param.envRules && param.envRules[activeEnv]) || { type: 'static', value: param.originalValue };
    let finalValue = rule.value || '';
    
    if (rule.type === 'random-phone') {
      finalValue = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    } else if (rule.type === 'random-alpha') {
      const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      finalValue = Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    } else if (rule.type === 'random-alphanumeric') {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      finalValue = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    } else if (rule.type === 'timestamp') {
      finalValue = Date.now().toString();
    } else if (rule.type === 'random-email') {
      finalValue = `user_${Date.now()}@example.com`;
    } else if (rule.type === 'custom-pattern') {
      const pattern = rule.value || '';
      let generated = '';
      const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const digits = '0123456789';
      const alphanum = alphabet + digits;
      
      for (let i = 0; i < pattern.length; i++) {
        const char = pattern[i].toUpperCase();
        if (char === 'L') {
          generated += alphabet[Math.floor(Math.random() * alphabet.length)];
        } else if (char === 'D') {
          generated += digits[Math.floor(Math.random() * digits.length)];
        } else if (char === 'X') {
          generated += alphanum[Math.floor(Math.random() * alphanum.length)];
        } else {
          generated += pattern[i]; // preserve spaces, hyphens, etc.
        }
      }
      finalValue = generated;
    }
    
    evaluatedParams[`PARAM_${param.id}`] = finalValue;
  });

  // Resolve base URL for the selected environment
  const envStartUrl = (test.startUrls && test.startUrls[activeEnv]) || test.startUrl;
  if (envStartUrl) {
    evaluatedParams['START_URL'] = envStartUrl;
  }

  return new Promise((resolve) => {
    let content = fs.readFileSync(absoluteFilePath, 'utf8');

    // Substitute the first page.goto URL with the environment-specific URL
    if (envStartUrl) {
      content = content.replace(/(await\s+page(?:\d*)\.goto\(\s*)(['"`])(.*?)\2(\s*\))/i, `$1process.env.START_URL || $2$3$2$4`);
    }

    // Substitute parameter fill/type lines in content
    parameters.forEach(param => {
      if (param.lineContent) {
        const paramEnvName = `PARAM_${param.id}`;
        const fillIndex = param.lineContent.indexOf('.fill(');
        const typeIndex = param.lineContent.indexOf('.type(');
        const isFill = fillIndex !== -1;
        const actionIndex = isFill ? fillIndex : typeIndex;
        
        if (actionIndex !== -1) {
          const methodCall = isFill ? 'fill' : 'type';
          const locatorPart = param.lineContent.substring(0, actionIndex);
          const replacementLine = `${locatorPart}.${methodCall}(process.env.${paramEnvName} || ${JSON.stringify(param.originalValue)});`;
          content = content.replace(param.lineContent, replacementLine);
        }
      }
    });

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
    const env = { ...process.env, ...evaluatedParams };
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
ipcMain.handle('update-test', async (event, { testId, name, description, env, startUrl, startUrls, options, parameters }) => {
  const tests = readTestsData();
  const testIndex = tests.findIndex(t => t.id === testId);
  if (testIndex === -1) {
    return { success: false, error: 'Test not found' };
  }

  const test = tests[testIndex];
  test.name = name;
  test.description = description;
  test.env = env || 'dev';
  test.startUrls = startUrls || {};
  test.startUrl = (startUrls && startUrls[env]) || startUrl || '';
  test.options = options;
  if (parameters) {
    test.parameters = parameters;
  }

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

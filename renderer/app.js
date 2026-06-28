// DOM Elements - Views
const viewDashboard = document.getElementById('view-dashboard');
const viewScenarios = document.getElementById('view-scenarios');
const viewHistory = document.getElementById('view-history');
const viewSettings = document.getElementById('view-settings');
const viewParameterEditor = document.getElementById('view-parameter-editor');
const btnBackToScenarios = document.getElementById('btn-back-to-scenarios');

// DOM Elements - Sidebar Nav
const navDashboard = document.getElementById('nav-dashboard');
const navScenarios = document.getElementById('nav-scenarios');
const navHistory = document.getElementById('nav-history');
const navSettings = document.getElementById('nav-settings');

// DOM Elements - Lists & States
const testsListContainer = document.getElementById('tests-list-container');
const emptyState = document.getElementById('empty-state');
const testsListHeader = document.getElementById('tests-list-header');

const historyListContainer = document.getElementById('history-list-container');
const emptyHistoryState = document.getElementById('empty-history-state');
const emptyHistoryTitle = document.getElementById('empty-history-title');
const emptyHistoryDesc = document.getElementById('empty-history-desc');
const historyListHeader = document.getElementById('history-list-header');

// Modals & Overlays
const recordingStatus = document.getElementById('recording-status');
const codeModal = document.getElementById('code-modal');
const runDrawer = document.getElementById('run-drawer');
const editModal = document.getElementById('edit-modal');
const lightboxModal = document.getElementById('lightbox-modal');
const runConfirmModal = document.getElementById('run-confirm-modal');
const recordModal = document.getElementById('record-modal');

// Form Inputs - Recording Form (Modal)
const recordForm = document.getElementById('record-form');
const recordEnvsContainer = document.getElementById('record-envs-container');
const testNameInput = document.getElementById('test-name');
const testDescInput = document.getElementById('test-description');
const headlessToggle = document.getElementById('headless-toggle');

// Toggles & Screenshot Path (Record Form)
const testSleepToggle = document.getElementById('test-sleep-toggle');
const testScreenshotToggle = document.getElementById('test-screenshot-toggle');
const testScreenshotPath = document.getElementById('test-screenshot-path');
const screenshotPathContainer = document.getElementById('screenshot-path-container');

// Form Inputs - Edit Form
const editForm = document.getElementById('edit-form');
const editTestIdInput = document.getElementById('edit-test-id');
const editTestNameInput = document.getElementById('edit-test-name');
const editTestDescInput = document.getElementById('edit-test-description');
const editEnvsContainer = document.getElementById('edit-envs-container');
const editTestSleepToggle = document.getElementById('edit-test-sleep-toggle');
const editTestScreenshotToggle = document.getElementById('edit-test-screenshot-toggle');
const editTestScreenshotPath = document.getElementById('edit-test-screenshot-path');
const editScreenshotPathContainer = document.getElementById('edit-screenshot-path-container');
const btnCancelEdit = document.getElementById('edit-cancel');
const btnCloseEditModal = document.getElementById('edit-modal-close');

// Form Inputs - Run Confirm Form
const runConfirmForm = document.getElementById('run-confirm-form');
const runConfirmTestId = document.getElementById('run-confirm-test-id');
const runConfirmSubtitle = document.getElementById('run-confirm-subtitle');
const runConfirmHeadlessToggle = document.getElementById('run-confirm-headless-toggle');
const btnRunConfirmCancel = document.getElementById('run-confirm-cancel');
const btnRunConfirmClose = document.getElementById('run-confirm-modal-close');

// Form Inputs - Settings Form
const settingsForm = document.getElementById('settings-form');
const settingsScreenshotPath = document.getElementById('settings-screenshot-path');
const settingsReportPath = document.getElementById('settings-report-path');
const settingsHeadlessDefault = document.getElementById('settings-headless-default');
const settingsNewEnv = document.getElementById('settings-new-env');
const settingsAddEnvBtn = document.getElementById('settings-add-env-btn');
const settingsEnvChipsContainer = document.getElementById('settings-env-chips-container');
const runConfirmEnvSelect = document.getElementById('run-confirm-env-select');

// Lightbox Elements
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCaption = document.getElementById('lightbox-caption');
const lightboxClose = document.getElementById('lightbox-close');

// Navigation Buttons
const btnClearHistory = document.getElementById('btn-clear-history');
const btnOpenRecordModal = document.getElementById('btn-open-record-modal');
const btnCloseRecordModal = document.getElementById('record-modal-close');
const btnCancelRecord = document.getElementById('record-cancel');
const btnEmptyRecord = document.getElementById('btn-empty-record');

const btnCloseCodeModal = document.getElementById('code-modal-close');
const btnDoneCodeModal = document.getElementById('code-modal-done');
const btnCopyCode = document.getElementById('code-modal-copy');

const btnCloseRunDrawer = document.getElementById('run-drawer-close');
const btnDrawerCloseAction = document.getElementById('btn-drawer-close-action');
const btnStopTest = document.getElementById('btn-stop-test');
const btnClearLogs = document.getElementById('btn-clear-logs');

// Dashboard Widgets
const cardRecorded = document.getElementById('card-recorded');
const cardRuns = document.getElementById('card-runs');
const cardPassed = document.getElementById('card-passed');
const cardFailed = document.getElementById('card-failed');

const countRecorded = document.getElementById('count-recorded');
const countRuns = document.getElementById('count-runs');
const countPassed = document.getElementById('count-passed');
const countFailed = document.getElementById('count-failed');

const successRingFg = document.getElementById('success-ring-fg');
const successRingText = document.getElementById('success-ring-text');
const statAvgDuration = document.getElementById('stat-avg-duration');
const statTotalDuration = document.getElementById('stat-total-duration');
const recentActivityContainer = document.getElementById('recent-activity-container');
const btnExportHolistic = document.getElementById('btn-export-holistic');

// Filter Buttons (History view)
const filterBtnAll = document.getElementById('filter-btn-all');
const filterBtnPassed = document.getElementById('filter-btn-passed');
const filterBtnFailed = document.getElementById('filter-btn-failed');

// Drawer / Viewer Contents
const drawerTestTitle = document.getElementById('drawer-test-title');
const drawerRunStatus = document.getElementById('drawer-run-status');
const drawerDuration = document.getElementById('drawer-duration');
const logOutputContent = document.getElementById('log-output-content');
const codeViewerContent = document.getElementById('code-viewer-content');

// App State
let testsList = [];
let historyList = [];
let activeRunningTestId = null;
let logUnsubscribe = null;
let finishedUnsubscribe = null;
let historyFilter = 'all'; // 'all', 'passed', 'failed'

// Global settings defaults
let globalSettings = {
  screenshotPath: '/Users/bhargavkk/.gemini/antigravity/scratch/playwright-test-agent/screenshots',
  defaultHeadless: false,
  reportPath: '',
  environments: ['dev', 'prod']
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadHistory();
  await loadTests();
  setupNavigation();
  setupEventListeners();
  setupRealtimeListeners();
  renderRecordEnvsContainer();
});

// Load settings from backend file
async function loadSettings() {
  try {
    const settings = await window.api.getSettings();
    if (settings) {
      globalSettings = settings;
      if (!globalSettings.environments) {
        globalSettings.environments = ['dev', 'prod'];
      }
      settingsScreenshotPath.value = globalSettings.screenshotPath;
      settingsReportPath.value = globalSettings.reportPath || '';
      settingsHeadlessDefault.checked = globalSettings.defaultHeadless;
      testScreenshotPath.value = globalSettings.screenshotPath;
      renderSettingsEnvChips();
    }
  } catch (error) {
    console.error('Error loading global settings:', error);
  }
}

// Render environment manager chips in Settings UI
function renderSettingsEnvChips() {
  if (!settingsEnvChipsContainer) return;
  settingsEnvChipsContainer.innerHTML = '';
  const envs = globalSettings.environments || ['dev', 'prod'];
  
  envs.forEach(env => {
    const chip = document.createElement('div');
    chip.className = 'env-chip';
    chip.style.cssText = 'background: rgba(255,255,255,0.06); border: 1px solid var(--border-color); padding: 4px 10px; border-radius: 12px; display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #fff; text-transform: uppercase;';
    chip.innerHTML = `
      <span>${env}</span>
      <span class="delete-chip" data-env="${env}" style="cursor: pointer; color: var(--danger); font-weight: bold; font-size: 14px; line-height: 1;">×</span>
    `;
    
    chip.querySelector('.delete-chip').addEventListener('click', (e) => {
      const envToDelete = e.target.getAttribute('data-env');
      if (globalSettings.environments.length <= 1) {
        alert('You must have at least one environment.');
        return;
      }
      globalSettings.environments = globalSettings.environments.filter(item => item !== envToDelete);
      renderSettingsEnvChips();
    });
    
    settingsEnvChipsContainer.appendChild(chip);
  });
}

// Setup Tab Navigation
function setupNavigation() {
  const switchView = (targetView) => {
    // Reset sidebar selection classes
    navDashboard.classList.remove('active');
    navScenarios.classList.remove('active');
    navHistory.classList.remove('active');
    navSettings.classList.remove('active');

    // Hide all views
    viewDashboard.classList.add('hidden');
    viewScenarios.classList.add('hidden');
    viewHistory.classList.add('hidden');
    viewSettings.classList.add('hidden');
    if (viewParameterEditor) viewParameterEditor.classList.add('hidden');

    if (targetView === 'dashboard') {
      navDashboard.classList.add('active');
      viewDashboard.classList.remove('hidden');
      loadHistory();
      loadTests();
    } else if (targetView === 'scenarios') {
      navScenarios.classList.add('active');
      viewScenarios.classList.remove('hidden');
      loadTests();
    } else if (targetView === 'history') {
      navHistory.classList.add('active');
      viewHistory.classList.remove('hidden');
      loadHistory();
    } else if (targetView === 'settings') {
      navSettings.classList.add('active');
      viewSettings.classList.remove('hidden');
    } else if (targetView === 'parameter-editor') {
      if (viewParameterEditor) viewParameterEditor.classList.remove('hidden');
    }
  };

  navDashboard.addEventListener('click', () => switchView('dashboard'));
  navScenarios.addEventListener('click', () => switchView('scenarios'));
  navHistory.addEventListener('click', () => switchView('history'));
  navSettings.addEventListener('click', () => switchView('settings'));

  if (btnBackToScenarios) {
    btnBackToScenarios.addEventListener('click', () => switchView('scenarios'));
  }

  window.switchView = switchView;
}

// Render dynamic environments base URLs inputs inside Record Modal
function renderRecordEnvsContainer() {
  if (!recordEnvsContainer) return;
  const envs = globalSettings.environments || ['dev', 'prod'];
  
  let envSelectOptionsHtml = '';
  let envUrlsInputsHtml = '';
  
  envs.forEach(env => {
    envSelectOptionsHtml += `<option value="${env}">${env.toUpperCase()}</option>`;
    envUrlsInputsHtml += `
      <div class="form-group">
        <label for="record-url-${env}">Base URL (${env.toUpperCase()})</label>
        <input type="url" id="record-url-${env}" class="record-env-url-input" data-env="${env}" placeholder="https://${env}.example.com" required>
      </div>
    `;
  });

  recordEnvsContainer.innerHTML = `
    <div class="form-grid-2">
      <div class="form-group">
        <label for="record-env-select">Select Environment to Record On</label>
        <select id="record-env-select" class="form-select-input">
          ${envSelectOptionsHtml}
        </select>
      </div>
    </div>
    <div style="margin-top: 12px; border-top: 1px dashed var(--border-color); padding-top: 12px;">
      <h4 style="margin: 0 0 10px 0; color: #fff; font-size: 13px; font-family: var(--font-display);">Starting URLs per Environment</h4>
      <div class="form-grid-2">
        ${envUrlsInputsHtml}
      </div>
    </div>
  `;
}

// Setup Realtime IPC Listeners
function setupRealtimeListeners() {
  logUnsubscribe = window.api.onTestLog(({ testId, data, type }) => {
    if (activeRunningTestId === testId) {
      appendLog(data, type);
    }
  });

  finishedUnsubscribe = window.api.onTestFinished(({ testId, status, duration }) => {
    if (activeRunningTestId === testId) {
      updateDrawerStatus(status, duration);
      btnStopTest.disabled = true;
      loadHistory();
      loadTests(); 
    }
  });
}

// Fetch all tests
async function loadTests() {
  try {
    testsList = await window.api.getTests();
    renderTests();
    updateDashboardStats();
  } catch (error) {
    console.error('Error loading tests:', error);
  }
}

// Fetch execution history
async function loadHistory() {
  try {
    historyList = await window.api.getHistory();
    renderHistory();
    updateDashboardStats();
  } catch (error) {
    console.error('Error loading history:', error);
  }
}

// Update Dashboard Numbers & Holistic Statistics Widget
function updateDashboardStats() {
  const totalRecordedScenarios = testsList.length;
  const totalRuns = historyList.length;
  const passedRunsCount = historyList.filter(r => r.status === 'Passed').length;
  const failedRunsCount = historyList.filter(r => r.status === 'Failed').length;

  countRecorded.innerText = totalRecordedScenarios;
  countRuns.innerText = totalRuns;
  countPassed.innerText = passedRunsCount;
  countFailed.innerText = failedRunsCount;

  // 2. Execution Success Rate Ring
  const successPercentage = totalRuns > 0 ? Math.round((passedRunsCount / totalRuns) * 100) : 0;
  
  successRingText.innerText = `${successPercentage}%`;
  successRingFg.setAttribute('stroke-dasharray', `${successPercentage}, 100`);

  // 3. Durations
  const totalDurationSum = historyList.reduce((acc, r) => acc + parseFloat(r.duration || 0), 0);
  const avgDurationVal = totalRuns > 0 ? (totalDurationSum / totalRuns).toFixed(2) : '0.00';

  statAvgDuration.innerText = `${avgDurationVal}s`;
  statTotalDuration.innerText = `${totalDurationSum.toFixed(2)}s`;

  // 4. Populate Recent Activity List (Last 5 Runs)
  recentActivityContainer.innerHTML = '';
  if (historyList.length === 0) {
    recentActivityContainer.innerHTML = `<p style="font-size:13px; color:var(--text-secondary); text-align:center; padding: 40px 0;">No runs executed yet.</p>`;
    return;
  }

  historyList.slice(0, 5).forEach(run => {
    const item = document.createElement('div');
    item.className = 'recent-item';
    
    const formattedTime = new Date(run.timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let badgeClass = 'badge-failed';
    if (run.status === 'Passed') {
      badgeClass = 'badge-passed';
    }

    item.innerHTML = `
      <div class="recent-meta">
        <span class="recent-name">${escapeHTML(run.testName)}</span>
        <span class="recent-time">Run: ${run.runId} • ${formattedTime}</span>
      </div>
      <span class="badge ${badgeClass}">${run.status}</span>
    `;
    recentActivityContainer.appendChild(item);
  });
}

// Apply list filter on History page list
function applyHistoryFilter(filterType) {
  historyFilter = filterType;

  // Toggle button active classes
  filterBtnAll.classList.remove('btn-active');
  filterBtnPassed.classList.remove('btn-active');
  filterBtnFailed.classList.remove('btn-active');

  if (filterType === 'all') filterBtnAll.classList.add('btn-active');
  if (filterType === 'passed') filterBtnPassed.classList.add('btn-active');
  if (filterType === 'failed') filterBtnFailed.classList.add('btn-active');

  renderHistory();
}

// Render Tests Scenarios list rows
function renderTests() {
  const existingContainers = testsListContainer.querySelectorAll('.scenario-item-container');
  existingContainers.forEach(c => c.remove());

  if (testsList.length === 0) {
    emptyState.style.display = 'flex';
    testsListHeader.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  testsListHeader.style.display = 'grid';

  testsList.forEach(test => {
    const container = document.createElement('div');
    container.className = 'scenario-item-container';

    const row = document.createElement('div');
    row.className = 'test-row';
    row.setAttribute('data-id', test.id);

    const createdDate = new Date(test.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    let statusClass = 'badge-notrun';
    let statusText = 'Not Run';
    if (test.lastRunStatus === 'Passed') {
      statusClass = 'badge-passed';
      statusText = 'Passed';
    } else if (test.lastRunStatus === 'Failed') {
      statusClass = 'badge-failed';
      statusText = 'Failed';
    } else if (test.lastRunStatus === 'Running') {
      statusClass = 'badge-running';
      statusText = 'Running';
    }

    row.innerHTML = `
      <div class="col-name">
        <span class="test-name-txt">${escapeHTML(test.name)}</span>
        <span class="test-date-txt">Recorded: ${createdDate}</span>
      </div>
      
      <div class="col-desc" title="${escapeHTML(test.description || '')}">${escapeHTML(test.description || 'No description provided.')}</div>
      
      <div class="col-status">
        <span class="badge ${statusClass}">${statusText}</span>
      </div>
      
      <div class="col-duration">${test.duration ? `${test.duration}s` : '--'}</div>
      
      <div class="col-actions">
        <button class="btn-icon view-code-btn" title="View Code">📄</button>
        <button class="btn-icon rerecord-btn" title="Re-record Scenario">🔄</button>
        <button class="btn-icon edit-btn" title="Edit Scenario Details">✏️</button>
        <button class="btn-icon delete-btn" title="Delete Scenario">🗑️</button>
        <button class="btn-icon run-btn" title="Execute Scenario">▶️</button>
      </div>
    `;

    // Row click redirects to dedicated page view
    row.addEventListener('click', (e) => {
      if (e.target.closest('.btn-icon')) return;
      openParameterEditor(test.id);
    });

    row.querySelector('.run-btn').addEventListener('click', (e) => { e.stopPropagation(); promptRunConfirm(test.id); });
    row.querySelector('.view-code-btn').addEventListener('click', (e) => { e.stopPropagation(); viewTestCode(test.id); });
    row.querySelector('.rerecord-btn').addEventListener('click', (e) => { e.stopPropagation(); rerecordTestScenario(test.id); });
    row.querySelector('.edit-btn').addEventListener('click', (e) => { e.stopPropagation(); openEditModal(test.id); });
    row.querySelector('.delete-btn').addEventListener('click', (e) => { e.stopPropagation(); deleteTestScenario(test.id); });

    container.appendChild(row);
    testsListContainer.appendChild(container);
  });
}

// Render dedicated parameters editor workspace and switch view
function openParameterEditor(testId) {
  const test = testsList.find(t => t.id === testId);
  if (!test) return;

  const workspace = document.getElementById('param-editor-workspace');
  if (!workspace) return;

  document.getElementById('param-editor-title').innerText = `Configure Parameters: ${test.name}`;

  const envs = globalSettings.environments || ['dev', 'prod'];
  const params = test.parameters || [];

  if (params.length === 0) {
    workspace.innerHTML = `
      <div style="text-align: center; padding: 40px 0;">
        <p style="font-size:15px; color:var(--text-secondary); margin-bottom: 20px;">No input fields detected in this scenario script.</p>
        <button type="button" class="btn btn-secondary" onclick="window.switchView('scenarios')">Back to Scenarios</button>
      </div>
    `;
    window.switchView('parameter-editor');
    return;
  }

  let html = `
    <div class="params-editor-box">
      <div style="overflow-x: auto;">
        <table class="params-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr>
              <th style="text-align: left; padding: 12px 10px; color: var(--text-muted); border-bottom: 1px solid var(--border-color); width: 30%;">Locator / Selector</th>
              <th style="text-align: left; padding: 12px 10px; color: var(--text-muted); border-bottom: 1px solid var(--border-color);">Environment Configurations & Generation Rules</th>
              <th style="text-align: right; padding: 12px 10px; color: var(--text-muted); border-bottom: 1px solid var(--border-color); width: 15%;">Actions</th>
            </tr>
          </thead>
          <tbody>
  `;

  params.forEach(param => {
    html += `
      <tr class="param-row" data-param-id="${param.id}" style="border-bottom: 1px solid rgba(255,255,255,0.04);">
        <td style="padding: 16px 10px; font-family: var(--font-code); color: #60a5fa; vertical-align: top;" title="${escapeHTML(param.selector)}">
          ${escapeHTML(param.selector)}
        </td>
        <td style="padding: 16px 10px;">
          <div style="display: flex; flex-direction: column; gap: 12px;">
    `;

    envs.forEach(env => {
      const rule = (param.envRules && param.envRules[env]) || { type: 'static', value: param.originalValue };
      const showInput = rule.type === 'static' || rule.type === 'custom-pattern';
      const placeholder = rule.type === 'custom-pattern' 
        ? 'e.g. LLDDDDD (L=Letter, D=Digit, X=AlphaNum)' 
        : 'Enter static value...';
      
      html += `
            <div class="env-rule-item" data-env="${env}" style="display: flex; align-items: center; gap: 12px;">
              <span class="badge" style="width: 60px; text-align: center; text-transform: uppercase; font-weight: 600; padding: 4px 6px;">${env}</span>
              
              <select class="param-rule-select form-select-input" style="padding: 6px 10px; font-size: 12px; margin: 0; width: 180px;">
                <option value="static" ${rule.type === 'static' ? 'selected' : ''}>Static Value</option>
                <option value="random-phone" ${rule.type === 'random-phone' ? 'selected' : ''}>Random Phone (10 digits)</option>
                <option value="random-alpha" ${rule.type === 'random-alpha' ? 'selected' : ''}>Random Alpha</option>
                <option value="random-alphanumeric" ${rule.type === 'random-alphanumeric' ? 'selected' : ''}>Random AlphaNum</option>
                <option value="random-email" ${rule.type === 'random-email' ? 'selected' : ''}>Random Email</option>
                <option value="timestamp" ${rule.type === 'timestamp' ? 'selected' : ''}>Timestamp</option>
                <option value="custom-pattern" ${rule.type === 'custom-pattern' ? 'selected' : ''}>Custom Format Pattern</option>
              </select>
              
              <input type="text" class="param-rule-value" value="${escapeHTML(rule.value || '')}" 
                     style="padding: 6px 10px; font-size: 12px; margin: 0; flex: 1; min-width: 150px; ${showInput ? '' : 'display: none;'}" 
                     placeholder="${placeholder}">
            </div>
      `;
    });

    html += `
          </div>
        </td>
        <td style="padding: 16px 10px; text-align: right; vertical-align: top;">
          <button type="button" class="btn btn-secondary btn-xs copy-all-btn" style="padding: 6px 10px; font-size: 11px;">Copy to All</button>
        </td>
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; border-top: 1px solid var(--border-color); padding-top: 16px;">
        <button type="button" class="btn btn-secondary" onclick="window.switchView('scenarios')" style="padding: 10px 20px;">Cancel</button>
        <button type="button" class="btn btn-primary btn-save-params" style="padding: 10px 24px; font-weight: 600;">Save Configurations</button>
      </div>
    </div>
  `;

  workspace.innerHTML = html;

  // Add event listeners inside table rows
  const rows = workspace.querySelectorAll('.param-row');
  rows.forEach(row => {
    const envRuleItems = row.querySelectorAll('.env-rule-item');
    envRuleItems.forEach(item => {
      const select = item.querySelector('.param-rule-select');
      const input = item.querySelector('.param-rule-value');
      
      select.addEventListener('change', () => {
        if (select.value === 'static' || select.value === 'custom-pattern') {
          input.style.display = '';
          input.placeholder = select.value === 'custom-pattern' 
            ? 'e.g. LLDDDDD (L=Letter, D=Digit, X=AlphaNum)' 
            : 'Enter static value...';
        } else {
          input.style.display = 'none';
        }
      });
    });

    const copyAllBtn = row.querySelector('.copy-all-btn');
    copyAllBtn.addEventListener('click', () => {
      const firstItem = envRuleItems[0];
      const sourceSelect = firstItem.querySelector('.param-rule-select');
      const sourceInput = firstItem.querySelector('.param-rule-value');
      
      const sourceType = sourceSelect.value;
      const sourceVal = sourceInput.value;

      envRuleItems.forEach((item, idx) => {
        if (idx === 0) return;
        const targetSelect = item.querySelector('.param-rule-select');
        const targetInput = item.querySelector('.param-rule-value');
        
        targetSelect.value = sourceType;
        targetInput.value = sourceVal;
        
        if (sourceType === 'static' || sourceType === 'custom-pattern') {
          targetInput.style.display = '';
          targetInput.placeholder = sourceType === 'custom-pattern' 
            ? 'e.g. LLDDDDD (L=Letter, D=Digit, X=AlphaNum)' 
            : 'Enter static value...';
        } else {
          targetInput.style.display = 'none';
        }
      });
    });
  });

  const saveBtn = workspace.querySelector('.btn-save-params');
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.innerText = 'Saving...';
    
    const updatedParameters = [];
    rows.forEach(row => {
      const paramId = row.getAttribute('data-param-id');
      const originalParam = params.find(p => p.id === paramId);
      
      const envRules = {};
      const envRuleItems = row.querySelectorAll('.env-rule-item');
      envRuleItems.forEach(item => {
        const env = item.getAttribute('data-env');
        const select = item.querySelector('.param-rule-select');
        const input = item.querySelector('.param-rule-value');
        
        envRules[env] = {
          type: select.value,
          value: (select.value === 'static' || select.value === 'custom-pattern') ? input.value : ''
        };
      });

      updatedParameters.push({
        ...originalParam,
        envRules
      });
    });

    try {
      const res = await window.api.updateTest({
        testId: test.id,
        name: test.name,
        description: test.description,
        env: test.env,
        startUrls: test.startUrls,
        options: test.options,
        parameters: updatedParameters
      });

      if (res.success) {
        alert('Configurations saved successfully!');
        await loadTests();
        window.switchView('scenarios');
      } else {
        alert(`Failed to save: ${res.error}`);
        saveBtn.disabled = false;
        saveBtn.innerText = 'Save Configurations';
      }
    } catch (e) {
      alert(`System Error saving configurations: ${e.message}`);
      saveBtn.disabled = false;
      saveBtn.innerText = 'Save Configurations';
    }
  });

  window.switchView('parameter-editor');
}

// Render History view rows
function renderHistory() {
  const existingContainers = historyListContainer.querySelectorAll('.history-item-container');
  existingContainers.forEach(container => container.remove());

  // Filter run history records
  const filteredRuns = historyList.filter(run => {
    if (historyFilter === 'all') return true;
    return (run.status || '').toLowerCase() === historyFilter;
  });

  if (filteredRuns.length === 0) {
    emptyHistoryState.style.display = 'flex';
    historyListHeader.style.display = 'none';

    if (historyFilter === 'failed') {
      emptyHistoryTitle.innerText = "No tests failed";
      emptyHistoryDesc.innerText = "Congratulations! All run executions in your log are passing cleanly.";
    } else if (historyFilter === 'passed') {
      emptyHistoryTitle.innerText = "No passed execution runs found";
      emptyHistoryDesc.innerText = "Run scenarios from the Recorded Tests tab to register passing runs.";
    } else {
      emptyHistoryTitle.innerText = "No execution history found";
      emptyHistoryDesc.innerText = "Run your scenarios on the Recorded Tests tab to see logs and screenshots here.";
    }
    return;
  }

  emptyHistoryState.style.display = 'none';
  historyListHeader.style.display = 'grid';

  filteredRuns.forEach(run => {
    const container = document.createElement('div');
    container.className = 'history-item-container';

    const formattedTime = new Date(run.timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    let statusClass = 'badge-failed';
    if (run.status === 'Passed') {
      statusClass = 'badge-passed';
    }

    container.innerHTML = `
      <div class="history-row" data-run-id="${run.runId}">
        <div class="col-runid">${run.runId}</div>
        <div class="col-name">
          <span class="test-name-txt">${escapeHTML(run.testName)}</span>
        </div>
        <div class="col-time">${formattedTime}</div>
        <div class="col-status">
          <span class="badge ${statusClass}">${run.status}</span>
        </div>
        <div class="col-duration">${run.duration}s</div>
        <div class="col-actions">
          <button class="btn btn-xs btn-outline report-btn" data-run-id="${run.runId}">📄 Report</button>
        </div>
      </div>
      <div class="history-details" id="details-${run.runId}">
        <!-- Gallery content is populated below -->
      </div>
    `;

    const row = container.querySelector('.history-row');
    const details = container.querySelector('.history-details');
    const reportBtn = container.querySelector('.report-btn');

    reportBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      reportBtn.disabled = true;
      try {
        const res = await window.api.generateReport(run.runId);
        if (res.success) {
          alert(`Report downloaded successfully to:\n${res.reportPath}`);
        } else {
          alert(`Failed to generate report: ${res.error}`);
        }
      } catch (err) {
        alert(err.message);
      } finally {
        reportBtn.disabled = false;
      }
    });

    // Populating expanded details (screenshots gallery)
    let detailsContent = '';
    if (run.screenshots && run.screenshots.length > 0) {
      detailsContent = `
        <div class="gallery-title">Captured Screenshots (${run.screenshots.length} checkpoints)</div>
        <div class="gallery-scroll">
      `;
      
      run.screenshots.forEach((screenshotPath, index) => {
        const stepNum = index + 1;
        detailsContent += `
          <div class="gallery-card" data-img-src="../${screenshotPath}" data-step="${stepNum}">
            <img class="gallery-img" src="../${screenshotPath}" alt="Step ${stepNum}" loading="lazy">
            <div class="gallery-meta">Action Step ${stepNum}</div>
          </div>
        `;
      });
      detailsContent += `</div>`;
    } else {
      detailsContent = `<p style="font-size:13px; color:var(--text-secondary);">No screenshots captured for this execution run (toggles were disabled).</p>`;
    }
    details.innerHTML = detailsContent;

    // Toggle expansion
    row.addEventListener('click', () => {
      const isExpanded = row.classList.toggle('expanded');
      details.classList.toggle('open', isExpanded);
    });

    // Lightbox triggers
    details.querySelectorAll('.gallery-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        const src = card.getAttribute('data-img-src');
        const step = card.getAttribute('data-step');
        openLightbox(src, `Action Checkpoint - Step ${step}`);
      });
    });

    historyListContainer.appendChild(container);
  });
}

// Lightbox controller
function openLightbox(src, caption) {
  lightboxImg.src = src;
  lightboxCaption.innerText = caption;
  openOverlay(lightboxModal);
}

// Action: Start Recording Scenario
async function startRecordingFlow(e) {
  e.preventDefault();
  
  const name = testNameInput.value.trim();
  const description = testDescInput.value.trim();

  // Read environment URLs map
  const startUrls = {};
  const urlInputs = recordEnvsContainer.querySelectorAll('.record-env-url-input');
  urlInputs.forEach(input => {
    const envKey = input.getAttribute('data-env');
    startUrls[envKey] = input.value.trim();
  });

  const recordEnvSelect = document.getElementById('record-env-select');
  const recordEnv = recordEnvSelect ? recordEnvSelect.value : 'dev';

  const addSleep = testSleepToggle.checked;
  const addScreenshots = testScreenshotToggle.checked;
  const screenshotPath = testScreenshotPath.value.trim();

  const options = {
    addSleep,
    addScreenshots,
    screenshotPath: addScreenshots ? screenshotPath : null
  };

  closeOverlay(recordModal);
  openOverlay(recordingStatus);

  try {
    const result = await window.api.startRecording({ name, description, startUrls, recordEnv, options });
    closeOverlay(recordingStatus);

    if (result.success) {
      recordForm.reset();
      renderRecordEnvsContainer();
      testScreenshotPath.value = globalSettings.screenshotPath;
      screenshotPathContainer.classList.add('hidden');
      
      window.switchView('scenarios');
      loadTests();
    } else {
      alert(`Recording aborted: ${result.error || 'No actions recorded.'}`);
    }
  } catch (error) {
    closeOverlay(recordingStatus);
    alert(`System Error during recording: ${error.message}`);
  }
}

// Action: Prompt Headless check before running test
function promptRunConfirm(testId) {
  const test = testsList.find(t => t.id === testId);
  if (!test) return;

  runConfirmTestId.value = testId;
  runConfirmSubtitle.innerText = `You are about to execute scenario: ${test.name}`;
  runConfirmHeadlessToggle.checked = globalSettings.defaultHeadless;

  // Populate Environments Select Dropdown
  if (runConfirmEnvSelect) {
    runConfirmEnvSelect.innerHTML = '';
    const envs = globalSettings.environments || ['dev', 'prod'];
    envs.forEach(env => {
      const opt = document.createElement('option');
      opt.value = env;
      opt.innerText = env.toUpperCase();
      if (env === test.env) {
        opt.selected = true;
      }
      runConfirmEnvSelect.appendChild(opt);
    });
  }

  openOverlay(runConfirmModal);
}

// Action: Execute test scenario after confirmation
async function runTestScenarioConfirm(e) {
  e.preventDefault();

  const testId = runConfirmTestId.value;
  const isHeadless = runConfirmHeadlessToggle.checked;
  const runEnv = runConfirmEnvSelect ? runConfirmEnvSelect.value : 'dev';

  closeOverlay(runConfirmModal);
  runTestScenarioExec(testId, isHeadless, runEnv);
}

// Actual test execution logic
async function runTestScenarioExec(testId, isHeadless, runEnv) {
  const test = testsList.find(t => t.id === testId);
  if (!test) return;

  activeRunningTestId = testId;

  // Configure logs UI drawer
  drawerTestTitle.innerText = `Running: ${test.name}`;
  drawerRunStatus.innerText = 'RUNNING';
  drawerRunStatus.className = 'badge badge-running';
  drawerDuration.innerText = '0.00s';
  logOutputContent.innerText = 'Launching browser engine...\n';
  
  headlessToggle.checked = isHeadless;
  btnStopTest.disabled = false;
  openDrawer(runDrawer);

  let timerVal = 0;
  const timerInterval = setInterval(() => {
    if (activeRunningTestId !== testId) {
      clearInterval(timerInterval);
      return;
    }
    timerVal += 0.1;
    drawerDuration.innerText = `${timerVal.toFixed(2)}s`;
  }, 100);

  try {
    const res = await window.api.runTest({ testId, headless: isHeadless, runEnv });
    clearInterval(timerInterval);
    if (!res.success) {
      appendLog(`\nExecution Failed: ${res.error || 'Check browser details.'}\n`, 'stderr');
    }
  } catch (error) {
    clearInterval(timerInterval);
    appendLog(`\nSystem Run Error: ${error.message}\n`, 'stderr');
    updateDrawerStatus('Failed');
    btnStopTest.disabled = true;
  }
}

// Action: View Javascript Code
async function viewTestCode(testId) {
  const test = testsList.find(t => t.id === testId);
  if (!test) return;

  try {
    const res = await window.api.readTestCode(testId);
    if (res.success) {
      codeViewerContent.innerText = res.code;
      codeModal.setAttribute('data-current-code', res.code);
      document.getElementById('code-modal-title').innerText = `${test.name} - Script`;
      openOverlay(codeModal);
    } else {
      alert(`Could not fetch code: ${res.error}`);
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
}

// Action: Re-record scenario (overwrite existing scenario file)
async function rerecordTestScenario(testId) {
  const test = testsList.find(t => t.id === testId);
  if (!test) return;

  const confirmRerecord = confirm(`Are you sure you want to re-record "${test.name}"?\nThis will open the browser and completely overwrite your existing script with the new actions.`);
  if (!confirmRerecord) return;

  openOverlay(recordingStatus);

  try {
    const result = await window.api.rerecordTest(testId);
    closeOverlay(recordingStatus);

    if (result.success) {
      alert(`Re-recording saved successfully for "${test.name}"!`);
      loadTests();
    } else {
      alert(`Re-recording aborted: ${result.error || 'No actions recorded.'}`);
    }
  } catch (error) {
    closeOverlay(recordingStatus);
    alert(`System Error during re-recording: ${error.message}`);
  }
}

// Action: Open Edit Metadata Modal
function openEditModal(testId) {
  const test = testsList.find(t => t.id === testId);
  if (!test) return;

  editTestIdInput.value = test.id;
  editTestNameInput.value = test.name;
  editTestDescInput.value = test.description || '';

  // Render edit environments container dynamically
  if (editEnvsContainer) {
    const envs = globalSettings.environments || ['dev', 'prod'];
    const testStartUrls = test.startUrls || {};
    
    let editEnvSelectOptionsHtml = '';
    let editEnvUrlsInputsHtml = '';
    
    envs.forEach(env => {
      const isSelected = (test.env || 'dev') === env;
      editEnvSelectOptionsHtml += `<option value="${env}" ${isSelected ? 'selected' : ''}>${env.toUpperCase()}</option>`;
      const val = testStartUrls[env] || (env === test.env ? test.startUrl : '');
      editEnvUrlsInputsHtml += `
        <div class="form-group">
          <label for="edit-url-${env}">Base URL (${env.toUpperCase()})</label>
          <input type="url" id="edit-url-${env}" class="edit-env-url-input" data-env="${env}" value="${escapeHTML(val)}" placeholder="https://${env}.example.com" required>
        </div>
      `;
    });

    editEnvsContainer.innerHTML = `
      <div class="form-grid-2">
        <div class="form-group">
          <label for="edit-test-env-select">Default Environment</label>
          <select id="edit-test-env-select" class="form-select-input">
            ${editEnvSelectOptionsHtml}
          </select>
        </div>
      </div>
      <div style="margin-top: 12px; border-top: 1px dashed var(--border-color); padding-top: 12px;">
        <h4 style="margin: 0 0 10px 0; color: #fff; font-size: 13px; font-family: var(--font-display);">Starting Base URLs per Environment</h4>
        <div class="form-grid-2">
          ${editEnvUrlsInputsHtml}
        </div>
      </div>
    `;
  }

  if (test.options) {
    editTestSleepToggle.checked = !!test.options.addSleep;
    editTestScreenshotToggle.checked = !!test.options.addScreenshots;
    editTestScreenshotPath.value = test.options.screenshotPath || globalSettings.screenshotPath;
    
    if (test.options.addScreenshots) {
      editScreenshotPathContainer.classList.remove('hidden');
    } else {
      editScreenshotPathContainer.classList.add('hidden');
    }
  } else {
    editTestSleepToggle.checked = false;
    editTestScreenshotToggle.checked = false;
    editTestScreenshotPath.value = globalSettings.screenshotPath;
    editScreenshotPathContainer.classList.add('hidden');
  }

  openOverlay(editModal);
}

// Action: Save edited metadata
async function saveEditFlow(e) {
  e.preventDefault();

  const testId = editTestIdInput.value;
  const name = editTestNameInput.value.trim();
  const description = editTestDescInput.value.trim();

  // Read edit environment URLs map
  const startUrls = {};
  const urlInputs = editEnvsContainer.querySelectorAll('.edit-env-url-input');
  urlInputs.forEach(input => {
    const envKey = input.getAttribute('data-env');
    startUrls[envKey] = input.value.trim();
  });

  const editEnvSelect = document.getElementById('edit-test-env-select');
  const env = editEnvSelect ? editEnvSelect.value : 'dev';
  const startUrl = startUrls[env] || '';

  const addSleep = editTestSleepToggle.checked;
  const addScreenshots = editTestScreenshotToggle.checked;
  const screenshotPath = editTestScreenshotPath.value.trim();

  const options = {
    addSleep,
    addScreenshots,
    screenshotPath: addScreenshots ? screenshotPath : null
  };

  try {
    const res = await window.api.updateTest({ testId, name, description, env, startUrl, startUrls, options });
    closeOverlay(editModal);
    if (res.success) {
      loadTests();
    } else {
      alert(`Failed to save changes: ${res.error}`);
    }
  } catch (error) {
    closeOverlay(editModal);
    alert(`Error updating metadata: ${error.message}`);
  }
}

// Action: Save global settings configurations
async function saveSettingsFlow(e) {
  e.preventDefault();

  const pathVal = settingsScreenshotPath.value.trim();
  const reportPathVal = settingsReportPath.value.trim();
  const headlessVal = settingsHeadlessDefault.checked;

  try {
    const res = await window.api.saveSettings({ 
      screenshotPath: pathVal, 
      reportPath: reportPathVal, 
      defaultHeadless: headlessVal,
      environments: globalSettings.environments
    });
    if (res.success) {
      globalSettings.screenshotPath = pathVal;
      globalSettings.reportPath = reportPathVal;
      globalSettings.defaultHeadless = headlessVal;
      alert('Global configurations saved successfully!');
      testScreenshotPath.value = pathVal;
      renderSettingsEnvChips();
    } else {
      alert('Failed to save settings configurations.');
    }
  } catch (err) {
    alert(`Error saving settings: ${err.message}`);
  }
}

// Action: Delete scenario
async function deleteTestScenario(testId) {
  const test = testsList.find(t => t.id === testId);
  if (!test) return;

  const confirmDelete = confirm(`Are you sure you want to delete the scenario "${test.name}"?`);
  if (!confirmDelete) return;

  try {
    const res = await window.api.deleteTest(testId);
    if (res.success) {
      loadTests();
    } else {
      alert(`Deletion failed: ${res.error}`);
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
}

// Helpers: Overlay Utilities
function openOverlay(el) {
  el.classList.add('open');
}

function closeOverlay(el) {
  el.classList.remove('open');
}

function openDrawer(el) {
  el.classList.add('open');
}

function closeDrawer(el) {
  el.classList.remove('open');
  activeRunningTestId = null;
}

function appendLog(text, type) {
  const isStderr = type === 'stderr';
  const span = document.createElement('span');
  if (isStderr) {
    span.style.color = 'var(--danger)';
  }
  span.innerText = text;
  logOutputContent.appendChild(span);
  logOutputContent.scrollTop = logOutputContent.scrollHeight;
}

function updateDrawerStatus(status, duration) {
  drawerRunStatus.innerText = status.toUpperCase();
  if (status === 'Passed') {
    drawerRunStatus.className = 'badge badge-passed';
  } else if (status === 'Failed') {
    drawerRunStatus.className = 'badge badge-failed';
  } else {
    drawerRunStatus.className = 'badge badge-notrun';
  }
  if (duration) {
    drawerDuration.innerText = `${duration}s`;
  }
}

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Setup Event Listeners
function setupEventListeners() {

  if (settingsAddEnvBtn) {
    settingsAddEnvBtn.addEventListener('click', () => {
      const newEnv = settingsNewEnv.value.trim().toLowerCase();
      if (!newEnv) return;
      
      const cleanEnv = newEnv.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!cleanEnv) return;

      if (!globalSettings.environments) {
        globalSettings.environments = ['dev', 'prod'];
      }

      if (globalSettings.environments.includes(cleanEnv)) {
        alert('Environment already exists!');
        return;
      }
      globalSettings.environments.push(cleanEnv);
      settingsNewEnv.value = '';
      renderSettingsEnvChips();
    });
  }

  testScreenshotToggle.addEventListener('change', () => {
    if (testScreenshotToggle.checked) {
      screenshotPathContainer.classList.remove('hidden');
    } else {
      screenshotPathContainer.classList.add('hidden');
    }
  });

  editTestScreenshotToggle.addEventListener('change', () => {
    if (editTestScreenshotToggle.checked) {
      editScreenshotPathContainer.classList.remove('hidden');
    } else {
      editScreenshotPathContainer.classList.add('hidden');
    }
  });

  recordForm.addEventListener('submit', startRecordingFlow);
  settingsForm.addEventListener('submit', saveSettingsFlow);

  editForm.addEventListener('submit', saveEditFlow);
  btnCancelEdit.addEventListener('click', () => closeOverlay(editModal));
  btnCloseEditModal.addEventListener('click', () => closeOverlay(editModal));

  runConfirmForm.addEventListener('submit', runTestScenarioConfirm);
  btnRunConfirmCancel.addEventListener('click', () => closeOverlay(runConfirmModal));
  btnRunConfirmClose.addEventListener('click', () => closeOverlay(runConfirmModal));

  btnOpenRecordModal.addEventListener('click', () => {
    renderRecordEnvsContainer();
    openOverlay(recordModal);
  });
  btnEmptyRecord.addEventListener('click', () => {
    renderRecordEnvsContainer();
    openOverlay(recordModal);
  });
  btnCloseRecordModal.addEventListener('click', () => closeOverlay(recordModal));
  btnCancelRecord.addEventListener('click', () => closeOverlay(recordModal));

  // Dashboard metrics routing: Passed Runs and Failed Runs cards route to History and filter there
  cardRecorded.addEventListener('click', () => {
    window.switchView('scenarios');
  });
  cardRuns.addEventListener('click', () => {
    window.switchView('history');
    applyHistoryFilter('all');
  });
  cardPassed.addEventListener('click', () => {
    window.switchView('history');
    applyHistoryFilter('passed');
  });
  cardFailed.addEventListener('click', () => {
    window.switchView('history');
    applyHistoryFilter('failed');
  });

  // History filtering listeners
  filterBtnAll.addEventListener('click', () => applyHistoryFilter('all'));
  filterBtnPassed.addEventListener('click', () => applyHistoryFilter('passed'));
  filterBtnFailed.addEventListener('click', () => applyHistoryFilter('failed'));

  // Holistic Summary Report Trigger
  btnExportHolistic.addEventListener('click', async () => {
    btnExportHolistic.disabled = true;
    try {
      const res = await window.api.generateHolisticReport();
      if (res.success) {
        alert(`Holistic Executive Report downloaded successfully to:\n${res.reportPath}`);
      } else {
        alert(`Failed to export holistic report: ${res.error}`);
      }
    } catch (e) {
      alert(e.message);
    } finally {
      btnExportHolistic.disabled = false;
    }
  });

  btnCloseCodeModal.addEventListener('click', () => closeOverlay(codeModal));
  btnDoneCodeModal.addEventListener('click', () => closeOverlay(codeModal));

  btnCopyCode.addEventListener('click', () => {
    const code = codeModal.getAttribute('data-current-code');
    if (code) {
      navigator.clipboard.writeText(code);
      btnCopyCode.innerText = 'Copied!';
      setTimeout(() => {
        btnCopyCode.innerText = 'Copy Script';
      }, 1500);
    }
  });

  btnCloseRunDrawer.addEventListener('click', () => closeDrawer(runDrawer));
  btnDrawerCloseAction.addEventListener('click', () => closeDrawer(runDrawer));
  btnClearLogs.addEventListener('click', () => { logOutputContent.innerText = ''; });

  btnStopTest.addEventListener('click', async () => {
    if (activeRunningTestId) {
      btnStopTest.disabled = true;
      try {
        await window.api.stopTest({ testId: activeRunningTestId });
      } catch (err) {
        console.error('Error stopping running test:', err);
      }
    }
  });

  btnClearHistory.addEventListener('click', async () => {
    const confirmClear = confirm('Are you sure you want to clear your entire execution history? This will delete all run metadata from the History list.');
    if (!confirmClear) return;
    try {
      const res = await window.api.clearHistory();
      if (res.success) {
        loadHistory();
      } else {
        alert(`Failed to clear: ${res.error}`);
      }
    } catch (e) {
      console.error(e);
    }
  });

  lightboxClose.addEventListener('click', () => closeOverlay(lightboxModal));
  lightboxModal.addEventListener('click', (e) => {
    if (e.target === lightboxModal) closeOverlay(lightboxModal);
  });
}

const { app, BrowserWindow, ipcMain } = require('electron');
const { Builder } = require('xml2js');
const path = require('path');
const fs = require('fs');
const http = require('http');

let mainWindow;

function getWorkflowsPath() {
  return path.join(app.getPath('userData'), 'workflows.json');
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function readSettings() {
  const settingsPath = getSettingsPath();

  if (!fs.existsSync(settingsPath)) {
    return { vantageDeliveryFolder: '' };
  }

  return { vantageDeliveryFolder: '', ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) };
}

function writeSettings(settings) {
  fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true });
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
}

function readWorkflows() {
  const workflowsPath = getWorkflowsPath();

  if (!fs.existsSync(workflowsPath)) {
    return [];
  }

  return JSON.parse(fs.readFileSync(workflowsPath, 'utf8'));
}

function writeWorkflows(workflows) {
  fs.mkdirSync(path.dirname(getWorkflowsPath()), { recursive: true });
  fs.writeFileSync(getWorkflowsPath(), JSON.stringify(workflows, null, 2), 'utf8');
}

function createProperty(name, value) {
  return {
    $: {
      name,
      value: String(value ?? '')
    }
  };
}

function toVantagePath(value) {
  return String(value ?? '')
    .replaceAll('{OriginalName}', '$(OriginalName)')
    .replaceAll('{Date}', '$(Date)')
    .replaceAll('{Time}', '$(Time)');
}

function getWorkflowPaths(workflow) {
  const paths = [];
  const actions = Array.isArray(workflow.actions) ? workflow.actions : [];

  for (const action of actions) {
    if ((action.type === 'Watch' || action.type === 'Transcode') && action.watchFolder) {
      paths.push({ type: 'Watch', path: action.watchFolder });
    }
    if ((action.type === 'Deploy' || action.type === 'Transcode') && action.outputFolder) {
      paths.push({ type: 'Deploy', path: action.outputFolder });
    }
  }

  return paths;
}

function validateWorkflowPaths(workflow) {
  const paths = getWorkflowPaths(workflow);
  const missing = paths.filter(({ path: folderPath }) => {
    const variableIndex = folderPath.search(/\{(?:OriginalName|Date|Time)\}|\$\((?:OriginalName|Date|Time)\)/);
    const validationPath = variableIndex >= 0
      ? folderPath.slice(0, variableIndex).replace(/[\\/]+$/, '')
      : folderPath;

    return !fs.existsSync(validationPath || path.dirname(folderPath));
  });
  return { valid: missing.length === 0, checked: paths, missing };
}

function buildVantageXML(workflowData) {
  const workflowActions = Array.isArray(workflowData.actions) ? workflowData.actions : [];
  const actions = workflowActions.map((action) => {
    const properties = [];

    switch (action.type) {
      case 'Watch':
        properties.push(createProperty('WatchDirectory', toVantagePath(action.watchFolder)));
        break;
      case 'Transcode':
        properties.push(
          createProperty('WatchDirectory', toVantagePath(action.watchFolder)),
          createProperty('OutputDirectory', toVantagePath(action.outputFolder)),
          createProperty('Preset', action.preset || action.profile || '')
        );
        break;
      case 'Deploy':
        properties.push(createProperty('OutputDirectory', toVantagePath(action.outputFolder)));
        break;
      default:
        throw new Error(`Desteklenmeyen Vantage action tipi: ${action.type}`);
    }

    return {
      $: { type: action.type },
      Property: properties
    };
  });

  const builder = new Builder({
    xmldec: { version: '1.0', encoding: 'UTF-8' },
    renderOpts: { pretty: true, indent: '    ', newline: '\n' }
  });

  return builder.buildObject({
    VantageWorkflow: {
      Name: String(workflowData.name || 'workflow'),
      Actions: { Action: actions }
    }
  });
}

function waitForDevServer(url, retries = 30) {
  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on('error', () => {
        if (retries <= 0) {
          reject(new Error(`Dev server is not available at ${url}`));
          return;
        }

        setTimeout(() => waitForDevServer(url, retries - 1).then(resolve, reject), 500);
      });
    };

    check();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
   width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
    console.error(`Preload failed (${preloadPath}):`, error);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Page failed to load (${errorCode}): ${errorDescription} - ${validatedURL}`);
  });

  if (app.isPackaged) {
    await mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    await waitForDevServer('http://localhost:5173');
    await mainWindow.loadURL('http://localhost:5173');
  }
}

app.whenReady().then(createWindow).catch((error) => {
  console.error('Failed to start application:', error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Vue'dan gelen verileri dinleyip XML üreten fonksiyon
ipcMain.handle('generate-xml', async (event, data) => {
  try {
    const settings = readSettings();
    const deliveryFolder = String(settings.vantageDeliveryFolder || '').trim();
    if (!deliveryFolder || !fs.existsSync(deliveryFolder)) {
      return {
        success: false,
        code: 'DELIVERY_UNAVAILABLE',
        error: 'Sunucuya bağlanılamadı: Vantage XML Teslim Klasörüne ulaşılamıyor.'
      };
    }

    const workflow = {
      name: data.name || data.workflowName,
      actions: data.actions || [{
        type: 'Watch',
        watchFolder: data.watchFolder,
        outputFolder: data.outputFolder
      }]
    };
    const pathValidation = validateWorkflowPaths(workflow);
    if (!pathValidation.valid && !data.allowMissingPaths) {
      return {
        success: false,
        requiresConfirmation: true,
        missingPaths: pathValidation.missing,
        error: 'Bir veya daha fazla klasör yolu bulunamadı.'
      };
    }
    const xmlContent = buildVantageXML(workflow);

    const safeName = String(workflow.name || 'workflow')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .trim() || 'workflow';
    const filePath = path.join(deliveryFolder, `${safeName}.xml`);
    
    fs.writeFileSync(filePath, xmlContent, 'utf8');
    
    return { success: true, path: filePath, deliveryFolder };
  } catch (error) {
    return { success: false, code: 'DELIVERY_WRITE_FAILED', error: `Sunucuya bağlanılamadı: ${error.message}` };
  }
});

ipcMain.handle('get-settings', async () => {
  try {
    return { success: true, settings: readSettings() };
  } catch (error) {
    return { success: false, error: error.message, settings: { vantageDeliveryFolder: '' } };
  }
});

ipcMain.handle('save-settings', async (event, settings) => {
  try {
    const savedSettings = {
      ...readSettings(),
      vantageDeliveryFolder: String(settings.vantageDeliveryFolder || '').trim()
    };
    writeSettings(savedSettings);
    return { success: true, settings: savedSettings };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-workflows', async () => {
  try {
    return { success: true, workflows: readWorkflows() };
  } catch (error) {
    return { success: false, error: error.message, workflows: [] };
  }
});

ipcMain.handle('save-workflow', async (event, workflow) => {
  try {
    const workflows = readWorkflows();
    const savedWorkflow = { ...workflow, updatedAt: new Date().toISOString() };
    const index = workflows.findIndex((item) => item.id === savedWorkflow.id);

    if (index >= 0) {
      workflows[index] = savedWorkflow;
    } else {
      workflows.push(savedWorkflow);
    }

    writeWorkflows(workflows);
    return { success: true, workflow: savedWorkflow };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-workflow', async (event, workflowId) => {
  try {
    writeWorkflows(readWorkflows().filter((workflow) => workflow.id !== workflowId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('generate-workflow', async (event, description) => {
  const prompt = String(description || '').trim();
  const normalizedPrompt = prompt.toLocaleLowerCase('tr-TR');

  if (!prompt) {
    return { success: false, error: 'Workflow açıklaması boş olamaz.' };
  }

  const actions = [];
  if (/(watch|izle|gelen|klasör|folder)/i.test(normalizedPrompt)) {
    actions.push({ type: 'Watch', watchFolder: '', outputFolder: '' });
  }
  if (/(transcode|encode|kodla|h264|h265|prores|dönüştür)/i.test(normalizedPrompt)) {
    actions.push({ type: 'Transcode', watchFolder: '', outputFolder: '' });
  }
  if (/(deploy|çıktı|gönder|yayınla|output)/i.test(normalizedPrompt)) {
    actions.push({ type: 'Deploy', watchFolder: '', outputFolder: '' });
  }

  const workflowActions = actions.length > 0
    ? actions
    : [{ type: 'Watch', watchFolder: '', outputFolder: '' }];

  return {
    success: true,
    workflow: {
      id: `workflow-${Date.now()}`,
      name: prompt.slice(0, 40).replace(/\s+/g, '_'),
      description: prompt,
      actions: workflowActions.map((action, index) => ({
        ...action,
        id: `${Date.now()}-${index}`
      }))
    }
  };
});

ipcMain.handle('validate-paths', async (event, workflow) => {
  try {
    return { success: true, ...validateWorkflowPaths(workflow) };
  } catch (error) {
    return { success: false, error: error.message, valid: false, missing: [] };
  }
});
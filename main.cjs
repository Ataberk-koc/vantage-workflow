const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

let mainWindow;

function getWorkflowsPath() {
  return path.join(app.getPath('userData'), 'workflows.json');
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

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function createWorkflowXml(workflow) {
  const actions = workflow.actions.map((action) => `
        <Action type="${escapeXml(action.type)}">
            <Property name="WatchDirectory" value="${escapeXml(action.watchFolder)}" />
            <Property name="OutputDirectory" value="${escapeXml(action.outputFolder)}" />
        </Action>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<VantageWorkflow>
    <Name>${escapeXml(workflow.name)}</Name>
    <Actions>${actions}
    </Actions>
</VantageWorkflow>`;
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
    const workflow = {
      name: data.name || data.workflowName,
      actions: data.actions || [{
        type: 'Watch',
        watchFolder: data.watchFolder,
        outputFolder: data.outputFolder
      }]
    };
    const xmlContent = createWorkflowXml(workflow);

    const desktopPath = app.getPath('desktop');
    const safeName = workflow.name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'workflow';
    const filePath = path.join(desktopPath, `${safeName}.xml`);
    
    fs.writeFileSync(filePath, xmlContent, 'utf8');
    
    return { success: true, path: filePath };
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
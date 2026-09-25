const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
   width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.loadURL('http://localhost:5173');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Vue'dan gelen verileri dinleyip XML üreten fonksiyon
ipcMain.handle('generate-xml', async (event, data) => {
  try {
    // Şimdilik test için basit bir XML şablonu oluşturuyoruz.
    // İleride buraya gerçek Vantage XML şablonumuzu okutacağız.
    let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<VantageWorkflow>
    <Name>${data.workflowName}</Name>
    <Actions>
        <Action type="Watch">
            <Property name="WatchDirectory" value="${data.watchFolder}" />
        </Action>
        <Action type="Deploy">
            <Property name="OutputDirectory" value="${data.outputFolder}" />
        </Action>
    </Actions>
</VantageWorkflow>`;

    // Dosyayı doğrudan Masaüstüne kaydedelim (Test etmesi kolay olsun)
    const desktopPath = app.getPath('desktop');
    const filePath = path.join(desktopPath, `${data.workflowName}.xml`);
    
    fs.writeFileSync(filePath, xmlContent, 'utf8');
    
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
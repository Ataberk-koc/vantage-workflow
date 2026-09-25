<template>
  <div class="app-container">
    <div class="header">
      <h1>Vantage Workflow Builder</h1>
      <p>Workflow tasarla ve Vantage'a güvenle gönder.</p>
    </div>

    <div class="form-card settings-card">
      <div class="setting-heading">
        <label for="delivery-folder">Vantage XML Teslim Klasörü</label>
        <span>Genel uygulama ayarı</span>
      </div>
      <div class="setting-row">
        <input id="delivery-folder" v-model="settings.vantageDeliveryFolder" type="text" placeholder="\\VantageServer\XML_Drop" />
        <button class="secondary-btn" @click="persistSettings" :disabled="isLoading">Ayarı kaydet</button>
      </div>
    </div>

    <div class="toolbar">
      <button class="secondary-btn" @click="createWorkflow">+ Yeni Workflow</button>
      <select v-model="selectedWorkflowId" @change="selectWorkflow">
        <option disabled value="">Workflow seç</option>
        <option v-for="workflow in workflows" :key="workflow.id" :value="workflow.id">
          {{ workflow.name }}
        </option>
      </select>
    </div>

    <div class="form-card prompt-card">
      <label>Otomatik workflow taslağı:</label>
      <div class="prompt-row">
        <input v-model="workflowPrompt" type="text" placeholder="Örn: Gelen klasöründeki videoları H264'e dönüştür ve çıktı klasörüne gönder" @keyup.enter="generateDraft" />
        <button class="secondary-btn" @click="generateDraft" :disabled="isLoading">Taslak oluştur</button>
      </div>
    </div>

    <div v-if="currentWorkflow" class="form-card">
      <div class="form-group">
        <label>Workflow Adı:</label>
        <input v-model="currentWorkflow.name" type="text" placeholder="Örn: Gece_Bulteni_H264" />
      </div>

      <draggable v-model="currentWorkflow.actions" item-key="id" handle=".drag-handle" class="action-list" animation="180">
        <template #item="{ element: action, index }">
        <div class="action-row">
          <button class="drag-handle" type="button" title="Action sırasını değiştirmek için sürükle">☷</button>
        <div class="form-group">
          <label>Action {{ index + 1 }}:</label>
          <select v-model="action.type">
            <option value="Watch">Watch</option>
            <option value="Deploy">Deploy</option>
            <option value="Transcode">Transcode</option>
          </select>
        </div>
        <div v-if="action.type === 'Transcode'" class="form-group">
          <label>Encoder Profile:</label>
          <select v-model="action.profile">
            <option value="H264_1080p_Web">H264_1080p_Web</option>
            <option value="ProRes_422_HQ">ProRes_422_HQ</option>
            <option value="XDCAM_HD50">XDCAM_HD50</option>
            <option value="Audio_Only_WAV">Audio_Only_WAV</option>
          </select>
        </div>
        <div v-if="action.type === 'Watch' || action.type === 'Transcode'" class="form-group path-group">
          <label>İzlenecek klasör:</label>
          <input v-model="action.watchFolder" type="text" placeholder="\\192.168.1.10\Gelenler" />
          <select class="variable-select" title="Watch klasörüne değişken ekle" @change="insertVariable(action, 'watchFolder', $event)">
            <option value="">Değişken Ekle</option>
            <option value="{OriginalName}">{OriginalName}</option>
            <option value="{Date}">{Date}</option>
            <option value="{Time}">{Time}</option>
          </select>
        </div>
        <div v-if="action.type === 'Deploy' || action.type === 'Transcode'" class="form-group path-group">
          <label>Çıktı klasörü:</label>
          <input v-model="action.outputFolder" type="text" placeholder="\\192.168.1.10\Gidenler" />
          <select class="variable-select" title="Çıktı klasörüne değişken ekle" @change="insertVariable(action, 'outputFolder', $event)">
            <option value="">Değişken Ekle</option>
            <option value="{OriginalName}">{OriginalName}</option>
            <option value="{Date}">{Date}</option>
            <option value="{Time}">{Time}</option>
          </select>
        </div>
        <button v-if="currentWorkflow.actions.length > 1" class="icon-btn" title="Action sil" @click="removeAction(index)">×</button>
        </div>
        </template>
      </draggable>

      <div class="button-row">
        <button class="secondary-btn" @click="addAction">+ Action ekle</button>
        <button class="submit-btn" @click="saveWorkflow" :disabled="isLoading">Kaydet</button>
        <button class="submit-btn" @click="generateWorkflow" :disabled="isLoading">Vantage'a Gönder</button>
        <button class="danger-btn" @click="deleteWorkflow">Sil</button>
      </div>
    </div>

    <div v-else class="form-card empty-state">
      <p>Başlamak için yeni bir workflow oluştur.</p>
    </div>

    <div v-if="message" :class="['alert', isSuccess ? 'alert-success' : 'alert-danger']">
      {{ message }}
    </div>

    <section class="log-panel" aria-label="İşlem günlüğü">
      <div class="log-header">İşlem Günlüğü</div>
      <div class="log-content">
        <div v-if="logs.length === 0" class="log-empty">Henüz işlem kaydı yok.</div>
        <div v-for="entry in logs" :key="entry.id" :class="['log-line', `log-${entry.level}`]">
          [{{ entry.time }}] {{ entry.message }}
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import draggable from 'vuedraggable';

const workflows = ref([]);
const currentWorkflow = ref(null);
const selectedWorkflowId = ref('');

const isLoading = ref(false);
const message = ref('');
const isSuccess = ref(false);
const workflowPrompt = ref('');
const settings = ref({ vantageDeliveryFolder: '' });
const logs = ref([]);

const addLog = (message, level = 'info') => {
  const now = new Date();
  logs.value.push({
    id: `${now.getTime()}-${Math.random()}`,
    time: now.toLocaleTimeString('tr-TR', { hour12: false }),
    message,
    level
  });
  if (logs.value.length > 200) logs.value.shift();
};

const createAction = () => ({
  id: crypto.randomUUID(),
  type: 'Watch',
  watchFolder: '',
  outputFolder: ''
});

const createWorkflow = () => {
  const workflow = {
    id: crypto.randomUUID(),
    name: `Yeni Workflow ${workflows.value.length + 1}`,
    actions: [createAction()]
  };

  workflows.value.push(workflow);
  currentWorkflow.value = workflow;
  selectedWorkflowId.value = workflow.id;
  message.value = '';
};

const selectWorkflow = () => {
  currentWorkflow.value = workflows.value.find((workflow) => workflow.id === selectedWorkflowId.value) || null;
};

const addAction = () => currentWorkflow.value?.actions.push(createAction());

const removeAction = (index) => currentWorkflow.value?.actions.splice(index, 1);

const insertVariable = (action, field, event) => {
  const variable = event.target.value;
  if (variable) action[field] = `${action[field] || ''}${variable}`;
  event.target.value = '';
};

const validatePaths = async () => {
  ensureElectron();
  return window.electronAPI.validatePaths(toPlainWorkflow());
};

const confirmMissingPaths = (missingPaths) => {
  const pathList = missingPaths.map(({ type, path }) => `${type}: ${path}`).join('\n');
  return window.confirm(`Uyarı: Belirtilen ağ yoluna ulaşılamıyor. Sunucu kapalı olabilir.\n\n${pathList}\n\nYine de XML oluşturulsun mu?`);
};

const ensureElectron = () => {
  if (!window.electronAPI) {
    throw new Error('Bu işlem için uygulamayı npm start ile açın.');
  }
};

const toPlainWorkflow = () => JSON.parse(JSON.stringify(currentWorkflow.value));

const saveWorkflow = async () => {
  if (!currentWorkflow.value?.name.trim()) {
    message.value = 'Workflow adı zorunlu.';
    isSuccess.value = false;
    return;
  }

  try {
    ensureElectron();
    const result = await window.electronAPI.saveWorkflow(toPlainWorkflow());
    if (!result.success) throw new Error(result.error);
    workflows.value = workflows.value.map((workflow) => workflow.id === result.workflow.id ? result.workflow : workflow);
    message.value = 'Workflow yerel olarak kaydedildi.';
    isSuccess.value = true;
    addLog(`Workflow '${result.workflow.name}' yerel olarak kaydedildi.`, 'success');
  } catch (error) {
    message.value = error.message;
    isSuccess.value = false;
    addLog(`Workflow kaydedilemedi: ${error.message}`, 'error');
  }
};

const persistSettings = async () => {
  try {
    ensureElectron();
    const result = await window.electronAPI.saveSettings(JSON.parse(JSON.stringify(settings.value)));
    if (!result.success) throw new Error(result.error);
    settings.value = result.settings;
    message.value = 'Vantage teslim klasörü ayarı kaydedildi.';
    isSuccess.value = true;
    addLog(`Vantage teslim klasörü ayarlandı: ${result.settings.vantageDeliveryFolder}`, 'success');
    return true;
  } catch (error) {
    message.value = error.message;
    isSuccess.value = false;
    addLog(`Ayar kaydedilemedi: ${error.message}`, 'error');
    return false;
  }
};

const generateDraft = async () => {
  if (!workflowPrompt.value.trim()) {
    message.value = 'Taslak oluşturmak için bir açıklama yazın.';
    isSuccess.value = false;
    return;
  }

  try {
    ensureElectron();
    isLoading.value = true;
    const result = await window.electronAPI.generateWorkflow(workflowPrompt.value);
    if (!result.success) throw new Error(result.error);

    workflows.value.push(result.workflow);
    currentWorkflow.value = result.workflow;
    selectedWorkflowId.value = result.workflow.id;
    message.value = 'Workflow taslağı oluşturuldu. Klasör yollarını kontrol edip kaydedin.';
    isSuccess.value = true;
    addLog(`Workflow taslağı oluşturuldu: '${result.workflow.name}'.`, 'info');
  } catch (error) {
    message.value = error.message;
    isSuccess.value = false;
    addLog(`Taslak oluşturulamadı: ${error.message}`, 'error');
  } finally {
    isLoading.value = false;
  }
};

const generateWorkflow = async () => {
  if (!currentWorkflow.value?.name.trim()) {
    message.value = 'Workflow adı zorunlu.';
    isSuccess.value = false;
    return;
  }

  isLoading.value = true;
  message.value = '';

  try {
    ensureElectron();
    if (!settings.value.vantageDeliveryFolder.trim()) {
      throw new Error('Önce Vantage XML Teslim Klasörünü ayarlayın.');
    }

    if (!await persistSettings()) return;
    const pathValidation = await validatePaths();
    if (!pathValidation.success) throw new Error(pathValidation.error);

    if (!pathValidation.valid) {
      addLog('Klasör doğrulama uyarısı: bir veya daha fazla workflow yolu bulunamadı.', 'warning');
    }

    if (!pathValidation.valid && !confirmMissingPaths(pathValidation.missing)) {
      message.value = 'XML oluşturma iptal edildi.';
      isSuccess.value = false;
      addLog(`Workflow '${currentWorkflow.value.name}' gönderilmekten vazgeçildi.`, 'warning');
      return;
    }

    const result = await window.electronAPI.generateXml({
      ...toPlainWorkflow(),
      allowMissingPaths: !pathValidation.valid
    });

    if (result.success) {
      isSuccess.value = true;
      message.value = `Başarılı! XML Vantage'a gönderildi: ${result.path}`;
      addLog(`Workflow '${currentWorkflow.value.name}' başarıyla sunucuya iletildi.`, 'success');
    } else {
      isSuccess.value = false;
      message.value = result.error;
      addLog(result.code === 'DELIVERY_UNAVAILABLE'
        ? 'Sunucuya bağlanılamadı. XML gönderimi durduruldu.'
        : `Gönderim hatası: ${result.error}`, 'error');
    }
  } catch (error) {
    isSuccess.value = false;
    message.value = `İşlem başarısız: ${error.message || error}`;
    addLog(`Gönderim hatası: ${error.message || error}`, 'error');
    console.error(error);
  } finally {
    isLoading.value = false;
  }
};

const deleteWorkflow = async () => {
  if (!currentWorkflow.value) return;

  try {
    ensureElectron();
    const result = await window.electronAPI.deleteWorkflow(currentWorkflow.value.id);
    if (!result.success) throw new Error(result.error);
    workflows.value = workflows.value.filter((workflow) => workflow.id !== currentWorkflow.value.id);
    currentWorkflow.value = null;
    selectedWorkflowId.value = '';
    message.value = 'Workflow silindi.';
    isSuccess.value = true;
    addLog('Workflow silindi.', 'info');
  } catch (error) {
    message.value = error.message;
    isSuccess.value = false;
    addLog(`Workflow silinemedi: ${error.message}`, 'error');
  }
};

const loadWorkflows = async () => {
  if (!window.electronAPI) return;
  const result = await window.electronAPI.listWorkflows();
  if (result.success) workflows.value = result.workflows;
};

const loadSettings = async () => {
  if (!window.electronAPI) return;
  const result = await window.electronAPI.getSettings();
  if (result.success) settings.value = result.settings;
};

loadWorkflows();
loadSettings();
</script>

<style>
/* Basit ve modern bir karanlık tema stili */
body {
  background-color: #1e1e2f;
  color: #fff;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  margin: 0;
  padding: 20px;
}
.app-container {
  max-width: 600px;
  margin: 0 auto;
}
.header {
  text-align: center;
  margin-bottom: 30px;
}
.header h1 {
  color: #4ade80;
  margin-bottom: 5px;
}
.header p {
  color: #94a3b8;
  font-size: 14px;
}
.form-card {
  background-color: #2a2a40;
  padding: 25px;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.3);
}
.toolbar,
.button-row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 20px;
}
.prompt-card {
  margin-bottom: 20px;
}
.prompt-card label {
  display: block;
  margin-bottom: 8px;
  color: #cbd5e1;
  font-weight: bold;
}
.prompt-row {
  display: flex;
  gap: 10px;
}
.prompt-row input {
  flex: 1;
}
.toolbar select,
.form-group select {
  flex: 1;
  padding: 10px;
  border-radius: 5px;
  border: 1px solid #475569;
  background-color: #1e1e2f;
  color: #fff;
  font-size: 14px;
}
.action-row {
  position: relative;
  border-top: 1px solid #475569;
  padding-top: 18px;
  display: grid;
  grid-template-columns: 32px minmax(120px, 0.7fr) minmax(160px, 1fr) minmax(220px, 1.5fr);
  gap: 12px;
  align-items: start;
}
.action-list {
  display: grid;
  gap: 12px;
}
.drag-handle {
  align-self: center;
  justify-self: start;
  width: 32px;
  height: 32px;
  border: 1px solid #64748b;
  border-radius: 5px;
  background: #475569;
  color: #fff;
  cursor: grab;
}
.drag-handle:active {
  cursor: grabbing;
}
.icon-btn {
  position: absolute;
  top: 12px;
  right: 0;
  border: 0;
  background: transparent;
  color: #f87171;
  font-size: 22px;
  cursor: pointer;
}
.secondary-btn,
.danger-btn {
  padding: 10px 14px;
  border-radius: 5px;
  font-weight: bold;
  cursor: pointer;
}
.secondary-btn {
  background: #475569;
  color: #fff;
  border: 1px solid #64748b;
}
.danger-btn {
  background: transparent;
  color: #f87171;
  border: 1px solid #f87171;
}
.button-row .submit-btn {
  width: auto;
  flex: 1;
}
.empty-state {
  text-align: center;
  color: #94a3b8;
}
.form-group {
  margin-bottom: 20px;
}
.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #cbd5e1;
}
.form-group input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px;
  border-radius: 5px;
  border: 1px solid #475569;
  background-color: #1e1e2f;
  color: #fff;
  font-size: 14px;
}
.path-group {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}
.path-group label {
  grid-column: 1 / -1;
}
.variable-select {
  min-width: 116px;
  padding: 10px 6px;
  border-radius: 5px;
  border: 1px solid #64748b;
  background: #475569;
  color: #fff;
  font-size: 12px;
}
@media (max-width: 720px) {
  .action-row {
    grid-template-columns: 1fr;
  }
  .path-group {
    grid-template-columns: 1fr;
  }
  .path-group label {
    grid-column: auto;
  }
}
.submit-btn {
  width: 100%;
  padding: 12px;
  background-color: #4ade80;
  color: #1e1e2f;
  border: none;
  border-radius: 5px;
  font-weight: bold;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}
.submit-btn:hover {
  background-color: #22c55e;
}
.submit-btn:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}
.alert {
  margin-top: 20px;
  padding: 15px;
  border-radius: 5px;
  text-align: center;
}
.alert-success {
  background-color: rgba(74, 222, 128, 0.2);
  color: #4ade80;
  border: 1px solid #4ade80;
}
.alert-danger {
  background-color: rgba(248, 113, 113, 0.2);
  color: #f87171;
  border: 1px solid #f87171;
}
.settings-card {
  margin-bottom: 20px;
}
.setting-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
  margin-bottom: 8px;
}
.setting-heading label {
  color: #cbd5e1;
  font-weight: bold;
}
.setting-heading span {
  color: #94a3b8;
  font-size: 12px;
}
.setting-row {
  display: flex;
  gap: 10px;
}
.setting-row input {
  flex: 1;
  min-width: 0;
}
.log-panel {
  margin-top: 20px;
  overflow: hidden;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #090d12;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}
.log-header {
  padding: 10px 14px;
  border-bottom: 1px solid #334155;
  color: #94a3b8;
  font-size: 12px;
  font-weight: bold;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.log-content {
  max-height: 180px;
  overflow-y: auto;
  padding: 12px 14px;
  color: #cbd5e1;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
}
.log-line {
  white-space: pre-wrap;
}
.log-success {
  color: #4ade80;
}
.log-warning {
  color: #facc15;
}
.log-error {
  color: #f87171;
}
.log-empty {
  color: #64748b;
}
@media (max-width: 620px) {
  .setting-row {
    flex-direction: column;
  }
  .setting-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
}
</style>
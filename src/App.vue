<template>
  <div class="app-container">
    <div class="header">
      <h1>Vantage Workflow Builder</h1>
      <p>Workflow tasarla, yerel olarak sakla ve XML olarak dışa aktar.</p>
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

      <div v-for="(action, index) in currentWorkflow.actions" :key="action.id" class="action-row">
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

      <div class="button-row">
        <button class="secondary-btn" @click="addAction">+ Action ekle</button>
        <button class="submit-btn" @click="saveWorkflow" :disabled="isLoading">Kaydet</button>
        <button class="submit-btn" @click="generateWorkflow" :disabled="isLoading">XML oluştur</button>
        <button class="danger-btn" @click="deleteWorkflow">Sil</button>
      </div>
    </div>

    <div v-else class="form-card empty-state">
      <p>Başlamak için yeni bir workflow oluştur.</p>
    </div>

    <div v-if="message" :class="['alert', isSuccess ? 'alert-success' : 'alert-danger']">
      {{ message }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const workflows = ref([]);
const currentWorkflow = ref(null);
const selectedWorkflowId = ref('');

const isLoading = ref(false);
const message = ref('');
const isSuccess = ref(false);
const workflowPrompt = ref('');

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
  } catch (error) {
    message.value = error.message;
    isSuccess.value = false;
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
  } catch (error) {
    message.value = error.message;
    isSuccess.value = false;
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
    const result = await window.electronAPI.generateXml(toPlainWorkflow());

    if (result.success) {
      isSuccess.value = true;
      message.value = `Başarılı! XML dosyası masaüstüne kaydedildi: ${result.path}`;
    } else {
      isSuccess.value = false;
      message.value = 'Hata oluştu: ' + result.error;
    }
  } catch (error) {
    isSuccess.value = false;
    message.value = `İşlem başarısız: ${error.message || error}`;
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
  } catch (error) {
    message.value = error.message;
    isSuccess.value = false;
  }
};

const loadWorkflows = async () => {
  if (!window.electronAPI) return;
  const result = await window.electronAPI.listWorkflows();
  if (result.success) workflows.value = result.workflows;
};

loadWorkflows();
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
  grid-template-columns: minmax(120px, 0.7fr) minmax(160px, 1fr) minmax(220px, 1.5fr);
  gap: 12px;
  align-items: start;
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
</style>
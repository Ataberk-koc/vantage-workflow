<template>
  <div class="app-container">
    <div class="header">
      <h1>Vantage Workflow Builder</h1>
      <p>Yeni bir iş akışı oluşturmak için aşağıdaki bilgileri doldurun.</p>
    </div>

    <div class="form-card">
      <div class="form-group">
        <label>Workflow Adı:</label>
        <input v-model="formData.workflowName" type="text" placeholder="Örn: Gece_Bulteni_H264" />
      </div>

      <div class="form-group">
        <label>İzlenecek Klasör (Watch Folder):</label>
        <input v-model="formData.watchFolder" type="text" placeholder="\\192.168.1.10\Gelenler" />
      </div>

      <div class="form-group">
        <label>Çıktı Klasörü (Deploy Folder):</label>
        <input v-model="formData.outputFolder" type="text" placeholder="\\192.168.1.10\Gidenler" />
      </div>

      <button @click="generateWorkflow" class="submit-btn" :disabled="isLoading">
        {{ isLoading ? 'Oluşturuluyor...' : 'XML Oluştur ve Kaydet' }}
      </button>
    </div>

    <div v-if="message" :class="['alert', isSuccess ? 'alert-success' : 'alert-danger']">
      {{ message }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const formData = ref({
  workflowName: '',
  watchFolder: '',
  outputFolder: ''
});

const isLoading = ref(false);
const message = ref('');
const isSuccess = ref(false);

const generateWorkflow = async () => {
  if (!formData.value.workflowName) {
    message.value = 'Lütfen en azından bir Workflow Adı girin!';
    isSuccess.value = false;
    return;
  }

  isLoading.value = true;
  message.value = '';

  try {
    if (!window.electronAPI?.generateXml) {
      throw new Error('Electron API is unavailable. Start the app with npm start.');
    }

    const result = await window.electronAPI.generateXml(formData.value);

    if (result.success) {
      isSuccess.value = true;
      message.value = `Başarılı! XML dosyası masaüstüne kaydedildi: ${result.path}`;
      // Formu temizle
      formData.value = { workflowName: '', watchFolder: '', outputFolder: '' };
    } else {
      isSuccess.value = false;
      message.value = 'Hata oluştu: ' + result.error;
    }
  } catch (error) {
    isSuccess.value = false;
    message.value = 'Uygulama arka planıyla iletişim kurulamadı.';
    console.error(error);
  } finally {
    isLoading.value = false;
  }
};
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
  width: 95%;
  padding: 10px;
  border-radius: 5px;
  border: 1px solid #475569;
  background-color: #1e1e2f;
  color: #fff;
  font-size: 14px;
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
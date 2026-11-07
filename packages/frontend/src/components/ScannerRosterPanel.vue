<script setup lang="ts">
import { ref } from 'vue'
import {
  parseScannerSave,
  saveRoster,
  clearRoster,
  type ImportedRoster,
} from '@/utils/scannerImport'

const props = defineProps<{ roster: ImportedRoster | null }>()
const emit = defineEmits<{
  (e: 'update:roster', v: ImportedRoster | null): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const error = ref('')
const busy = ref(false)

function pickFile() {
  fileInput.value?.click()
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  busy.value = true
  error.value = ''
  try {
    const text = await file.text()
    const roster = parseScannerSave(text)
    saveRoster(roster)
    emit('update:roster', roster)
  } catch {
    error.value = '解析失败：请确认是 reliquary_archiver / 扫描器导出的 JSON'
  } finally {
    busy.value = false
    input.value = ''
  }
}

function onClear() {
  clearRoster()
  emit('update:roster', null)
}
</script>

<template>
  <section class="eg-card eg-scanner-card">
    <h2>账号存档</h2>
    <p class="eg-scanner-hint">
      导入扫描器 JSON（如 御星凌月.json）后，推荐会按你实际持有/星魂/行迹校正强度，并在卡池上标注已持有。
    </p>

    <div class="eg-scanner-actions">
      <button type="button" class="primary" :disabled="busy" @click="pickFile">
        {{ busy ? '解析中…' : roster ? '重新导入' : '导入扫描器 JSON' }}
      </button>
      <button v-if="roster" type="button" @click="onClear">清除存档</button>
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        class="eg-hidden-input"
        @change="onFile"
      />
    </div>

    <div v-if="error" class="eg-scanner-error">{{ error }}</div>

    <div v-if="roster" class="eg-scanner-summary">
      <div>UID：{{ roster.uid ?? '—' }}</div>
      <div>持有角色：{{ roster.owned.length }}</div>
      <div>光锥：{{ roster.lightConeCount }} · 遗器：{{ roster.relicCount }}</div>
      <div>
        星琼 {{ roster.stellarJade }} · 专票 {{ roster.specialPass }} · 通票
        {{ roster.standardPass }}
      </div>
      <div v-if="roster.unknownNames.length" class="eg-scanner-unknown">
        未映射角色：{{ roster.unknownNames.join('、') }}
      </div>
      <div class="eg-scanner-time">导入于 {{ new Date(roster.importedAt).toLocaleString() }}</div>
    </div>
    <div v-else class="eg-scanner-empty">尚未导入存档，配队按「全角色可用」排序。</div>
  </section>
</template>

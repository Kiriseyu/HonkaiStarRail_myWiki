<script setup lang="ts">
import { getCharacterAvatar, handleImageError } from '@/data/avatars'
import { getLightconeImage, handleLightconeImageError } from '@/data/lightcones'
import charactersJson from '@/data/endgame/characters.json'
import buildsJson from '@/data/endgame/characterBuilds.json'
import { computed, ref } from 'vue'
import type { CharactersFile } from '@/utils/endgameTypes'

interface BuildEntry {
  lightCones: Array<{ name: string; note: string; id?: string }>
  relics: string[]
  mainStats: string
  subStats: string
  teammates: string[]
  tips: string[]
  materials?: {
    ascension: string
    boss: string
    credit: string
    weekly: string
  }
}

interface BuildsFile {
  meta: { updatedAt: string; note: string; sources?: string[]; characterCount?: number }
  builds: Record<string, BuildEntry>
}

const charactersFile = charactersJson as CharactersFile
const buildsFile = buildsJson as BuildsFile
const buildMap = buildsFile.builds

const query = ref('')
const selectedId = ref<string | null>(null)

const sorted = computed(() =>
  [...charactersFile.characters].sort((a, b) => (b.strength || 0) - (a.strength || 0)),
)

const suggestions = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q || selectedId.value) return sorted.value.slice(0, 18)
  return sorted.value
    .filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.id.includes(q) ||
        c.element.includes(q) ||
        c.path.includes(q) ||
        (c.tags || []).some((t) => t.toLowerCase().includes(q)),
    )
    .slice(0, 18)
})

const selected = computed(() =>
  selectedId.value ? charactersFile.characters.find((c) => c.id === selectedId.value) || null : null,
)

const build = computed(() => {
  const id = selectedId.value
  if (!id) return null
  return (
    buildMap[id] || {
      lightCones: [{ name: '暂无数据', note: '见通用路径建议' }],
      relics: ['见左侧养成说明'],
      mainStats: '按定位填写',
      subStats: '按定位',
      teammates: [],
      tips: ['该角色构筑表待补充'],
    }
  )
})

const teammateChars = computed(() => {
  const names = build.value?.teammates || []
  return names
    .map((n) => charactersFile.characters.find((c) => c.name === n))
    .filter(Boolean)
    .slice(0, 4)
})

const teammateNamesOnly = computed(() => {
  const known = new Set(charmateCharsIds())
  return (build.value?.teammates || []).filter((n) => !charactersFile.characters.some((c) => c.name === n))
  function charmateCharsIds() {
    return teammateChars.value.map((c) => c!.name)
  }
})

function pick(id: string) {
  selectedId.value = id
  query.value = ''
}

function avatarFor(id: string) {
  return getCharacterAvatar(id)
}

function lcImage(lc: { id?: string; name: string }) {
  if (lc.id) return getLightconeImage(lc.id)
  return ''
}
</script>

<template>
  <section class="eg-card eg-guide-card">
    <h2>角色简评 · 养成</h2>
    <p class="eg-guide-hint">
      全角色构筑/素材表 · 共 {{ Object.keys(buildMap).length }} 人 · 更新于
      {{ buildsFile.meta.updatedAt }} · 社区/Prydwen
    </p>

    <div class="eg-guide-search">
      <input
        v-model="query"
        type="search"
        placeholder="搜索角色名 / 属性 / 标签"
        aria-label="搜索角色"
      />
    </div>

    <div class="eg-guide-list" role="listbox" aria-label="角色列表">
      <button
        v-for="c in suggestions"
        :key="c.id"
        type="button"
        class="eg-guide-chip"
        :class="{ active: selectedId === c.id }"
        role="option"
        :aria-selected="selectedId === c.id"
        @click="pick(c.id)"
      >
        <img :src="avatarFor(c.id)" :alt="c.name" loading="lazy" @error="handleImageError" />
        <span>{{ c.name }}</span>
      </button>
    </div>

    <div v-if="selected && build" class="eg-guide-detail">
      <div class="eg-guide-head">
        <img :src="avatarFor(selected.id)" :alt="selected.name" @error="handleImageError" />
        <div>
          <div class="name">{{ selected.name }}</div>
          <div class="meta">
            {{ selected.element }} · {{ selected.path }} · {{ selected.rarity }}★ · 强度
            {{ selected.strength }}
          </div>
          <div class="eg-tag-row">
            <span v-for="t in selected.tags.slice(0, 5)" :key="t" class="eg-tag">{{ t }}</span>
          </div>
        </div>
      </div>

      <div class="eg-guide-sec">
        <h3>推荐队友</h3>
        <div v-if="teammateChars.length" class="mates">
          <div v-for="m in teammateChars" :key="m.id" class="mate">
            <img :src="avatarFor(m.id)" :alt="m.name" @error="handleImageError" />
            <span>{{ m.name }}</span>
          </div>
        </div>
        <p v-if="teammateNamesOnly.length" class="line">
          另可：{{ teammateNamesOnly.join('、') }}
        </p>
        <p v-if="!teammateChars.length && !teammateNamesOnly.length" class="line eg-roster-muted">
          —
        </p>
      </div>

      <div class="eg-guide-sec">
        <h3>光锥建议</h3>
        <div class="eg-guide-lcs">
          <div v-for="(lc, i) in build.lightCones" :key="lc.name + i" class="lc">
            <img
              v-if="lcImage(lc)"
              :src="lcImage(lc)"
              :alt="lc.name"
              @error="handleLightconeImageError"
            />
            <div v-else class="lc-placeholder">LC</div>
            <div>
              <div class="name">{{ lc.name }}</div>
              <div class="note">{{ lc.note }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="eg-guide-sec">
        <h3>遗器 / 词条</h3>
        <p class="line"><b>主词条</b>：{{ build.mainStats }}</p>
        <p class="line"><b>副词条</b>：{{ build.subStats }}</p>
        <ul>
          <li v-for="r in build.relics" :key="r">{{ r }}</li>
        </ul>
      </div>

      <div v-if="build.materials" class="eg-guide-sec">
        <h3>养成素材</h3>
        <p class="line"><b>晋阶材料</b>：{{ build.materials.ascension }}</p>
        <p class="line"><b>首领材料</b>：{{ build.materials.boss }}</p>
        <p class="line"><b>信用点</b>：{{ build.materials.credit }}</p>
        <p class="line"><b>周本</b>：{{ build.materials.weekly }}</p>
      </div>

      <div v-if="build.tips?.length" class="eg-guide-sec">
        <h3>提示</h3>
        <ul>
          <li v-for="t in build.tips" :key="t">{{ t }}</li>
        </ul>
      </div>
    </div>

    <div v-else class="eg-guide-empty">从上方点选一名角色开始查看</div>
  </section>
</template>

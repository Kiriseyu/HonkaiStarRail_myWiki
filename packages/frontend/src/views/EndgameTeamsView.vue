<script setup lang="ts">
import { getCharacterAvatar, handleImageError } from '@/data/avatars'
import { useEndgameTeams } from '@/composables/useEndgameTeams'
import { useThemePreference } from '@/composables/useThemePreference'
import { useCustomRoster } from '@/composables/useCustomRoster'
import CustomRosterDock from '@/components/CustomRosterDock.vue'
import CharacterGuidePanel from '@/components/CharacterGuidePanel.vue'
import type { EndgameModeId } from '@/utils/endgameTypes'
import { ref, watch } from 'vue'
import '@/assets/endgame.css'

const { theme, toggleTheme } = useThemePreference()
const { setStageContext } = useCustomRoster()

const {
  meta,
  modeId,
  side,
  teams,
  currentStage,
  modeOptions,
  sideOptions,
  setMode,
  onSwap,
  resetTeams,
  buildShareText,
} = useEndgameTeams()

watch(
  [modeId, currentStage],
  () => {
    setStageContext(modeId.value, currentStage.value)
  },
  { immediate: true },
)

const shareText = ref('')
const showShare = ref(false)
const toastMsg = ref('')
const toastVisible = ref(false)
let toastTimer: number | undefined

function showToast(msg: string) {
  toastMsg.value = msg
  toastVisible.value = true
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastVisible.value = false
  }, 2800)
}

function handleModeClick(id: EndgameModeId) {
  setMode(id)
}

function handleSwap(teamIndex: number, slotIndex: number, event: Event) {
  const target = event.target as HTMLSelectElement
  onSwap(teamIndex, slotIndex, target.value)
  const team = teams.value[teamIndex]
  const char = team?.slots[slotIndex]
  const name = team?.slots[slotIndex]?.candidates?.find((c) => c.id === target.value)?.name
    || target.value
  showToast(
    `已替换为 ${name} · 总分 ${team?.score.total.toFixed(1) ?? '-'}（${char?.penaltyText ?? '已更新'}）`,
  )
}

async function handleCopy() {
  const text = buildShareText()
  shareText.value = text
  showShare.value = true
  try {
    await navigator.clipboard.writeText(text)
    showToast('配队文案已复制到剪贴板')
  } catch {
    showToast('已生成文案，请手动复制')
  }
}

function avatarFor(id: string) {
  return getCharacterAvatar(id)
}
</script>

<template>
  <div class="endgame-page">
    <header class="eg-hero">
      <div>
        <h1>当期高难挑战 · 配队推荐</h1>
        <p>
          基于当期关卡弱点、机制与环境 Buff 自动评分，给出可切换下位替代的推荐队伍。假设全角色可用，按泛用性排序。路由：
          <code>/endgame</code>
        </p>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center">
        <div class="eg-theme-switch">
          <button
            type="button"
            class="eg-theme-switch-btn"
            :class="{ 'is-dark': theme === 'dark' }"
            role="switch"
            :aria-checked="theme === 'dark' ? 'true' : 'false'"
            :aria-label="theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'"
            :title="theme === 'dark' ? '切换到浅色' : '切换到深色'"
            @click="toggleTheme()"
          >
            <div class="eg-ts-stars" aria-hidden="true">
              <span></span><span></span><span></span><span></span>
              <span></span><span></span><span></span>
            </div>
            <div class="eg-ts-clouds" aria-hidden="true">
              <i></i><i></i><i></i><i></i><i></i><i></i>
            </div>
            <div class="eg-ts-thumb" aria-hidden="true">
              <div class="eg-ts-sun"></div>
              <div class="eg-ts-moon"></div>
            </div>
          </button>
          <span>{{ theme === 'dark' ? '深色' : '浅色' }}</span>
        </div>
        <div class="eg-meta-pill">
          <span>{{ meta.version }}</span>
          <span>·</span>
          <span>{{ meta.period }}</span>
        </div>
      </div>
    </header>

    <nav class="eg-mode-tabs" aria-label="模式切换">
      <button
        v-for="m in modeOptions"
        :key="m.id"
        type="button"
        class="eg-mode-tab"
        :class="{ active: m.id === modeId }"
        @click="handleModeClick(m.id)"
      >
        <strong>{{ m.label }}</strong>
        <span>{{ m.short }} · {{ m.round }}</span>
      </button>
    </nav>

    <div class="eg-layout">
      <aside>
        <section class="eg-card">
          <h2>当期关卡</h2>
          <div class="eg-section-title">
            <h3>{{ currentStage.round }}</h3>
            <span class="eg-tag">{{ currentStage.period }}</span>
          </div>

          <div class="eg-buff-box">
            <div class="title">{{ currentStage.buff.title }}</div>
            <p>{{ currentStage.buff.desc }}</p>
            <div class="eg-tag-row">
              <span v-for="t in currentStage.buff.tags" :key="t" class="eg-tag mech">{{ t }}</span>
            </div>
          </div>

          <div v-for="node in currentStage.nodes" :key="node.side" class="eg-node">
            <div class="side">{{ node.side }}</div>
            <div v-for="enemy in node.enemies" :key="enemy.name" class="eg-enemy">
              <div class="name">{{ enemy.name }}</div>
              <div class="eg-tag-row">
                <span class="eg-tag">弱点</span>
                <span v-for="w in enemy.weaknesses" :key="w" class="eg-tag weak">{{ w }}</span>
              </div>
              <div class="eg-tag-row">
                <span class="eg-tag">机制</span>
                <span v-for="m in enemy.mechanics" :key="m" class="eg-tag mech">{{ m }}</span>
              </div>
              <div class="hp-note">{{ enemy.hpNote }}</div>
            </div>
          </div>

          <h2 style="margin-top: 12px">评分线</h2>
          <ul class="eg-score-lines">
            <li v-for="s in currentStage.scoreLines.stars" :key="s.stars">
              {{ s.stars }}星：{{ s.condition }}
            </li>
          </ul>
          <div class="eg-tag-row">
            <span class="eg-tag element">{{ currentStage.scoreLines.target }}</span>
          </div>
        </section>

        <section class="eg-card">
          <h2>说明</h2>
          <p style="margin: 0; font-size: 13px; color: var(--eg-ink-2)">
            总分 = 弱点覆盖 40% + 机制适配 30% + 模式适配 20% + 当期 Buff 加成 10%。
            下拉切换角色后会实时重算，并提示替代代价。
          </p>
        </section>

        <CharacterGuidePanel />
      </aside>

      <main>
        <section class="eg-card">
          <h2>推荐配队</h2>
          <div class="eg-toolbar">
            <label for="eg-side" style="font-size: 13px; color: var(--eg-ink-2)">节点筛选</label>
            <select id="eg-side" v-model="side">
              <option value="">全部节点</option>
              <option v-for="s in sideOptions" :key="s" :value="s">{{ s }}</option>
            </select>
            <button type="button" class="primary" @click="handleCopy">导出 / 分享配队</button>
            <button type="button" @click="resetTeams">重置默认</button>
          </div>

          <div v-if="!teams.length" class="eg-empty">暂无匹配推荐，请切换模式或放宽节点筛选。</div>

          <article
            v-for="(team, teamIndex) in teams"
            :key="team.templateId + teamIndex"
            class="eg-team-card"
            :class="`grade-${team.score.grade}`"
          >
            <div class="eg-team-header">
              <div>
                <div class="eg-team-title">
                  <span class="eg-badge" :class="team.score.grade">{{ team.score.grade }}</span>
                  <h3 style="margin: 0">{{ team.name }}</h3>
                  <span class="eg-tag">{{ team.system }}</span>
                </div>
                <div class="eg-mechanic-line">{{ team.coreMechanic }}</div>
                <div class="eg-sides">
                  <span v-for="s in team.suitableSides" :key="s" class="eg-tag element">
                    适用 {{ s }}
                  </span>
                </div>
              </div>
              <div class="eg-score-box">
                <div class="num">{{ team.score.total.toFixed(1) }}</div>
                <div class="label">综合评分</div>
              </div>
            </div>

            <div class="eg-breakdown">
              <div class="eg-metric">
                <div class="name">弱点覆盖 40%</div>
                <div class="val">{{ Math.round(team.score.breakdown.weakness.score) }}</div>
                <div class="eg-bar">
                  <i :style="{ width: `${Math.min(100, team.score.breakdown.weakness.score)}%` }" />
                </div>
              </div>
              <div class="eg-metric">
                <div class="name">机制适配 30%</div>
                <div class="val">{{ Math.round(team.score.breakdown.mechanic.score) }}</div>
                <div class="eg-bar">
                  <i :style="{ width: `${Math.min(100, team.score.breakdown.mechanic.score)}%` }" />
                </div>
              </div>
              <div class="eg-metric">
                <div class="name">模式适配 20%</div>
                <div class="val">{{ Math.round(team.score.breakdown.mode.score) }}</div>
                <div class="eg-bar">
                  <i :style="{ width: `${Math.min(100, team.score.breakdown.mode.score)}%` }" />
                </div>
              </div>
              <div class="eg-metric">
                <div class="name">当期Buff 10%</div>
                <div class="val">{{ Math.round(team.score.breakdown.buff.score) }}</div>
                <div class="eg-bar">
                  <i :style="{ width: `${Math.min(100, team.score.breakdown.buff.score)}%` }" />
                </div>
              </div>
            </div>

            <div class="eg-slots">
              <div v-for="(slot, slotIndex) in team.slots" :key="slot.role + slotIndex" class="eg-slot">
                <div class="role">{{ slot.role }}</div>
                <select
                  :value="slot.selectedId"
                  @change="handleSwap(teamIndex, slotIndex, $event)"
                >
                  <option
                    v-for="c in slot.candidates"
                    :key="c.id"
                    :value="c.id"
                  >
                    {{ c.name }}（{{ c.element }}·{{ c.path }} · {{ c.role }}）
                  </option>
                </select>
                <div class="eg-char-row">
                  <img
                    class="eg-avatar"
                    :src="avatarFor(slot.selectedId)"
                    :alt="slot.candidates.find((c) => c.id === slot.selectedId)?.name || slot.selectedId"
                    width="52"
                    height="52"
                    loading="lazy"
                    @error="handleImageError"
                  />
                  <div class="eg-char-meta">
                    <div class="name">
                      {{ slot.candidates.find((c) => c.id === slot.selectedId)?.name || slot.selectedId }}
                    </div>
                    <div class="meta">
                      {{
                        slot.candidates.find((c) => c.id === slot.selectedId)?.element
                      }}·{{
                        slot.candidates.find((c) => c.id === slot.selectedId)?.path
                      }}
                    </div>
                  </div>
                </div>
                <div class="eg-penalty">
                  {{ slot.penaltyText || '当前为综合最优主选' }}
                </div>
              </div>
            </div>

            <div v-if="team.notes?.length" class="eg-team-notes">
              <strong>注意事项</strong>
              <ul>
                <li v-for="n in team.notes" :key="n">{{ n }}</li>
              </ul>
            </div>
          </article>

          <div v-if="showShare" class="eg-share">
            <textarea readonly :value="shareText" />
          </div>
        </section>
      </main>
    </div>

    <footer class="eg-footer">
      <div>{{ meta.disclaimer }}</div>
      <div style="margin-top: 6px">
        更新于 {{ meta.updatedAt }} · 数据文件 packages/frontend/src/data/endgame/*
      </div>
      <div style="margin-top: 8px">
        代码基于 Gilded 的 MIT 项目 hsr-team-builder · © 2025 Gilded · 非官方粉丝工具
      </div>
    </footer>

    <div class="eg-toast" :class="{ show: toastVisible }" role="status" aria-live="polite">
      {{ toastMsg }}
    </div>

    <CustomRosterDock />
  </div>
</template>

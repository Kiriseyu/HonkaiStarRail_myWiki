<script setup lang="ts">
import { getCharacterAvatar, handleImageError } from '@/data/avatars'
import { useCustomRoster } from '@/composables/useCustomRoster'
import { computed, ref } from 'vue'

const {
  open,
  query,
  elementFilter,
  pathFilter,
  selectedIds,
  selectedChars,
  activeDetail,
  activeGuide,
  filtered,
  elements,
  paths,
  customScore,
  panelSize,
  resizing,
  togglePick,
  removePick,
  clearPicks,
  openDetail,
  toggleOpen,
  beginResize,
  resetPanelSize,
} = useCustomRoster()

const panelEl = ref<HTMLElement | null>(null)

const panelStyle = computed(() => {
  if (!panelSize.value.width || !panelSize.value.height) return undefined
  return {
    width: `${panelSize.value.width}px`,
    height: `${panelSize.value.height}px`,
    maxHeight: 'none',
    minHeight: '0',
    overflow: 'hidden',
  }
})

function onResizeDown(mode: 'ne' | 'e' | 's', event: PointerEvent) {
  if (panelEl.value) beginResize(mode, event, panelEl.value)
}

function avatarFor(id: string) {
  return getCharacterAvatar(id)
}

function gradeClass(g?: string) {
  return g || ''
}
</script>

<template>
  <div class="eg-roster-dock" :class="{ open, resizing }">
    <button
      type="button"
      class="eg-roster-fab"
      :aria-expanded="open"
      aria-controls="eg-roster-panel"
      :title="open ? '收起我的角色栏' : '打开我的角色栏'"
      @click="toggleOpen()"
    >
      <span class="eg-roster-fab-icon" aria-hidden="true">✦</span>
      <span class="eg-roster-fab-text">我的角色</span>
      <span v-if="selectedIds.length" class="eg-roster-fab-badge">{{ selectedIds.length }}/4</span>
    </button>

    <aside
      v-show="open"
      id="eg-roster-panel"
      ref="panelEl"
      class="eg-roster-panel"
      :style="panelStyle"
      aria-label="自定义角色栏"
    >
      <header class="eg-roster-head">
        <div>
          <strong>自定义配队 · 养成</strong>
          <div class="eg-roster-sub">拖拽右上角 ⌝ 可调整窗口大小 · 左下角角色栏</div>
        </div>
        <div class="eg-roster-head-actions">
          <button
            type="button"
            class="eg-roster-close"
            title="恢复默认尺寸"
            aria-label="恢复默认尺寸"
            @click="resetPanelSize()"
          >
            ↺
          </button>
          <button
            type="button"
            class="eg-roster-close"
            aria-label="关闭"
            @click="toggleOpen()"
          >
            ×
          </button>
        </div>
      </header>

      <div class="eg-roster-team">
        <div class="eg-roster-team-label">我的四人队</div>
        <div class="eg-roster-team-slots">
          <button
            v-for="i in 4"
            :key="i"
            type="button"
            class="eg-roster-slot"
            :class="{ filled: selectedChars[i - 1] }"
            @click="selectedChars[i - 1] && openDetail(selectedChars[i - 1].id)"
          >
            <template v-if="selectedChars[i - 1]">
              <img
                :src="avatarFor(selectedChars[i - 1].id)"
                :alt="selectedChars[i - 1].name"
                @error="handleImageError"
              />
              <span>{{ selectedChars[i - 1].name }}</span>
              <span class="eg-roster-slot-x" @click.stop="removePick(selectedChars[i - 1].id)">
                ×
              </span>
            </template>
            <span v-else class="eg-roster-empty">空位</span>
          </button>
        </div>
        <div class="eg-roster-score" :class="gradeClass(customScore?.grade)">
          <template v-if="customScore">
            综合 <strong>{{ customScore.total.toFixed(1) }}</strong>
            <span class="eg-badge" :class="customScore.grade">{{ customScore.grade }}</span>
          </template>
          <template v-else>选满 4 人后自动评分</template>
        </div>
      </div>

      <div class="eg-roster-filters">
        <input v-model="query" type="search" placeholder="搜索角色 / 属性 / 标签" aria-label="搜索角色" />
        <select v-model="elementFilter" aria-label="属性筛选">
          <option value="">全部属性</option>
          <option v-for="e in elements" :key="e" :value="e">{{ e }}</option>
        </select>
        <select v-model="pathFilter" aria-label="命途筛选">
          <option value="">全部命途</option>
          <option v-for="p in paths" :key="p" :value="p">{{ p }}</option>
        </select>
        <button type="button" class="eg-roster-clear" @click="clearPicks()">清空</button>
      </div>

      <div class="eg-roster-body">
        <div class="eg-roster-grid" role="list">
          <button
            v-for="c in filtered"
            :key="c.id"
            type="button"
            class="eg-roster-card"
            :class="{ picked: selectedIds.includes(c.id), active: activeDetail?.id === c.id }"
            role="listitem"
            :title="`${c.name} · ${c.element}/${c.path}`"
            @click="togglePick(c.id)"
            @dblclick="openDetail(c.id)"
          >
            <img :src="avatarFor(c.id)" :alt="c.name" loading="lazy" @error="handleImageError" />
            <span class="eg-roster-card-name">{{ c.name }}</span>
            <span class="eg-roster-card-meta">{{ c.element }}·{{ c.path }}</span>
          </button>
        </div>

        <aside class="eg-roster-detail">
          <template v-if="activeDetail && activeGuide">
            <div class="eg-roster-detail-head">
              <img
                :src="avatarFor(activeDetail.id)"
                :alt="activeDetail.name"
                @error="handleImageError"
              />
              <div>
                <div class="name">{{ activeDetail.name }}</div>
                <div class="meta">
                  {{ activeDetail.element }} · {{ activeDetail.path }} · {{ activeDetail.rarity }}★
                </div>
                <div class="tag-row">
                  <span v-for="t in activeDetail.tags.slice(0, 5)" :key="t" class="eg-tag">{{ t }}</span>
                </div>
              </div>
            </div>

            <div class="eg-roster-detail-sec">
              <h4>养成攻略</h4>
              <p><b>主词条</b>：{{ activeGuide.mainStats.join('；') }}</p>
              <p><b>副词条</b>：{{ activeGuide.subStats.join(' / ') }}</p>
              <p><b>遗器</b>：{{ activeGuide.relics.join('；') }}</p>
              <p><b>行迹优先</b>：{{ activeGuide.priority.join('；') }}</p>
              <ul>
                <li v-for="tip in activeGuide.tips" :key="tip">{{ tip }}</li>
              </ul>
            </div>

            <div class="eg-roster-detail-sec">
              <h4>下位替代</h4>
              <template v-if="activeDetail.replacements?.length">
                <p v-for="r in activeDetail.replacements.slice(0, 4)" :key="r.id">
                  <b>{{ r.role }}</b>：{{ r.cost }}
                </p>
              </template>
              <p v-else class="eg-roster-muted">暂无推荐替代</p>
            </div>

            <button type="button" class="eg-roster-detail-btn" @click="togglePick(activeDetail.id)">
              {{ selectedIds.includes(activeDetail.id) ? '从队伍移除' : '加入我的队伍' }}
            </button>
          </template>
          <div v-else class="eg-roster-detail-empty">
            <div class="hint-title">点击左侧角色头像</div>
            <p>可上阵到队伍，或查看养成攻略与下位替代。</p>
            <p class="eg-roster-muted">再次点击可移出队伍；已选角色会高亮描边。</p>
          </div>
        </aside>
      </div>

      <div
        class="eg-resize-handle eg-resize-e"
        title="拖拽调整宽度"
        @pointerdown="onResizeDown('e', $event)"
      />
      <div
        class="eg-resize-handle eg-resize-s"
        title="拖拽调整高度"
        @pointerdown="onResizeDown('s', $event)"
      />
      <div
        class="eg-resize-handle eg-resize-ne"
        title="拖拽调整大小（右上角）"
        @pointerdown="onResizeDown('ne', $event)"
      />
    </aside>
  </div>
</template>

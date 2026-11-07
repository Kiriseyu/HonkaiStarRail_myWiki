<script setup lang="ts">
import { computed } from 'vue'
import bannersJson from '@/data/endgame/banners_current.json'
import { getCharacterAvatar, handleImageError } from '@/data/avatars'
import type { ImportedRoster } from '@/utils/scannerImport'

interface BannerChar {
  id: string
  name: string
  element: string
  path: string
  rarity: number
}

interface BannerLightCone {
  name: string
  path: string
  bannerName: string
}

interface Banner {
  id: string
  name: string
  type?: string
  phase: string
  start: string
  end: string
  fiveStar: BannerChar[]
  fourStar?: BannerChar[]
  lightCone?: BannerLightCone
}

interface RecentBanner {
  id: string
  name: string
  phase: string
  start: string
  end: string
  fiveStar: BannerChar[]
  status?: string
  note?: string
}

const props = defineProps<{ roster: ImportedRoster | null }>()

const meta = (bannersJson as { meta: Record<string, string> }).meta
const banners = (bannersJson as { banners: Banner[] }).banners
const recent = (bannersJson as { recent: RecentBanner[] }).recent

const currency = computed(() => {
  if (props.roster) {
    return {
      stellarJade: props.roster.stellarJade,
      specialPass: props.roster.specialPass,
      standardPass: props.roster.standardPass,
      source: '扫描器导入',
    }
  }
  const c = (bannersJson as { currency: { stellarJade: number; specialPass: number; standardPass: number; note: string } }).currency
  return { ...c, source: '示例存档' }
})

/** 约可抽次数：专票 + 星琼/160 */
const specialPulls = computed(
  () => currency.value.specialPass + Math.floor(currency.value.stellarJade / 160),
)

function owned(id: string): boolean {
  return !!props.roster?.ownedSlugs.has(id)
}

function avatarFor(id: string) {
  return getCharacterAvatar(id)
}
</script>

<template>
  <section class="eg-card eg-banner-card">
    <h2>当期与前瞻卡池</h2>
    <p class="eg-banner-hint">
      版本 {{ meta.version }} · 更新于 {{ meta.updatedAt }} · 来源 {{ meta.sourceText || 'BWIKI 历史跃迁' }}
    </p>

    <div class="eg-currency-row">
      <div class="eg-currency-item">
        <span class="label">星琼</span>
        <span class="val">{{ currency.stellarJade }}</span>
      </div>
      <div class="eg-currency-item">
        <span class="label">专票</span>
        <span class="val">{{ currency.specialPass }}</span>
      </div>
      <div class="eg-currency-item">
        <span class="label">通票</span>
        <span class="val">{{ currency.standardPass }}</span>
      </div>
      <div class="eg-currency-item highlight">
        <span class="label">约可抽</span>
        <span class="val">{{ specialPulls }}</span>
      </div>
    </div>
    <div class="eg-currency-src">资源来源：{{ currency.source }}</div>

    <article v-for="b in banners" :key="b.id" class="eg-banner">
      <header>
        <div>
          <strong>{{ b.name }}</strong>
          <span class="eg-tag">{{ b.phase }}</span>
          <span v-if="b.lightCone" class="eg-tag mech">{{ b.lightCone.bannerName }}</span>
        </div>
        <div class="eg-banner-time">{{ b.start }} ~ {{ b.end }}</div>
      </header>

      <div class="eg-banner-stars">
        <div
          v-for="c in b.fiveStar"
          :key="c.id"
          class="eg-banner-char five"
          :class="{ owned: owned(c.id) }"
        >
          <img
            class="eg-avatar"
            :src="avatarFor(c.id)"
            :alt="c.name"
            width="48"
            height="48"
            loading="lazy"
            @error="handleImageError"
          />
          <div>
            <div class="name">{{ c.name }}</div>
            <div class="meta">{{ c.element }}·{{ c.path }} · 5★</div>
          </div>
          <span v-if="owned(c.id)" class="eg-tag element">已持有</span>
        </div>
        <div
          v-for="c in b.fourStar || []"
          :key="c.id + '-4'"
          class="eg-banner-char"
          :class="{ owned: owned(c.id) }"
        >
          <img
            class="eg-avatar"
            :src="avatarFor(c.id)"
            :alt="c.name"
            width="36"
            height="36"
            loading="lazy"
            @error="handleImageError"
          />
          <div>
            <div class="name">{{ c.name }}</div>
            <div class="meta">{{ c.element }}·{{ c.path }}</div>
          </div>
          <span v-if="owned(c.id)" class="eg-tag">已持有</span>
        </div>
      </div>

      <div v-if="b.lightCone" class="eg-banner-lc">
        UP 光锥：{{ b.lightCone.name }}（{{ b.lightCone.path }}）
      </div>
    </article>

    <details v-if="recent?.length" class="eg-banner-recent">
      <summary>近期卡池</summary>
      <ul>
        <li v-for="r in recent" :key="r.id">
          <strong>{{ r.name }}</strong>
          <span class="eg-tag">{{ r.phase }}</span>
          <span class="eg-tag">{{ r.status }}</span>
          —— {{ r.fiveStar.map((c) => c.name).join(' / ') }}
          <div v-if="r.note" class="eg-banner-note">{{ r.note }}</div>
        </li>
      </ul>
    </details>
  </section>
</template>

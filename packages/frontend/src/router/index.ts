import { createRouter, createWebHistory } from 'vue-router'
import EndgameTeamsView from '../views/EndgameTeamsView.vue'

const router = createRouter({
  history: createWebHistory('/'),
  routes: [
    {
      path: '/',
      name: 'home',
      component: EndgameTeamsView,
      meta: { title: '当期高难配队' },
    },
    {
      path: '/endgame',
      name: 'endgame',
      component: EndgameTeamsView,
      meta: { title: '当期高难配队' },
    },
  ],
})

router.afterEach((to) => {
  const title = to.meta?.title
  document.title = title ? `${title} · HSR Team Builder` : 'HSR Team Builder'
})

export default router

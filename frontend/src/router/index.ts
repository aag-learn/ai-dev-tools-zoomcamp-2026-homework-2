import { createRouter, createWebHistory } from 'vue-router'
import PeopleView from '../views/PeopleView.vue'
import ExpensesView from '../views/ExpensesView.vue'
import BalancesView from '../views/BalancesView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/expenses' },
    { path: '/people', name: 'people', component: PeopleView },
    { path: '/expenses', name: 'expenses', component: ExpensesView },
    { path: '/balances', name: 'balances', component: BalancesView },
  ],
})

export default router

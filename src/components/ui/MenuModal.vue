<script setup lang="ts">
import { DEBUG } from '@/config/debug.config';
import { useGameStore } from '@/stores/game.store';
import { useSessionStore } from '@/stores/session.store';
import { useUiStore } from '@/stores/ui.store';
import { formatMoney } from '@/utils/format';

const ui = useUiStore();
const game = useGameStore();
const session = useSessionStore();
</script>

<template>
  <Transition name="fade">
    <div v-if="ui.modal === 'menu'" class="modal" @click.self="ui.closeModal()">
      <aside class="drawer" role="dialog" aria-label="Меню">
        <header class="drawer__head">
          <h2>Меню</h2>
          <button class="icon-button" type="button" @click="ui.closeModal()">✕</button>
        </header>

        <button class="drawer__item" type="button" @click="ui.openModal('paytable')">
          Таблица выплат
        </button>

        <button class="drawer__item" type="button" @click="ui.setSound(!ui.soundEnabled)">
          Звук
          <span>{{ ui.soundEnabled ? 'вкл' : 'выкл' }}</span>
        </button>

        <button class="drawer__item" type="button" @click="game.setTurbo(!ui.turbo)">
          Турбо-режим
          <span>{{ ui.turbo ? 'вкл' : 'выкл' }}</span>
        </button>

        <dl class="drawer__info">
          <div>
            <dt>Игрок</dt>
            <dd>{{ session.user?.name ?? '—' }}</dd>
          </div>
          <div>
            <dt>Баланс</dt>
            <dd>{{ formatMoney(session.balance) }}</dd>
          </div>
          <div>
            <dt>Ставка</dt>
            <dd>{{ formatMoney(game.bet) }}</dd>
          </div>
        </dl>

        <p v-if="DEBUG" class="drawer__note">
          Демо-режим: спины считает локальный мок. Отладка сценариев —
          <code>?force=bigwin|freespins|lightning|slam</code>, фиксированный ГПСЧ —
          <code>?seed=123</code>, профиль частот — <code>?tuning=demo</code>.
        </p>
      </aside>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.modal {
  position: absolute;
  inset: 0;
  z-index: 65;
  background: rgba(3, 5, 12, 0.6);
}

.drawer {
  position: absolute;
  inset: 0 auto 0 0;
  width: min(360px, 86vw);
  padding: 20px;
  background: var(--panel-solid);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 10px;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;

    h2 {
      margin: 0;
      font-size: 20px;
    }
  }

  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: rgba(255, 255, 255, 0.04);
    text-align: left;
    cursor: pointer;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    span {
      color: var(--gold);
      font-size: 13px;
    }
  }

  &__info {
    margin: 14px 0 0;
    display: grid;
    gap: 8px;
    font-size: 13px;

    div {
      display: flex;
      justify-content: space-between;
    }

    dt {
      color: var(--text-muted);
    }

    dd {
      margin: 0;
      font-variant-numeric: tabular-nums;
    }
  }

  &__note {
    margin-top: auto;
    font-size: 11px;
    line-height: 1.6;
    color: var(--text-muted);

    code {
      color: var(--gold);
      font-size: 11px;
    }
  }
}
</style>

<script setup lang="ts">
import { computed } from 'vue';

import { SYMBOL_TEXTURES } from '@/config/assets.manifest';
import {
  FREE_SPINS_RETRIGGER,
  MIN_CLUSTER,
  PAYTABLE,
  SLAM_COINS,
} from '@/config/symbols.config';
import { useGameStore } from '@/stores/game.store';
import { useSessionStore } from '@/stores/session.store';
import { useUiStore } from '@/stores/ui.store';
import { formatMoney } from '@/utils/format';

const ui = useUiStore();
const game = useGameStore();
const session = useSessionStore();

const rows = computed(() =>
  (session.config?.paytable ?? PAYTABLE).map((entry) => ({
    ...entry,
    src: SYMBOL_TEXTURES[entry.symbol],
    amounts: entry.pays.map((mult) => formatMoney(Math.round(mult * game.bet))),
  })),
);

const rtp = computed(() => session.config?.rtp);
</script>

<template>
  <Transition name="fade">
    <div v-if="ui.modal === 'paytable'" class="modal" @click.self="ui.closeModal()">
      <div class="modal__box" role="dialog" aria-label="Таблица выплат">
        <header class="modal__head">
          <h2>Таблица выплат</h2>
          <button class="icon-button" type="button" @click="ui.closeModal()">✕</button>
        </header>

        <p class="modal__hint">
          Выигрыш даёт {{ MIN_CLUSTER }} и более одинаковых символов в любом месте поля.
          Суммы указаны для текущей ставки {{ formatMoney(game.bet) }} — за 8–9, 10–11 и 12+
          символов.
        </p>

        <ul class="paytable">
          <li v-for="row in rows" :key="row.symbol" class="paytable__row">
            <img class="paytable__icon" :src="row.src" :alt="row.symbol" />
            <span class="paytable__pays">
              <span v-for="(amount, i) in row.amounts" :key="i">{{ amount }}</span>
            </span>
          </li>
        </ul>

        <section class="modal__features">
          <h3>Особенности</h3>
          <ul>
            <li>
              <img :src="SYMBOL_TEXTURES.wild_zeus" alt="wild" />
              <span>
                <b>Wild</b> — заменяет любой платящий символ. Появляется от удара молнии Зевса.
              </span>
            </li>
            <li>
              <img :src="SYMBOL_TEXTURES.scatter" alt="scatter" />
              <span>
                <b>Scatter</b> — 3 штуки на поле дают 10 фриспинов, 4 — 15, 5 — 25, 6 и больше —
                30. Внутри бонуса 3+ скаттера добавляют ещё {{ FREE_SPINS_RETRIGGER }}. Во
                фриспинах кулак Зевса прилетает заметно чаще, а каждый удар молнии поднимает
                общий множитель.
              </span>
            </li>
            <li>
              <img :src="SYMBOL_TEXTURES.extra_slam" alt="slam" />
              <span>
                <b>Удар Зевса</b> — разносит всё активное поле и превращает символы в монеты:
                {{ formatMoney(SLAM_COINS.silver * game.bet) }} за обычный символ и
                {{ formatMoney(SLAM_COINS.gold * game.bet) }} за редкий (шлем и доспех).
              </span>
            </li>
            <li>
              <span class="paytable__tile" />
              <span>
                <b>Погашенные ячейки</b> — тёмные клетки поля. Символы в них видны, но в
                выигрышах и в ударе Зевса не участвуют.
              </span>
            </li>
          </ul>
        </section>

        <footer v-if="rtp" class="modal__foot">Теоретическая отдача (RTP): {{ rtp }}%</footer>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.modal {
  position: absolute;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(3, 5, 12, 0.76);

  &__box {
    width: min(620px, 100%);
    max-height: 86vh;
    overflow-y: auto;
    padding: 22px;
    border-radius: 16px;
    background: var(--panel-solid);
    border: 1px solid var(--border);
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;

    h2 {
      margin: 0;
      font-size: 20px;
    }
  }

  &__hint {
    margin: 10px 0 16px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-muted);
  }

  &__features {
    margin-top: 18px;

    h3 {
      margin: 0 0 10px;
      font-size: 15px;
    }

    ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 12px;
    }

    li {
      display: grid;
      grid-template-columns: 46px 1fr;
      gap: 12px;
      align-items: center;
      font-size: 13px;
      line-height: 1.45;
      color: var(--text-muted);

      b {
        color: var(--text);
      }
    }

    img {
      width: 46px;
      height: 46px;
    }
  }

  .paytable__tile {
    width: 46px;
    height: 46px;
    border-radius: 8px;
    background: linear-gradient(180deg, #33415f, #1d2740);
    border: 2px solid #4a5c85;
  }

  &__foot {
    margin-top: 18px;
    font-size: 12px;
    color: var(--text-muted);
  }
}

.paytable {
  margin: 0;
  padding: 0;
  list-style: none;

  &__row {
    display: grid;
    grid-template-columns: 54px 1fr;
    align-items: center;
    gap: 14px;
    padding: 6px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  &__icon {
    width: 54px;
    height: 54px;
  }

  &__pays {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    font-variant-numeric: tabular-nums;
    font-size: 13px;
    color: var(--text-muted);

    span:last-child {
      color: var(--gold);
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

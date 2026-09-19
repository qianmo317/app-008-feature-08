<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getTask, addCountAdjustment } from '../db';
import {
  estimateVehicle,
  roomProgress,
  statusColor,
  statusLabel,
  adjustmentTotal,
  adjustedBoxCount,
  isFullyUnloaded,
  formatTime,
  uid,
} from '../utils';
import type { MoveTask } from '../types';

const route = useRoute();
const router = useRouter();
const task = ref<MoveTask | null>(null);

const stats = computed(() => {
  if (!task.value) return { total: 0, loaded: 0, unpacked: 0, damaged: 0 };
  const boxes = task.value.boxes;
  return {
    total: boxes.length,
    loaded: boxes.filter((b) => b.status === 'loaded').length,
    unpacked: boxes.filter((b) => b.status === 'unpacked').length,
    damaged: boxes.filter((b) => b.status === 'damaged').length,
  };
});

const adjustments = computed(() => task.value?.countAdjustments ?? []);
const adjustSum = computed(() => (task.value ? adjustmentTotal(task.value) : 0));
const adjustedTotal = computed(() => (task.value ? adjustedBoxCount(task.value) : 0));
const countDiffers = computed(() => adjustSum.value !== 0);
const fullyUnloaded = computed(() => (task.value ? isFullyUnloaded(task.value) : false));

// 车型建议按校准后的总箱数估算
const vehicle = computed(() => {
  if (!task.value || adjustedTotal.value <= 0) return null;
  return estimateVehicle(adjustedTotal.value);
});

const roomStats = computed(() => {
  if (!task.value) return [];
  return task.value.rooms.map((r) => ({ room: r, ...roomProgress(task.value!, r) }));
});

const showAdjustForm = ref(false);
const adjustDelta = ref<number | string>('');
const adjustReason = ref('');
const adjustError = ref('');

function openAdjustForm() {
  adjustDelta.value = '';
  adjustReason.value = '';
  adjustError.value = '';
  showAdjustForm.value = true;
}

async function submitAdjustment() {
  if (!task.value) return;
  const delta = Number(adjustDelta.value);
  if (!Number.isInteger(delta) || delta === 0) {
    adjustError.value = '请输入非零整数（正数加箱，负数减箱）';
    return;
  }
  const reason = adjustReason.value.trim();
  if (!reason) {
    adjustError.value = '请填写调整原因';
    return;
  }
  if (adjustedTotal.value + delta < 0) {
    adjustError.value = '校准后总箱数不能小于 0';
    return;
  }
  if (fullyUnloaded.value && !confirm('该任务已卸完货，确定还要调整总箱数吗？')) {
    return;
  }
  await addCountAdjustment(task.value.id, { id: uid(), delta, reason, createdAt: Date.now() });
  showAdjustForm.value = false;
  await load();
}

async function load() {
  task.value = await getTask(route.params.id as string);
}

onMounted(load);
</script>

<template>
  <div v-if="task">
    <div class="header">
      <router-link to="/" class="back">←</router-link>
      <h1>{{ task.title }}</h1>
    </div>
    <div class="page">
      <div class="grid-2">
        <div class="card" style="text-align:center;">
          <div style="font-size:28px;font-weight:800;" :style="countDiffers ? 'color:var(--warning);' : ''">{{ adjustedTotal }}</div>
          <div style="font-size:12px;color:var(--text-secondary);">
            总箱数<template v-if="countDiffers">（登记 {{ stats.total }}）</template>
          </div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:28px;font-weight:800;color:var(--info);">{{ stats.loaded }}</div>
          <div style="font-size:12px;color:var(--text-secondary);">已装车</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:28px;font-weight:800;color:var(--success);">{{ stats.unpacked }}</div>
          <div style="font-size:12px;color:var(--text-secondary);">已拆箱</div>
        </div>
        <div class="card" style="text-align:center;">
          <div style="font-size:28px;font-weight:800;color:var(--danger);">{{ stats.damaged }}</div>
          <div style="font-size:12px;color:var(--text-secondary);">破损</div>
        </div>
      </div>

      <div class="card" :style="countDiffers ? 'border-left:4px solid var(--warning);' : ''">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="font-weight:700;">箱数校准</div>
          <span style="font-size:12px;color:var(--text-secondary);">已调整 {{ adjustments.length }} 次</span>
        </div>
        <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:8px;font-size:14px;">
          <span>登记箱数 <b>{{ stats.total }}</b></span>
          <span>校准后 <b :style="countDiffers ? 'color:var(--warning);' : ''">{{ adjustedTotal }}</b></span>
          <span v-if="countDiffers" style="color:var(--warning);font-weight:700;">
            {{ adjustSum > 0 ? '+' : '' }}{{ adjustSum }}（与登记不符）
          </span>
        </div>

        <button v-if="!showAdjustForm" class="btn btn-secondary no-print" style="margin-top:10px;padding:8px 14px;font-size:14px;" @click="openAdjustForm">调整总箱数</button>

        <div v-else style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px;">
          <label class="label">调整数量（正数加箱，负数减箱）</label>
          <input v-model="adjustDelta" type="number" step="1" class="input" placeholder="例如：2 或 -1" />
          <label class="label" style="margin-top:8px;">调整原因</label>
          <input v-model="adjustReason" class="input" placeholder="例如：现场清点多出 2 箱未登记" @keyup.enter="submitAdjustment" />
          <div v-if="fullyUnloaded" style="color:var(--warning);font-size:13px;margin-top:8px;">
            ⚠ 该任务已卸完货，调整前请确认现场清点无误
          </div>
          <div v-if="adjustError" style="color:var(--danger);font-size:13px;margin-top:8px;">{{ adjustError }}</div>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="btn" style="padding:8px 14px;font-size:14px;" @click="submitAdjustment">保存调整</button>
            <button class="btn btn-secondary" style="padding:8px 14px;font-size:14px;" @click="showAdjustForm = false">取消</button>
          </div>
        </div>

        <div v-if="adjustments.length" style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px;">
          <div v-for="a in [...adjustments].reverse()" :key="a.id" style="display:flex;align-items:baseline;gap:8px;font-size:13px;padding:4px 0;">
            <b :style="{color: a.delta > 0 ? 'var(--success)' : 'var(--danger)'}">{{ a.delta > 0 ? '+' : '' }}{{ a.delta }}</b>
            <span style="flex:1;">{{ a.reason }}</span>
            <span style="color:var(--text-secondary);white-space:nowrap;">{{ formatTime(a.createdAt) }}</span>
          </div>
        </div>
      </div>

      <div v-if="vehicle" class="card">
        <div style="font-weight:700;">车型建议</div>
        <div style="font-size:14px;color:var(--text-secondary);margin-top:4px;">
          {{ vehicle.vehicle }} · {{ vehicle.suggestion }}
        </div>
        <div v-if="countDiffers" style="font-size:12px;color:var(--text-secondary);margin-top:4px;">
          按校准后 {{ adjustedTotal }} 箱估算
        </div>
      </div>

      <div class="card">
        <div style="font-weight:700;margin-bottom:8px;">拆箱进度</div>
        <div v-for="rs in roomStats" :key="rs.room" style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:14px;">
            <span>{{ rs.room }}</span>
            <span>{{ rs.unpacked }}/{{ rs.total }}</span>
          </div>
          <div style="height:8px;background:var(--border);border-radius:999px;overflow:hidden;margin-top:4px;">
            <div :style="{width: rs.total ? `${(rs.unpacked/rs.total)*100}%` : '0%', height:'100%', background:'var(--success)', borderRadius:'999px'}"></div>
          </div>
        </div>
      </div>

      <div class="toolbar no-print">
        <button class="btn" @click="router.push(`/task/${task.id}/register`)">封箱登记</button>
        <button class="btn" @click="router.push(`/task/${task.id}/scan`)">扫码查箱</button>
        <button class="btn" @click="router.push(`/task/${task.id}/check`)">卸货核对</button>
        <button class="btn" @click="router.push(`/task/${task.id}/labels`)">标签打印</button>
      </div>

      <div class="card">
        <div style="font-weight:700;margin-bottom:8px;">最近封箱</div>
        <div v-if="task.boxes.length === 0" class="empty" style="padding:12px 0;">还没有箱子，去封箱登记吧</div>
        <div v-for="b in [...task.boxes].reverse().slice(0,10)" :key="b.id" class="card" @click="router.push(`/task/${task.id}/box/${b.code}`)" style="display:flex;align-items:center;gap:10px;cursor:pointer;">
          <span class="status-dot" :style="{background: statusColor(b.status)}"></span>
          <div style="flex:1;">
            <div style="font-weight:700;">{{ b.code }}</div>
            <div style="font-size:12px;color:var(--text-secondary);">{{ b.roomTo }} · {{ b.tags.join(', ') || '无标签' }}</div>
          </div>
          <span style="font-size:12px;color:var(--text-secondary);">{{ statusLabel(b.status) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

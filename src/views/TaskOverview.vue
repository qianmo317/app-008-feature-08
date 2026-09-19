<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getTask, addCountAdjustment } from '../db';
import { estimateVehicle, roomProgress, statusColor, statusLabel, boxCountSummary, isUnloadFinished, formatDateTime, uid } from '../utils';
import type { MoveTask } from '../types';

const route = useRoute();
const router = useRouter();
const task = ref<MoveTask | null>(null);

const stats = computed(() => {
  if (!task.value) return { loaded: 0, unpacked: 0, damaged: 0 };
  const boxes = task.value.boxes;
  return {
    loaded: boxes.filter((b) => b.status === 'loaded').length,
    unpacked: boxes.filter((b) => b.status === 'unpacked').length,
    damaged: boxes.filter((b) => b.status === 'damaged').length,
  };
});

const countSummary = computed(() => {
  if (!task.value) return { registered: 0, delta: 0, effective: 0, adjustCount: 0 };
  return boxCountSummary(task.value);
});

const adjustments = computed(() => [...(task.value?.countAdjustments || [])].reverse());

const unloadFinished = computed(() => (task.value ? isUnloadFinished(task.value) : false));

const vehicle = computed(() => {
  if (!task.value || countSummary.value.effective <= 0) return null;
  return estimateVehicle(countSummary.value.effective);
});

const roomStats = computed(() => {
  if (!task.value) return [];
  return task.value.rooms.map((r) => ({ room: r, ...roomProgress(task.value!, r) }));
});

const showAdjForm = ref(false);
const adjDeltaText = ref('');
const adjReason = ref('');

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

async function submitAdjustment() {
  if (!task.value) return;
  const delta = Number(adjDeltaText.value);
  if (!Number.isInteger(delta) || delta === 0) {
    alert('请输入非零整数（正数=多出来的箱数，负数=少了的箱数）');
    return;
  }
  const reason = adjReason.value.trim();
  if (!reason) {
    alert('请填写修改原因');
    return;
  }
  if (countSummary.value.effective + delta < 0) {
    alert('修正后总箱数不能小于 0');
    return;
  }
  if (unloadFinished.value && !confirm('该任务已完成卸货，确定还要修正总箱数吗？')) {
    return;
  }
  await addCountAdjustment(task.value.id, { id: uid(), delta, reason, createdAt: Date.now() });
  adjDeltaText.value = '';
  adjReason.value = '';
  showAdjForm.value = false;
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
          <div style="font-size:28px;font-weight:800;" :style="countSummary.delta !== 0 ? 'color:var(--warning);' : ''">{{ countSummary.effective }}</div>
          <div style="font-size:12px;color:var(--text-secondary);">总箱数</div>
          <div v-if="countSummary.delta !== 0" style="font-size:11px;color:var(--warning);margin-top:2px;">
            系统 {{ countSummary.registered }} · 修正 {{ signed(countSummary.delta) }}
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

      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="font-weight:700;">箱数修正</div>
          <span style="font-size:12px;color:var(--text-secondary);">已修正 {{ countSummary.adjustCount }} 次</span>
        </div>
        <div style="display:flex;align-items:center;gap:14px;margin-top:8px;font-size:14px;flex-wrap:wrap;">
          <span>系统计算 <b>{{ countSummary.registered }}</b> 箱</span>
          <span :style="countSummary.delta !== 0 ? 'color:var(--warning);font-weight:700;' : ''">
            修正后 <b>{{ countSummary.effective }}</b> 箱
          </span>
          <span v-if="countSummary.delta !== 0" style="font-size:12px;background:var(--warning);color:#fff;border-radius:999px;padding:2px 8px;">
            差 {{ signed(countSummary.delta) }}
          </span>
        </div>

        <div v-if="showAdjForm" style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px;">
          <label class="label">加减箱数（正数=多出来，负数=少了）</label>
          <input v-model="adjDeltaText" type="number" step="1" class="input" placeholder="例如 2 或 -1" />
          <label class="label" style="margin-top:8px;">修改原因</label>
          <input v-model="adjReason" class="input" placeholder="例如：现场清点多出 2 箱未登记" @keyup.enter="submitAdjustment" />
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="btn" style="flex:1;" @click="submitAdjustment">确认修正</button>
            <button class="btn btn-secondary" style="flex:1;" @click="showAdjForm = false">取消</button>
          </div>
        </div>
        <button v-else class="btn btn-secondary btn-block" style="margin-top:10px;" @click="showAdjForm = true">加减箱数</button>

        <div v-if="adjustments.length" style="margin-top:10px;border-top:1px solid var(--border);padding-top:6px;">
          <div v-for="a in adjustments" :key="a.id" style="display:flex;align-items:baseline;gap:8px;font-size:13px;padding:4px 0;">
            <span :style="{color: a.delta > 0 ? 'var(--success)' : 'var(--danger)', fontWeight:700, minWidth:'36px'}">{{ signed(a.delta) }}</span>
            <span style="flex:1;">{{ a.reason }}</span>
            <span style="color:var(--text-secondary);font-size:12px;white-space:nowrap;">{{ formatDateTime(a.createdAt) }}</span>
          </div>
        </div>
      </div>

      <div v-if="vehicle" class="card">
        <div style="font-weight:700;">车型建议</div>
        <div style="font-size:14px;color:var(--text-secondary);margin-top:4px;">
          {{ vehicle.vehicle }} · {{ vehicle.suggestion }}
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

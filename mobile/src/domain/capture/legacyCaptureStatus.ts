// 仅用于旧记录回看，不参与新的采集状态转换。
export type SafetyStopReason = 'pain' | 'dizziness' | 'fatigue' | 'other';

export const safetyStopReasonLabels: Record<SafetyStopReason, string> = {
  pain: '疼痛',
  dizziness: '头晕',
  fatigue: '明显疲劳',
  other: '其他风险',
};

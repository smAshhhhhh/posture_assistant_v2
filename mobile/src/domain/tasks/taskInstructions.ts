import type { AffectedSide } from '../patients/types';

import type { RehabTaskId } from './taskCatalog';

interface TaskInstructions {
  readonly movement: string;
  readonly framing: string;
  readonly support: string;
  readonly safety: string;
  readonly measurementNotice?: string;
}

export function getTaskInstructions(
  taskId: RehabTaskId,
  affectedSide: AffectedSide,
): TaskInstructions {
  const side = affectedSide === 'left' ? '左' : '右';
  const seatedSafety = '患者坐姿稳定，周围空间安全；出现疼痛、头晕或明显疲劳时立即停止。';
  const standingSafety = '由治疗师确认适用性、陪护与防跌倒条件；未确认前不要尝试站立或步行。';

  switch (taskId) {
    case 'elbow_flexion_extension':
      return {
        movement: `坐稳后缓慢弯曲${side}肘，再伸直。按舒适节奏重复，避免躯干晃动。`,
        framing: `${side}侧朝向镜头，肩、肘、腕完整入镜，避免扶手遮挡。`,
        support: '使用稳固的椅子，双脚着地。',
        safety: seatedSafety,
      };
    case 'shoulder_flexion':
      return {
        movement: `坐稳后，将${side}臂在舒适范围内缓慢向前抬起，再放回。避免耸肩或后仰。`,
        framing: `${side}侧朝向镜头，肩、肘、腕和躯干完整入镜。`,
        support: '使用稳固的椅子，双脚着地。',
        safety: seatedSafety,
      };
    case 'seated_trunk_lean':
      return {
        movement: '坐稳后在舒适范围内缓慢前倾，再回到坐直的位置，不勉强增加幅度。',
        framing: `${side}侧朝向镜头，肩、髋、膝完整入镜。`,
        measurementNotice:
          '本次倾角以画面竖直方向为参照。手机保持竖直、镜头水平并固定，镜头倾斜会影响结果。',
        support: '使用稳固的椅子，双脚着地，按现场需要陪护。',
        safety: seatedSafety,
      };
    case 'seated_knee_extension':
      return {
        movement: `坐稳后缓慢伸展${side}膝，再放回，不勉强伸直。`,
        framing: `${side}侧朝向镜头，髋、膝、踝完整入镜。`,
        support: '使用稳固的椅子，保持躯干稳定。',
        safety: seatedSafety,
      };
    case 'sit_to_stand':
      return {
        movement: '在治疗师指导和保护下，先坐稳片刻，再起身、站稳片刻，最后缓慢坐回并坐稳。',
        framing: `${side}侧朝向固定镜头，头部到双脚完整入镜，双脚留在原位。`,
        measurementNotice:
          '从稳定坐姿开始，手机固定、镜头水平，避免移动椅子和双脚。报告结合膝夹角与髋部抬升识别往返，无法判断是否接触椅面或独立站稳。',
        support: '确认椅子稳固、地面防滑，记录扶手及人工辅助。',
        safety: standingSafety,
      };
    case 'march_in_place':
      return {
        movement: '先稳定站立至少半秒，再在治疗师指导和保护下原地交替抬脚并放回。',
        framing: '侧面机位水平固定，头部到双脚完整入镜，双侧髋、膝和踝均须清晰可见。',
        measurementNotice:
          '开始后先站稳至少半秒；机位保持水平固定，双腿清晰可见。暂停恢复后需重新站稳再抬脚。',
        support: '确认地面防滑、有陪护，记录扶持和辅助器具。',
        safety: standingSafety,
      };
    case 'short_walk':
      return {
        movement:
          '沿治疗师确认的直线路线，以舒适节奏从画面一侧走向另一侧，使用平时所需的辅助器具。',
        framing: '侧面机位水平固定，路线平行画面，全程双腿清晰入镜，不跟拍或转弯。',
        measurementNotice:
          '固定手机，不跟拍；沿平行画面的直线行走，双侧肩、髋、膝和踝保持入镜。周期与位移只描述二维投影，不提供米制步长或步速。',
        support: '路线无障碍、有足够空间和陪护，记录人工与器具辅助。',
        safety: standingSafety,
      };
  }
}

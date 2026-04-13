export const GOAL_STATUSES = ['draft', 'confirmed', 'pending-review', 'completed'] as const;

export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const GOAL_EDITABLE_STATUS: GoalStatus = 'draft';
export const GOAL_CONFIRMABLE_STATUS: GoalStatus = 'confirmed';
export const GOAL_REVIEWABLE_STATUS: GoalStatus = 'pending-review';
export const GOAL_COMPLETED_STATUS: GoalStatus = 'completed';

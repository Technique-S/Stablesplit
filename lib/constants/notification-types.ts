export const NOTIFICATION_TYPES = {
  EXPENSE_CREATED: "expense_created",
  EXPENSE_UPDATED: "expense_updated",
  EXPENSE_DELETED: "expense_deleted",
  SETTLEMENT_COMPLETED: "settlement_completed",
  MEMBER_JOINED: "member_joined",
  INVITE_ACCEPTED: "invite_accepted",
  GROUP_UPDATED: "group_updated",
  GROUP_DELETED: "group_deleted",
  BRIDGE_COMPLETED: "bridge_completed",
  TEST: "test",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  groupId?: string;
  groupName?: string;
  actorName?: string;
  metadata?: Record<string, unknown>;
}

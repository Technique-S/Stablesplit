import type { ExpenseCategory } from "./types";

export interface GroupTemplate {
  id: string;
  label: string;
  emoji: string;
  description: string;
  suggestedCategories: ExpenseCategory[];
}

export const GROUP_TEMPLATES: GroupTemplate[] = [
  {
    id: "roommates",
    label: "Roommates",
    emoji: "🏠",
    description: "Shared household expenses with roommates.",
    suggestedCategories: ["utilities", "food", "other"],
  },
  {
    id: "trip",
    label: "Trip",
    emoji: "✈️",
    description: "Travel expenses on a group trip.",
    suggestedCategories: ["accommodation", "transport", "food", "entertainment"],
  },
  {
    id: "friends",
    label: "Friends",
    emoji: "🎉",
    description: "Everyday expenses with friends.",
    suggestedCategories: ["food", "entertainment", "transport"],
  },
  {
    id: "project",
    label: "Project Team",
    emoji: "👥",
    description: "Team project expenses and supplies.",
    suggestedCategories: ["other", "food", "utilities"],
  },
  {
    id: "event",
    label: "Event",
    emoji: "🎪",
    description: "Planning an event or party together.",
    suggestedCategories: ["entertainment", "food", "accommodation"],
  },
  {
    id: "custom",
    label: "Custom",
    emoji: "✏️",
    description: "Start from scratch with a blank group.",
    suggestedCategories: [],
  },
];

// Defensive cleanup for the offer stack lists (projects.stack_items / fast_action_bonuses, see
// 0045_value_stack.sql and 0046_bonus_category_and_fab.sql) — shared by the Discovery save and the
// stack auto-save so both accept exactly the same shape. Optional keys (category, basis,
// basis_type, image_path) are kept only when valid and filled in, so existing rows stay exactly as
// they were and nothing is ever dropped or rewritten except malformed entries.

import type { FastActionBonus, StackItem } from "@/types/database";
import { isValueBasisType } from "@/lib/valueBasis";

// Product images live in the slide-images bucket under the member's own folder (see
// api/projects/[id]/offer-images) — only paths in exactly that shape are kept.
const OFFER_IMAGE_PATH = /^[0-9a-f-]{36}\/offer-items\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|png)$/;

function offerImagePath(value: unknown): { image_path?: string } {
  return typeof value === "string" && OFFER_IMAGE_PATH.test(value) ? { image_path: value } : {};
}

function valueBasis(item: { basis?: unknown; basis_type?: unknown }): { basis?: string; basis_type?: string } {
  return {
    ...(typeof item.basis === "string" && item.basis.trim() ? { basis: item.basis.trim().slice(0, 2000) } : {}),
    ...(isValueBasisType(item.basis_type) ? { basis_type: item.basis_type } : {}),
  };
}

export function sanitizeStackItems(parsed: unknown): StackItem[] {
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item): item is StackItem => typeof item?.name === "string" && typeof item?.value === "string")
    .map((item) => ({
      name: item.name,
      value: item.value,
      ...(item.category === "stack" || item.category === "bonus" ? { category: item.category } : {}),
      ...valueBasis(item),
      ...offerImagePath(item.image_path),
    }));
}

export function sanitizeFastActionBonuses(parsed: unknown): FastActionBonus[] {
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(
      (item): item is FastActionBonus =>
        typeof item?.name === "string" && typeof item?.value === "string" && typeof item?.condition === "string"
    )
    .map((item) => ({
      name: item.name,
      value: item.value,
      condition: item.condition,
      ...valueBasis(item),
      ...offerImagePath(item.image_path),
    }));
}

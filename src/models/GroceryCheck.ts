/**
 * One ticked-off grocery line for a given week.
 * Compound primary key: [weekStart+ingredientId] — naturally unique.
 */
export interface GroceryCheck {
  /** Start-of-week-Monday epoch ms. */
  weekStart: number;
  ingredientId: number;
}

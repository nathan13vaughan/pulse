import type { BPCategory } from "../models/BPReading";
import { BP_CATEGORY_LABEL } from "../models/BPReading";

export function CategoryBadge({ category }: { category: BPCategory }) {
  return <span className={`category-badge cat-${category}`}>{BP_CATEGORY_LABEL[category]}</span>;
}

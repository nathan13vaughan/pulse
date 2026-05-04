#!/usr/bin/env python3
"""
Convert AUSNUT 2011-13 spreadsheets into the slim JSON Pulse bundles.

Source files (download from FSANZ):
  https://www.foodstandards.gov.au/science-data/monitoringnutrients/ausnut/ausnutdatafiles
  - "AUSNUT 2011-13 AHS Food Nutrient Database.xlsx"  (or .xls)
  - "AUSNUT 2011-13 AHS Food Details file.xlsx"

Output: ausnut_foods.json — drop into Pulse/Resources/, replacing the starter set.

Usage:
  python convert_ausnut.py \
      --nutrients "AUSNUT 2011-13 AHS Food Nutrient Database.xlsx" \
      --names     "AUSNUT 2011-13 AHS Food Details file.xlsx" \
      --out       ../Pulse/Resources/ausnut_foods.json

Requirements: Python 3.9+, pandas, openpyxl (or xlrd for .xls).
  pip install pandas openpyxl xlrd

The AUSNUT spreadsheets evolve their column headers occasionally. If a
KeyError fires, run with --inspect to print the column names of each input
file and adjust NUTRIENT_COLS / NAME_COLS / KEY_COL below.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# AUSNUT column names — verify these against your downloaded file with --inspect.
KEY_COL = "Public Food Key"
NAME_COL = "Food Name"
GROUP_COL = "Submajor Group"  # may be "Submajor Group ID" or similar

# Map AUSNUT nutrient column → our slim-JSON key. The AUSNUT spreadsheet uses
# verbose names with units in parentheses; pandas preserves them verbatim.
NUTRIENT_COLS: dict[str, str] = {
    "Energy, with dietary fibre (kJ)": "kj",
    "Energy, with dietary fibre (kcal)": "kcal",
    "Protein (g)": "protein",
    "Total fat (g)": "fat",
    "Available carbohydrate, with sugar alcohols (g)": "carbs",
    "Total dietary fibre (g)": "fibre",
    "Sodium (Na) (mg)": "sodium",
    "Potassium (K) (mg)": "potassium",
    "Calcium (Ca) (mg)": "calcium",
    "Magnesium (Mg) (mg)": "magnesium",
}

# AUSNUT submajor food group prefix (first 2 digits of food key) → our GroceryAisle raw value.
# Source: AUSNUT 2011-13 food classification system.
AISLE_BY_GROUP_PREFIX: dict[str, str] = {
    "11": "pantry",       # Cereals and cereal products
    "12": "bakery",       # Cereal-based products and dishes
    "13": "condiments",   # Fats and oils
    "14": "meatSeafood",  # Fish and seafood
    "15": "dairyEggs",    # Egg products
    "16": "meatSeafood",  # Meat, poultry and game
    "17": "dairyEggs",    # Milk products
    "18": "pantry",       # Soup
    "19": "condiments",   # Savoury sauces and condiments
    "20": "produce",      # Vegetable products and dishes
    "21": "pantry",       # Legume and pulse products
    "22": "pantry",       # Snack foods
    "23": "pantry",       # Sugar products
    "24": "pantry",       # Confectionery and bars
    "25": "pantry",       # Seed and nut products
    "26": "beverages",    # Non-alcoholic beverages
    "27": "beverages",    # Alcoholic beverages
    "28": "other",        # Special dietary foods
    "29": "other",        # Miscellaneous
    "06": "produce",      # Fruit (some AUSNUT versions use 06xxxxxx)
}


def aisle_for(food_key: str) -> str:
    return AISLE_BY_GROUP_PREFIX.get(food_key[:2], "other")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--nutrients", required=True, type=Path, help="Path to AUSNUT Food Nutrient Database file.")
    parser.add_argument("--names", required=True, type=Path, help="Path to AUSNUT Food Details file.")
    parser.add_argument("--out", required=True, type=Path, help="Output JSON path.")
    parser.add_argument("--inspect", action="store_true", help="Print column names from input files and exit.")
    parser.add_argument("--limit", type=int, default=None, help="Optional cap on number of rows (useful for testing).")
    args = parser.parse_args()

    try:
        import pandas as pd
    except ImportError:
        sys.exit("pandas is required. Install with: pip install pandas openpyxl xlrd")

    nutrients_df = pd.read_excel(args.nutrients)
    names_df = pd.read_excel(args.names)

    if args.inspect:
        print("Nutrient file columns:")
        for col in nutrients_df.columns:
            print(f"  {col!r}")
        print("\nName file columns:")
        for col in names_df.columns:
            print(f"  {col!r}")
        return 0

    missing = [c for c in [KEY_COL, *NUTRIENT_COLS] if c not in nutrients_df.columns]
    if missing:
        sys.exit(
            f"Missing columns in nutrient file: {missing}\n"
            f"Run with --inspect to see actual column names, then edit NUTRIENT_COLS in this script."
        )
    if KEY_COL not in names_df.columns or NAME_COL not in names_df.columns:
        sys.exit(f"Name file must contain columns {KEY_COL!r} and {NAME_COL!r}. Run with --inspect.")

    merged = nutrients_df.merge(
        names_df[[KEY_COL, NAME_COL]],
        on=KEY_COL,
        how="inner",
    )

    rows: list[dict[str, Any]] = []
    for _, record in merged.iterrows():
        key = str(record[KEY_COL]).strip()
        if not key or key.lower() == "nan":
            continue
        slim: dict[str, Any] = {
            "key": key,
            "name": str(record[NAME_COL]).strip(),
            "aisle": aisle_for(key),
        }
        for source, target in NUTRIENT_COLS.items():
            value = record.get(source)
            try:
                slim[target] = round(float(value), 2)
            except (TypeError, ValueError):
                slim[target] = 0.0
        rows.append(slim)

    if args.limit:
        rows = rows[: args.limit]

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))

    print(f"Wrote {len(rows)} foods to {args.out}")
    print(f"File size: {args.out.stat().st_size / 1024:.1f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
Filter the Open Food Facts bulk dump down to Coles/Woolworths-tagged Australian
products and write the slim JSON Pulse bundles.

Source: https://world.openfoodfacts.org/data
  Use the gzipped JSONL dump — `openfoodfacts-products.jsonl.gz`.
  The full file is ~10 GB compressed; this script streams it line by line
  so you don't need to hold it all in memory.

Output: branded_foods.json — drop into Pulse/Resources/, replacing the starter set.

Usage:
  python convert_off.py \
      --input openfoodfacts-products.jsonl.gz \
      --out   ../Pulse/Resources/branded_foods.json

Requirements: Python 3.9+. No third-party deps (uses stdlib gzip + json).

License note: Open Food Facts data is released under the Open Database License
(ODbL). The slim JSON we bundle is a derivative database — keep an attribution
notice in your About screen if you ship publicly. (For a personal app, no-op.)
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterator

# Aisle inference from OFF category tags.
#
# We use word-boundary regex (not raw substring) for two reasons:
#   - Avoid false positives like `egg` matching `eggplant`.
#   - Allow safe ordering by category specificity since hyphens act as word
#     boundaries in OFF tags (e.g. `\bfish\b` matches `en:fish-canned-in-water`).
#
# Order matters: first match wins. Keep specific food types BEFORE generic
# location/preparation words like "water"/"frozen" so e.g. tuna in water
# doesn't land in beverages.
AISLE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    # Specific protein sources first
    (re.compile(r"\bfish(es)?\b"),       "meatSeafood"),
    (re.compile(r"\bseafoods?\b"),       "meatSeafood"),
    (re.compile(r"\bsalmons?\b"),        "meatSeafood"),
    (re.compile(r"\btunas?\b"),          "meatSeafood"),
    (re.compile(r"\bsardines?\b"),       "meatSeafood"),
    (re.compile(r"\banchov(y|ies)\b"),   "meatSeafood"),
    (re.compile(r"\bprawns?\b"),         "meatSeafood"),
    (re.compile(r"\bshrimps?\b"),        "meatSeafood"),
    (re.compile(r"\bcrabs?\b"),          "meatSeafood"),
    (re.compile(r"\bmeats?\b"),          "meatSeafood"),
    (re.compile(r"\bpoultry\b"),         "meatSeafood"),
    (re.compile(r"\bchickens?\b"),       "meatSeafood"),
    (re.compile(r"\bbeef\b"),            "meatSeafood"),
    (re.compile(r"\blambs?\b"),          "meatSeafood"),
    (re.compile(r"\bporks?\b"),          "meatSeafood"),
    (re.compile(r"\bsausages?\b"),       "meatSeafood"),
    (re.compile(r"\bbacons?\b"),         "meatSeafood"),
    (re.compile(r"\bham\b"),             "meatSeafood"),

    # Dairy & eggs (egg pattern matches eggs but not eggplant)
    (re.compile(r"\bdair(y|ies)\b"),     "dairyEggs"),
    (re.compile(r"\bmilks?\b"),          "dairyEggs"),
    (re.compile(r"\byog(h?urts?)?\b"),   "dairyEggs"),
    (re.compile(r"\bcheeses?\b"),        "dairyEggs"),
    (re.compile(r"\bbutters?\b"),        "dairyEggs"),
    (re.compile(r"\bcreams?\b"),         "dairyEggs"),
    (re.compile(r"\beggs?\b"),           "dairyEggs"),

    # Bakery
    (re.compile(r"\bbreads?\b"),         "bakery"),
    (re.compile(r"\bbakery\b"),          "bakery"),
    (re.compile(r"\bpastr(y|ies)\b"),    "bakery"),
    (re.compile(r"\bcakes?\b"),          "bakery"),
    (re.compile(r"\bmuffins?\b"),        "bakery"),

    # Produce — check before "frozen" so fresh tags win, but after "frozen"
    # in the legacy ordering would put e.g. "frozen-vegetables" in produce.
    # We want frozen-vegetables in the frozen aisle, so frozen wins.
    # That's why frozen comes BEFORE produce in this list.
    (re.compile(r"\bfrozen\b"),          "frozen"),
    (re.compile(r"\bvegetables?\b"),     "produce"),
    (re.compile(r"\bfruits?\b"),         "produce"),
    (re.compile(r"\bberr(y|ies)\b"),     "produce"),
    (re.compile(r"\bsalads?\b"),         "produce"),

    # Pantry staples
    (re.compile(r"\bcereals?\b"),        "pantry"),
    (re.compile(r"\bbreakfast\b"),       "pantry"),
    (re.compile(r"\boats?\b"),           "pantry"),
    (re.compile(r"\brice\b"),            "pantry"),
    (re.compile(r"\bpastas?\b"),         "pantry"),
    (re.compile(r"\bnoodles?\b"),        "pantry"),
    (re.compile(r"\bflours?\b"),         "pantry"),
    (re.compile(r"\bsugars?\b"),         "pantry"),
    (re.compile(r"\bsnacks?\b"),         "pantry"),
    (re.compile(r"\bbiscuits?\b"),       "pantry"),
    (re.compile(r"\bcrackers?\b"),       "pantry"),
    (re.compile(r"\blegumes?\b"),        "pantry"),
    (re.compile(r"\bbeans?\b"),          "pantry"),
    (re.compile(r"\blentils?\b"),        "pantry"),
    (re.compile(r"\bchickpeas?\b"),      "pantry"),
    (re.compile(r"\bnuts?\b"),           "pantry"),
    (re.compile(r"\bseeds?\b"),          "pantry"),
    (re.compile(r"\bjams?\b"),           "pantry"),
    (re.compile(r"\bhoney\b"),           "pantry"),

    # Condiments & oils
    (re.compile(r"\bsauces?\b"),         "condiments"),
    (re.compile(r"\bcondiments?\b"),     "condiments"),
    (re.compile(r"\boils?\b"),           "condiments"),
    (re.compile(r"\bvinegars?\b"),       "condiments"),
    (re.compile(r"\bdressings?\b"),      "condiments"),
    (re.compile(r"\bspreads?\b"),        "condiments"),
    (re.compile(r"\bmayonnaise\b"),      "condiments"),
    (re.compile(r"\bketchup\b"),         "condiments"),
    (re.compile(r"\bmustards?\b"),       "condiments"),

    # Spices & herbs
    (re.compile(r"\bherbs?\b"),          "spices"),
    (re.compile(r"\bspices?\b"),         "spices"),
    (re.compile(r"\bsalts?\b"),          "spices"),
    (re.compile(r"\bpeppers?\b"),        "spices"),

    # Beverages last so things like "fish in water" don't get vacuumed up first
    (re.compile(r"\bbeverages?\b"),      "beverages"),
    (re.compile(r"\bdrinks?\b"),         "beverages"),
    (re.compile(r"\bwaters?\b"),         "beverages"),
    (re.compile(r"\bjuices?\b"),         "beverages"),
    (re.compile(r"\bsodas?\b"),          "beverages"),
    (re.compile(r"\bteas?\b"),           "beverages"),
    (re.compile(r"\bcoffees?\b"),        "beverages"),
    (re.compile(r"\bwines?\b"),          "beverages"),
    (re.compile(r"\bbeers?\b"),          "beverages"),
]

# Required fields per row; products missing these are dropped.
REQUIRED_NUTRIENTS = ["energy-kj_100g", "proteins_100g", "carbohydrates_100g", "fat_100g"]


def aisle_for(categories_tags: list[str]) -> str:
    haystack = " ".join(categories_tags).lower()
    for pattern, aisle in AISLE_PATTERNS:
        if pattern.search(haystack):
            return aisle
    return "other"


def matches_target_stores(product: dict[str, Any]) -> bool:
    """True iff product is sold at Coles or Woolworths."""
    stores = product.get("stores_tags", []) or []
    if not isinstance(stores, list):
        return False
    joined = " ".join(stores).lower()
    return "coles" in joined or "woolworths" in joined


def matches_australia(product: dict[str, Any]) -> bool:
    countries = product.get("countries_tags", []) or []
    if not isinstance(countries, list):
        return False
    return any("australia" in c.lower() for c in countries)


def primary_brand(product: dict[str, Any]) -> str | None:
    brands = product.get("brands")
    if not brands:
        return None
    # OFF stores comma-separated brand strings; first one is usually the manufacturer.
    return brands.split(",")[0].strip() or None


def slim_row(product: dict[str, Any]) -> dict[str, Any] | None:
    code = (product.get("code") or "").strip()
    name = (product.get("product_name") or product.get("product_name_en") or "").strip()
    if not code or not name:
        return None

    nutriments = product.get("nutriments") or {}
    if not isinstance(nutriments, dict):
        return None
    if any(nutriments.get(k) is None for k in REQUIRED_NUTRIENTS):
        return None

    # OFF reports sodium in grams per 100g; convert to mg. Fall back to salt → sodium.
    sodium_g = nutriments.get("sodium_100g")
    if sodium_g is None:
        salt_g = nutriments.get("salt_100g")
        sodium_g = (salt_g / 2.5) if salt_g is not None else 0.0

    def mg(value: Any) -> float:
        try:
            return round(float(value) * 1000, 2)
        except (TypeError, ValueError):
            return 0.0

    def g(value: Any, fallback: float = 0.0) -> float:
        try:
            return round(float(value), 2)
        except (TypeError, ValueError):
            return fallback

    return {
        "barcode": code,
        "brand": primary_brand(product),
        "name": name,
        "aisle": aisle_for(product.get("categories_tags") or []),
        "kj": g(nutriments.get("energy-kj_100g")),
        "kcal": g(nutriments.get("energy-kcal_100g")),
        "protein": g(nutriments.get("proteins_100g")),
        "carbs": g(nutriments.get("carbohydrates_100g")),
        "fat": g(nutriments.get("fat_100g")),
        "fibre": g(nutriments.get("fiber_100g")),
        "sodium": mg(sodium_g),
        "potassium": mg(nutriments.get("potassium_100g")),
        "calcium": mg(nutriments.get("calcium_100g")),
        "magnesium": mg(nutriments.get("magnesium_100g")),
    }


def stream_products(path: Path) -> Iterator[dict[str, Any]]:
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", required=True, type=Path, help="Path to Open Food Facts JSONL dump (gz or plain).")
    parser.add_argument("--out", type=Path, default=None, help="Output JSON path (omit when using --search).")
    parser.add_argument("--limit", type=int, default=None, help="Stop after collecting N rows (testing).")
    parser.add_argument("--progress-every", type=int, default=100_000, help="Log progress every N input rows.")
    parser.add_argument(
        "--stores-only",
        action="store_true",
        help="Only keep products tagged with Coles or Woolworths as a store. Most AU products in OFF "
             "lack store tags, so the default (without this flag) is AU-only.",
    )
    parser.add_argument(
        "--search",
        type=str,
        default=None,
        help="Diagnostic mode. Print every product whose name or brand contains this substring "
             "(case-insensitive) along with their tags, then exit without writing JSON. "
             "Useful for figuring out why a specific product was filtered out.",
    )
    args = parser.parse_args()

    if not args.input.exists():
        sys.exit(f"Input file not found: {args.input}")

    if args.search:
        return run_search(args)

    if args.out is None:
        sys.exit("--out is required when not using --search.")

    rows: list[dict[str, Any]] = []
    seen_barcodes: set[str] = set()
    scanned = 0

    for product in stream_products(args.input):
        scanned += 1
        if scanned % args.progress_every == 0:
            print(f"  scanned {scanned:,} products, kept {len(rows):,}", file=sys.stderr)

        if not matches_australia(product):
            continue
        if args.stores_only and not matches_target_stores(product):
            continue

        row = slim_row(product)
        if row is None:
            continue
        if row["barcode"] in seen_barcodes:
            continue
        seen_barcodes.add(row["barcode"])
        rows.append(row)

        if args.limit and len(rows) >= args.limit:
            break

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))

    filter_label = "Coles/Woolworths-tagged" if args.stores_only else "AU-tagged"
    print(f"Scanned {scanned:,} products. Kept {len(rows):,} {filter_label}.")
    print(f"Wrote {args.out} ({args.out.stat().st_size / 1024:.1f} KB)")
    return 0


def run_search(args: argparse.Namespace) -> int:
    needle = args.search.lower()
    matches = 0
    for product in stream_products(args.input):
        name = (product.get("product_name") or product.get("product_name_en") or "").lower()
        brand = (product.get("brands") or "").lower()
        if needle not in name and needle not in brand:
            continue
        matches += 1
        print(f"\n#{matches}  barcode={product.get('code')}")
        print(f"  name:       {product.get('product_name') or product.get('product_name_en')!r}")
        print(f"  brands:     {product.get('brands')!r}")
        print(f"  countries:  {product.get('countries_tags')}")
        print(f"  stores:     {product.get('stores_tags')}")
        nutriments = product.get("nutriments") or {}
        missing = [k for k in REQUIRED_NUTRIENTS if nutriments.get(k) is None]
        print(f"  has all required nutrients: {not missing}" + (f"  (missing: {missing})" if missing else ""))

        # Show whether each filter would let it through.
        au = matches_australia(product)
        stores = matches_target_stores(product)
        verdict = []
        if not au:
            verdict.append("filtered: not tagged Australia")
        if not stores:
            verdict.append("would-be-filtered: no Coles/Woolworths store tag (only matters with --stores-only)")
        if missing:
            verdict.append("filtered: missing required nutrients")
        if not verdict:
            verdict.append("kept by default (AU-only) filter")
        print("  verdict:    " + "; ".join(verdict))

        if args.limit and matches >= args.limit:
            break

    if matches == 0:
        print(f"No products found matching {args.search!r}. The product may not be in this OFF dump at all.")
    else:
        print(f"\nFound {matches} match(es) for {args.search!r}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db";
import { Modal } from "../../components/Modal";
import { BarcodeScanner } from "../../components/BarcodeScanner";
import { lookupBarcode } from "../../services/openFoodFacts";
import {
  AISLE_LABEL,
  ingredientDisplayName,
  nutrientsPer100g,
  type Ingredient,
} from "../../models/Ingredient";
import { GRAMS_PER_UNIT, UNITS, type MeasurementUnit } from "../../models/MealIngredient";
import { scaleTotals } from "../../models/NutrientTotals";

type Scope = "all" | "whole" | "branded";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (ingredient: Ingredient, quantity: number, unit: MeasurementUnit) => void;
}

export function IngredientPicker({ open, onClose, onAdd }: Props) {
  const ingredients = useLiveQuery(
    () => db.ingredients.orderBy("name").toArray(),
    [],
    [],
  );

  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [selected, setSelected] = useState<Ingredient | null>(null);
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState<MeasurementUnit>("g");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ingredients.filter((ing) => {
      if (scope === "whole" && ing.brand) return false;
      if (scope === "branded" && !ing.brand) return false;
      if (!q) return true;
      if (ing.name.toLowerCase().includes(q)) return true;
      if (ing.brand?.toLowerCase().includes(q)) return true;
      if (ing.barcode?.includes(q)) return true;
      return false;
    });
  }, [ingredients, scope, search]);

  const reset = () => {
    setSearch("");
    setScope("all");
    setSelected(null);
    setQuantity(100);
    setUnit("g");
    setScanMessage(null);
  };

  const close = () => { reset(); onClose(); };

  const onBarcodeDetected = async (code: string) => {
    setScannerOpen(false);
    setScanMessage(null);

    // 1. Local cache hit?
    const local = await db.ingredients.where("barcode").equals(code).first();
    if (local) {
      setSelected(local);
      return;
    }

    // 2. Online fallback: ask Open Food Facts. Cache the result.
    setScanMessage(`Looking up ${code} on Open Food Facts…`);
    try {
      const fetched = await lookupBarcode(code);
      if (fetched) {
        const newId = await db.ingredients.add(fetched);
        const stored = await db.ingredients.get(Number(newId));
        if (stored) {
          setSelected(stored);
          setScanMessage(`Added "${stored.name}" from Open Food Facts.`);
          return;
        }
      }
      setScanMessage(`Barcode ${code} isn't in Open Food Facts. Search manually or add it as a new ingredient.`);
      setSearch(code);
      setScope("branded");
    } catch {
      setScanMessage(`Couldn't reach Open Food Facts. Try again when you're online.`);
      setSearch(code);
      setScope("branded");
    }
  };

  const confirmAdd = () => {
    if (!selected) return;
    onAdd(selected, quantity, unit);
    close();
  };

  return (
    <Modal open={open} onClose={close} title="Add ingredient">
      <div className="picker">
        <div className="picker__search">
          <div className="picker__search-row">
            <input
              className="text-input"
              placeholder="Search name, brand, or barcode"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className="icon-btn picker__scan"
              onClick={() => setScannerOpen(true)}
              aria-label="Scan barcode"
              title="Scan barcode"
            >
              <ScanIcon />
            </button>
          </div>
          {scanMessage ? (
            <div className="muted picker__scan-msg">{scanMessage}</div>
          ) : null}
          <div className="seg">
            {(["all", "whole", "branded"] as Scope[]).map((s) => (
              <button
                key={s}
                type="button"
                className={`seg__btn ${scope === s ? "seg__btn--active" : ""}`}
                onClick={() => setScope(s)}
              >
                {s === "all" ? "All" : s === "whole" ? "Whole" : "Branded"}
              </button>
            ))}
          </div>
        </div>

        <ul className="picker__list">
          {filtered.length === 0 ? (
            <li className="picker__empty muted">No matches.</li>
          ) : (
            filtered.map((ing) => {
              const isSelected = selected?.id === ing.id;
              return (
                <li
                  key={ing.id}
                  className={`picker__row ${isSelected ? "picker__row--active" : ""}`}
                >
                  <button type="button" className="picker__row-btn" onClick={() => setSelected(ing)}>
                    <div className="picker__main">
                      <div className="picker__name">{ing.name}</div>
                      {ing.brand ? <div className="picker__brand">{ing.brand}</div> : null}
                      <div className="picker__meta">
                        {Math.round(ing.energyKjPer100g)} kJ/100g
                        {ing.sodiumMgPer100g > 0 ? ` · ${Math.round(ing.sodiumMgPer100g)} mg Na` : ""}
                        {" · "}{AISLE_LABEL[ing.aisle]}
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="picker__check" aria-hidden>✓</span>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        {selected ? (
          <PickerFooter
            ingredient={selected}
            quantity={quantity}
            unit={unit}
            onQuantityChange={setQuantity}
            onUnitChange={setUnit}
            onAdd={confirmAdd}
          />
        ) : null}
      </div>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={onBarcodeDetected}
      />
    </Modal>
  );
}

function ScanIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M7 8v8M11 8v8M15 8v8" />
    </svg>
  );
}

interface FooterProps {
  ingredient: Ingredient;
  quantity: number;
  unit: MeasurementUnit;
  onQuantityChange: (n: number) => void;
  onUnitChange: (u: MeasurementUnit) => void;
  onAdd: () => void;
}

function PickerFooter({ ingredient, quantity, unit, onQuantityChange, onUnitChange, onAdd }: FooterProps) {
  const grams = quantity * GRAMS_PER_UNIT[unit];
  const totals = scaleTotals(nutrientsPer100g(ingredient), grams / 100);

  return (
    <div className="picker__footer">
      <div className="picker__footer-name">{ingredientDisplayName(ingredient)}</div>
      <div className="picker__footer-summary muted">
        {Math.round(totals.energyKj)} kJ · {Math.round(totals.sodiumMg)} mg Na · {Math.round(grams)} g
      </div>
      <div className="picker__footer-controls">
        <input
          type="number"
          inputMode="decimal"
          className="text-input picker__qty"
          value={quantity}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onQuantityChange(Number.isFinite(v) ? v : 0);
          }}
          min={0}
          step="any"
        />
        <select
          className="text-input picker__unit"
          value={unit}
          onChange={(e) => onUnitChange(e.target.value as MeasurementUnit)}
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <button type="button" className="btn btn--primary" onClick={onAdd}>Add</button>
      </div>
    </div>
  );
}

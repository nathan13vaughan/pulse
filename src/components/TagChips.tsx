import "./TagChips.css";

interface TagChipsProps {
  options: string[];
  selected: ReadonlySet<string>;
  onToggle: (tag: string) => void;
}

export function TagChips({ options, selected, onToggle }: TagChipsProps) {
  return (
    <div className="chips">
      {options.map((tag) => {
        const active = selected.has(tag);
        return (
          <button
            key={tag}
            type="button"
            className={`chip ${active ? "chip--active" : ""}`}
            onClick={() => onToggle(tag)}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}

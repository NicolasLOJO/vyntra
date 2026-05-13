interface Props {
  active: boolean;
  onToggle: () => void;
}

export function EditModeToggle({ active, onToggle }: Props) {
  return (
    <button
      type="button"
      className="vyntra-edit-toggle"
      data-active={active}
      onClick={onToggle}
    >
      {active ? "✓ Done" : "✎ Edit"}
    </button>
  );
}

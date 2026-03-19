"use client";

import { Input } from "@sachikit/ui/components/input";
import * as React from "react";

type EditableTitleProps = {
  title: string;
  onSave: (value: string) => void;
  isPending: boolean;
};

export function EditableTitle({ title, onSave, isPending }: EditableTitleProps) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(title);

  function commit() {
    const trimmed = value.trim();
    if (trimmed.length > 0 && trimmed !== title) {
      onSave(trimmed);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") {
            setValue(title);
            setEditing(false);
          }
        }}
        disabled={isPending}
        className="text-lg font-semibold"
        autoFocus
      />
    );
  }

  return (
    <button
      type="button"
      className="text-left text-lg font-semibold text-sachi-fg hover:text-sachi-accent"
      onClick={() => {
        setValue(title);
        setEditing(true);
      }}
      title="Click to edit title"
    >
      {title}
    </button>
  );
}

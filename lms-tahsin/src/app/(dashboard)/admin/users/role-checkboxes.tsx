"use client";

import { RoleName } from "@/generated/prisma/enums";
import { ROLE_LABEL } from "@/lib/labels";

/**
 * Satu user boleh punya lebih dari satu role (docs/02), jadi pilihannya
 * checkbox — bukan radio.
 */
export function RoleCheckboxes({
  selected,
  onToggle,
  lockedRoles = [],
}: {
  selected: RoleName[];
  onToggle: (role: RoleName, checked: boolean) => void;
  lockedRoles?: readonly RoleName[];
}) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-3">
      {Object.values(RoleName).map((role) => {
        const locked = lockedRoles.includes(role);
        return (
          <label
            key={role}
            className={`flex items-center gap-2 text-sm ${
              locked ? "cursor-not-allowed text-plum-400" : "text-plum-700"
            }`}
          >
            <input
              type="checkbox"
              className="size-4 accent-plum-700"
              checked={selected.includes(role)}
              disabled={locked}
              onChange={(e) => onToggle(role, e.target.checked)}
            />
            {ROLE_LABEL[role]}
          </label>
        );
      })}
    </div>
  );
}

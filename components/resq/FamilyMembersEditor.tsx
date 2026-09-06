import { useState } from "react";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { useFamilySync } from "@/lib/family-sync";

const control = "tap-target rounded-xl border border-input bg-card px-3 py-2 font-bold";
export function FamilyMembersEditor() {
  const family = useFamilySync();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const act = (fn: () => void) => {
    try {
      fn();
      setError("");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  return (
    <section className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {family.identity
          ? "Use any name or relationship. Added members have no location until it is confirmed."
          : "Start with your name. You can add your family next. This saves on this device."}
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (
            act(() =>
              family.identity
                ? family.manage("addMember", crypto.randomUUID(), name)
                : family.startLocal(name),
            )
          )
            setName("");
        }}
      >
        <input
          aria-label={family.identity ? "New member name" : "Your name"}
          placeholder={family.identity ? "Name, e.g. Aisha or Brother" : "Your name"}
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          className={control + " min-w-0 flex-1 font-normal"}
          required
        />
        <button className={control + " bg-primary text-primary-foreground"} type="submit">
          <Plus className="mr-1 inline h-4 w-4" />
          {family.identity ? "Add" : "Start"}
        </button>
      </form>
      {family.identity &&
        family.members.map((m) => (
          <div key={m.id} className="rounded-xl border p-3">
            {editing === m.id ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (act(() => family.manage("renameMember", m.id, draft))) setEditing(null);
                }}
              >
                <input
                  autoFocus
                  aria-label="Edit member name"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={40}
                  required
                  className={control + " min-w-0 flex-1"}
                />
                <button type="submit" aria-label="Save name" className={control}>
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Cancel editing"
                  className={control}
                  onClick={() => setEditing(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 break-words font-bold">
                  {m.name}
                  {m.id === family.identity?.memberId && (
                    <small className="block font-normal text-muted-foreground">This phone</small>
                  )}
                </span>
                <button
                  className={control}
                  aria-label={"Rename " + m.name}
                  onClick={() => {
                    setEditing(m.id);
                    setDraft(m.name);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {m.id !== family.identity?.memberId && (
                  <button
                    className={control + " text-red-700"}
                    aria-label={"Remove " + m.name}
                    onClick={() => setRemoving(m.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
            {removing === m.id && (
              <div className="mt-3 text-sm">
                <p>
                  Remove {m.name} from the family? Their shared access and family record will be
                  removed when synchronized.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    className={control + " text-red-700"}
                    onClick={() => {
                      if (act(() => family.manage("removeMember", m.id))) setRemoving(null);
                    }}
                  >
                    Remove member
                  </button>
                  <button className={control} onClick={() => setRemoving(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {family.identity && !family.identity.demo && (
        <p className="text-xs text-muted-foreground">
          Changes synchronize with your family server. To join an added member, enter their exact
          name on their phone.
        </p>
      )}
    </section>
  );
}

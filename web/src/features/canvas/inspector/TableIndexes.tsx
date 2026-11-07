import { indexProblems, keyType, MAX_INDEXES, tableIndexes, type KeyType, type TableIndex } from "../tableIndexes";
import type { CanvasNode } from "../useCanvas";
import { inputClass, sectionTitle } from "./styles";

interface TableIndexesProps {
  node: CanvasNode;
  readOnly?: boolean;
  onUpdate: (config: Record<string, unknown>) => void;
}

const TYPES: { value: KeyType; label: string }[] = [
  { value: "S", label: "String" },
  { value: "N", label: "Number" },
  { value: "B", label: "Binary" },
];

// Global secondary indexes: other keys to query the table by.
export function TableIndexes({ node, readOnly = false, onUpdate }: TableIndexesProps) {
  const indexes = tableIndexes(node);
  const problems = indexProblems(node);
  const save = (next: TableIndex[]) => onUpdate({ ...node.config, indexes: next });
  const change = (i: number, patch: Partial<TableIndex>) => save(indexes.map((ix, j) => (j === i ? { ...ix, ...patch } : ix)));
  const tableName = String(node.config.name ?? "table");

  const add = () => {
    const taken = new Set(indexes.map((ix) => ix.name));
    let n = indexes.length + 1;
    while (taken.has(`index-${n}`)) n++;
    save([...indexes, { name: `index-${n}`, partitionKey: "", partitionKeyType: "S", projection: "ALL" }]);
  };

  return (
    <section className="px-4 py-4 border-b border-edge">
      <div className="flex items-center justify-between mb-2.5">
        <p className={sectionTitle}>Indexes</p>
        {!readOnly && indexes.length < MAX_INDEXES && (
          <button onClick={add} className="text-[11px] font-medium text-indigo-500 hover:text-indigo-400 transition-colors">
            + Add index
          </button>
        )}
      </div>

      {indexes.length === 0 ? (
        <p className="text-[11px] leading-snug text-ink-dim">
          Add a global secondary index to query the table by other attributes, such as every item with a status, newest first.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {indexes.map((ix, i) => (
            <div key={i} className={["rounded-xl border p-2.5 flex flex-col gap-2", problems[i] ? "border-amber-500/40" : "border-edge"].join(" ")}>
              <div className="flex items-center gap-2">
                <input
                  aria-label="Index name"
                  value={ix.name}
                  disabled={readOnly}
                  onChange={(e) => change(i, { name: e.target.value })}
                  className={`${inputClass} flex-1 font-mono`}
                />
                {!readOnly && (
                  <button
                    onClick={() => save(indexes.filter((_, j) => j !== i))}
                    aria-label={`Remove the index ${ix.name}`}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-dim hover:text-red-500 hover:bg-red-500/5 transition-colors shrink-0"
                  >
                    <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M1 1l8 8M9 1L1 9" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>

              <KeyRow
                label="Partition key"
                attr={ix.partitionKey}
                type={keyType(ix.partitionKeyType)}
                placeholder="status"
                disabled={readOnly}
                onChange={(attr, type) => change(i, { partitionKey: attr, partitionKeyType: type })}
              />
              <KeyRow
                label="Sort key"
                attr={ix.sortKey ?? ""}
                type={keyType(ix.sortKeyType)}
                placeholder="Optional, such as createdAt"
                disabled={readOnly}
                onChange={(attr, type) => change(i, { sortKey: attr, sortKeyType: type })}
              />

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-ink-dim">Copies</span>
                <div role="radiogroup" aria-label="Attributes copied into the index" className="flex rounded-lg border border-edge p-0.5">
                  {(["ALL", "KEYS_ONLY"] as const).map((p) => (
                    <button
                      key={p}
                      role="radio"
                      aria-checked={(ix.projection ?? "ALL") === p}
                      disabled={readOnly}
                      onClick={() => change(i, { projection: p })}
                      className={[
                        "px-2 h-6 rounded-md text-[11px] transition-colors",
                        (ix.projection ?? "ALL") === p ? "bg-raised text-ink font-medium" : "text-ink-dim hover:text-ink",
                      ].join(" ")}
                    >
                      {p === "ALL" ? "Every attribute" : "Keys only"}
                    </button>
                  ))}
                </div>
              </div>

              {problems[i] ? (
                <p className="text-[11px] leading-snug text-amber-600 dark:text-amber-400">{problems[i]} It is left out until then.</p>
              ) : (
                <p className="text-[11px] leading-snug text-ink-dim font-mono truncate" title="How a function queries it with boto3">
                  table.query(IndexName="{ix.name}", …)
                </p>
              )}
            </div>
          ))}
          <p className="text-[11px] leading-snug text-ink-dim">
            Functions connected to {tableName} can query its indexes. Items without the index's keys are not in it.
          </p>
        </div>
      )}
    </section>
  );
}

function KeyRow({
  label,
  attr,
  type,
  placeholder,
  disabled,
  onChange,
}: {
  label: string;
  attr: string;
  type: KeyType;
  placeholder: string;
  disabled: boolean;
  onChange: (attr: string, type: KeyType) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        aria-label={label}
        value={attr}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value, type)}
        className={`${inputClass} flex-1 font-mono`}
      />
      <select
        aria-label={`${label} type`}
        value={type}
        disabled={disabled}
        onChange={(e) => onChange(attr, e.target.value as KeyType)}
        className={`${inputClass} w-24 pr-1`}
      >
        {TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}

import { useState } from "react";
import type { ConfigFormat } from "@shared/types";
import { toast } from "../toast";

interface Props {
  modName: string;
  filePath: string;
  format: ConfigFormat;
  initialData: Record<string, unknown>;
  onClose: () => void;
}

type JsonValue = string | number | boolean | JsonValue[] | { [key: string]: JsonValue };

function isPlainObject(value: unknown): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function setAtPath(root: Record<string, unknown>, path: string[], value: unknown): Record<string, unknown> {
  const next = structuredClone(root);
  let cursor: any = next;
  for (let i = 0; i < path.length - 1; i++) {
    cursor = cursor[path[i]];
  }
  cursor[path[path.length - 1]] = value;
  return next;
}

function ConfigField({ label, value, onChange }: { label: string; value: JsonValue; onChange: (value: JsonValue) => void }) {
  if (typeof value === "boolean") {
    return (
      <label className="field-checkbox config-field">
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
      </label>
    );
  }

  if (typeof value === "number") {
    return (
      <label className="field config-field">
        <span>{label}</span>
        <input
          className="input"
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        />
      </label>
    );
  }

  if (Array.isArray(value)) {
    const asText = value.map((v) => String(v)).join(", ");
    return (
      <label className="field config-field">
        <span>{label} (comma-separated)</span>
        <input
          className="input"
          defaultValue={asText}
          onBlur={(e) => {
            const items = e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
              .map((s) => (s === "true" ? true : s === "false" ? false : !isNaN(Number(s)) && s !== "" ? Number(s) : s));
            onChange(items as JsonValue[]);
          }}
        />
      </label>
    );
  }

  // string (or unknown scalar, stringified)
  return (
    <label className="field config-field">
      <span>{label}</span>
      <input className="input" defaultValue={String(value)} onBlur={(e) => onChange(e.target.value)} />
    </label>
  );
}

function ConfigSection({
  data,
  path,
  onChange,
}: {
  data: Record<string, JsonValue>;
  path: string[];
  onChange: (path: string[], value: JsonValue) => void;
}) {
  const scalarKeys = Object.keys(data).filter((k) => !isPlainObject(data[k]));
  const sectionKeys = Object.keys(data).filter((k) => isPlainObject(data[k]));

  return (
    <div className="config-section">
      {scalarKeys.map((key) => (
        <ConfigField key={key} label={key} value={data[key]} onChange={(value) => onChange([...path, key], value)} />
      ))}
      {sectionKeys.map((key) => (
        <div key={key} className="config-subsection">
          <h4>{key}</h4>
          <ConfigSection data={data[key] as Record<string, JsonValue>} path={[...path, key]} onChange={onChange} />
        </div>
      ))}
      {scalarKeys.length === 0 && sectionKeys.length === 0 && <p className="empty-hint">This section has no editable fields.</p>}
    </div>
  );
}

export default function ConfigModal({ modName, filePath, format, initialData, onClose }: Props) {
  const [data, setData] = useState<Record<string, unknown>>(initialData);
  const [saving, setSaving] = useState(false);

  const handleChange = (path: string[], value: JsonValue) => {
    setData((prev) => setAtPath(prev, path, value));
  };

  const save = async () => {
    setSaving(true);
    try {
      await window.api.modConfig.write(filePath, format, data);
      toast(`Saved ${modName} config`, "success");
      onClose();
    } catch (err) {
      toast(`Failed to save config: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={saving ? undefined : onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>{modName} config</h2>
        <p className="instance-subtitle config-path">{filePath}</p>
        {format === "toml" && (
          <p className="config-warning">Saving rewrites this file from scratch - any hand-written comments in it will be lost.</p>
        )}

        <div className="config-form">
          <ConfigSection data={data as Record<string, JsonValue>} path={[]} onChange={handleChange} />
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

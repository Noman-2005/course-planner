import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { adoptRemote, createCode, getCode, hasLocalData, lookupCode, normalizeCode, syncOut } from "./syncClient.js";

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  // fallback for older mobile browsers / non-secure pages
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

const cleanName = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 40);

/* "I have a code..." box + Sync button (used before and after sync is turned on) */
function CodeBox({ ownCode, label }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState(null);
  const [err, setErr] = useState("");

  async function go() {
    setErr("");
    const norm = normalizeCode(input);
    if (!norm) return setErr("That doesn’t look like a valid code.");
    if (norm === ownCode) return setErr("This is already this device’s code.");
    setBusy(true);
    try {
      const res = await lookupCode(input);
      if (!res) setErr("No saved data found for this code.");
      else if (hasLocalData()) setFound(res); // ask before replacing what is on this device
      else {
        adoptRemote(res);
        window.location.reload();
        return;
      }
    } catch {
      setErr("Could not reach the server. Try again.");
    }
    setBusy(false);
  }

  function confirm() {
    adoptRemote(found);
    window.location.reload();
  }

  return (
    <div className="sync-field">
      {label && <span className="sync-label">{label}</span>}
      <div className="sync-box">
        <input
          type="text"
          className="mono"
          value={input}
          placeholder="I have a code..."
          aria-label="Enter a sync code"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={20}
          disabled={!!found}
          onChange={(e) => {
            setInput(e.target.value.toUpperCase());
            setErr("");
          }}
          onKeyDown={(e) => e.key === "Enter" && !busy && !found && go()}
        />
        <button type="button" className="sync-go" onClick={go} disabled={busy || !!found || !input.trim()}>
          {busy ? "…" : "Sync"}
        </button>
      </div>
      {err && <p className="sync-err">{err}</p>}
      {found && (
        <div className="sync-confirm">
          <p className="sync-warn">
            Saved data found. This will replace the data currently on <b>this device</b>.
          </p>
          <div className="sync-row">
            <button type="button" className="sync-go ghost" onClick={() => setFound(null)}>
              Cancel
            </button>
            <button type="button" className="sync-go" onClick={confirm}>
              Replace &amp; sync
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Profile name: shows the saved name with an edit button; input + tick while editing */
function NameField({ name, onName, toast }) {
  const saved = cleanName(name);
  const [editing, setEditing] = useState(!saved);
  const [draft, setDraft] = useState(saved);
  const changed = cleanName(draft) !== saved;

  function save() {
    const n = cleanName(draft);
    if (n === saved) {
      // nothing changed: just go back to showing the saved name
      if (saved) {
        setDraft(saved);
        setEditing(false);
      }
      return;
    }
    onName(n);
    setDraft(n);
    setEditing(!n);
    toast(n ? "Name saved" : "Name removed");
  }

  return (
    <div className="sync-field">
      <span className="sync-label">
        <Icon name="user" size={12} /> Profile name <em>optional</em>
      </span>
      {editing ? (
        <div className="sync-box">
          <input
            type="text"
            value={draft}
            maxLength={40}
            placeholder="Your name"
            aria-label="Profile name"
            autoComplete="off"
            autoFocus={!!saved}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
          <button
            type="button"
            className={"sync-act" + (changed || saved ? " on" : "")}
            onClick={save}
            disabled={!changed && !saved}
            aria-label="Save name"
            title="Save name"
          >
            <Icon name="check" size={15} />
          </button>
        </div>
      ) : (
        <div className="sync-box">
          <span className="sync-name">{saved}</span>
          <button
            type="button"
            className="sync-act"
            onClick={() => {
              setDraft(saved);
              setEditing(true);
            }}
            aria-label="Edit name"
            title="Edit name"
          >
            <Icon name="edit" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function SyncPanel({ name, onName, toast }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(() => getCode());
  const [copied, setCopied] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const t = useRef(0);

  useEffect(() => () => clearTimeout(t.current), []);

  function doSyncOut() {
    syncOut();
    setCode(null);
    setConfirmOut(false);
    toast("Synced out of this device");
  }

  function generate() {
    setCode(createCode());
    toast("Sync code created");
  }

  async function copy() {
    const ok = await copyText(code);
    if (!ok) return toast("Could not copy — select the code and copy it manually");
    setCopied(true);
    toast("Code copied");
    clearTimeout(t.current);
    t.current = setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className={"sync" + (open ? " open" : "")}>
      <button
        type="button"
        className="more-item sync-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Icon name="sync" size={16} /> Sync
      </button>

      {open && !code && (
        <div className="sync-body">
          <p className="sync-note">Keep your routines, plans and progress on every device.</p>
          <CodeBox ownCode={null} />
          <div className="sync-or">
            <span>or</span>
          </div>
          <button type="button" className="sync-create" onClick={generate}>
            <Icon name="key" size={14} /> Generate a sync code
          </button>
        </div>
      )}

      {open && code && (
        <div className="sync-body">
          <NameField name={name} onName={onName} toast={toast} />

          <div className="sync-field">
            <span className="sync-label">
              <Icon name="key" size={12} /> Your sync code
            </span>
            <div className="sync-box code">
              <code translate="no">{code}</code>
              <button
                type="button"
                className={"sync-act on" + (copied ? " done" : "")}
                onClick={copy}
                aria-label="Copy sync code"
                title="Copy code"
              >
                <Icon name={copied ? "check" : "copy"} size={14} />
              </button>
            </div>
            <p className="sync-note">Use this code on any other device to sync all your routines, plans and progress.</p>
            <p className="sync-remind">Please save this code for future use.</p>
          </div>

          {!confirmOut ? (
            <button type="button" className="sync-out" onClick={() => setConfirmOut(true)}>
              Sync out
            </button>
          ) : (
            <div className="sync-confirm">
              <p className="sync-warn">
                Sync out of <b>this device</b>? Your data stays here but will stop syncing. Save your code first, you
                will need it to sync again.
              </p>
              <div className="sync-row">
                <button type="button" className="sync-go ghost" onClick={() => setConfirmOut(false)}>
                  Cancel
                </button>
                <button type="button" className="sync-go danger" onClick={doSyncOut}>
                  Sync out
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
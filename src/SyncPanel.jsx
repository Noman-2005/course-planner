import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { adoptRemote, createCode, getCode, hasLocalData, lookupCode, normalizeCode, syncOut } from "./syncClient.js";
import { useEscape } from "./utils.js";

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

/* "I have a code..." box + Sync button */
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
        <Icon name="user" size={13} /> Profile name <em>optional</em>
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
            <Icon name="check" size={16} />
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
            <Icon name="edit" size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

/* Centered sync window (opened from the 3-dot menu) */
export default function SyncModal({ name, onName, toast, onClose }) {
  useEscape(onClose);
  const [code, setCode] = useState(() => getCode());
  const [copied, setCopied] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [wipe, setWipe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outErr, setOutErr] = useState("");
  const t = useRef(0);

  useEffect(() => () => clearTimeout(t.current), []);

  async function doSyncOut() {
    if (busy) return;
    setBusy(true);
    setOutErr("");
    try {
      await syncOut({ wipe });
    } catch {
      setOutErr("Couldn’t back up your latest changes. Check your connection, or untick the delete option.");
      setBusy(false);
      return;
    }
    if (wipe) {
      window.location.reload(); // start clean, nothing of the old data stays on screen
      return;
    }
    setCode(null);
    setConfirmOut(false);
    setBusy(false);
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
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal sync-modal" role="dialog" aria-modal="true" aria-label="Device sync">
        <div className="sm-head">
          <span className="sm-badge">
            <Icon name="sync" size={22} />
          </span>
          <div className="sm-titles">
            <h3>Device sync</h3>
            <p>
              {code
                ? "Open your routines, plans and progress on any device."
                : "Keep your routines, plans and progress on every device."}
            </p>
          </div>
          <button type="button" className="icon-btn sm-x" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="sm-body">
          {!code ? (
            <>
              <span className="sm-status off">
                <i /> Sync is off on this device
              </span>
              <CodeBox ownCode={null} />
              <div className="sync-or">
                <span>or</span>
              </div>
              <button type="button" className="sync-create" onClick={generate}>
                <Icon name="key" size={16} /> Generate a sync code
              </button>
            </>
          ) : (
            <>
              <span className="sm-status on">
                <i /> Sync is on
              </span>

              <NameField name={name} onName={onName} toast={toast} />

              <div className="sync-field">
                <span className="sync-label">
                  <Icon name="key" size={13} /> Your sync code
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
                    <Icon name={copied ? "check" : "copy"} size={16} />
                  </button>
                </div>
                <p className="sync-note">Use this code on any other device to sync all your routines, plans and progress.</p>
                <p className="sync-remind">Please save this code for future use.</p>
              </div>

              {!confirmOut ? (
                <button type="button" className="sm-out" onClick={() => setConfirmOut(true)}>
                  Sync out
                </button>
              ) : (
                <div className="sm-confirm" role="alertdialog" aria-label="Confirm sync out">
                  <div className="sm-confirm-t">
                    <Icon name="warn" size={16} /> Sync out of this device?
                  </div>
                  <p className="sm-confirm-p">
                    Your data stays here but will stop syncing. Save your code first, you will need it to sync again.
                  </p>

                  <div className="sm-actions">
                    <button
                      type="button"
                      className="sm-btn ghost"
                      disabled={busy}
                      onClick={() => {
                        setConfirmOut(false);
                        setWipe(false);
                        setOutErr("");
                      }}
                    >
                      Cancel
                    </button>
                    <button type="button" className="sm-btn danger" disabled={busy} onClick={doSyncOut}>
                      {busy ? "Please wait…" : wipe ? "Sync out & delete" : "Sync out"}
                    </button>
                  </div>

                  <label className={"sm-check" + (wipe ? " on" : "")}>
                    <input type="checkbox" checked={wipe} disabled={busy} onChange={(e) => setWipe(e.target.checked)} />
                    <span className="sm-box">
                      <Icon name="check" size={12} />
                    </span>
                    <span>Delete all data from this device</span>
                  </label>

                  {wipe && (
                    <p className="sm-wipe-note">
                      All routines, plans and progress on this device will be erased. Your synced copy stays safe and
                      comes back with your code.
                    </p>
                  )}
                  {outErr && <p className="sync-err">{outErr}</p>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
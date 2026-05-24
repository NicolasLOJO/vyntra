import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface UpdateInfo {
  version: string;
  body: string | null;
}

type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; info: UpdateInfo }
  | { status: "up-to-date" }
  | { status: "installing" }
  | { status: "error"; message: string };

export function AboutSection() {
  const [update, setUpdate] = useState<UpdateState>({ status: "idle" });

  const checkForUpdates = async () => {
    setUpdate({ status: "checking" });
    try {
      const info = await invoke<UpdateInfo | null>("check_update");
      if (info) {
        setUpdate({ status: "available", info });
      } else {
        setUpdate({ status: "up-to-date" });
      }
    } catch (e) {
      setUpdate({ status: "error", message: String(e) });
    }
  };

  const installUpdate = async () => {
    setUpdate({ status: "installing" });
    try {
      await invoke("install_update");
    } catch (e) {
      setUpdate({ status: "error", message: String(e) });
    }
  };

  return (
    <div className="vyntra-section">
      <header className="vyntra-section-head">
        <h2>About</h2>
      </header>
      <div className="vyntra-about">
        <div className="vyntra-about-logo">Vyntra</div>
        <div className="vyntra-about-version">v0.1.0 · pre-alpha</div>
        <p>
          A modular widget platform for Windows, macOS and Linux. Built on
          Tauri v2 with a single-WebView orchestrator and a sandboxed widget
          format (<code>.vyn</code>).
        </p>

        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
          {update.status === "idle" && (
            <button className="vyntra-btn-primary" onClick={checkForUpdates}>
              Check for updates
            </button>
          )}
          {update.status === "checking" && (
            <span style={{ opacity: 0.6, fontSize: 13 }}>Checking…</span>
          )}
          {update.status === "up-to-date" && (
            <span style={{ fontSize: 13, color: "#7ecf9a" }}>
              You are on the latest version.{" "}
              <button className="vyntra-link-btn" onClick={checkForUpdates}>
                Check again
              </button>
            </span>
          )}
          {update.status === "available" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 13 }}>
                Version <strong>{update.info.version}</strong> is available.
              </span>
              {update.info.body && (
                <p style={{ margin: 0, fontSize: 12, opacity: 0.65, whiteSpace: "pre-wrap" }}>
                  {update.info.body}
                </p>
              )}
              <button className="vyntra-btn-primary" onClick={installUpdate}>
                Download &amp; install
              </button>
            </div>
          )}
          {update.status === "installing" && (
            <span style={{ opacity: 0.6, fontSize: 13 }}>Downloading…</span>
          )}
          {update.status === "error" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#ff9c9c" }}>{update.message}</span>
              <button className="vyntra-link-btn" onClick={checkForUpdates}>
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

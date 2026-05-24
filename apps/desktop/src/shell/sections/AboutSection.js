import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
export function AboutSection() {
    const [update, setUpdate] = useState({ status: "idle" });
    const checkForUpdates = async () => {
        setUpdate({ status: "checking" });
        try {
            const info = await invoke("check_update");
            if (info) {
                setUpdate({ status: "available", info });
            }
            else {
                setUpdate({ status: "up-to-date" });
            }
        }
        catch (e) {
            setUpdate({ status: "error", message: String(e) });
        }
    };
    const installUpdate = async () => {
        setUpdate({ status: "installing" });
        try {
            await invoke("install_update");
        }
        catch (e) {
            setUpdate({ status: "error", message: String(e) });
        }
    };
    return (_jsxs("div", { className: "vyntra-section", children: [_jsx("header", { className: "vyntra-section-head", children: _jsx("h2", { children: "About" }) }), _jsxs("div", { className: "vyntra-about", children: [_jsx("div", { className: "vyntra-about-logo", children: "Vyntra" }), _jsx("div", { className: "vyntra-about-version", children: "v0.1.0 \u00B7 pre-alpha" }), _jsxs("p", { children: ["A modular widget platform for Windows, macOS and Linux. Built on Tauri v2 with a single-WebView orchestrator and a sandboxed widget format (", _jsx("code", { children: ".vyn" }), ")."] }), _jsxs("div", { style: { marginTop: 20, display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }, children: [update.status === "idle" && (_jsx("button", { className: "vyntra-btn-primary", onClick: checkForUpdates, children: "Check for updates" })), update.status === "checking" && (_jsx("span", { style: { opacity: 0.6, fontSize: 13 }, children: "Checking\u2026" })), update.status === "up-to-date" && (_jsxs("span", { style: { fontSize: 13, color: "#7ecf9a" }, children: ["You are on the latest version.", " ", _jsx("button", { className: "vyntra-link-btn", onClick: checkForUpdates, children: "Check again" })] })), update.status === "available" && (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [_jsxs("span", { style: { fontSize: 13 }, children: ["Version ", _jsx("strong", { children: update.info.version }), " is available."] }), update.info.body && (_jsx("p", { style: { margin: 0, fontSize: 12, opacity: 0.65, whiteSpace: "pre-wrap" }, children: update.info.body })), _jsx("button", { className: "vyntra-btn-primary", onClick: installUpdate, children: "Download & install" })] })), update.status === "installing" && (_jsx("span", { style: { opacity: 0.6, fontSize: 13 }, children: "Downloading\u2026" })), update.status === "error" && (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: [_jsx("span", { style: { fontSize: 12, color: "#ff9c9c" }, children: update.message }), _jsx("button", { className: "vyntra-link-btn", onClick: checkForUpdates, children: "Retry" })] }))] })] })] }));
}

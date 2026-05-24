import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { WidgetsSection } from "../shell/sections/WidgetsSection";
import { StoreSection } from "../shell/sections/StoreSection";
import { SettingsSection } from "../shell/sections/SettingsSection";
import { AboutSection } from "../shell/sections/AboutSection";
const NAV = [
    { id: "widgets", label: "Widgets", icon: "▦" },
    { id: "store", label: "Store", icon: "⊕" },
    { id: "settings", label: "Settings", icon: "⚙" },
    { id: "about", label: "About", icon: "ⓘ" },
];
const SECTIONS = {
    widgets: WidgetsSection,
    store: StoreSection,
    settings: SettingsSection,
    about: AboutSection,
};
export function ManagerApp() {
    const [section, setSection] = useState("widgets");
    const Section = SECTIONS[section];
    return (_jsxs("div", { className: "manager-root", children: [_jsxs("aside", { className: "manager-sidebar", children: [_jsx("div", { className: "manager-brand", children: "Vyntra" }), _jsx("nav", { children: NAV.map((item) => (_jsxs("button", { className: "manager-nav-item", "data-active": section === item.id, onClick: () => setSection(item.id), children: [_jsx("span", { className: "manager-nav-icon", children: item.icon }), _jsx("span", { children: item.label })] }, item.id))) }), _jsx("div", { className: "manager-version", children: "v0.1.0" })] }), _jsx("main", { className: "manager-content", children: _jsx(Section, {}) })] }));
}

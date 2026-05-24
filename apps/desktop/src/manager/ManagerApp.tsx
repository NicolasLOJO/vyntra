import React, { useState } from "react";
import { WidgetsSection } from "../shell/sections/WidgetsSection";
import { StoreSection } from "../shell/sections/StoreSection";
import { SettingsSection } from "../shell/sections/SettingsSection";
import { AboutSection } from "../shell/sections/AboutSection";

type Section = "widgets" | "store" | "settings" | "about";

const NAV: { id: Section; label: string; icon: string }[] = [
  { id: "widgets", label: "Widgets", icon: "▦" },
  { id: "store", label: "Store", icon: "⊕" },
  { id: "settings", label: "Settings", icon: "⚙" },
  { id: "about", label: "About", icon: "ⓘ" },
];

const SECTIONS: Record<Section, () => React.JSX.Element> = {
  widgets: WidgetsSection,
  store: StoreSection,
  settings: SettingsSection,
  about: AboutSection,
};

export function ManagerApp() {
  const [section, setSection] = useState<Section>("widgets");
  const Section = SECTIONS[section];

  return (
    <div className="manager-root">
      <aside className="manager-sidebar">
        <div className="manager-brand">Vyntra</div>
        <nav>
          {NAV.map((item) => (
            <button
              key={item.id}
              className="manager-nav-item"
              data-active={section === item.id}
              onClick={() => setSection(item.id)}
            >
              <span className="manager-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="manager-version">v0.1.0</div>
      </aside>
      <main className="manager-content">
        <Section />
      </main>
    </div>
  );
}

//! Commandes IPC exposées au front Vyntra (pas aux widgets tiers).
//!
//! Les widgets tiers passent par le SDK `window.Vyn` qui appelle ces commandes
//! avec leur `widget_id`; le runtime vérifie alors les capabilities via
//! `vyn-sandbox` avant d'exécuter.

pub mod media;
pub mod system;
pub mod ui;
pub mod widgets;

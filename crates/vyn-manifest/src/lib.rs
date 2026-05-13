//! Schéma du `manifest.json` d'un widget `.vyn` + capabilities.

use semver::Version;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const MANIFEST_FILENAME: &str = "manifest.json";
pub const ENTRY_FILENAME: &str = "bundle.js";

#[derive(Debug, Error)]
pub enum ManifestError {
    #[error("invalid JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("missing field: {0}")]
    MissingField(&'static str),
    #[error("invalid id `{0}` (expected reverse-DNS like com.author.widget)")]
    InvalidId(String),
    #[error("manifest schema version {0} unsupported (max {1})")]
    UnsupportedSchema(u8, u8),
}

pub const CURRENT_SCHEMA: u8 = 1;

/// Manifeste racine d'un widget.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    /// Version du schéma manifest (pour migrations futures).
    pub schema: u8,
    /// Identifiant reverse-DNS unique. ex: `com.acme.cpu-monitor`.
    pub id: String,
    pub name: String,
    pub version: Version,
    pub author: Author,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub icon: Option<String>,
    /// Dimensions par défaut en unités de grille.
    pub size: GridSize,
    /// Bornes (min/max) en unités de grille.
    #[serde(default)]
    pub size_constraints: Option<SizeConstraints>,
    /// Permissions demandées. L'utilisateur les valide à l'install.
    #[serde(default)]
    pub permissions: Permissions,
    /// Domaines réseau autorisés (utilisés pour le CSP injecté).
    #[serde(default)]
    pub network: NetworkPolicy,
    /// Fichier d'entrée (défaut: `bundle.js`).
    #[serde(default = "default_entry")]
    pub entry: String,
}

fn default_entry() -> String {
    ENTRY_FILENAME.to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Author {
    pub name: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct GridSize {
    pub w: u16,
    pub h: u16,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct SizeConstraints {
    pub min: GridSize,
    pub max: GridSize,
}

/// Capacités déclarées dans le manifeste. Chaque flag mappe sur des
/// commandes IPC autorisées côté Rust (cf. crate `vyn-sandbox`).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Permissions {
    /// Lecture monitoring système (CPU/GPU/RAM/temp).
    pub system: bool,
    /// Contrôle media SMTC/MPRIS/NowPlaying.
    pub media: bool,
    /// Lancement d'apps + récupération icônes.
    pub launcher: bool,
    /// Storage local persistant et isolé.
    pub storage: bool,
    /// Effets natifs Mica/Acrylic.
    pub ui_effects: bool,
    /// Accès réseau (si vrai, `network.allow` doit lister les domaines).
    pub network: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct NetworkPolicy {
    /// Domaines autorisés. Servent à générer le CSP `connect-src`.
    pub allow: Vec<String>,
}

impl Manifest {
    pub fn parse(bytes: &[u8]) -> Result<Self, ManifestError> {
        let m: Manifest = serde_json::from_slice(bytes)?;
        m.validate()?;
        Ok(m)
    }

    pub fn validate(&self) -> Result<(), ManifestError> {
        if self.schema == 0 || self.schema > CURRENT_SCHEMA {
            return Err(ManifestError::UnsupportedSchema(self.schema, CURRENT_SCHEMA));
        }
        if !is_valid_id(&self.id) {
            return Err(ManifestError::InvalidId(self.id.clone()));
        }
        if self.name.trim().is_empty() {
            return Err(ManifestError::MissingField("name"));
        }
        Ok(())
    }
}

fn is_valid_id(id: &str) -> bool {
    // reverse-DNS: 3+ segments, chars [a-z0-9-], pas de segment vide
    let parts: Vec<&str> = id.split('.').collect();
    if parts.len() < 2 {
        return false;
    }
    parts.iter().all(|p| {
        !p.is_empty()
            && p.chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_minimal_manifest() {
        let json = r#"{
            "schema": 1,
            "id": "com.acme.clock",
            "name": "Clock",
            "version": "0.1.0",
            "author": { "name": "Acme" },
            "size": { "w": 2, "h": 2 }
        }"#;
        let m = Manifest::parse(json.as_bytes()).unwrap();
        assert_eq!(m.id, "com.acme.clock");
        assert_eq!(m.entry, "bundle.js");
    }

    #[test]
    fn rejects_bad_id() {
        let json = r#"{
            "schema": 1,
            "id": "BAD ID",
            "name": "x",
            "version": "0.1.0",
            "author": { "name": "a" },
            "size": { "w": 1, "h": 1 }
        }"#;
        assert!(Manifest::parse(json.as_bytes()).is_err());
    }
}

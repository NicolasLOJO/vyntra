//! Format de paquet `.vyn` — zip + manifest.
//!
//! Structure attendue:
//! ```text
//! widget.vyn (zip)
//! ├── manifest.json
//! ├── bundle.js
//! └── assets/...
//! ```

use std::io::{Cursor, Read, Seek};
use thiserror::Error;
use vyn_manifest::{Manifest, ManifestError, MANIFEST_FILENAME};

#[derive(Debug, Error)]
pub enum VynError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("zip: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("manifest: {0}")]
    Manifest(#[from] ManifestError),
    #[error("entry `{0}` not found in .vyn archive")]
    MissingEntry(String),
    #[error("file `{path}` exceeds size limit ({size} > {limit} bytes)")]
    FileTooLarge { path: String, size: u64, limit: u64 },
}

/// 25 MB par fichier max — protège contre zip bombs.
const PER_FILE_LIMIT: u64 = 25 * 1024 * 1024;

/// Une archive `.vyn` chargée en mémoire ou depuis un curseur.
pub struct VynArchive<R: Read + Seek> {
    zip: zip::ZipArchive<R>,
    manifest: Manifest,
}

impl<R: Read + Seek> VynArchive<R> {
    /// Ouvre une archive et valide son manifest.
    pub fn open(reader: R) -> Result<Self, VynError> {
        let mut zip = zip::ZipArchive::new(reader)?;
        let manifest = read_manifest(&mut zip)?;
        Ok(Self { zip, manifest })
    }

    pub fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    /// Lit un fichier de l'archive en mémoire. Respecte `PER_FILE_LIMIT`.
    pub fn read_file(&mut self, path: &str) -> Result<Vec<u8>, VynError> {
        let mut file = self
            .zip
            .by_name(path)
            .map_err(|_| VynError::MissingEntry(path.to_string()))?;
        if file.size() > PER_FILE_LIMIT {
            return Err(VynError::FileTooLarge {
                path: path.to_string(),
                size: file.size(),
                limit: PER_FILE_LIMIT,
            });
        }
        let mut buf = Vec::with_capacity(file.size() as usize);
        file.read_to_end(&mut buf)?;
        Ok(buf)
    }

    /// Liste les chemins contenus.
    pub fn entries(&self) -> Vec<String> {
        self.zip.file_names().map(|s| s.to_string()).collect()
    }
}

impl VynArchive<Cursor<Vec<u8>>> {
    pub fn from_bytes(bytes: Vec<u8>) -> Result<Self, VynError> {
        Self::open(Cursor::new(bytes))
    }
}

fn read_manifest<R: Read + Seek>(zip: &mut zip::ZipArchive<R>) -> Result<Manifest, VynError> {
    let mut entry = zip
        .by_name(MANIFEST_FILENAME)
        .map_err(|_| VynError::MissingEntry(MANIFEST_FILENAME.to_string()))?;
    let mut buf = Vec::new();
    entry.read_to_end(&mut buf)?;
    Ok(Manifest::parse(&buf)?)
}

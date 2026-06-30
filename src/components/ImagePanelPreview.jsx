import React, { useState } from 'react';
import './ImagePanelPreview.css';

/**
 * Inline raster thumb (fixed size in the task panel) + click-to-expand modal.
 */
export default function ImagePanelPreview({ src, alt = 'Preview' }) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!src) return null;

  const openModal = (event) => {
    event.stopPropagation();
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  return (
    <>
      <button
        type="button"
        className="image-panel-preview-inline-btn"
        onClick={openModal}
        title="Click for larger preview"
      >
        <img src={src} alt={alt} className="image-panel-preview-inline" draggable={false} />
      </button>

      {modalOpen ? (
        <div className="image-panel-preview-modal" onClick={closeModal} role="presentation">
          <div
            className="image-panel-preview-modal-content"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="image-panel-preview-close"
              onClick={closeModal}
              aria-label="Close preview"
            >
              ×
            </button>
            <div className="image-panel-preview-modal-frame">
              <img src={src} alt={alt} draggable={false} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

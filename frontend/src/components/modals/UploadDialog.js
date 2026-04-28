import { useState, useCallback, useRef } from 'react';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function UploadDialog({ journalNo, onClose, onUploadStart }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef();

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith('.pdf'));
    setFiles((prev) => [...prev, ...droppedFiles]);
  }, []);

  const handleFileSelect = useCallback((e) => {
    const selectedFiles = Array.from(e.target.files).filter((f) => f.name.endsWith('.pdf'));
    setFiles((prev) => [...prev, ...selectedFiles]);
  }, []);

  const removeFile = useCallback((index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = useCallback(async () => {
    if (files.length === 0) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('journal_no', journalNo);
    files.forEach((file) => formData.append('files', file));

    try {
      const res = await fetch(`${API}/api/journals/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      const data = await res.json();
      onUploadStart(data.job_id);
      onClose();
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  }, [files, journalNo, onUploadStart, onClose]);

  return (
    <div
      data-testid="upload-modal"
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="upload-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="upload-header">
          <h2>Upload PDFs for Journal {journalNo}</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div
          data-testid="upload-dropzone"
          className="upload-dropzone"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#111"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ margin: '0 auto 12px' }}
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p>Drop PDF files here or click to browse</p>
          <input
            ref={fileInputRef}
            data-testid="upload-file-input"
            type="file"
            multiple
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </div>

        {files.length > 0 && (
          <div className="upload-files">
            <h3>{files.length} file(s) selected:</h3>
            <ul>
              {files.map((f, i) => (
                <li key={`file-${f.name}-${i}`}>
                  {f.name} ({(f.size / 1024 / 1024).toFixed(1)} MB)
                  <button onClick={() => removeFile(i)}>✕</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="upload-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            data-testid="upload-submit-button"
          >
            {uploading ? 'Uploading...' : `Upload ${files.length} PDF(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

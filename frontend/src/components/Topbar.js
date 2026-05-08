import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

export default function Topbar({ onSearch }) {
  const [query, setQuery] = useState('');

  // Debounced search trigger
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) return;
    const timer = setTimeout(() => {
      onSearch && onSearch(query.trim());
    }, 600);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim().length >= 2) {
      onSearch && onSearch(query.trim());
    }
  };

  return (
    <div className="topbar">
      <form className="search-bar-form" onSubmit={handleSubmit}>
        <Search className="search-icon" size={14} strokeWidth={1.8} />
        <input
          className="search-bar"
          type="text"
          placeholder="Search patents by title, applicant, or IPC code..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            className="search-clear"
            onClick={() => setQuery('')}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </form>
    </div>
  );
}

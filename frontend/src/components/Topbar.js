import React, { useState } from 'react';
import { Search } from 'lucide-react';

export default function Topbar({ onSearch }) {
  const [query, setQuery] = useState('');

  const submit = (e) => {
    e.preventDefault();
    onSearch?.(query.trim());
  };

  return (
    <div className="topbar">
      <form className="search-box" onSubmit={submit}>
        <input
          className="search-input"
          placeholder="Search patents, applicants, technologies…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="search-button" aria-label="Search">
          <Search size={14} strokeWidth={2} />
        </button>
      </form>
    </div>
  );
}

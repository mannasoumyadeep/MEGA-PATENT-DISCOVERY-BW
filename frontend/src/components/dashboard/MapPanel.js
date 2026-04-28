import { IndiaMap } from './IndiaMap';

export function MapPanel({ patents, selectedCity, fieldCounts, focusField, onCityClick, onFieldClick }) {
  const maxFieldCount = Math.max(...Object.values(fieldCounts), 1);
  const sortedFields = Object.keys(fieldCounts)
    .filter((f) => fieldCounts[f] > 0)
    .sort((a, b) => (fieldCounts[b] || 0) - (fieldCounts[a] || 0));

  return (
    <div
      data-testid="map-panel"
      style={{
        width: 450,
        flexShrink: 0,
        borderRight: '1px solid #dedede',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #dedede' }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#5a5a5a',
          }}
        >
          Innovation Map
        </span>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 12,
        }}
      >
        <IndiaMap patents={patents} selectedCity={selectedCity} onCityClick={onCityClick} />
      </div>
      <div style={{ borderTop: '1px solid #dedede', padding: '12px 16px', maxHeight: '35%', overflowY: 'auto' }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#5a5a5a',
            marginBottom: 10,
          }}
        >
          Technology Density
        </div>
        {sortedFields.slice(0, 12).map((field) => {
          const n = fieldCounts[field] || 0;
          const intensity = n / maxFieldCount;
          const isOn = focusField === field;
          return (
            <div
              key={field}
              className="field-row"
              onClick={() => onFieldClick(field)}
              data-testid="tech-field-row"
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: `rgba(0, 0, 0, ${0.1 + intensity * 0.6})`,
                  border: `1px solid ${isOn ? '#111' : '#cfcfcf'}`,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, fontSize: 10, fontWeight: isOn ? 600 : 400, color: isOn ? '#111' : '#5a5a5a' }}>
                {field}
              </div>
              <div style={{ width: 50, background: '#f6f6f6', height: 4, borderRadius: 2 }}>
                <div
                  style={{
                    height: '100%',
                    width: `${(n / maxFieldCount) * 100}%`,
                    background: `rgba(0, 0, 0, ${0.1 + intensity * 0.6})`,
                    borderRadius: 2,
                  }}
                />
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  color: '#7a7a7a',
                  width: 20,
                  textAlign: 'right',
                }}
              >
                {n}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

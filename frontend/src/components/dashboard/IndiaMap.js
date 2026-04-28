import { useState, useEffect, useMemo, useCallback } from 'react';
import * as d3 from 'd3';

const CITY_COORDS = {
  Mumbai: [72.877, 19.076],
  'New Delhi': [77.209, 28.613],
  Bengaluru: [77.594, 12.971],
  Chennai: [80.27, 13.082],
  Hyderabad: [78.486, 17.385],
  Pune: [73.856, 18.52],
  Kolkata: [88.363, 22.572],
  Ahmedabad: [72.571, 23.022],
  Nagpur: [79.088, 21.145],
  Mangaluru: [74.856, 12.914],
  Coimbatore: [76.955, 11.016],
  Jaipur: [75.787, 26.912],
  Kochi: [76.267, 9.931],
  Chandigarh: [76.779, 30.733],
  Lucknow: [80.946, 26.846],
  Visakhapatnam: [83.299, 17.686],
  Indore: [75.857, 22.719],
  Bhubaneswar: [85.824, 20.296],
  Vadodara: [73.2, 22.307],
  Gurugram: [77.026, 28.459],
  Noida: [77.391, 28.535],
  Mysuru: [76.655, 12.295],
  Bhopal: [77.402, 23.259],
  Patna: [85.144, 25.594],
};

export function IndiaMap({ patents, selectedCity, onCityClick }) {
  const [states, setStates] = useState([]);
  const [proj, setProj] = useState(null);

  const cityStats = useMemo(() => {
    const stats = {};
    patents.forEach((p) => {
      const c = p.city;
      if (!c) return;
      if (!stats[c]) stats[c] = { total: 0, mega: 0 };
      stats[c].total++;
      if (p.mega_score >= 65) stats[c].mega++;
    });
    return stats;
  }, [patents]);

  const maxCount = useMemo(() => Math.max(...Object.values(cityStats).map((s) => s.total), 1), [cityStats]);

  const getCircleRadius = useCallback(
    (count) => {
      return 6 + (count / maxCount) * 20;
    },
    [maxCount]
  );

  useEffect(() => {
    let isMounted = true;

    const loadMap = async () => {
      try {
        // Load topojson if needed
        if (!window.topojson) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        // Load India map
        const response = await fetch(
          'https://gist.githubusercontent.com/jbrobst/56c13bbbf9d97d187fea01ca62ea5112/raw/e388c4cae20aa53cb5090210a42ebb9b765c0a36/india_states.geojson'
        );
        const indiaGeo = await response.json();

        if (!isMounted) return;

        const projection = d3.geoMercator().fitSize([420, 520], indiaGeo);
        setProj(() => projection);

        const pathGen = d3.geoPath().projection(projection);
        const statePaths = indiaGeo.features.map((f) => ({
          path: pathGen(f),
          name: f.properties.st_nm,
        }));
        setStates(statePaths);
      } catch (error) {
        console.error('Map loading error:', error);
      }
    };

    loadMap();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <svg width={420} height={520} style={{ display: 'block' }} data-testid="india-map">
      <rect x={0} y={0} width={420} height={520} fill="#ffffff" />
      {states.length > 0 ? (
        states.map((s) => (
          <path
            key={`state-${s.name}`}
            d={s.path}
            fill="#eeeeee"
            stroke="#5a5a5a"
            strokeWidth={0.5}
          />
        ))
      ) : (
        <rect
          x={30}
          y={30}
          width={360}
          height={460}
          rx={6}
          fill="#eeeeee"
          stroke="#5a5a5a"
          strokeDasharray="8,4"
        />
      )}
      {proj &&
        Object.entries(CITY_COORDS).map(([city, [lng, lat]]) => {
          const stat = cityStats[city];
          if (!stat) return null;

          const [cx, cy] = proj([lng, lat]);
          const r = getCircleRadius(stat.total);
          const isSel = selectedCity === city;

          return (
            <g
              key={`city-${city}`}
              style={{ cursor: 'pointer' }}
              onClick={() => onCityClick(city)}
              data-testid="city-pin"
            >
              {isSel && (
                <circle cx={cx} cy={cy} r={r + 8} fill="none" stroke="#111" strokeWidth={2} opacity={0.3} />
              )}
              <circle cx={cx} cy={cy} r={r} fill="#000" opacity={isSel ? 1 : 0.75} stroke="#fff" strokeWidth={1.5} />
              {stat.total >= 3 && (
                <text
                  x={cx}
                  y={cy + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#fff"
                  fontSize={r > 14 ? 10 : 8}
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="700"
                >
                  {stat.total}
                </text>
              )}
              <text
                x={cx + r + 6}
                y={cy + 2}
                dominantBaseline="middle"
                fill={isSel ? '#111' : '#5a5a5a'}
                fontSize={10}
                fontFamily="DM Sans, sans-serif"
                fontWeight={isSel ? '600' : '400'}
              >
                {city}
              </text>
              {stat.mega > 0 && (
                <text
                  x={cx + r + 6}
                  y={cy + 14}
                  fontSize={8}
                  fill="#111"
                  fontFamily="JetBrains Mono"
                  fontWeight="600"
                >
                  {stat.mega} MEGA
                </text>
              )}
            </g>
          );
        })}
    </svg>
  );
}

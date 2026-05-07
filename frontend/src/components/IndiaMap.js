import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { ArrowRight } from 'lucide-react';
import { fmt } from '../utils/format';

/**
 * India state names normalization map
 * (handles common spelling variants between IP India patents data
 *  and TopoJSON state names)
 */
const STATE_ALIASES = {
  'tamil nadu': 'Tamil Nadu',
  'tamilnadu': 'Tamil Nadu',
  'karnataka': 'Karnataka',
  'maharashtra': 'Maharashtra',
  'delhi': 'NCT of Delhi',
  'new delhi': 'NCT of Delhi',
  'telangana': 'Telangana',
  'andhra pradesh': 'Andhra Pradesh',
  'gujarat': 'Gujarat',
  'west bengal': 'West Bengal',
  'rajasthan': 'Rajasthan',
  'kerala': 'Kerala',
  'uttar pradesh': 'Uttar Pradesh',
  'haryana': 'Haryana',
  'punjab': 'Punjab',
  'madhya pradesh': 'Madhya Pradesh',
  'odisha': 'Odisha',
  'orissa': 'Odisha',
  'bihar': 'Bihar',
  'jharkhand': 'Jharkhand',
  'chhattisgarh': 'Chhattisgarh',
  'assam': 'Assam',
  'jammu and kashmir': 'Jammu and Kashmir',
  'himachal pradesh': 'Himachal Pradesh',
  'uttarakhand': 'Uttarakhand',
  'chandigarh': 'Chandigarh',
  'puducherry': 'Puducherry',
};

const TOPO_URL = 'https://raw.githubusercontent.com/deldersveld/topojson/master/countries/india/india-states.json';

export default function IndiaMap({ stateDensity = [], onViewMap }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [topoData, setTopoData] = useState(null);

  // Build state value lookup
  const valueByState = React.useMemo(() => {
    const m = new Map();
    stateDensity.forEach(({ state, total, mega }) => {
      const key = STATE_ALIASES[state.toLowerCase()] || state;
      m.set(key, { total, mega });
    });
    return m;
  }, [stateDensity]);

  // Fetch TopoJSON once
  useEffect(() => {
    fetch(TOPO_URL)
      .then((r) => r.json())
      .then(setTopoData)
      .catch((e) => console.error('TopoJSON load failed:', e));
  }, []);

  // Render map
  useEffect(() => {
    if (!topoData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 460;
    const height = 460;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Get the main feature collection
    const objKey = Object.keys(topoData.objects)[0];
    const states = topojson.feature(topoData, topoData.objects[objKey]);

    // Projection
    const projection = d3.geoMercator().fitSize([width, height], states);
    const path = d3.geoPath().projection(projection);

    // Color scale based on patent counts
    const maxVal = Math.max(...[...valueByState.values()].map((v) => v.total), 10);
    const color = d3
      .scaleSequential()
      .domain([0, maxVal])
      .interpolator(d3.interpolate('#EEF2F7', '#2C4A6B'));

    // Find state name property — TopoJSON files vary
    const findStateName = (props) => {
      return (
        props.NAME_1 ||
        props.name ||
        props.st_nm ||
        props.STATE ||
        props.NAME ||
        ''
      );
    };

    // Draw states
    svg
      .append('g')
      .selectAll('path')
      .data(states.features)
      .enter()
      .append('path')
      .attr('d', path)
      .attr('fill', (d) => {
        const name = findStateName(d.properties);
        const v = valueByState.get(name);
        return v ? color(v.total) : '#F5F2EC';
      })
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 0.7)
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this).attr('stroke', '#1E3A5F').attr('stroke-width', 1.5);
        const name = findStateName(d.properties);
        const v = valueByState.get(name) || { total: 0, mega: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left + 10,
          y: event.clientY - rect.top + 10,
          state: name || 'Unknown',
          total: v.total,
          mega: v.mega,
        });
      })
      .on('mousemove', function (event) {
        const rect = containerRef.current.getBoundingClientRect();
        setTooltip((t) => (t ? { ...t, x: event.clientX - rect.left + 10, y: event.clientY - rect.top + 10 } : null));
      })
      .on('mouseleave', function () {
        d3.select(this).attr('stroke', '#FFFFFF').attr('stroke-width', 0.7);
        setTooltip(null);
      });

    // Major innovation cities — uniform-size dots
    const cities = [
      { name: 'New Delhi', coord: [77.21, 28.61] },
      { name: 'Mumbai', coord: [72.87, 19.07] },
      { name: 'Bengaluru', coord: [77.59, 12.97] },
      { name: 'Hyderabad', coord: [78.48, 17.38] },
      { name: 'Chennai', coord: [80.27, 13.08] },
      { name: 'Pune', coord: [73.85, 18.52] },
      { name: 'Kolkata', coord: [88.36, 22.57] },
      { name: 'Ahmedabad', coord: [72.57, 23.02] },
    ];

    const cityGroup = svg.append('g');
    cities.forEach(({ name, coord }) => {
      const [x, y] = projection(coord);
      cityGroup
        .append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 3)
        .attr('fill', '#0A0A0A')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 1.2);
      cityGroup
        .append('text')
        .attr('x', x + 6)
        .attr('y', y + 3)
        .text(name)
        .style('font-size', '9px')
        .style('font-family', 'Manrope, sans-serif')
        .style('font-weight', '500')
        .style('fill', '#1A1A1A')
        .style('pointer-events', 'none');
    });
  }, [topoData, valueByState]);

  return (
    <div className="map-column" ref={containerRef}>
      <div className="map-header">
        <div className="map-title">Patent Activity Across India</div>
        <div className="map-subtitle">Patents by State (Current Period)</div>
      </div>

      <div className="map-legend">
        <span className="legend-label">Low</span>
        <div className="legend-bar">
          <div className="legend-cell" style={{ background: '#EEF2F7' }} />
          <div className="legend-cell" style={{ background: '#C5D4E5' }} />
          <div className="legend-cell" style={{ background: '#93B0CC' }} />
          <div className="legend-cell" style={{ background: '#5B7DA0' }} />
          <div className="legend-cell" style={{ background: '#2C4A6B' }} />
        </div>
        <span className="legend-label">High</span>
      </div>
      <div className="legend-caption">Darker shading indicates higher patent activity</div>

      <div className="map-svg-wrap">
        <svg ref={svgRef} style={{ width: '100%', height: 'auto', maxHeight: 460 }} />
        {tooltip && (
          <div className="map-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
            <div className="tooltip-state">{tooltip.state}</div>
            <div className="tooltip-row">
              <span>MEGA Patents (≥65)</span>
              <strong>{fmt(tooltip.mega)}</strong>
            </div>
            <div className="tooltip-row">
              <span>Total Patents</span>
              <strong>{fmt(tooltip.total)}</strong>
            </div>
            <div className="tooltip-link">View State Report →</div>
          </div>
        )}
      </div>

      <button className="map-button" onClick={onViewMap}>
        View India Map <ArrowRight size={11} strokeWidth={2} />
      </button>
    </div>
  );
}

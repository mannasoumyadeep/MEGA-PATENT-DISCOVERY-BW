import { useState, useEffect, useMemo, useCallback } from "react";
import * as d3 from "d3";
import "./App.css";

const API = process.env.REACT_APP_BACKEND_URL || "";

const FIELD_PALETTE = {
  "Computing/AI":"#2563eb","Medical/Veterinary":"#16a34a","Chemistry & Metallurgy":"#d97706",
  "Organic Chemistry":"#7c3aed","Biochemistry/Microbiology":"#0891b2","Electric Power":"#ea580c",
  "Communications":"#db2777","Mechanical Engineering":"#64748b","Agriculture":"#65a30d",
  "Physics":"#9333ea","ICT Applications":"#0284c7","Measuring/Testing":"#b45309",
  "Basic Electric Elements":"#c2410c","Nano-Technology":"#7e22ce","Polymers":"#0f766e",
  "Petroleum/Fuels":"#78350f","Human Necessities":"#15803d","Performing Operations":"#0369a1",
  "Textiles & Paper":"#be185d","Unknown":"#d1d5db",
};

const CITY_COORDS = {
  "Mumbai":[72.877,19.076],"New Delhi":[77.209,28.613],"Bengaluru":[77.594,12.971],
  "Chennai":[80.270,13.082],"Hyderabad":[78.486,17.385],"Pune":[73.856,18.520],
  "Kolkata":[88.363,22.572],"Ahmedabad":[72.571,23.022],"Nagpur":[79.088,21.145],
  "Mangaluru":[74.856,12.914],"Coimbatore":[76.955,11.016],"Jaipur":[75.787,26.912],
  "Kochi":[76.267,9.931],"Chandigarh":[76.779,30.733],"Lucknow":[80.946,26.846],
  "Visakhapatnam":[83.299,17.686],"Indore":[75.857,22.719],"Bhubaneswar":[85.824,20.296],
  "Vadodara":[73.200,22.307],"Gurugram":[77.026,28.459],"Noida":[77.391,28.535],
  "Mysuru":[76.655,12.295],"Bhopal":[77.402,23.259],"Patna":[85.144,25.594],
};

function DENSITY_GREEN(intensity) {
  const shades = [
    "#f0fdf4", "#dcfce7", "#bbf7d0", "#86efac", "#4ade80", 
    "#22c55e", "#16a34a", "#15803d", "#166534", "#14532d"
  ];
  const idx = Math.min(Math.floor(intensity * 10), 9);
  return shades[idx];
}

function getMegaBadge(score) {
  if (score >= 85) return { label: "ULTRA", color: "#dc2626" };
  if (score >= 75) return { label: "MEGA+", color: "#ea580c" };
  if (score >= 65) return { label: "MEGA", color: "#16a34a" };
  return null;
}

// Utility function to handle errors
function logError(context, error) {
  console.error(`[${context}]`, error);
  // In production, send to error tracking service
}

export default function PatentDashboard() {
  return <div>Patent Dashboard Loading...</div>;
}

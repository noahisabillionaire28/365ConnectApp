/** Light map style for white-theme screens (Post Shift Step 3, etc.) */
export const LIGHT_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry',              stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.icon',           stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',      stylers: [{ color: '#737373' }] },
  { elementType: 'labels.text.stroke',    stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'administrative',        elementType: 'geometry',            stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#737373' }] },
  { featureType: 'poi',                   stylers: [{ visibility: 'off' }] },
  { featureType: 'road',                 elementType: 'geometry',            stylers: [{ color: '#ffffff' }] },
  { featureType: 'road',                 elementType: 'geometry.stroke',     stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'road',                 elementType: 'labels.text.fill',    stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'road.highway',         elementType: 'geometry',            stylers: [{ color: '#dadada' }] },
  { featureType: 'road.highway',         elementType: 'labels.text.fill',    stylers: [{ color: '#737373' }] },
  { featureType: 'transit',              stylers: [{ visibility: 'off' }] },
  { featureType: 'water',               elementType: 'geometry',            stylers: [{ color: '#c9c9c9' }] },
  { featureType: 'water',               elementType: 'labels.text.fill',    stylers: [{ color: '#9e9e9e' }] },
];

/** Build a black teardrop pin SVG data-URI for light-theme maps */
export function blackPinUrl(selected: boolean): string {
  const size   = selected ? 38 : 30;
  const height = Math.round(size * 1.28);
  const cx     = size / 2;
  const cy     = size / 2;
  const dotR   = selected ? 6 : 4.5;
  const stroke = selected ? '#FFFFFF' : '#DBDBDB';
  const sw     = selected ? 2.5 : 1.5;
  const svg = `<svg width="${size}" height="${height}" viewBox="0 0 ${size} ${height}"
    xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.25))">
    <path d="M${cx} 0 C${size*0.232} 0 0 ${size*0.232} 0 ${cy}
             c0 ${size*0.375} ${cx} ${size*0.78} ${cx} ${size*0.78}
             s${cx} -${size*0.405} ${cx} -${size*0.78}
             C${size} ${size*0.232} ${size*0.768} 0 ${cx} 0z"
          fill="#000000" stroke="${stroke}" stroke-width="${sw}"/>
    <circle cx="${cx}" cy="${cy}" r="${dotR}" fill="#FFFFFF"/>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Shared Google Maps dark night-mode style for 365 Connect */
export const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry',            stylers: [{ color: '#0d0d0d' }] },
  { elementType: 'labels.icon',         stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#555555' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#0d0d0d' }] },
  { featureType: 'administrative',      elementType: 'geometry',            stylers: [{ color: '#111111' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
  { featureType: 'poi',                 stylers: [{ visibility: 'off' }] },
  { featureType: 'road',               elementType: 'geometry',            stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'road',               elementType: 'geometry.stroke',     stylers: [{ color: '#090909' }] },
  { featureType: 'road',               elementType: 'labels.text.fill',    stylers: [{ color: '#3d3d3d' }] },
  { featureType: 'road.highway',       elementType: 'geometry',            stylers: [{ color: '#252525' }] },
  { featureType: 'road.highway',       elementType: 'labels.text.fill',    stylers: [{ color: '#555555' }] },
  { featureType: 'transit',            stylers: [{ visibility: 'off' }] },
  { featureType: 'water',              elementType: 'geometry',            stylers: [{ color: '#000000' }] },
  { featureType: 'water',              elementType: 'labels.text.fill',    stylers: [{ color: '#111111' }] },
];

/** Build a gold teardrop pin SVG data-URI for use as a google.maps.Marker icon */
export function goldPinUrl(selected: boolean): string {
  const size   = selected ? 38 : 30;
  const height = Math.round(size * 1.28);
  const cx     = size / 2;
  const cy     = size / 2;
  const dotR   = selected ? 6 : 4.5;
  const stroke = selected ? '#FFFFFF' : '#111111';
  const sw     = selected ? 2.5 : 1.5;
  const glow   = selected
    ? 'filter:drop-shadow(0 0 8px rgba(255,215,0,0.9))'
    : 'filter:drop-shadow(0 2px 4px rgba(0,0,0,0.7))';
  const svg = `<svg width="${size}" height="${height}" viewBox="0 0 ${size} ${height}"
    xmlns="http://www.w3.org/2000/svg" style="${glow}">
    <path d="M${cx} 0 C${size*0.232} 0 0 ${size*0.232} 0 ${cy}
             c0 ${size*0.375} ${cx} ${size*0.78} ${cx} ${size*0.78}
             s${cx} -${size*0.405} ${cx} -${size*0.78}
             C${size} ${size*0.232} ${size*0.768} 0 ${cx} 0z"
          fill="#FFD700" stroke="${stroke}" stroke-width="${sw}"/>
    <circle cx="${cx}" cy="${cy}" r="${dotR}" fill="#000"/>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

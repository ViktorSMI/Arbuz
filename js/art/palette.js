// Art direction follows the six existing lands. No runtime downloads.
export const ART_VERSION = 'orchard-2';
export const LAND_STYLES = Object.freeze([
  { name: 'Зелёные холмы', ground: '#555c36', foliage: '#607347', stone: '#8e9982', fog: '#a8b5a1', sky: '#758c8b', light: '#ffe3ae', accent: '#e7c779', cloth: '#733a36', prop: 'orchard' },
  { name: 'Подземелья крыс', ground: '#474344', foliage: '#655752', stone: '#7c7273', fog: '#645f70', sky: '#363547', light: '#dec7a0', accent: '#b7a3d5', cloth: '#595170', prop: 'tunnels' },
  { name: 'Вороньи скалы', ground: '#515963', foliage: '#747c7c', stone: '#9aa1a4', fog: '#a4b6be', sky: '#798e9d', light: '#e6eff0', accent: '#b2d4d8', cloth: '#34485c', prop: 'roost' },
  { name: 'Токсичная свалка', ground: '#504f33', foliage: '#818853', stone: '#787453', fog: '#9ea880', sky: '#6e7a62', light: '#e1e5a9', accent: '#c3de79', cloth: '#666c39', prop: 'dump' },
  { name: 'Военная база', ground: '#535c59', foliage: '#58635b', stone: '#8e9691', fog: '#a2adaa', sky: '#677d80', light: '#e1d1b4', accent: '#d79b6b', cloth: '#485d59', prop: 'barricade' },
  { name: 'Кухня ада', ground: '#624a3e', foliage: '#856148', stone: '#ad967e', fog: '#b9977d', sky: '#744f44', light: '#ffd399', accent: '#efaf70', cloth: '#863e39', prop: 'kitchen' },
]);
export function landStyle(index = 0) { return LAND_STYLES[Math.max(0, Math.min(5, index | 0))]; }
export function randomSeed(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = Math.imul(value ^ value >>> 15, value | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export const clamp01 = n => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

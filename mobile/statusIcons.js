// statusIcons.js
//
// Raw XML markup for the 4 status-icon SVGs, embedded verbatim as strings so
// react-native-svg's SvgXml can render them unmodified (React Native's Image
// component cannot rasterize SVG on native, so the source files below —
// checked into assets/status-icons/ for reference/version control — are
// mirrored here byte-for-byte rather than re-authored as JSX paths). Do not
// hand-edit these strings; regenerate from the .svg files if they ever change.

export const LINK_SAFE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1792" viewBox="0 0 463 405">
  <rect width="463" height="405" fill="#FBFAF7"/>
  <rect x="41" y="40" width="337" height="336" rx="78" fill="#1A1A2E"/>
  <!-- Original white chain symbol traced directly from the supplied image -->
  <g>
    <path d="M 194 168 C 191.50 171.50 194.00 171.67 195 173 C 196.00 174.33 196.00 178.17 200 176 C 204.00 173.83 213.67 163.33 219 160 C 224.33 156.67 228.00 156.33 232 156 C 236.00 155.67 239.00 156.00 243 158 C 247.00 160.00 253.00 164.00 256 168 C 259.00 172.00 260.33 178.17 261 182 C 261.67 185.83 261.17 187.67 260 191 C 258.83 194.33 257.00 198.17 254 202 C 251.00 205.83 243.67 210.67 242 214 C 240.33 217.33 242.33 220.83 244 222 C 245.67 223.17 248.33 223.67 252 221 C 255.67 218.33 263.00 209.83 266 206 C 269.00 202.17 269.00 200.50 270 198 C 271.00 195.50 272.00 195.67 272 191 C 272.00 186.33 271.83 175.83 270 170 C 268.17 164.17 264.83 159.83 261 156 C 257.17 152.17 250.67 148.83 247 147 C 243.33 145.17 243.50 145.00 239 145 C 234.50 145.00 224.83 145.83 220 147 C 215.17 148.17 214.33 148.50 210 152 C 205.67 155.50 196.50 164.50 194 168 Z" fill="#FFFFFF"/>
  <path d="M 232 184 C 230.67 182.67 233.83 176.33 226 183 C 218.17 189.67 191.50 216.00 185 224 C 178.50 232.00 185.67 229.67 187 231 C 188.33 232.33 185.17 238.67 193 232 C 200.83 225.33 227.50 199.00 234 191 C 240.50 183.00 233.33 185.33 232 184 Z" fill="#FFFFFF"/>
  <path d="M 149 217 C 148.00 219.50 147.00 219.33 147 224 C 147.00 228.67 147.17 239.17 149 245 C 150.83 250.83 154.17 255.17 158 259 C 161.83 262.83 168.50 266.17 172 268 C 175.50 269.83 174.33 270.00 179 270 C 183.67 270.00 195.00 269.17 200 268 C 205.00 266.83 204.83 266.67 209 263 C 213.17 259.33 222.83 249.83 225 246 C 227.17 242.17 223.50 241.00 222 240 C 220.50 239.00 219.67 237.50 216 240 C 212.33 242.50 204.83 251.83 200 255 C 195.17 258.17 190.67 258.50 187 259 C 183.33 259.50 181.83 259.83 178 258 C 174.17 256.17 167.17 251.33 164 248 C 160.83 244.67 160.00 241.33 159 238 C 158.00 234.67 157.17 232.00 158 228 C 158.83 224.00 160.83 218.50 164 214 C 167.17 209.50 175.17 204.50 177 201 C 178.83 197.50 176.67 194.17 175 193 C 173.33 191.83 170.67 191.33 167 194 C 163.33 196.67 156.00 205.17 153 209 C 150.00 212.83 150.00 214.50 149 217 Z" fill="#FFFFFF"/>
  </g>
  <!-- Status badge -->
  <circle cx="342" cy="340" r="52" fill="#3B6D11" stroke="#FFFFFF" stroke-width="2"/>
  <path d="M 323 340 L 337 354 L 365 326" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export const LINK_GREEN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1792" viewBox="0 0 463 405">
  <rect width="463" height="405" fill="#FBFAF7"/>
  <rect x="41" y="40" width="337" height="336" rx="78" fill="#3B6D11"/>
  <!-- Original white chain symbol traced directly from the supplied image -->
  <g>
    <path d="M 194 168 C 191.50 171.50 194.00 171.67 195 173 C 196.00 174.33 196.00 178.17 200 176 C 204.00 173.83 213.67 163.33 219 160 C 224.33 156.67 228.00 156.33 232 156 C 236.00 155.67 239.00 156.00 243 158 C 247.00 160.00 253.00 164.00 256 168 C 259.00 172.00 260.33 178.17 261 182 C 261.67 185.83 261.17 187.67 260 191 C 258.83 194.33 257.00 198.17 254 202 C 251.00 205.83 243.67 210.67 242 214 C 240.33 217.33 242.33 220.83 244 222 C 245.67 223.17 248.33 223.67 252 221 C 255.67 218.33 263.00 209.83 266 206 C 269.00 202.17 269.00 200.50 270 198 C 271.00 195.50 272.00 195.67 272 191 C 272.00 186.33 271.83 175.83 270 170 C 268.17 164.17 264.83 159.83 261 156 C 257.17 152.17 250.67 148.83 247 147 C 243.33 145.17 243.50 145.00 239 145 C 234.50 145.00 224.83 145.83 220 147 C 215.17 148.17 214.33 148.50 210 152 C 205.67 155.50 196.50 164.50 194 168 Z" fill="#FFFFFF"/>
  <path d="M 232 184 C 230.67 182.67 233.83 176.33 226 183 C 218.17 189.67 191.50 216.00 185 224 C 178.50 232.00 185.67 229.67 187 231 C 188.33 232.33 185.17 238.67 193 232 C 200.83 225.33 227.50 199.00 234 191 C 240.50 183.00 233.33 185.33 232 184 Z" fill="#FFFFFF"/>
  <path d="M 149 217 C 148.00 219.50 147.00 219.33 147 224 C 147.00 228.67 147.17 239.17 149 245 C 150.83 250.83 154.17 255.17 158 259 C 161.83 262.83 168.50 266.17 172 268 C 175.50 269.83 174.33 270.00 179 270 C 183.67 270.00 195.00 269.17 200 268 C 205.00 266.83 204.83 266.67 209 263 C 213.17 259.33 222.83 249.83 225 246 C 227.17 242.17 223.50 241.00 222 240 C 220.50 239.00 219.67 237.50 216 240 C 212.33 242.50 204.83 251.83 200 255 C 195.17 258.17 190.67 258.50 187 259 C 183.33 259.50 181.83 259.83 178 258 C 174.17 256.17 167.17 251.33 164 248 C 160.83 244.67 160.00 241.33 159 238 C 158.00 234.67 157.17 232.00 158 228 C 158.83 224.00 160.83 218.50 164 214 C 167.17 209.50 175.17 204.50 177 201 C 178.83 197.50 176.67 194.17 175 193 C 173.33 191.83 170.67 191.33 167 194 C 163.33 196.67 156.00 205.17 153 209 C 150.00 212.83 150.00 214.50 149 217 Z" fill="#FFFFFF"/>
  </g>
  <!-- Status badge -->
  <circle cx="342" cy="340" r="52" fill="#3B6D11" stroke="#FFFFFF" stroke-width="2"/>
  <path d="M 323 340 L 337 354 L 365 326" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export const LINK_DANGEROUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1792" viewBox="0 0 463 405">
  <rect width="463" height="405" fill="#FBFAF7"/>
  <rect x="41" y="40" width="337" height="336" rx="78" fill="#E52521"/>
  <!-- Original white chain symbol traced directly from the supplied image -->
  <g>
    <path d="M 194 168 C 191.50 171.50 194.00 171.67 195 173 C 196.00 174.33 196.00 178.17 200 176 C 204.00 173.83 213.67 163.33 219 160 C 224.33 156.67 228.00 156.33 232 156 C 236.00 155.67 239.00 156.00 243 158 C 247.00 160.00 253.00 164.00 256 168 C 259.00 172.00 260.33 178.17 261 182 C 261.67 185.83 261.17 187.67 260 191 C 258.83 194.33 257.00 198.17 254 202 C 251.00 205.83 243.67 210.67 242 214 C 240.33 217.33 242.33 220.83 244 222 C 245.67 223.17 248.33 223.67 252 221 C 255.67 218.33 263.00 209.83 266 206 C 269.00 202.17 269.00 200.50 270 198 C 271.00 195.50 272.00 195.67 272 191 C 272.00 186.33 271.83 175.83 270 170 C 268.17 164.17 264.83 159.83 261 156 C 257.17 152.17 250.67 148.83 247 147 C 243.33 145.17 243.50 145.00 239 145 C 234.50 145.00 224.83 145.83 220 147 C 215.17 148.17 214.33 148.50 210 152 C 205.67 155.50 196.50 164.50 194 168 Z" fill="#FFFFFF"/>
  <path d="M 232 184 C 230.67 182.67 233.83 176.33 226 183 C 218.17 189.67 191.50 216.00 185 224 C 178.50 232.00 185.67 229.67 187 231 C 188.33 232.33 185.17 238.67 193 232 C 200.83 225.33 227.50 199.00 234 191 C 240.50 183.00 233.33 185.33 232 184 Z" fill="#FFFFFF"/>
  <path d="M 149 217 C 148.00 219.50 147.00 219.33 147 224 C 147.00 228.67 147.17 239.17 149 245 C 150.83 250.83 154.17 255.17 158 259 C 161.83 262.83 168.50 266.17 172 268 C 175.50 269.83 174.33 270.00 179 270 C 183.67 270.00 195.00 269.17 200 268 C 205.00 266.83 204.83 266.67 209 263 C 213.17 259.33 222.83 249.83 225 246 C 227.17 242.17 223.50 241.00 222 240 C 220.50 239.00 219.67 237.50 216 240 C 212.33 242.50 204.83 251.83 200 255 C 195.17 258.17 190.67 258.50 187 259 C 183.33 259.50 181.83 259.83 178 258 C 174.17 256.17 167.17 251.33 164 248 C 160.83 244.67 160.00 241.33 159 238 C 158.00 234.67 157.17 232.00 158 228 C 158.83 224.00 160.83 218.50 164 214 C 167.17 209.50 175.17 204.50 177 201 C 178.83 197.50 176.67 194.17 175 193 C 173.33 191.83 170.67 191.33 167 194 C 163.33 196.67 156.00 205.17 153 209 C 150.00 212.83 150.00 214.50 149 217 Z" fill="#FFFFFF"/>
  </g>
  <!-- Status badge -->
  <circle cx="342" cy="340" r="52" fill="#E52521" stroke="#FFFFFF" stroke-width="2"/>
  <path d="M 325 323 L 361 359 M 361 323 L 325 359" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round"/>
</svg>`;

export const LINK_UNCERTAIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1792" viewBox="0 0 463 405">
  <rect width="463" height="405" fill="#FBFAF7"/>
  <rect x="41" y="40" width="337" height="336" rx="78" fill="#F7B916"/>
  <!-- Original white chain symbol traced directly from the supplied image -->
  <g>
    <path d="M 194 168 C 191.50 171.50 194.00 171.67 195 173 C 196.00 174.33 196.00 178.17 200 176 C 204.00 173.83 213.67 163.33 219 160 C 224.33 156.67 228.00 156.33 232 156 C 236.00 155.67 239.00 156.00 243 158 C 247.00 160.00 253.00 164.00 256 168 C 259.00 172.00 260.33 178.17 261 182 C 261.67 185.83 261.17 187.67 260 191 C 258.83 194.33 257.00 198.17 254 202 C 251.00 205.83 243.67 210.67 242 214 C 240.33 217.33 242.33 220.83 244 222 C 245.67 223.17 248.33 223.67 252 221 C 255.67 218.33 263.00 209.83 266 206 C 269.00 202.17 269.00 200.50 270 198 C 271.00 195.50 272.00 195.67 272 191 C 272.00 186.33 271.83 175.83 270 170 C 268.17 164.17 264.83 159.83 261 156 C 257.17 152.17 250.67 148.83 247 147 C 243.33 145.17 243.50 145.00 239 145 C 234.50 145.00 224.83 145.83 220 147 C 215.17 148.17 214.33 148.50 210 152 C 205.67 155.50 196.50 164.50 194 168 Z" fill="#FFFFFF"/>
  <path d="M 232 184 C 230.67 182.67 233.83 176.33 226 183 C 218.17 189.67 191.50 216.00 185 224 C 178.50 232.00 185.67 229.67 187 231 C 188.33 232.33 185.17 238.67 193 232 C 200.83 225.33 227.50 199.00 234 191 C 240.50 183.00 233.33 185.33 232 184 Z" fill="#FFFFFF"/>
  <path d="M 149 217 C 148.00 219.50 147.00 219.33 147 224 C 147.00 228.67 147.17 239.17 149 245 C 150.83 250.83 154.17 255.17 158 259 C 161.83 262.83 168.50 266.17 172 268 C 175.50 269.83 174.33 270.00 179 270 C 183.67 270.00 195.00 269.17 200 268 C 205.00 266.83 204.83 266.67 209 263 C 213.17 259.33 222.83 249.83 225 246 C 227.17 242.17 223.50 241.00 222 240 C 220.50 239.00 219.67 237.50 216 240 C 212.33 242.50 204.83 251.83 200 255 C 195.17 258.17 190.67 258.50 187 259 C 183.33 259.50 181.83 259.83 178 258 C 174.17 256.17 167.17 251.33 164 248 C 160.83 244.67 160.00 241.33 159 238 C 158.00 234.67 157.17 232.00 158 228 C 158.83 224.00 160.83 218.50 164 214 C 167.17 209.50 175.17 204.50 177 201 C 178.83 197.50 176.67 194.17 175 193 C 173.33 191.83 170.67 191.33 167 194 C 163.33 196.67 156.00 205.17 153 209 C 150.00 212.83 150.00 214.50 149 217 Z" fill="#FFFFFF"/>
  </g>
  <!-- Status badge -->
  <circle cx="342" cy="340" r="52" fill="#F7B916" stroke="#FFFFFF" stroke-width="2"/>
  <path d="M 327 327 C 328 316 336 310 347 310 C 359 310 367 317 367 328
C 367 338 362 343 355 348 C 350 351 348 355 348 360" fill="none"
stroke="#FFFFFF" stroke-width="8" stroke-linecap="round"/>
<circle cx="348" cy="371" r="4" fill="#FFFFFF"/>
</svg>`;

// Backend statuses are 'safe' | 'danger' | 'unknown' (see api/check-link.js).
// 'safe' maps to the green tile (link_green) to match this app's existing
// green-for-safe theming (STATUS_THEMES.safe); the plain navy tile
// (link_safe) has no distinct backend status of its own, so it's used as
// the fallback for any unrecognized status.
export function statusIconXml(status) {
  if (status === 'safe') return LINK_GREEN_SVG;
  if (status === 'danger') return LINK_DANGEROUS_SVG;
  if (status === 'unknown') return LINK_UNCERTAIN_SVG;
  return LINK_SAFE_SVG;
}

// Intrinsic aspect ratio of the source SVGs (viewBox 0 0 463 405) — use this
// to size the icon via width/height without stretching it.
export const STATUS_ICON_ASPECT = 405 / 463;

// All 4 source files share this exact tile + badge geometry (only fill
// colors/badge glyph differ) — verified against every one of them.
const TILE = { x: 41, y: 40, w: 337, h: 336, r: 78 };
const BADGE = { cx: 342, cy: 340, r: 52 };

// Visible width/height of the clipped logo (tile bounds extended to the
// badge's overflow past the tile's bottom-right corner) — use this ratio to
// size LogoBadge without stretching it.
const STATUS_LOGO_VIEW_W = Math.max(TILE.w, BADGE.cx + BADGE.r - TILE.x);
const STATUS_LOGO_VIEW_H = Math.max(TILE.h, BADGE.cy + BADGE.r - TILE.y);
export const STATUS_LOGO_ASPECT = STATUS_LOGO_VIEW_H / STATUS_LOGO_VIEW_W;

// Strips the source file's own <svg ...>...</svg> wrapper (which carries a
// full-canvas opaque "#FBFAF7" page-background rect meant for standalone
// viewing) so the artwork can be re-mounted under a clip that exposes only
// the tile + badge silhouette. The artwork elements themselves (the rects/
// paths/circle) are passed through untouched — nothing is redrawn or
// recolored, this only changes what canvas they're composited onto.
function innerMarkup(svgString) {
  return svgString.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}

// The big header-logo rendering: same artwork as statusIconXml, clipped to
// the tile-plus-badge silhouette (a rounded square unioned with the badge
// circle that overlaps its corner) so it sits on the app background with no
// surrounding frame, instead of the source file's own cream card.
export function statusLogoXml(status) {
  const inner = innerMarkup(statusIconXml(status));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${TILE.x} ${TILE.y} ${STATUS_LOGO_VIEW_W} ${STATUS_LOGO_VIEW_H}">
    <clipPath id="tile-clip">
      <rect x="${TILE.x}" y="${TILE.y}" width="${TILE.w}" height="${TILE.h}" rx="${TILE.r}" />
      <circle cx="${BADGE.cx}" cy="${BADGE.cy}" r="${BADGE.r}" />
    </clipPath>
    <g clip-path="url(#tile-clip)">${inner}</g>
  </svg>`;
}

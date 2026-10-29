// game/render/boardLayout.js
// Bố cục bàn cờ cho lớp Phaser, suy ra trực tiếp từ mảng BOARD truyền vào.
// KHÔNG chứa bản board thứ hai — id, tên, loại ô, nhóm màu, giá đều đến từ BOARD
// (nguồn sự thật duy nhất trong gameLogic.js). Tọa độ lưới 11×11 giống hệt logic
// DOM trong ui.js (tileGridPosition) nên hai lớp render luôn cùng vị trí ô.

export const GRID_STEPS = 11;          // lưới 11x11 (viền ô, ở giữa 9x9 trống)
export const CELL = 100;               // kích thước 1 ô theo tọa độ logic
export const BOARD_PIXELS = GRID_STEPS * CELL; // 1100

// Bảng màu nhóm hiển thị — bản sao của GROUP_COLORS trong ui.js (payload trình diễn).
export const GROUP_COLORS = Object.freeze({
  A: '#E85A4F', B: '#F2B84B', C: '#3FC1C9', D: '#9B8CF2',
  E: '#5EC97A', F: '#F27DB0', G: '#6FCF97', H: '#F2994A',
  STATION: '#8C97B8',
});

/** Vị trí lưới (row, col) 1-based, giống hệt ui.js. */
export function tileGridPosition(i) {
  if (i <= 10) return { row: 11, col: 11 - i };
  if (i <= 20) return { row: 11 - (i - 10), col: 1 };
  if (i <= 30) return { row: 1, col: i - 20 + 1 };
  return { row: i - 30 + 1, col: 11 };
}

/** Tọa độ tâm ô trong hệ tọa độ logic 1100x1100. */
export function tileCenter(i) {
  const p = tileGridPosition(i);
  return { x: (p.col - 0.5) * CELL, y: (p.row - 0.5) * CELL };
}

/** Các ô góc (Xuất Phát 0, Nhà Giam 10, Bãi Nghỉ 20, Phố 30). */
export const CORNER_IDS = [0, 10, 20, 30];

/**
 * Rút gọn số tiền kiểu "1.5tr / 500k" cho nhãn ô — chỉ dùng hiển thị;
 * định dạng đầy đủ "1.200.000 ₫" vẫn do ui.js (HUD/modals) đảm nhiệm.
 */
export function compactMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}tr`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1000).toLocaleString('vi-VN')}k`;
  return String(Math.round(n));
}

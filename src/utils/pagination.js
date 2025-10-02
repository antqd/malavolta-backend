// src/utils/pagination.js
export function getPagination(pageParam, take = 12) {
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
  const limit = take;
  const offset = (page - 1) * take;
  return { page, limit, offset, take };
}

export function shapeList(items, total, page, take = 12) {
  const pages = Math.max(1, Math.ceil(total / take));
  return { items, total, page, pages };
}

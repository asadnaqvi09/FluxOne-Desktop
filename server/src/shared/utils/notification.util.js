/** Map auth role → notification audience filter. */
export function roleAudience(role) {
  return role === 'admin' ? 'admin' : 'cashier';
}

/** Safe notification fields for API responses. */
export function publicNotification(row) {
  return {
    id: row.id,
    source: row.source,
    audience: row.audience,
    title: row.title,
    body: row.body,
    isRead: Boolean(row.isRead),
    createdAt: row.createdAt,
    readAt: row.readAt,
  };
}

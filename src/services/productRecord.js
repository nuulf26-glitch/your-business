export function fromProduct(row) {
  return { ...(row.data && typeof row.data === 'object' ? row.data : {}), legacyId:row.data?.id, id:row.id, name:row.name || row.data?.name };
}

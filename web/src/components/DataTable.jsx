import { useCallback, useMemo, useState } from "react";

function isInteractiveElement(el) {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return (
    tag === "button" ||
    tag === "a" ||
    tag === "input" ||
    tag === "select" ||
    tag === "textarea" ||
    el.getAttribute?.("role") === "button"
  );
}

function normalize(v) {
  if (v == null) return "";
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  return String(v).toLowerCase();
}

function compare(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") {
    return (a ? 1 : 0) - (b ? 1 : 0);
  }
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export default function DataTable({
  columns,
  rows,
  onEdit,
  onDelete,
  onRowClick,
  rowKey = "id",
  actionsLabel = "Actions",
  defaultPageSize = 15,
  pageSizeOptions = [10, 15, 25, 50, 100],
  initialSortKey = null,
  initialSortDir = "asc",
  stickyHeader = true,
  maxBodyHeight = 520,
  emptyMessage = "No records found.",
}) {
  const showActions = !!(onEdit || onDelete);
  const [sortKey, setSortKey] = useState(initialSortKey);
  const [sortDir, setSortDir] = useState(initialSortDir);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [page, setPage] = useState(1);

  const getRawValue = useCallback((row, key) => {
    const col = columns.find((c) => c.key === key);
    if (col?.sortValue) return col.sortValue(row);
    return row?.[key];
  }, [columns]);

  const sortableKeys = useMemo(() => {
    const set = new Set();
    for (const c of columns) {
      if (c.sortable === false) continue;
      set.add(c.key);
    }
    return set;
  }, [columns]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;

    const dir = sortDir === "desc" ? -1 : 1;
    const copy = [...rows];

    copy.sort((aRow, bRow) => {
      const aValue = normalize(getRawValue(aRow, sortKey));
      const bValue = normalize(getRawValue(bRow, sortKey));
      const aEmpty = aValue === "" || aValue == null;
      const bEmpty = bValue === "" || bValue == null;

      if (aEmpty && !bEmpty) return 1;
      if (!aEmpty && bEmpty) return -1;
      return compare(aValue, bValue) * dir;
    });

    return copy;
  }, [getRawValue, rows, sortDir, sortKey]);

  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);

  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [pageSize, safePage, sortedRows]);

  function toggleSort(key) {
    if (!sortableKeys.has(key)) return;

    setPage(1);
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  function sortIndicator(key) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " (asc)" : " (desc)";
  }

  function goFirst() {
    setPage(1);
  }

  function goPrev() {
    setPage((p) => Math.max(1, p - 1));
  }

  function goNext() {
    setPage((p) => Math.min(totalPages, p + 1));
  }

  function goLast() {
    setPage(totalPages);
  }

  const showingFrom = totalRows === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showingTo = Math.min(safePage * pageSize, totalRows);

  return (
    <div style={{ display: "grid", gap: 10, maxWidth: "100%", minWidth: 0 }}>
      <div
        className="tableWrap"
        style={{
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          maxHeight: maxBodyHeight,
          overflow: "auto",
        }}
      >
        <table style={{ width: "100%", maxWidth: "100%" }}>
          <thead>
            <tr>
              {columns.map((c) => {
                const canSort = sortableKeys.has(c.key);
                return (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.key)}
                    title={canSort ? "Sort" : ""}
                    style={{
                      position: stickyHeader ? "sticky" : "static",
                      top: stickyHeader ? 0 : "auto",
                      zIndex: stickyHeader ? 2 : "auto",
                      cursor: canSort ? "pointer" : "default",
                      userSelect: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.header}
                    {canSort ? sortIndicator(c.key) : ""}
                  </th>
                );
              })}
              {showActions && (
                <th
                  style={{
                    position: stickyHeader ? "sticky" : "static",
                    top: stickyHeader ? 0 : "auto",
                    zIndex: stickyHeader ? 2 : "auto",
                    whiteSpace: "nowrap",
                  }}
                >
                  {actionsLabel}
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {pagedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (showActions ? 1 : 0)}>
                  <div className="emptyState compact">{emptyMessage}</div>
                </td>
              </tr>
            ) : (
              pagedRows.map((row, index) => {
                const keyVal = row?.[rowKey] ?? row?.id ?? index;

                return (
                  <tr
                    key={keyVal}
                    onClick={(e) => {
                      if (!onRowClick) return;
                      if (isInteractiveElement(e.target)) return;
                      onRowClick(row);
                    }}
                    style={{ cursor: onRowClick ? "pointer" : "default" }}
                  >
                    {columns.map((c) => (
                      <td key={c.key} style={{ maxWidth: 420 }}>
                        {c.render ? c.render(row) : row?.[c.key] ?? ""}
                      </td>
                    ))}

                    {showActions && (
                      <td style={{ whiteSpace: "nowrap" }}>
                        {onEdit && (
                          <button
                            type="button"
                            className="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(row);
                            }}
                            style={{ marginRight: 8, padding: "6px 10px" }}
                          >
                            Edit
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            className="danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(row);
                            }}
                            style={{ padding: "6px 10px" }}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: "100%",
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: 13,
            opacity: 0.8,
            maxWidth: "100%",
            minWidth: 0,
            overflowWrap: "anywhere",
          }}
        >
          Showing <b>{showingFrom}-{showingTo}</b> of <b>{totalRows}</b>
          {sortKey ? (
            <>
              {" "}
              | Sorted by <b>{columns.find((c) => c.key === sortKey)?.header ?? sortKey}</b>{" "}
              ({sortDir})
            </>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            maxWidth: "100%",
            minWidth: 0,
          }}
        >
          <label
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: 13, opacity: 0.8 }}>Rows</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={{ padding: "8px 10px", maxWidth: "100%" }}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              flexWrap: "wrap",
              maxWidth: "100%",
              minWidth: 0,
            }}
          >
            <button
              type="button"
              className="ghost"
              onClick={goFirst}
              disabled={safePage <= 1}
              aria-label="First page"
              title="First page"
            >
              {"<<"}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={goPrev}
              disabled={safePage <= 1}
              aria-label="Previous page"
              title="Previous page"
            >
              {"<"}
            </button>

            <span style={{ fontSize: 13, opacity: 0.85, padding: "0 6px", whiteSpace: "nowrap" }}>
              Page <b>{safePage}</b> / {totalPages}
            </span>

            <button
              type="button"
              className="ghost"
              onClick={goNext}
              disabled={safePage >= totalPages}
              aria-label="Next page"
              title="Next page"
            >
              {">"}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={goLast}
              disabled={safePage >= totalPages}
              aria-label="Last page"
              title="Last page"
            >
              {">>"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

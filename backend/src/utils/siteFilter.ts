/**
 * Site filter helpers.
 *
 * `siteId` query param may be a single id ("11") or a comma-separated list
 * ("11,12,19"). The list form is injected by `enforceSiteAccess` when a user
 * with several assigned sites requests "all sites", so queries are scoped to
 * exactly the sites that user may see.
 *
 * Use with SQL: `m.site_id = ANY($n::int[])`.
 */
export const parseSiteIds = (value: unknown): number[] | null => {
    if (value === undefined || value === null || value === '') return null;
    const raw = Array.isArray(value) ? value : String(value).split(',');
    const ids = raw
        .map((v) => Number(String(v).trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
    return ids.length ? Array.from(new Set(ids)) : null;
};

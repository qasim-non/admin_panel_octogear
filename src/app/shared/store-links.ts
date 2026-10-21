/** Only accept the requested record's protected image routes, never a supplied origin. */
export function storeMediaPath(url: string | null, kind: 'stores' | 'store-requests', id: number): string | null {
    const prefix = `/api/media/${kind}/${id}/`;
    if (!url?.startsWith(prefix) || !/^(registration|pictures\/\d+)$/.test(url.slice(prefix.length))) return null;
    return url.slice('/api/'.length);
}

export function locationLink(value: string): string | null {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
    catch { return null; }
}

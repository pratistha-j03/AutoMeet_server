export async function withRetry(fn, options = {}) {
    const {
        maxAttempts = 3,
        baseDelay = 1000,
        label = 'operation'
    } = options;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const isLast = attempt === maxAttempts;
            const isRetryable = isRetryableError(err);

            console.error(`[Retry] "${label}" failed (attempt ${attempt}/${maxAttempts}): ${err?.message || err?.code || String(err)}`);

            if (isLast || !isRetryable) {
                console.error(`[Retry] "${label}" permanently failed. Not retrying.`);
                throw err;
            }

            const delay = baseDelay * Math.pow(2, attempt - 1); // 1s → 2s → 4s
            console.warn(`[Retry] Retrying "${label}" in ${delay}ms...`);
            await sleep(delay);
        }
    }
}

function isRetryableError(err) {
    // Gemini / API rate limit or server-side errors
    if (err?.status === 429) return true;  
    if (err?.status === 503) return true; 
    if (err?.status >= 500) return true;  

    // Network-level errors
    if (err?.code === 'ECONNRESET') return true;
    if (err?.code === 'ENOTFOUND') return true;
    if (err?.code === 'ETIMEDOUT') return true;
    if (err?.code === 'ECONNREFUSED') return true;

    // Don't retry client errors — bad prompt, invalid auth, etc.
    // 400, 401, 403, 404 should not be retried
    return false;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
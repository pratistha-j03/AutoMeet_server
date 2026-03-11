
export function splitTextIntoChunks(text, maxCharsPerChunk = 12000) {
    if (!text || typeof text !== 'string') {
        throw new Error(`splitTextIntoChunks received invalid input: ${typeof text}`);
    }
    const chunks = [];
    const sentences = text.split(/(?<=[.!?])\s+/); 
    let current = '';
    for (const sentence of sentences) {
        if ((current + sentence).length > maxCharsPerChunk) {
            if (current) chunks.push(current.trim());
            current = sentence;
        } else {
            current += ' ' + sentence;
        }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
}
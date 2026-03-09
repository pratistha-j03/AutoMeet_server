import redis from '../config/redis.js';

const JOB_TTL = 60 * 60 * 24; 

export async function setJobStatus(meetingId, status, extra = {}) {
    const payload = {
        meetingId,
        status,        
        ...extra,
        updatedAt: new Date().toISOString()
    };
    await redis.setex(`job:${meetingId}`, JOB_TTL, JSON.stringify(payload));
    console.log(`[JobStatus] ${meetingId} → ${status}`);
}

export async function getJobStatus(meetingId) {
    const data = await redis.get(`job:${meetingId}`);
    return data ? JSON.parse(data) : null;
}
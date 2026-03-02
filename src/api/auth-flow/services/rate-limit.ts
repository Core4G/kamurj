type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export const assertRateLimit = (key: string, maxRequests: number, windowMs: number) => {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (bucket.count >= maxRequests) {
    const error: any = new Error('Too many requests. Please try again later.');
    error.status = 429;
    throw error;
  }

  bucket.count += 1;
  buckets.set(key, bucket);
};

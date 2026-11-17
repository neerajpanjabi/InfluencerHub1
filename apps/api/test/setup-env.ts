// Test environment: isolated database, inline queues, sandbox providers. No real transactions.
process.env.APP_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://influencehub:influencehub@localhost:5432/influencehub_test?schema=public';
process.env.QUEUE_ENABLED = 'false';
process.env.JWT_SECRET = 'test-jwt-secret-test-jwt-secret-test-jwt-secret';
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.SOCIAL_SANDBOX_ENABLED = 'true';
process.env.PAYMENT_PROVIDER = 'sandbox';
process.env.SANDBOX_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.LLM_PROVIDER = 'none';
process.env.WEB_ORIGIN = 'http://localhost:3000';
process.env.API_PUBLIC_URL = 'http://localhost:3000/api/v1';
process.env.UPLOAD_DIR = '/tmp/influencehub-test-uploads';

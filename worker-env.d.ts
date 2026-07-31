declare namespace Cloudflare {
  interface Env {
    ASSETS: Fetcher;
    DB: D1Database;
    MEDIA: R2Bucket;
    PAYSUITE_API_TOKEN?: string;
    PAYSUITE_WEBHOOK_SECRET?: string;
    PAYSUITE_API_URL?: string;
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
    VAPID_SUBJECT?: string;
    RESEND_API_KEY?: string;
    RESEND_API_URL?: string;
    EMAIL_FROM?: string;
    PUBLIC_APP_URL?: string;
    IMAGES: {
      input(stream: ReadableStream): {
        transform(options: Record<string, unknown>): {
          output(options: {
            format: string;
            quality: number;
          }): Promise<{ response(): Response }>;
        };
      };
    };
  }
}

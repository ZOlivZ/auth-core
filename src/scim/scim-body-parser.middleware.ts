/**
 * Enable body parsing for SCIM 2.0 `application/scim+json` content type.
 *
 * NestJS/Express default body parser only handles `application/json`.
 * Call this ONCE in main.ts, BEFORE setting the global prefix:
 *
 * ```typescript
 * import express from 'express'; // or: import * as express from 'express'
 * import { enableScimBodyParser } from '@zolivz/auth-core';
 *
 * const app = await NestFactory.create(AppModule);
 * enableScimBodyParser(app, express);
 * ```
 *
 * @param app - NestJS application instance
 * @param expressModule - The express module (passed by the app to avoid import issues)
 */
export function enableScimBodyParser(
  app: { use: (...args: any[]) => void },
  expressModule: { json: (opts: any) => any },
): void {
  app.use(expressModule.json({ type: 'application/scim+json' }));
}

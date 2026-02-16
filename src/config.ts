import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

const ConfigSchema = Type.Object({
  db: Type.Object({
    url: Type.String({
      default: 'postgres://bp_user:bp_password@localhost:5432/boilerplate_development',
    }),
  }),
  jwt: Type.Object({
    privateKey: Type.String(),
    publicKey: Type.String(),
  }),
  server: Type.Object({
    port: Type.Number({ default: 4000 }),
  }),
});

export type AppConfig = Static<typeof ConfigSchema>;

async function resolveJwtPem(envValue: string | undefined, keyFilePath: string, label: string): Promise<string> {
  if (envValue) return envValue;

  const file = Bun.file(keyFilePath);
  if (await file.exists()) return file.text();

  throw new Error(
    `Missing ${label}: set the environment variable or place a PEM file at ${keyFilePath}`,
  );
}

export async function loadConfig(): Promise<AppConfig> {
  const raw = {
    db: {
      url: process.env.DATABASE_URL,
    },
    jwt: {
      privateKey: await resolveJwtPem(process.env.JWT_PRIVATE_KEY, 'keys/private.pem', 'JWT_PRIVATE_KEY'),
      publicKey: await resolveJwtPem(process.env.JWT_PUBLIC_KEY, 'keys/public.pem', 'JWT_PUBLIC_KEY'),
    },
    server: {
      port: process.env.PORT ? Number(process.env.PORT) : undefined,
    },
  };

  Value.Default(ConfigSchema, raw);
  return Value.Decode(ConfigSchema, raw);
}

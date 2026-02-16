import { importPKCS8, importSPKI, jwtVerify, type KeyLike, SignJWT } from "jose";

export interface Jwt {
  sign(payload: Record<string, unknown>): Promise<string>;
  verify(token: string): Promise<Record<string, unknown> | false>;
}

export function createJwt(privateKey: KeyLike, publicKey: KeyLike): Jwt {
  return {
    async sign(payload) {
      const { exp, nbf, iat, ...rest } = payload;

      let builder = new SignJWT(rest).setProtectedHeader({ alg: "ES256" });

      if (typeof exp === "string") {
        builder = builder.setExpirationTime(exp);
      } else if (typeof exp === "number") {
        builder = builder.setExpirationTime(exp);
      }

      if (typeof nbf === "string") {
        builder = builder.setNotBefore(nbf);
      } else if (typeof nbf === "number") {
        builder = builder.setNotBefore(nbf);
      }

      if (typeof iat === "number") {
        builder = builder.setIssuedAt(iat);
      } else if (iat !== false) {
        builder = builder.setIssuedAt();
      }

      return builder.sign(privateKey);
    },

    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, publicKey);
        return payload as Record<string, unknown>;
      } catch {
        return false;
      }
    },
  };
}

export async function makeJwt(jwtConfig: { privateKey: string; publicKey: string }): Promise<Jwt> {
  const privateKey = await importPKCS8(jwtConfig.privateKey, "ES256");
  const publicKey = await importSPKI(jwtConfig.publicKey, "ES256");
  return createJwt(privateKey, publicKey);
}

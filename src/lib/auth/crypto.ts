import {
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";

const SCRYPT_PREFIX = "scrypt";
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SESSION_VERSION = 1;

export const MANAGER_SESSION_DURATION_SECONDS = 10 * 60 * 60;

type SessionPayload = {
  v: number;
  exp: number;
};

function safeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

async function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION,
        maxmem: 64 * 1024 * 1024,
      },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      }
    );
  });
}

/**
 * `MANAGER_PASSWORD_HASH` に設定する値を生成するための補助関数です。
 * アプリのリクエスト処理から平文パスワードを保存することはありません。
 */
export async function createManagerPasswordHash(
  password: string,
  salt = randomBytes(16)
): Promise<string> {
  const key = await derivePasswordKey(password, salt);
  return [
    SCRYPT_PREFIX,
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyManagerPassword(
  password: string,
  encodedHash: string
): Promise<boolean> {
  try {
    const [prefix, cost, blockSize, parallelization, encodedSalt, encodedKey, extra] =
      encodedHash.split("$");

    if (
      extra !== undefined ||
      prefix !== SCRYPT_PREFIX ||
      Number(cost) !== SCRYPT_COST ||
      Number(blockSize) !== SCRYPT_BLOCK_SIZE ||
      Number(parallelization) !== SCRYPT_PARALLELIZATION ||
      !encodedSalt ||
      !encodedKey
    ) {
      return false;
    }

    const salt = Buffer.from(encodedSalt, "base64url");
    const expectedKey = Buffer.from(encodedKey, "base64url");
    if (salt.length < 16 || expectedKey.length !== SCRYPT_KEY_LENGTH) return false;

    const actualKey = await derivePasswordKey(password, salt);
    return safeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
}

function signSessionPayload(encodedPayload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(encodedPayload).digest();
}

export function createManagerSessionToken(
  secret: string,
  nowMs = Date.now()
): string {
  const payload: SessionPayload = {
    v: SESSION_VERSION,
    exp: Math.floor(nowMs / 1_000) + MANAGER_SESSION_DURATION_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signSessionPayload(encodedPayload, secret).toString("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifyManagerSessionToken(
  token: string,
  secret: string,
  nowMs = Date.now()
): boolean {
  try {
    const [encodedPayload, encodedSignature, extra] = token.split(".");
    if (extra !== undefined || !encodedPayload || !encodedSignature) return false;

    const suppliedSignature = Buffer.from(encodedSignature, "base64url");
    const expectedSignature = signSessionPayload(encodedPayload, secret);
    if (!safeEqual(suppliedSignature, expectedSignature)) return false;

    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<SessionPayload>;

    return (
      payload.v === SESSION_VERSION &&
      typeof payload.exp === "number" &&
      Number.isSafeInteger(payload.exp) &&
      payload.exp > Math.floor(nowMs / 1_000)
    );
  } catch {
    return false;
  }
}

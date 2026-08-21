import { Prisma } from "@prisma/client";

/**
 * P2002 = unique constraint 撞咗。
 *
 * 用嚟認出「同一條 idempotency key 有第二個 request 贏咗」呢個併發情況 ——
 * 認到之後要回讀贏家嗰份 responseJson，唔可以當普通 500 掟返俾客人（張單其實
 * 已經落咗）。⚠️ 同一個 code 亦都可以嚟自第二個 unique（例如 orderNumber 撞），
 * 所以 caller 一定要再確認真係搵到嗰條 key 先當 replay。
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

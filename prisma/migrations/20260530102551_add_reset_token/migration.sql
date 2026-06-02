/*
  Warnings:

  - A unique constraint covering the columns `[reset_token]` on the table `hosts` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "hosts" ADD COLUMN     "reset_token" TEXT,
ADD COLUMN     "reset_token_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "hosts_reset_token_key" ON "hosts"("reset_token");

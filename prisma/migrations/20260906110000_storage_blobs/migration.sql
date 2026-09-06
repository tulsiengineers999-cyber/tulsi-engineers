CREATE TABLE "storage_blobs" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_blobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "storage_blobs_storageKey_key" ON "storage_blobs"("storageKey");
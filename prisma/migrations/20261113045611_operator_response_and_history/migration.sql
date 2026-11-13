-- AlterTable
ALTER TABLE "HazardEvent" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "acknowledgedBy" TEXT;

-- AlterTable
ALTER TABLE "ZoneStatus" ADD COLUMN     "sensorFault" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ZoneReading" (
    "id" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "distanceCm" DOUBLE PRECISION,
    "humidityPct" DOUBLE PRECISION,
    "motion" BOOLEAN,
    "alert" BOOLEAN NOT NULL,
    "sensorFault" BOOLEAN NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZoneReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ZoneReading_zone_recordedAt_idx" ON "ZoneReading"("zone", "recordedAt");

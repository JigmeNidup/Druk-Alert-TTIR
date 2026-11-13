-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZoneStatus" (
    "zone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "distanceCm" DOUBLE PRECISION,
    "humidityPct" DOUBLE PRECISION,
    "motion" BOOLEAN,
    "alert" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZoneStatus_pkey" PRIMARY KEY ("zone")
);

-- CreateTable
CREATE TABLE "HazardEvent" (
    "id" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "distanceCm" DOUBLE PRECISION,
    "humidityPct" DOUBLE PRECISION,
    "motion" BOOLEAN,
    "flood" BOOLEAN NOT NULL,
    "landslide" BOOLEAN NOT NULL,
    "trespass" BOOLEAN NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HazardEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_contact_key" ON "User"("contact");

-- CreateIndex
CREATE INDEX "HazardEvent_createdAt_idx" ON "HazardEvent"("createdAt");

-- CreateTable
CREATE TABLE `QuarterParticipationExclusion` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `quarter` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `QuarterParticipationExclusion_year_quarter_idx`(`year`, `quarter`),
    UNIQUE INDEX `QuarterParticipationExclusion_userId_year_quarter_key`(`userId`, `year`, `quarter`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `QuarterParticipationExclusion` ADD CONSTRAINT `QuarterParticipationExclusion_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `RankingTieBreakDecision` (
    `id` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `quarter` INTEGER NOT NULL,
    `reviewGroupId` VARCHAR(191) NOT NULL,
    `groupKey` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `orderIndex` INTEGER NOT NULL,
    `decidedByUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `rtd_yqrg_group_idx`(`year`, `quarter`, `reviewGroupId`, `groupKey`),
    UNIQUE INDEX `rtd_yqrg_emp_uq`(`year`, `quarter`, `reviewGroupId`, `employeeId`),
    UNIQUE INDEX `rtd_yqrg_group_ord_uq`(`year`, `quarter`, `reviewGroupId`, `groupKey`, `orderIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RankingTieBreakDecision` ADD CONSTRAINT `RankingTieBreakDecision_reviewGroupId_fkey` FOREIGN KEY (`reviewGroupId`) REFERENCES `ReviewGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RankingTieBreakDecision` ADD CONSTRAINT `RankingTieBreakDecision_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

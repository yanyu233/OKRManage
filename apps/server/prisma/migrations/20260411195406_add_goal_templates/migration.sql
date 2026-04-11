-- CreateTable
CREATE TABLE `GoalTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GoalTemplate_departmentId_name_key`(`departmentId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GoalTemplateKeyResult` (
    `id` VARCHAR(191) NOT NULL,
    `goalTemplateId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `points` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GoalTemplateKeyResult_goalTemplateId_code_key`(`goalTemplateId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImportedGoalTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `goalTemplateId` VARCHAR(191) NOT NULL,
    `goalId` VARCHAR(191) NOT NULL,
    `ownerUserId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `quarter` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ImportedGoalTemplate_goalTemplateId_ownerUserId_year_quarter_key`(`goalTemplateId`, `ownerUserId`, `year`, `quarter`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GoalTemplate` ADD CONSTRAINT `GoalTemplate_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoalTemplateKeyResult` ADD CONSTRAINT `GoalTemplateKeyResult_goalTemplateId_fkey` FOREIGN KEY (`goalTemplateId`) REFERENCES `GoalTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportedGoalTemplate` ADD CONSTRAINT `ImportedGoalTemplate_goalTemplateId_fkey` FOREIGN KEY (`goalTemplateId`) REFERENCES `GoalTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportedGoalTemplate` ADD CONSTRAINT `ImportedGoalTemplate_goalId_fkey` FOREIGN KEY (`goalId`) REFERENCES `Goal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportedGoalTemplate` ADD CONSTRAINT `ImportedGoalTemplate_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

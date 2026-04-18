CREATE TABLE `KnowledgeAsset` (
    `id` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `note` VARCHAR(191) NULL,
    `uploadedByUserId` VARCHAR(191) NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KnowledgeAsset_uploadedByUserId_idx`(`uploadedByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `KnowledgeAsset`
ADD CONSTRAINT `KnowledgeAsset_uploadedByUserId_fkey`
FOREIGN KEY (`uploadedByUserId`) REFERENCES `User`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `goaltemplatekeyresult` ADD COLUMN `scoreType` ENUM('objective', 'subjective') NOT NULL DEFAULT 'subjective';

-- AlterTable
ALTER TABLE `keyresult` ADD COLUMN `scoreType` ENUM('objective', 'subjective') NOT NULL DEFAULT 'objective';

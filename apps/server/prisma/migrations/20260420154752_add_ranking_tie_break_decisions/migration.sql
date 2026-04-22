-- RenameIndex
ALTER TABLE `rankingtiebreakdecision` RENAME INDEX `rtd_yqrg_emp_uq` TO `RankingTieBreakDecision_year_quarter_reviewGroupId_employeeI_key`;

-- RenameIndex
ALTER TABLE `rankingtiebreakdecision` RENAME INDEX `rtd_yqrg_group_idx` TO `RankingTieBreakDecision_year_quarter_reviewGroupId_groupKey_idx`;

-- RenameIndex
ALTER TABLE `rankingtiebreakdecision` RENAME INDEX `rtd_yqrg_group_ord_uq` TO `RankingTieBreakDecision_year_quarter_reviewGroupId_groupKey__key`;

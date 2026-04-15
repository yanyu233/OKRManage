# OKRManage 数据库表结构整理

- 数据库名：`okr_route_c_dev`
- 整理来源：
  - 实际本地 MySQL 表结构
  - [apps/server/prisma/schema.prisma](C:/Users/yanxi/Documents/OKRManage/apps/server/prisma/schema.prisma)
- 当前共 `18` 张表

## 表总览

| 表名 | 用途 |
| --- | --- |
| `_prisma_migrations` | Prisma 迁移记录 |
| `auditlog` | 审计日志 |
| `department` | 部门 |
| `goal` | OKR 目标 O |
| `goaltemplate` | 目标模板 |
| `goaltemplatekeyresult` | 模板关键结果 KR |
| `groupleaderbinding` | 小组负责人绑定 |
| `importedgoaltemplate` | 模板导入记录 |
| `keyresult` | 关键结果 KR |
| `localaccount` | 本地登录账号 |
| `proof` | KR 证明材料 |
| `reviewgradequota` | 评价组等级名额 |
| `reviewgroup` | 评价组 |
| `section` | 科室 |
| `sectionleaderbinding` | 科室负责人绑定 |
| `session` | 登录会话 |
| `user` | 用户/员工 |
| `userroleassignment` | 角色分配 |

---

## 1. `_prisma_migrations`

用途：记录 Prisma 数据库迁移执行历史。

| 字段 | 类型 | 可空 | 键 | 默认值 |
| --- | --- | --- | --- | --- |
| `id` | `varchar(36)` | 否 | `PRI` | - |
| `checksum` | `varchar(64)` | 否 | - | - |
| `finished_at` | `datetime(3)` | 是 | - | `NULL` |
| `migration_name` | `varchar(255)` | 否 | - | - |
| `logs` | `text` | 是 | - | `NULL` |
| `rolled_back_at` | `datetime(3)` | 是 | - | `NULL` |
| `started_at` | `datetime(3)` | 否 | - | `CURRENT_TIMESTAMP(3)` |
| `applied_steps_count` | `int unsigned` | 否 | - | `0` |

约束：
- 主键：`PRIMARY (id)`

---

## 2. `auditlog`

用途：记录系统操作审计日志。

| 字段 | 类型 | 可空 | 键 | 默认值 |
| --- | --- | --- | --- | --- |
| `id` | `varchar(191)` | 否 | `PRI` | - |
| `actorUserId` | `varchar(191)` | 是 | `MUL` | `NULL` |
| `actorRoleCode` | `varchar(191)` | 是 | - | `NULL` |
| `action` | `varchar(191)` | 否 | - | - |
| `entityType` | `varchar(191)` | 否 | - | - |
| `entityId` | `varchar(191)` | 是 | - | `NULL` |
| `beforeJson` | `json` | 是 | - | `NULL` |
| `afterJson` | `json` | 是 | - | `NULL` |
| `ip` | `varchar(191)` | 是 | - | `NULL` |
| `userAgent` | `varchar(191)` | 是 | - | `NULL` |
| `createdAt` | `datetime(3)` | 否 | - | `CURRENT_TIMESTAMP(3)` |

约束：
- 主键：`PRIMARY (id)`

外键：
- `actorUserId -> user.id`

---

## 3. `department`

用途：部门主数据。

| 字段 | 类型 | 可空 | 键 | 默认值 |
| --- | --- | --- | --- | --- |
| `id` | `varchar(191)` | 否 | `PRI` | - |
| `name` | `varchar(191)` | 否 | `UNI` | - |
| `isActive` | `tinyint(1)` | 否 | - | `1` |
| `createdAt` | `datetime(3)` | 否 | - | `CURRENT_TIMESTAMP(3)` |
| `updatedAt` | `datetime(3)` | 否 | - | - |

约束：
- 主键：`PRIMARY (id)`
- 唯一键：`Department_name_key (name)`

---

## 4. `goal`

用途：员工季度目标 O。

| 字段 | 类型 | 可空 | 键 | 默认值 |
| --- | --- | --- | --- | --- |
| `id` | `varchar(191)` | 否 | `PRI` | - |
| `ownerUserId` | `varchar(191)` | 否 | `MUL` | - |
| `year` | `int` | 否 | - | - |
| `quarter` | `int` | 否 | - | - |
| `code` | `varchar(191)` | 否 | - | - |
| `name` | `varchar(191)` | 否 | - | - |
| `description` | `varchar(191)` | 是 | - | `NULL` |
| `status` | `varchar(191)` | 否 | - | - |
| `totalPoints` | `int` | 否 | - | - |
| `createdAt` | `datetime(3)` | 否 | - | `CURRENT_TIMESTAMP(3)` |
| `updatedAt` | `datetime(3)` | 否 | - | - |

约束：
- 主键：`PRIMARY (id)`
- 唯一键：`Goal_ownerUserId_year_quarter_code_key (ownerUserId, year, quarter, code)`

外键：
- `ownerUserId -> user.id`

---

## 5. `goaltemplate`

用途：部门级目标模板。

| 字段 | 类型 | 可空 | 键 | 默认值 |
| --- | --- | --- | --- | --- |
| `id` | `varchar(191)` | 否 | `PRI` | - |
| `departmentId` | `varchar(191)` | 否 | `MUL` | - |
| `name` | `varchar(191)` | 否 | - | - |
| `description` | `varchar(191)` | 是 | - | `NULL` |
| `isActive` | `tinyint(1)` | 否 | - | `1` |
| `createdAt` | `datetime(3)` | 否 | - | `CURRENT_TIMESTAMP(3)` |
| `updatedAt` | `datetime(3)` | 否 | - | - |

约束：
- 主键：`PRIMARY (id)`
- 唯一键：`GoalTemplate_departmentId_name_key (departmentId, name)`

外键：
- `departmentId -> department.id`

---

## 6. `goaltemplatekeyresult`

用途：模板下的 KR 明细。

| 字段 | 类型 | 可空 | 键 | 默认值 |
| --- | --- | --- | --- | --- |
| `id` | `varchar(191)` | 否 | `PRI` | - |
| `goalTemplateId` | `varchar(191)` | 否 | `MUL` | - |
| `code` | `varchar(191)` | 否 | - | - |
| `name` | `varchar(191)` | 否 | - | - |
| `description` | `varchar(191)` | 是 | - | `NULL` |
| `points` | `int` | 否 | - | - |
| `createdAt` | `datetime(3)` | 否 | - | `CURRENT_TIMESTAMP(3)` |
| `updatedAt` | `datetime(3)` | 否 | - | - |
| `scoreType` | `enum('objective','subjective')` | 否 | - | `subjective` |

约束：
- 主键：`PRIMARY (id)`
- 唯一键：`GoalTemplateKeyResult_goalTemplateId_code_key (goalTemplateId, code)`

外键：
- `goalTemplateId -> goaltemplate.id`

---

## 7. `groupleaderbinding`

用途：小组负责人和评价组的绑定关系。

| 字段 | 类型 | 可空 | 键 | 默认值 |
| --- | --- | --- | --- | --- |
| `id` | `varchar(191)` | 否 | `PRI` | - |
| `leaderUserId` | `varchar(191)` | 否 | `MUL` | - |
| `reviewGroupId` | `varchar(191)` | 否 | `MUL` | - |
| `createdAt` | `datetime(3)` | 否 | - | `CURRENT_TIMESTAMP(3)` |
| `updatedAt` | `datetime(3)` | 否 | - | - |

约束：
- 主键：`PRIMARY (id)`
- 唯一键：`GroupLeaderBinding_leaderUserId_reviewGroupId_key (leaderUserId, reviewGroupId)`

外键：
- `leaderUserId -> user.id`
- `reviewGroupId -> reviewgroup.id`

---

## 8. `importedgoaltemplate`

用途：记录模板被导入为实际目标的历史。

| 字段 | 类型 | 可空 | 键 | 默认值 |
| --- | --- | --- | --- | --- |
| `id` | `varchar(191)` | 否 | `PRI` | - |
| `goalTemplateId` | `varchar(191)` | 否 | `MUL` | - |
| `goalId` | `varchar(191)` | 否 | `MUL` | - |
| `ownerUserId` | `varchar(191)` | 否 | `MUL` | - |
| `year` | `int` | 否 | - | - |
| `quarter` | `int` | 否 | - | - |
| `createdAt` | `datetime(3)` | 否 | - | `CURRENT_TIMESTAMP(3)` |

约束：
- 主键：`PRIMARY (id)`
- 唯一键：`ImportedGoalTemplate_goalTemplateId_ownerUserId_year_quarter_key (goalTemplateId, ownerUserId, year, quarter)`

外键：
- `goalTemplateId -> goaltemplate.id`
- `goalId -> goal.id`
- `ownerUserId -> user.id`

---

## 9. `keyresult`

用途：目标 O 下的关键结果 KR。

| 字段 | 类型 | 可空 | 键 | 默认值 |
| --- | --- | --- | --- | --- |
| `id` | `varchar(191)` | 否 | `PRI` | - |
| `goalId` | `varchar(191)` | 否 | `MUL` | - |
| `code` | `varchar(191)` | 否 | - | - |
| `name` | `varchar(191)` | 否 | - | - |
| `description` | `varchar(191)` | 是 | - | `NULL` |
| `points` | `int` | 否 | - | - |
| `completionState` | `varchar(191)` | 否 | - | - |
| `reviewScore` | `double` | 是 | - | `NULL` |
| `reviewComment` | `varchar(191)` | 是 | - | `NULL` |
| `reviewedAt` | `datetime(3)` | 是 | - | `NULL` |
| `reviewedByUserId` | `varchar(191)` | 是 | `MUL` | `NULL` |
| `createdAt` | `datetime(3)` | 否 | - | `CURRENT_TIMESTAMP(3)` |
| `updatedAt` | `datetime(3)` | 否 | - | - |
| `scoreType` | `enum('objective','subjective')` | 否 | - | `objective` |

约束：
- 主键：`PRIMARY (id)`
- 唯一键：`KeyResult_goalId_code_key (goalId, code)`

外键：
- `goalId -> goal.id`
- `reviewedByUserId -> user.id`

---

## 10. `localaccount`

用途：本地调试/兜底登录账号。

| 字段 | 类型 | 可空 | 键 | 默认值 |
| --- | --- | --- | --- | --- |
| `id` | `varchar(191)` | 否 | `PRI` | - |
| `userId` | `varchar(191)` | 否 | `UNI` | - |
| `loginName` | `varchar(191)` | 否 | `UNI` | - |
| `passwordHash` | `varchar(191)` | 否 | - | - |
| `localLoginEnabled` | `tinyint(1)` | 否 | - | `0` |
| `lastLoginAt` | `datetime(3)` | 是 | - | `NULL` |
| `createdAt` | `datetime(3)` | 否 | - | `CURRENT_TIMESTAMP(3)` |
| `updatedAt` | `datetime(3)` | 否 | - | - |

约束：
- 主键：`PRIMARY (id)`
- 唯一键：`LocalAccount_userId_key (userId)`
- 唯一键：`LocalAccount_loginName_key (loginName)`

外键：
- `userId -> user.id`

---

## 11. `proof`

用途：KR 的证明材料/附件。

| 字段 | 类型 | 可空 | 键 | 默认值 |
| --- | --- | --- | --- | --- |
| `id` | `varchar(191)` | 否 | `PRI` | - |
| `keyResultId` | `varchar(191)` | 否 | `MUL` | - |
| `fileName` | `varchar(191)` | 否 | - | - |
| `fileUrl` | `varchar(191)` | 否 | - | - |
| `fileSize` | `int` | 否 | - | - |
| `note` | `varchar(191)` | 是 | - | `NULL` |
| `uploadedAt` | `datetime(3)` | 否 | - | `CURRENT_TIMESTAMP(3)` |
| `createdAt` | `datetime(3)` | 否 | - | `CURRENT_TIMESTAMP(3)` |
| `updatedAt` | `datetime(3)` | 否 | - | - |
| `isKnowledge` | `tinyint(1)` | 否 | - | `0` |

约束：
- 主键：`PRIMARY (id)`

外键：
- `keyResultId -> keyresult.id`

---

## 12. `reviewgradequota`

用途：评价组各等级名额配置。

| 字段 | 类型 | 可空 | 键 | 默认值 |
| --- | --- | --- | --- | --- |
| `id` | `varchar(191)` | 否 | `PRI` | - |
| `reviewGroupId` | `varchar(191)` | 否 | `MUL` | - |
| `gradeCode` | `varchar(191)` | 否 | - | - |
| `seatCount` | `int` | 否 | - | - |
| `createdAt` | `datetime(3)` | 否 | - | `CURRENT_TIMESTAMP(3)` |
| `updatedAt` | `datetime(3)` | 否 | - | - |

约束：
- 主键：`PRIMARY (id)`
- 唯一键：`ReviewGradeQuota_reviewGroupId_gradeCode_key (reviewGroupId, gradeCode)`

外键：
- `reviewGroupId -> reviewgroup.id`

---

## 13. `reviewgroup`

用途：评价组主数据。

| 字段 | 类型 | 可空 | 键 | 默认值 |
| --- | --- | --- | --- | --- |
| `id` | `varchar(191)` | 否 | `PRI` | - |
| `name` | `varchar(191)` | 否 | `UNI` | - |
| `isActive` | `tinyint(1)` | 否 | - | `1` |
| `createdAt` | `datetime(3)` | 否 | - | `CURRENT_TIMESTAMP(3)` |
| `updatedAt` | `datetime(3)` | 否 | - | - |

约束：
- 主键：`PRIMARY (id)`
- 唯一键：`ReviewGroup_name_key (name)`

---

## 14. `section`

用途：科室主数据。

| 字段 | 类型 | 可空 | 键 | 默认值 |
| --- | --- | --- | --- | --- |
| `id` | `varchar(191)` | 否 | `PRI` | - |
| `departmentId` | `varchar(191)` | 否 | `MUL` | - |
| `name` | `varchar(191)` | 否 | - | - |
| `isActive` | `tinyint(1)` | 否 | - | `1` |
| `createdAt` | `datetime(3)` | 否 | - | `CURRENT_TIMESTAMP(3)` |
| `updatedAt` | `datetime(3)` | 否 | - | - |

约束：
- 主键：`PRIMARY (id)`
- 唯一键：`Section_departmentId_id_key (departmentId, id)`
- 唯一键：`Section_departmentId_name_key (departmentId, name)`

外键：
- `departmentId -> department.id`

---

## 15. `sectionleaderbinding`

用途：科室负责人和科室的绑定关系。

| 字段 | 类型 | 可空 | 键 | 默认值 |
| --- | --- | --- | --- | --- |
| `id` | `varchar(191)` | 否 | `PRI` | - |
| `leaderUserId` | `varchar(191)` | 否 | `MUL` | - |
| `sectionId` | `varchar(191)` | 否 | `MUL` | - |
| `createdAt` | `datetime(3)` | 否 | - | `CURRENT_TIMESTAMP(3)` |
| `updatedAt` | `datetime(3)` | 否 | - | - |

约束：
- 主键：`PRIMARY (id)`
- 唯一键：`SectionLeaderBinding_leaderUserId_sectionId_key (leaderUserId, sectionId)`

外键：
- `leaderUserId -> user.id`
- `sectionId -> section.id`

---

## 16. `session`

用途：登录会话。

| 字段 | 类型 | 可空 | 键 | 默认值 |
| --- | --- | --- | --- | --- |
| `id` | `varchar(191)` | 否 | `PRI` | - |
| `userId` | `varchar(191)` | 否 | `MUL` | - |
| `activeRoleAssignmentId` | `varchar(191)` | 否 | `MUL` | - |
| `authMethod` | `varchar(191)` | 否 | - | - |
| `ip` | `varchar(191)` | 是 | - | `NULL` |
| `userAgent` | `varchar(191)` | 是 | - | `NULL` |
| `expiresAt` | `datetime(3)` | 否 | - | - |
| `lastSeenAt` | `datetime(3)` | 是 | - | `NULL` |
| `createdAt` | `datetime(3)` | 否 | - | `CURRENT_TIMESTAMP(3)` |
| `updatedAt` | `datetime(3)` | 否 | - | - |

约束：
- 主键：`PRIMARY (id)`

外键：
- `userId -> user.id`
- `(activeRoleAssignmentId, userId) -> userroleassignment.(id, userId)`

---

## 17. `user`

用途：用户/员工主表。

| 字段 | 类型 | 可空 | 键 | 默认值 |
| --- | --- | --- | --- | --- |
| `id` | `varchar(191)` | 否 | `PRI` | - |
| `employeeNo` | `varchar(191)` | 是 | `UNI` | `NULL` |
| `name` | `varchar(191)` | 否 | - | - |
| `email` | `varchar(191)` | 是 | `UNI` | `NULL` |
| `mobile` | `varchar(191)` | 是 | `UNI` | `NULL` |
| `wecomUserId` | `varchar(191)` | 是 | `UNI` | `NULL` |
| `departmentId` | `varchar(191)` | 是 | `MUL` | `NULL` |
| `sectionId` | `varchar(191)` | 是 | - | `NULL` |
| `reviewGroupId` | `varchar(191)` | 是 | `MUL` | `NULL` |
| `isActive` | `tinyint(1)` | 否 | - | `1` |
| `createdAt` | `datetime(3)` | 否 | - | `CURRENT_TIMESTAMP(3)` |
| `updatedAt` | `datetime(3)` | 否 | - | - |

约束：
- 主键：`PRIMARY (id)`
- 唯一键：`User_employeeNo_key (employeeNo)`
- 唯一键：`User_email_key (email)`
- 唯一键：`User_mobile_key (mobile)`
- 唯一键：`User_wecomUserId_key (wecomUserId)`

外键：
- `departmentId -> department.id`
- `(departmentId, sectionId) -> section.(departmentId, id)`
- `reviewGroupId -> reviewgroup.id`

---

## 18. `userroleassignment`

用途：用户角色分配记录。

| 字段 | 类型 | 可空 | 键 | 默认值 |
| --- | --- | --- | --- | --- |
| `id` | `varchar(191)` | 否 | `PRI` | - |
| `userId` | `varchar(191)` | 否 | `MUL` | - |
| `roleCode` | `varchar(191)` | 否 | - | - |
| `scopeType` | `varchar(191)` | 否 | - | - |
| `scopeId` | `varchar(191)` | 否 | - | - |
| `isPrimary` | `tinyint(1)` | 否 | - | `0` |
| `isEnabled` | `tinyint(1)` | 否 | - | `1` |
| `createdAt` | `datetime(3)` | 否 | - | `CURRENT_TIMESTAMP(3)` |
| `updatedAt` | `datetime(3)` | 否 | - | - |

约束：
- 主键：`PRIMARY (id)`
- 唯一键：`UserRoleAssignment_id_userId_key (id, userId)`
- 唯一键：`UserRoleAssignment_userId_roleCode_scopeType_scopeId_key (userId, roleCode, scopeType, scopeId)`

外键：
- `userId -> user.id`

---

## 核心关系总览

- `department -> section -> user`
- `reviewgroup -> user`
- `reviewgroup -> reviewgradequota`
- `user -> localaccount`
- `user -> userroleassignment -> session`
- `user -> goal -> keyresult -> proof`
- `department -> goaltemplate -> goaltemplatekeyresult`
- `goaltemplate -> importedgoaltemplate -> goal`
- `user -> sectionleaderbinding -> section`
- `user -> groupleaderbinding -> reviewgroup`
- `user -> auditlog`

## 说明

- 业务核心链路是：`user -> goal -> keyresult -> proof`
- 角色与权限核心链路是：`user -> userroleassignment -> session`
- 模板导入链路是：`goaltemplate -> goaltemplatekeyresult -> importedgoaltemplate -> goal`
- `_prisma_migrations` 为框架迁移表，不属于业务表，但已一并列入

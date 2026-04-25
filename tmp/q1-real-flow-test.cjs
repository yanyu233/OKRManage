const fs = require('node:fs/promises');
const path = require('node:path');
const { PrismaClient } = require('../apps/server/node_modules/@prisma/client');
const bcrypt = require('../apps/server/node_modules/bcryptjs');

const API_BASE = 'http://127.0.0.1:3000/api';
const DATABASE_URL = process.env.DATABASE_URL || 'mysql://root:root@127.0.0.1:3306/okr_route_c_dev';
const TEST_PASSWORD = 'Admin123!';
const YEAR = 2026;
const QUARTER = 1;
const RESULTS_PATH = path.resolve(process.cwd(), 'tmp', 'q1-real-flow-results.json');
const SERVER_PROOF_ROOT = path.resolve(process.cwd(), 'apps', 'server', 'storage', 'proofs');

const FILE_POOL = [
  'C:\\Users\\yanxi\\Downloads\\股份五金维修材料2026.3.16.xls',
  'C:\\Users\\yanxi\\Downloads\\人员情况表.xlsx',
  'C:\\Users\\yanxi\\Downloads\\茅台大模型技术架构V1.5.pptx',
  'C:\\Users\\yanxi\\Downloads\\茅台AI规划方案V1.5.docx',
  'C:\\Users\\yanxi\\WPSDrive\\1624983128\\WPS企业云盘\\中国贵州茅台酒厂 (集团)有限责任公司及下属控股公司\\我的企业文档\\笔记本文件\\统一身份认证平台-定时拉取数据集成规范.docx',
  'C:\\Users\\yanxi\\WPSDrive\\1624983128\\WPS企业云盘\\中国贵州茅台酒厂 (集团)有限责任公司及下属控股公司\\我的企业文档\\笔记本文件\\1215-竹云统一身份认证平台认证服务-0AUTH2协议开发集成手册 .docx',
  'C:\\Users\\yanxi\\WPSDrive\\1624983128\\WPS企业云盘\\中国贵州茅台酒厂 (集团)有限责任公司及下属控股公司\\我的企业文档\\笔记本文件\\数字科技管理事业部一般员工2025年年度绩效考核结果公示表.pdf',
  'C:\\Users\\yanxi\\WPSDrive\\1624983128\\WPS企业云盘\\中国贵州茅台酒厂 (集团)有限责任公司及下属控股公司\\我的企业文档\\笔记本文件\\数字科技管理事业部一般员工2025年四季度绩效考核结果公示表.pdf'
];

const PARTICIPANTS = [
  { employeeNo: '20203176', name: '张艺耀', sectionName: '智慧园区中心', reviewGroupName: '信息化组' },
  { employeeNo: '1800054', name: '方墨', sectionName: '工业互联网中心', reviewGroupName: '信息化组' },
  { employeeNo: '20250003', name: '李健', sectionName: '数字生产力中心', reviewGroupName: '信息化组' },
  { employeeNo: '20250317', name: '田绍礼', sectionName: '数字基建中心', reviewGroupName: '新员工组' },
  { employeeNo: '20250286', name: '赵坚', sectionName: '数字业务中心', reviewGroupName: '新员工组' },
  { employeeNo: '20245105', name: '姚磬馨', sectionName: '运营中心', reviewGroupName: '新员工组' },
  { employeeNo: '1800189', name: '曹辉罡', sectionName: '运营中心', reviewGroupName: '运营组' },
  { employeeNo: '20250801', name: '周洪池', sectionName: '运营中心', reviewGroupName: '运营组' },
  { employeeNo: '20250802', name: '李昌慧颖', sectionName: '运营中心', reviewGroupName: '运营组' },
  { employeeNo: '1800470', name: '孙攀', sectionName: '综合管理部', reviewGroupName: '综合组' },
  { employeeNo: '1801448', name: '仇爱', sectionName: '综合管理部', reviewGroupName: '综合组' },
  { employeeNo: '20203491', name: '钟小玉', sectionName: '综合管理部', reviewGroupName: '综合组' }
];

const SECTION_LEADERS = [
  { employeeNo: '0103098', name: '胡川', sectionName: '智慧园区中心' },
  { employeeNo: '0105721', name: '赵友文', sectionName: '数字基建中心' },
  { employeeNo: '1700066', name: '陈美果', sectionName: '数字业务中心' },
  { employeeNo: '0102652', name: '朱武军', sectionName: '工业互联网中心' },
  { employeeNo: '1201469', name: '杜文闻', sectionName: '综合管理部' },
  { employeeNo: '1300444', name: '袁湘波', sectionName: '数字生产力中心' },
  { employeeNo: '1100299', name: '邓河', sectionName: '运营中心' }
];

const EXTRA_ROLE_CHECK_ACCOUNTS = [{ employeeNo: '20203486', name: '严翔', role: 'group-leader' }];

const SCORE_PLAN = {
  '20203176': { attendance: 5, learningShare: 5, innovation: 5, workAttitude: 8, workCapability: 4, objectiveTask: 9, custom: [28, 18, 9] },
  '1800054': { attendance: 5, learningShare: 5, innovation: 5, workAttitude: 8, workCapability: 4, objectiveTask: 9, custom: [28, 18, 9] },
  '20250003': { attendance: 5, learningShare: 4, innovation: 4, workAttitude: 7, workCapability: 4, objectiveTask: 8, custom: [26, 17, 8] },
  '20250317': { attendance: 5, learningShare: 4, innovation: 4, workAttitude: 8, workCapability: 4, objectiveTask: 9, custom: [26, 18, 8] },
  '20250286': { attendance: 5, learningShare: 5, innovation: 4, workAttitude: 8, workCapability: 4, objectiveTask: 9, custom: [27, 18, 8] },
  '20245105': { attendance: 4, learningShare: 4, innovation: 4, workAttitude: 8, workCapability: 4, objectiveTask: 8, custom: [26, 18, 9] },
  '1800189': { attendance: 5, learningShare: 5, innovation: 4, workAttitude: 8, workCapability: 4, objectiveTask: 9, custom: [27, 18, 9] },
  '20250801': { attendance: 5, learningShare: 4, innovation: 4, workAttitude: 8, workCapability: 4, objectiveTask: 8, custom: [27, 18, 9] },
  '20250802': { attendance: 4, learningShare: 4, innovation: 4, workAttitude: 8, workCapability: 4, objectiveTask: 8, custom: [26, 18, 8] },
  '1800470': { attendance: 5, learningShare: 5, innovation: 4, workAttitude: 8, workCapability: 4, objectiveTask: 8, custom: [26, 19, 9] },
  '1801448': { attendance: 4, learningShare: 4, innovation: 4, workAttitude: 7, workCapability: 4, objectiveTask: 8, custom: [26, 18, 9] },
  '20203491': { attendance: 4, learningShare: 4, innovation: 4, workAttitude: 7, workCapability: 3, objectiveTask: 8, custom: [25, 18, 9] }
};

const CUSTOM_GOAL_TEMPLATE = {
  nameSuffix: '2026年一季度重点工作推进',
  description: '围绕季度重点项目推进、过程文档沉淀和跨部门协同闭环形成自建目标，用于本轮真实数据联调测试。',
  keyResults: [
    {
      code: 'KR1',
      name: '完成季度重点任务交付',
      description: '输出季度重点事项的交付物、台账与过程纪要。',
      points: 30,
      scoreType: 'objective'
    },
    {
      code: 'KR2',
      name: '沉淀业务文档与方案材料',
      description: '形成关键方案、制度或知识材料并补齐说明。',
      points: 20,
      scoreType: 'objective'
    },
    {
      code: 'KR3',
      name: '推进协同事项闭环',
      description: '对跨科室协同事项形成闭环记录并完成复盘。',
      points: 10,
      scoreType: 'objective'
    }
  ]
};

process.env.DATABASE_URL = DATABASE_URL;

const prisma = new PrismaClient();

main()
  .then(async (results) => {
    await fs.writeFile(RESULTS_PATH, JSON.stringify(results, null, 2), 'utf8');
    console.log(JSON.stringify({ ok: true, resultsPath: RESULTS_PATH }, null, 2));
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });

async function main() {
  await assertFilesExist(FILE_POOL);

  const admin = await login('sysadmin.local', TEST_PASSWORD);
  const bootstrap = await apiJson('/admin/org/bootstrap', { cookie: admin.cookie });
  const bootstrapMaps = buildBootstrapMaps(bootstrap);
  const participants = PARTICIPANTS.map((entry) => resolveAccount(bootstrapMaps, entry.employeeNo));
  const sectionLeaders = SECTION_LEADERS.map((entry) => resolveAccount(bootstrapMaps, entry.employeeNo));
  const extraAccounts = EXTRA_ROLE_CHECK_ACCOUNTS.map((entry) => ({
    ...resolveAccount(bootstrapMaps, entry.employeeNo),
    role: entry.role
  }));

  await resetSelectedQuarterData(participants);
  await enableKnownPasswords([...participants, ...sectionLeaders, ...extraAccounts]);
  const exclusionSummary = await configureQuarterParticipants(admin.cookie, bootstrapMaps, participants);

  const preparation = [];
  for (const participant of participants) {
    const session = await login(participant.loginName, TEST_PASSWORD);
    await importQuarterTemplates(session.cookie);
    const customGoal = await createCustomGoal(session.cookie, participant);
    const okr = await apiJson(`/employee/okr?year=${YEAR}&quarter=${QUARTER}`, { cookie: session.cookie });
    const goalDetails = [];
    for (const goal of okr.goals) {
      const detail = await apiJson(`/employee/goals/${goal.id}`, { cookie: session.cookie });
      await uploadProofsForGoal(session.cookie, participant, detail);
      goalDetails.push(await apiJson(`/employee/goals/${goal.id}`, { cookie: session.cookie }));
    }

    preparation.push({
      participant: slimUser(participant),
      customGoalId: customGoal.id,
      goalCount: goalDetails.length,
      goals: goalDetails.map((goal) => ({
        id: goal.id,
        code: goal.code,
        name: goal.name,
        status: goal.status,
        totalPoints: goal.totalPoints,
        proofCount: goal.proofCount,
        keyResultCount: goal.keyResultCount
      }))
    });
  }

  const transitionResults = [];
  for (const participant of participants) {
    const payload = await apiJson('/admin/goal-status-control/transition', {
      cookie: admin.cookie,
      method: 'POST',
      body: {
        year: YEAR,
        quarter: QUARTER,
        userId: participant.userId,
        targetStatus: 'pending-review'
      }
    });
    transitionResults.push({
      user: slimUser(participant),
      affectedGoalCount: payload.affectedGoalCount,
      autoAdvancedGoalCount: payload.autoAdvancedGoalCount
    });
  }

  const preScoreVisibility = await verifyPreScoreVisibility(participants[0]);
  const subjectiveIsolation = await verifySubjectiveIsolation(sectionLeaders, extraAccounts[0]);

  const scoringSessions = await createSectionLeaderSessions(sectionLeaders);
  const quarterPlan = await buildQuarterPlan(participants);

  const partialScoring = await scoreParticipant(scoringSessions, quarterPlan, '20250286');
  const visibilityAfterPartial = await verifyPreScoreVisibility(participants[0]);

  for (const participant of participants) {
    if (participant.employeeNo === '20250286') {
      continue;
    }
    await scoreParticipant(scoringSessions, quarterPlan, participant.employeeNo);
  }

  const finalVisibility = await verifyPostScoreVisibility(participants[0]);
  const rankingBeforeResolve = await verifyRankingTie(admin.cookie, bootstrapMaps, quarterPlan);
  const tieBreakResolution = await resolveTieBreak(admin.cookie, rankingBeforeResolve);
  const rankingAfterResolve = await apiJson(
    `/leader/ranking?year=${YEAR}&quarter=${QUARTER}&reviewGroupId=${bootstrapMaps.reviewGroupsByName.get('信息化组').id}`,
    { cookie: admin.cookie }
  );

  const previewChecks = await collectPreviewChecks(participants[0]);

  return {
    executedAt: new Date().toISOString(),
    configuration: {
      year: YEAR,
      quarter: QUARTER,
      participantCount: participants.length,
      participantEmployeeNos: participants.map((entry) => entry.employeeNo),
      sectionLeaderEmployeeNos: sectionLeaders.map((entry) => entry.employeeNo)
    },
    exclusionSummary,
    preparation,
    transitionResults,
    preScoreVisibility,
    subjectiveIsolation,
    partialScoring,
    visibilityAfterPartial,
    finalVisibility,
    rankingBeforeResolve,
    tieBreakResolution,
    rankingAfterResolve: {
      scoresVisible: rankingAfterResolve.scoresVisible,
      pendingTieGroups: rankingAfterResolve.pendingTieGroups.length,
      ranking: rankingAfterResolve.ranking.slice(0, 5).map((entry) => ({
        employeeName: entry.employeeName,
        quarterScore: entry.quarterScore,
        currentGrade: entry.currentGrade,
        tieBreakStatus: entry.tieBreakStatus
      }))
    },
    previewChecks
  };
}

async function assertFilesExist(filePaths) {
  for (const filePath of filePaths) {
    await fs.access(filePath);
  }
}

async function login(loginName, password) {
  const response = await fetch(`${API_BASE}/auth/manual-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ loginName, password })
  });
  if (!response.ok) {
    throw new Error(`login failed for ${loginName}: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  return {
    cookie: extractCookie(response.headers.get('set-cookie')),
    user: payload.user
  };
}

async function switchRole(cookie, role) {
  await apiJson('/auth/active-role', {
    cookie,
    method: 'POST',
    body: { role }
  });
}

async function apiJson(pathname, options = {}) {
  const response = await apiFetch(pathname, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {})
    },
    body:
      options.body && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options.body
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${pathname} failed: ${response.status} ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function apiFetch(pathname, options = {}) {
  return fetch(`${API_BASE}${pathname}`, {
    method: options.method ?? 'GET',
    headers: options.headers,
    body: options.body
  });
}

function extractCookie(setCookieValue) {
  if (!setCookieValue) {
    throw new Error('missing session cookie');
  }

  return setCookieValue.split(';')[0];
}

function buildBootstrapMaps(bootstrap) {
  return {
    usersById: new Map(bootstrap.users.map((entry) => [entry.id, entry])),
    usersByEmployeeNo: new Map(
      bootstrap.users.filter((entry) => entry.employeeNo).map((entry) => [String(entry.employeeNo), entry])
    ),
    localAccountsByUserId: new Map(bootstrap.localAccounts.map((entry) => [entry.userId, entry])),
    sectionsById: new Map(bootstrap.sections.map((entry) => [entry.id, entry])),
    reviewGroupsById: new Map(bootstrap.reviewGroups.map((entry) => [entry.id, entry])),
    reviewGroupsByName: new Map(bootstrap.reviewGroups.map((entry) => [entry.name, entry])),
    rolesByUserId: bootstrap.roleAssignments.reduce((map, assignment) => {
      if (!assignment.isEnabled) {
        return map;
      }
      const current = map.get(assignment.userId) ?? [];
      current.push(assignment);
      map.set(assignment.userId, current);
      return map;
    }, new Map())
  };
}

function resolveAccount(bootstrapMaps, employeeNo) {
  const user = bootstrapMaps.usersByEmployeeNo.get(String(employeeNo));
  if (!user) {
    throw new Error(`user not found for employeeNo=${employeeNo}`);
  }

  const localAccount = bootstrapMaps.localAccountsByUserId.get(user.id);
  if (!localAccount?.loginName) {
    throw new Error(`local account missing for employeeNo=${employeeNo}`);
  }

  const section = bootstrapMaps.sectionsById.get(user.sectionId);
  const reviewGroup = bootstrapMaps.reviewGroupsById.get(user.reviewGroupId);
  const roles = (bootstrapMaps.rolesByUserId.get(user.id) ?? []).map((entry) => entry.roleCode);

  return {
    userId: user.id,
    employeeNo: String(user.employeeNo),
    loginName: localAccount.loginName,
    name: user.name,
    sectionId: user.sectionId,
    sectionName: section?.name ?? null,
    reviewGroupId: user.reviewGroupId,
    reviewGroupName: reviewGroup?.name ?? null,
    roles
  };
}

function slimUser(user) {
  return {
    employeeNo: user.employeeNo,
    loginName: user.loginName,
    name: user.name,
    sectionName: user.sectionName,
    reviewGroupName: user.reviewGroupName,
    roles: user.roles
  };
}

async function resetSelectedQuarterData(participants) {
  const ownerUserIds = participants.map((entry) => entry.userId);
  const reviewGroupIds = Array.from(new Set(participants.map((entry) => entry.reviewGroupId).filter(Boolean)));
  const goals = await prisma.goal.findMany({
    where: {
      ownerUserId: { in: ownerUserIds },
      year: YEAR,
      quarter: QUARTER
    },
    include: {
      keyResults: {
        include: {
          proofs: true
        }
      }
    }
  });

  const storageKeys = goals.flatMap((goal) =>
    goal.keyResults.flatMap((keyResult) => keyResult.proofs.map((proof) => proof.fileUrl))
  );

  await prisma.rankingTieBreakDecision.deleteMany({
    where: {
      year: YEAR,
      quarter: QUARTER,
      reviewGroupId: {
        in: reviewGroupIds
      }
    }
  });

  if (goals.length > 0) {
    await prisma.goal.deleteMany({
      where: {
        id: {
          in: goals.map((goal) => goal.id)
        }
      }
    });
  }

  await Promise.all(
    Array.from(new Set(storageKeys)).map(async (storageKey) => {
      const absolutePath = path.resolve(SERVER_PROOF_ROOT, storageKey);
      try {
        await fs.rm(absolutePath, { force: true });
      } catch {
        return;
      }
    })
  );
}

async function enableKnownPasswords(accounts) {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  for (const account of accounts) {
    await prisma.localAccount.upsert({
      where: { userId: account.userId },
      update: {
        loginName: account.loginName,
        passwordHash,
        localLoginEnabled: true
      },
      create: {
        userId: account.userId,
        loginName: account.loginName,
        passwordHash,
        localLoginEnabled: true
      }
    });
  }
}

async function configureQuarterParticipants(adminCookie, bootstrapMaps, participants) {
  const participantIds = new Set(participants.map((entry) => entry.userId));
  const employeeRoleUserIds = Array.from(bootstrapMaps.rolesByUserId.entries())
    .filter(([, assignments]) => assignments.some((assignment) => assignment.roleCode === 'employee'))
    .map(([userId]) => userId);

  const excludedUserIds = employeeRoleUserIds.filter((userId) => !participantIds.has(userId));
  const result = await apiJson('/admin/quarter-participation-exclusions', {
    cookie: adminCookie,
    method: 'PUT',
    body: {
      year: YEAR,
      quarter: QUARTER,
      userIds: excludedUserIds
    }
  });

  return {
    participantCount: participants.length,
    excludedCount: result.records.length,
    participantEmployeeNos: participants.map((entry) => entry.employeeNo)
  };
}

async function importQuarterTemplates(cookie) {
  const templateResponse = await apiJson(`/employee/goal-templates?year=${YEAR}&quarter=${QUARTER}`, { cookie });
  if (!templateResponse.templates.length) {
    throw new Error('no templates available');
  }

  const templateIds = templateResponse.templates.map((entry) => entry.id);
  await apiJson('/employee/goal-templates/import', {
    cookie,
    method: 'POST',
    body: {
      year: YEAR,
      quarter: QUARTER,
      templateIds
    }
  });
}

async function createCustomGoal(cookie, participant) {
  return apiJson('/employee/goals', {
    cookie,
    method: 'POST',
    body: {
      year: YEAR,
      quarter: QUARTER,
      name: `${participant.name}${CUSTOM_GOAL_TEMPLATE.nameSuffix}`,
      description: CUSTOM_GOAL_TEMPLATE.description,
      keyResults: CUSTOM_GOAL_TEMPLATE.keyResults
    }
  });
}

async function uploadProofsForGoal(cookie, participant, goalDetail) {
  const goalFileOffsets = resolveGoalFileOffsets(goalDetail.name);

  for (const [index, keyResult] of goalDetail.keyResults.entries()) {
    const filePath = FILE_POOL[goalFileOffsets[index] % FILE_POOL.length];
    const fileBuffer = await fs.readFile(filePath);
    const fileName = path.basename(filePath);
    const file = new File([fileBuffer], fileName);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('note', `${participant.name} / ${goalDetail.code} / ${keyResult.code} / ${fileName}`);

    await apiJson(`/employee/key-results/${keyResult.id}/proofs`, {
      cookie,
      method: 'POST',
      body: formData
    });
  }
}

function resolveGoalFileOffsets(goalName) {
  if (goalName === '工作态度与能力') {
    return [0, 1, 2, 3, 4];
  }

  if (goalName === '目标任务综合评价') {
    return [5];
  }

  return [6, 7, 1];
}

async function verifyPreScoreVisibility(participant) {
  const session = await login(participant.loginName, TEST_PASSWORD);
  const allOkr = await apiJson(`/leader/all-okr?year=${YEAR}&quarter=${QUARTER}`, {
    cookie: session.cookie
  });
  return {
    scoresVisible: allOkr.scoresVisible,
    employeeCount: allOkr.employees.length,
    rankingPreview: allOkr.employees.map((entry) => ({
      employeeName: entry.name,
      quarterScore: entry.quarterScore,
      goalCount: entry.goalCount
    }))
  };
}

async function verifyPostScoreVisibility(participant) {
  const session = await login(participant.loginName, TEST_PASSWORD);
  const allOkr = await apiJson(`/leader/all-okr?year=${YEAR}&quarter=${QUARTER}`, {
    cookie: session.cookie
  });
  return {
    scoresVisible: allOkr.scoresVisible,
    employeeCount: allOkr.employees.length,
    rankingPreview: allOkr.employees.map((entry) => ({
      employeeName: entry.name,
      quarterScore: entry.quarterScore,
      goalCount: entry.goalCount,
      status: entry.status
    }))
  };
}

async function verifySubjectiveIsolation(sectionLeaders, extraAccount) {
  const sectionResults = {};

  for (const leader of sectionLeaders) {
    const session = await login(leader.loginName, TEST_PASSWORD);
    await switchRole(session.cookie, 'section-leader');
    const workbench = await apiJson(`/leader/workbench?year=${YEAR}&quarter=${QUARTER}&scoreType=subjective`, {
      cookie: session.cookie
    });
    sectionResults[leader.sectionName] = {
      leaderName: leader.name,
      employeeNames: workbench.employees.map((entry) => entry.name),
      employeeSections: [...new Set(workbench.employees.map((entry) => entry.sectionName))]
    };
  }

  const groupLeaderSession = await login(extraAccount.loginName, TEST_PASSWORD);
  await switchRole(groupLeaderSession.cookie, extraAccount.role);
  const groupLeaderSubjective = await apiJson(`/leader/workbench?year=${YEAR}&quarter=${QUARTER}&scoreType=subjective`, {
    cookie: groupLeaderSession.cookie
  });

  return {
    sectionLeaderViews: sectionResults,
    groupLeaderSubjective: {
      leaderName: extraAccount.name,
      employeeCount: groupLeaderSubjective.employees.length
    }
  };
}

async function createSectionLeaderSessions(sectionLeaders) {
  const sessions = new Map();
  for (const leader of sectionLeaders) {
    const session = await login(leader.loginName, TEST_PASSWORD);
    await switchRole(session.cookie, 'section-leader');
    sessions.set(leader.sectionName, {
      ...session,
      leader
    });
  }
  return sessions;
}

async function buildQuarterPlan(participants) {
  const ownerUserIds = participants.map((entry) => entry.userId);
  const goals = await prisma.goal.findMany({
    where: {
      ownerUserId: { in: ownerUserIds },
      year: YEAR,
      quarter: QUARTER
    },
    include: {
      owner: {
        include: {
          section: true,
          reviewGroup: true
        }
      },
      importedTemplates: true,
      keyResults: {
        include: {
          proofs: true
        },
        orderBy: {
          code: 'asc'
        }
      }
    },
    orderBy: [{ ownerUserId: 'asc' }, { code: 'asc' }]
  });

  const byEmployeeNo = new Map();
  for (const goal of goals) {
    const employeeNo = String(goal.owner.employeeNo);
    const current = byEmployeeNo.get(employeeNo) ?? {
      employeeNo,
      employeeName: goal.owner.name,
      userId: goal.owner.id,
      sectionName: goal.owner.section?.name ?? null,
      reviewGroupName: goal.owner.reviewGroup?.name ?? null,
      goals: []
    };

    current.goals.push({
      id: goal.id,
      code: goal.code,
      name: goal.name,
      status: goal.status,
      isTemplateGoal: goal.importedTemplates.length > 0,
      keyResults: goal.keyResults.map((keyResult) => ({
        id: keyResult.id,
        code: keyResult.code,
        name: keyResult.name,
        scoreType: keyResult.scoreType,
        points: keyResult.points,
        proofCount: keyResult.proofs.length
      }))
    });
    byEmployeeNo.set(employeeNo, current);
  }
  return byEmployeeNo;
}

async function scoreParticipant(scoringSessions, quarterPlan, employeeNo) {
  const employeePlan = quarterPlan.get(employeeNo);
  if (!employeePlan) {
    throw new Error(`missing quarter plan for employeeNo=${employeeNo}`);
  }

  const leaderSession = scoringSessions.get(employeePlan.sectionName);
  if (!leaderSession) {
    throw new Error(`missing section leader session for section=${employeePlan.sectionName}`);
  }

  const plan = SCORE_PLAN[employeeNo];
  if (!plan) {
    throw new Error(`missing score plan for employeeNo=${employeeNo}`);
  }

  const scoreOperations = [];

  for (const goal of employeePlan.goals) {
    if (goal.name === '工作态度与能力') {
      for (const keyResult of goal.keyResults) {
        scoreOperations.push({
          keyResultId: keyResult.id,
          keyResultName: keyResult.name,
          score: resolveTemplateScore(plan, keyResult.name)
        });
      }
      continue;
    }

    if (goal.name === '目标任务综合评价') {
      scoreOperations.push({
        keyResultId: goal.keyResults[0].id,
        keyResultName: goal.keyResults[0].name,
        score: plan.objectiveTask
      });
      continue;
    }

    goal.keyResults.forEach((keyResult, index) => {
      scoreOperations.push({
        keyResultId: keyResult.id,
        keyResultName: keyResult.name,
        score: plan.custom[index]
      });
    });
  }

  for (const operation of scoreOperations) {
    await apiJson(`/leader/key-results/${operation.keyResultId}/score`, {
      cookie: leaderSession.cookie,
      method: 'PUT',
      body: {
        score: operation.score,
        comment: `${leaderSession.leader.name} 对 ${employeePlan.employeeName} 的联调评分`
      }
    });
  }

  return {
    employeeNo,
    employeeName: employeePlan.employeeName,
    leaderName: leaderSession.leader.name,
    operationCount: scoreOperations.length
  };
}

function resolveTemplateScore(plan, keyResultName) {
  switch (keyResultName) {
    case '活动与会议、5S管理出勤':
      return plan.attendance;
    case '学习分享':
      return plan.learningShare;
    case '创新能力':
      return plan.innovation;
    case '工作态度表现':
      return plan.workAttitude;
    case '工作能力表现':
      return plan.workCapability;
    case '目标任务综合评价':
      return plan.objectiveTask;
    default:
      throw new Error(`unknown template key result name: ${keyResultName}`);
  }
}

async function verifyRankingTie(adminCookie, bootstrapMaps, quarterPlan) {
  const infoGroupId = bootstrapMaps.reviewGroupsByName.get('信息化组').id;
  const ranking = await apiJson(`/leader/ranking?year=${YEAR}&quarter=${QUARTER}&reviewGroupId=${infoGroupId}`, {
    cookie: adminCookie
  });

  const tieGroup = ranking.pendingTieGroups[0] ?? null;
  return {
    scoresVisible: ranking.scoresVisible,
    reviewGroupId: infoGroupId,
    ranking: ranking.ranking.map((entry) => ({
      employeeName: entry.employeeName,
      quarterScore: entry.quarterScore,
      currentGrade: entry.currentGrade,
      tieBreakStatus: entry.tieBreakStatus
    })),
    pendingTieGroups: ranking.pendingTieGroups.map((group) => ({
      groupKey: group.groupKey,
      rankStart: group.rankStart,
      rankEnd: group.rankEnd,
      affectedGradeCodes: group.affectedGradeCodes,
      employees: group.employees.map((entry) => ({
        employeeId: entry.employeeId,
        employeeName: entry.employeeName,
        quarterScore: entry.quarterScore,
        currentGrade: entry.currentGrade,
        tieBreakMetrics: entry.tieBreakMetrics
        }))
    })),
    expectedTieEmployees: tieGroup ? tieGroup.employees.map((entry) => entry.employeeName) : []
  };
}

async function resolveTieBreak(adminCookie, rankingBeforeResolve) {
  const tieGroup = rankingBeforeResolve.pendingTieGroups[0];
  if (!tieGroup) {
    throw new Error('expected pending tie group for ranking test');
  }

  const preferredOrder = [...tieGroup.employees]
    .sort((left, right) => left.employeeName.localeCompare(right.employeeName, 'zh-CN'))
    .map((entry) => entry.employeeId);

  await apiJson('/leader/ranking/tie-breaks', {
    cookie: adminCookie,
    method: 'POST',
    body: {
      year: YEAR,
      quarter: QUARTER,
      reviewGroupId: rankingBeforeResolve.reviewGroupId,
      groupKey: tieGroup.groupKey,
      orderedEmployeeIds: preferredOrder
    }
  });

  return {
    groupKey: tieGroup.groupKey,
    orderedEmployeeIds: preferredOrder
  };
}

async function collectPreviewChecks(participant) {
  const session = await login(participant.loginName, TEST_PASSWORD);
  const okr = await apiJson(`/employee/okr?year=${YEAR}&quarter=${QUARTER}`, { cookie: session.cookie });
  const details = [];
  for (const goal of okr.goals) {
    details.push(await apiJson(`/employee/goals/${goal.id}`, { cookie: session.cookie }));
  }

  const proofCandidates = new Map();
  for (const goal of details) {
    for (const keyResult of goal.keyResults) {
      for (const proof of keyResult.proofs) {
        const extension = path.extname(proof.fileName).toLowerCase();
        if (!proofCandidates.has(extension)) {
          proofCandidates.set(extension, proof);
        }
      }
    }
  }

  const targetExtensions = ['.xls', '.xlsx', '.pptx', '.docx', '.pdf'];
  const checks = [];
  for (const extension of targetExtensions) {
    const proof = proofCandidates.get(extension);
    if (!proof) {
      continue;
    }
    const previewMeta = await apiJson(`/employee/proofs/${proof.id}/preview-meta`, {
      cookie: session.cookie
    });
    const targetResponse = await fetch(previewMeta.targetUrl, {
      redirect: 'manual'
    });
    checks.push({
      proofId: proof.id,
      fileName: proof.fileName,
      extension,
      mode: previewMeta.mode,
      targetUrl: previewMeta.targetUrl,
      fallbackUrl: previewMeta.fallbackUrl,
      downloadUrl: previewMeta.downloadUrl,
      targetStatus: targetResponse.status
    });
  }

  return checks;
}

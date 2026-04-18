export const CURRENT_DEMO_LOGIN = {
  sysadmin: {
    loginName: 'sysadmin.local',
    password: 'Admin123!'
  },
  multiRole: {
    loginName: '1700066',
    password: 'Admin123!'
  }
} as const;

export const CURRENT_DEMO_EMPLOYEES = {
  employeeLeader: {
    employeeNo: '1700066',
    name: '陈美果',
    positionName: '负责人',
    sectionName: '数字业务中心',
    reviewGroupName: '信息化组',
    quarterOneScore: 58,
    annualScore: 130
  },
  topRankEmployee: {
    name: '杨增禄',
    quarterOneScore: 92,
    annualScore: 364,
    quarterScores: [
      { quarter: 1, score: 92 },
      { quarter: 2, score: 88 },
      { quarter: 3, score: 90 },
      { quarter: 4, score: 94 }
    ]
  },
  secondRankEmployee: {
    name: '蒲雪映',
    quarterOneScore: 81,
    annualScore: 323,
    quarterScores: [
      { quarter: 1, score: 81 },
      { quarter: 2, score: 79 },
      { quarter: 3, score: 83 },
      { quarter: 4, score: 80 }
    ]
  },
  outOfScopeEmployee: {
    name: '潘红',
    quarterOneScore: 66,
    annualScore: 66
  }
} as const;

export const CURRENT_DEMO_REVIEW_GROUPS = {
  primary: '信息化组',
  newHire: '新员工组',
  operations: '运营组'
} as const;

export const CURRENT_DEMO_GOALS = {
  employeeQuarterOnePrimary: {
    code: 'O1',
    name: '陈美果 2026 年一季度重点项目推进'
  },
  employeeQuarterOneSecondary: {
    code: 'O2',
    name: '陈美果 一季度知识资产补充'
  }
} as const;

export const CURRENT_DEMO_PUBLIC_NOTICE = {
  quarterlyTitle: '数字科技管理事业部一般员工2026年一季度绩效考评结果表',
  annualTitle: '数字科技管理事业部一般员工2026年年度绩效考评结果表'
} as const;

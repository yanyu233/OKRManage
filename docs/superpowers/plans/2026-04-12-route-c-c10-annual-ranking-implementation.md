# Route C C10 年度评分排名实施计划

1. 先写失败测试
   - 后端年度排名 e2e
   - 前端 helper/page 测试

2. 后端实现
   - 扩展 leader repository/service/controller
   - 新增年度排名 DTO/类型
   - MySQL 聚合全年四季度得分

3. 前端实现
   - 新增负责人菜单项与路由
   - 新增年度评分排名页
   - 新增 API、类型、helper

4. 验证
   - `apps/server`: `npm run test:e2e`
   - `apps/web`: `npm run test`
   - `apps/web`: `npm run build`

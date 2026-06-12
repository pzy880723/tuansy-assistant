原因已定位：前端和函数已经改成“可多条启用”，但数据库里还残留一个唯一约束 `copy_logics_one_active_per_user`，它仍然强制每个用户只能有一条 `is_active=true`，所以启用第二条时写入被拦截。

实施计划：
1. 新增一条数据库迁移，删除 `copy_logics_one_active_per_user` 唯一约束/唯一索引。
2. 保留现有 `is_active` 字段语义：从“唯一激活”改为“启用/停用”，允许同一用户多条为 true。
3. 不改表结构、不改权限策略、不影响已有文案逻辑内容。
4. 验证启用接口不再返回 duplicate key 错误，前端可显示多条“已启用”。

技术细节：
- 迁移会用安全的 `DROP INDEX IF EXISTS` / 约束删除方式处理，避免不同数据库对象类型导致失败。
- 前端 `settings.tsx` 和 `copy-logics.functions.ts` 当前逻辑已经符合“多条启用”，无需大改。
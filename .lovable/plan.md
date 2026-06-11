## 调整

**文件**: `src/components/tuan/IntroTab.tsx`

1. **标题字号缩小**（第 316 行）
   - 当前：`text-[18px] font-bold`（编辑态太大）
   - 改为：`text-[15px] font-semibold`，更贴近移动端编辑场景

2. **文字块去固定高度**（第 469-475 行的 `AutoTextarea`）
   - 移除 `min-h-[60px]`，保留自动撑高逻辑（`scrollHeight` 已实现无限换行）
   - 确保 `whitespace-pre-wrap` 在展示态生效（第 481 行已有），换行符不被吞
   - 同步检查标题 `AutoTextarea` 也无 min-h 限制（确认无）

3. **不改动**
   - AutoTextarea 自身的自动撑高机制（已正确）
   - 其他媒体块布局、AI 对话、数据结构

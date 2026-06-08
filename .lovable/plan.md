## 问题
`ResizablePanelGroup` 缺少 `direction="horizontal"` 属性，导致默认按垂直方向布局，左侧对话框被挤成一条窄缝。

## 修复
在 `src/routes/app.project.$id.tsx` 第 132 行：

```tsx
<ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
  <ResizablePanel defaultSize={38} minSize={20} maxSize={75}>
    <ChatPane ... />
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={62} minSize={25}>
    <PreviewPane ... />
  </ResizablePanel>
</ResizablePanelGroup>
```

同时把拖拽范围放宽（左侧 20%–75%），更接近之前的尺寸观感。
## 目标

团宝在想/在写时：
1. 发送按钮变成「停止」按钮，点一下立刻打断
2. 输入框依然可用，回车进入排队（不阻塞）
3. 团宝结束当前回合后，自动从队列里取下一条发出去
4. 队列里的消息可单独「立即插队」——打断当前回合并马上发这条

## 改动文件

仅前端，集中在 `src/routes/app.project.$id.tsx`，外加服务端一行 `abortSignal` 接入 `src/routes/api/chat.ts`。

## 1. 服务端：把 abort 信号透传给模型

`src/routes/api/chat.ts` 第 216 行的 `streamText({...})` 增加一行：

```ts
abortSignal: request.signal,
```

否则点停止只是前端断流，后端会继续烧 token。

## 2. 前端：解构 stop、加队列状态

在 `useChat` 解构里加 `stop`：

```ts
const { messages, sendMessage, setMessages, regenerate, status, error, stop } = useChat({...});
```

新增队列 state：

```ts
type QueuedMsg = { id: string; text: string; files: ReadyFile[]; planMode: boolean };
const [queue, setQueue] = useState<QueuedMsg[]>([]);
const queueRef = useRef(queue);
useEffect(() => { queueRef.current = queue; }, [queue]);
```

## 3. sendText 行为分叉

改造 `sendText(text)`：
- 校验空内容、上传中维持原样
- 若 `isLoading`：把这条 push 进 `queue`，清空输入框/附件，toast「已加入队列」，**不调用** `sendMessage`
- 若空闲：保持现有行为（写 history snapshot + sendMessage）

新增内部函数 `dispatch(msg: QueuedMsg)`：把现在 sendText 里"组装 parts → sendMessage → 写 history"那一段抽出来复用，给队列消费用。

## 4. 队列自动消费

新增 effect：当 `status === "ready"` 且队列非空时，shift 出队首调用 `dispatch`：

```ts
useEffect(() => {
  if (status !== "ready") return;
  if (queue.length === 0) return;
  const [next, ...rest] = queue;
  setQueue(rest);
  dispatch(next);
}, [status, queue]);
```

注意：bootedRef 的 seed 自动 regenerate 逻辑保持原状，但加一句 `if (queue.length > 0) return;`，避免冲突。

## 5. 停止按钮 / 发送按钮切换

输入框右下角原来的「发送」按钮根据 `isLoading` 切换：

- 空闲：原样（橙色 Send）
- `submitted` / `streaming`：变成方形 Stop 图标（`Square` from lucide-react），点击 `stop()`；样式保持高对比但用次要色，提示「停止团宝」

textarea 的 `disabled={isLoading}` 去掉，改为始终可输入；placeholder 在 `isLoading` 时切到「团宝在写，回车可加入队列…」。Enter 行为不变（调 `send`，由 sendText 内部决定是排队还是立刻发）。

## 6. 队列 UI（输入框上方）

`isLoading` 或 `queue.length > 0` 时，在输入框上方（建议放在 suggestions 上面）渲染一条小条：

```
排队中 (N)
[1] 把价格改成 39.9…    [插队] [×]
[2] 加一个试吃装…        [插队] [×]
```

- 每行：序号、文字预览（截断 30 字，若有图加 📎N）、「插队」按钮（`SkipForward` 图标）、「移除」按钮（X）
- 「插队」：从队列移除该项 → 调 `stop()` → 把该项暂存到 `pendingJumpRef`，并在 status 回到 ready 的 effect 里优先 dispatch 它（先于队列正常消费）
- 「移除」：从队列里删掉

## 7. 验收

1. 团宝在想/写时，发送键变成方形停止键，点了立刻停（前端停 + 后端 streamText 接到 abort）
2. 在想/写时输入新内容回车：被加到下方队列条，输入框清空，团宝继续当前回合
3. 当前回合完成后，队列首条自动发出去，UI 队列条少一行
4. 队列里点「插队」：当前回合被打断，被点的那条立刻发出去，其余排队条保留顺序
5. 队列里点「×」：该条消失，不发送
6. 没有图片附件丢失：排队时附件随消息一起入队列（捕获当时的 `getReadyFiles()` 快照，并清空 `img`）

## 不动的部分

- 计划模式逻辑、history 快照、seed 自动 regenerate、suggestions、错误展示
- 服务端除了一行 `abortSignal` 不动
- `intro/skus/settings` 数据流不变

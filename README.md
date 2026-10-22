# 延河课堂 · 课程解锁器（Edge / Chrome 扩展）

在弹窗里浏览**全部课程**、列出**全部节次**、直接播放**无权限课程**的视频。

## 安装

1. 打开 `edge://extensions/`（Chrome 用 `chrome://extensions/`）
2. 打开右下角「开发人员模式」
3. 点「加载解压缩的扩展」，选择本目录 `yanhekt-unlock`
4. 先登录 <https://www.yanhekt.cn>，再点扩展图标

## 功能

| 标签页 | 作用 |
|---|---|
| 全部课程 | 搜索 / 翻页浏览全站课程（3815 门），点「解锁节次」查看该课程全部节次 |
| 节次列表 | 列出该课程所有节次（含无权限部分），点「▶ 播放」直接播放 |
| 直接播放 | 输入课程 ID 快速载入 |

每个节次另有「复制播放直链」，可粘贴到 PotPlayer / VLC / IDM 下载。

## 工作原理

```
1. 全量课程      GET /v1/course/list                      —— 不做账号过滤
2. 全量节次      GET /v1/course/session/list?course_id=   —— 不做权限过滤（v2 才过滤）
3. 签发播放凭证  GET /v1/auth/video/token?id=<video_id>   —— 只验登录态，不验课程权限
4. 组装播放地址
     path/Video1/Video1.m3u8
       → path/Video1/f4ff94d1bc715b077e1ebe03493799fd/Video1.m3u8
     ?Xvideo_Token=<token>
     &Xclient_Timestamp=<秒级时间戳>
     &Xclient_Signature=md5("1138b69dfef641d9d7ba49137d2d4875" + "_v1_" + ts)
     &Xclient_Version=v1&Platform=yhkt_user
5. hls.js 播放（自动从 CDN 载入并缓存）
```

### 三个关键常量

| 名称 | 值 | 说明 |
|---|---|---|
| xclient 签名密钥 | `1138b69dfef641d9d7ba49137d2d4875` | 前端硬编码，用于证明请求来自官方客户端 |
| 视频路径段 | `f4ff94d1bc715b077e1ebe03493799fd` | cvideo 播放路径的固定目录段 |

时间戳为秒级，签名窗口很短；若长时间挂起后播放失败，重新点一次「播放」即可。

## 文件说明

| 文件 | 运行环境 | 作用 |
|---|---|---|
| `manifest.json` | — | MV3 配置 |
| `inject.js` | MAIN world | 拦截 permission 强制放行、组装播放地址、hls.js 播放器 |
| `hook.js` | ISOLATED world | 在页面与扩展存储之间传递开关状态 |
| `popup.html/js` | 弹窗 | 课程 / 节次浏览与播放入口 |
| `background.js` | Service Worker | 初始化默认开关 |

## 注意

- 播放凭证 `Xvideo_Token` 有效期约 10 分钟，过期重新获取即可。
- cvideo 要求请求携带 `Origin: https://www.yanhekt.cn`，所以播放器必须跑在页面内（`inject.js`），不能在弹窗里直接播放。
- hls.js 首次使用需联网从 jsDelivr / unpkg 加载；之后会复用已注入实例。
- 页面内的「关闭」按钮可随时退出播放器。

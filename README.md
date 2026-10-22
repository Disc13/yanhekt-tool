# 延河课堂 · 课程解锁器

把课程搜索和节次目录放到浏览器里，播放继续使用延河课堂原站的双屏播放器。

**适用：桌面版 Microsoft Edge / Google Chrome。无需 Python、Node.js 或命令行。**

[下载源码 ZIP](https://github.com/Disc13/yanhekt-unlock/archive/refs/heads/master.zip) · [反馈问题](https://github.com/Disc13/yanhekt-unlock/issues)

> 非官方学习辅助工具，与延河课堂及学校无隶属关系。请仅访问自己有权观看的课程，遵守平台规则与课程资料的使用约定。

## 能做什么

- 在原站课程页适配课程与节次目录。
- 在扩展弹窗里搜索课程、查看节次，或按课程 ID 查找。
- 点击“打开课程页”“打开原站课时”，继续使用原站播放器。
- 随时关闭扩展功能；已保存的开关状态会保留。

本项目是浏览器扩展。本地录像下载、离线双屏播放请看独立项目 [yanhekt-local](https://github.com/Disc13/yanhekt-local)。

## 安装：四步完成

### 1. 下载并解压

点击上方“下载源码 ZIP”，或在仓库首页选择 **Code → Download ZIP**，然后解压。

找到包含 `manifest.json` 的文件夹，通常叫 `yanhekt-unlock-master`。后面加载的是这个文件夹，不是 ZIP 文件，也不是单个 `manifest.json`。

### 2. 打开扩展管理页

将对应地址复制到浏览器地址栏并回车：

| 浏览器 | 地址 |
| --- | --- |
| Microsoft Edge | `edge://extensions` |
| Google Chrome | `chrome://extensions` |

打开页面上的 **开发人员模式 / Developer mode**。

### 3. 加载文件夹

点击 **加载解压缩的扩展 / Load unpacked**，选择第 1 步找到的文件夹。

看到“延河课堂 · 课程解锁器”卡片后，确认扩展已启用。可以在浏览器工具栏的扩展菜单里固定它，方便下次打开。

### 4. 登录原站并刷新

打开 [延河课堂](https://www.yanhekt.cn)，正常登录，再刷新页面。

打开一个课程页使用原站目录，或点击工具栏里的扩展图标搜索课程。登录只在原站完成，无需向扩展填写账号密码，也无需手动复制登录 Token。

## 怎么用

- **浏览课程**：在弹窗搜索课程，点“打开课程页”。
- **查看节次**：点“解锁节次”，再点“打开原站课时”。
- **按 ID 查找**：从原站课程页 `/course/12345` 取出数字，填入“按 ID 查看”。这里要填课程 ID，不是 `/session/` 后面的课时 ID。
- **关闭功能**：关闭弹窗右上角开关。若要还原页面先前显示的内容，再刷新原站页面。

播放在原站进行，保留原站的双屏体验；扩展不提供独立播放器或视频直链。

## 更新

1. 下载新版源码，将其解压到固定位置，更新已加载目录中的文件。
2. 回到扩展管理页，在扩展卡片上点击 **重新加载 / Reload**。
3. 刷新所有已打开的延河课堂页面。

**扩展重新加载和网页刷新，两步都要做。** 已加载的文件夹不要随意移动或删除。

## 常见问题

**找不到 `manifest.json`，或提示无法加载？**  
先确认 ZIP 已解压，再进入真正包含 `manifest.json` 的那一层目录。部分浏览器会将 ZIP 外面再包一层文件夹。

**安装了，但页面或弹窗没有变化？**  
确认扩展已启用，原站已登录；重新加载扩展，再刷新原站页面。刚安装时已打开的旧页面也需要刷新。

**提示“页面脚本未就绪”或请求超时？**  
打开并登录 `www.yanhekt.cn`，刷新站点标签页后再试。学校网络、平台维护和接口变化都可能影响请求。

**目录为空，是否说明没有课程权限？**  
不一定。登录过期、课程无录像、平台规则或接口变化都可能产生空列表。扩展不能替你授予服务器端访问权限。

**手机、Firefox 可以用吗？**  
本文提供的是桌面 Edge / Chrome 的解压缩加载方式；不提供其他平台的安装保证。

## 权限与隐私

- `storage`：保存扩展开关。
- `tabs / activeTab`：查找已打开的站点标签页，以及打开课程、课时页面。
- `scripting`：为已打开的站点页面准备扩展脚本。
- 站点范围：`www.yanhekt.cn`、`cbiz.yanhekt.cn`。

扩展读取原站已有的登录状态，向原站接口请求课程与节次。当前代码没有开发者服务器或统计上报功能；也不加载远程播放引擎。请只从你信任的来源加载扩展。

## 反馈

在 [Issues](https://github.com/Disc13/yanhekt-unlock/issues) 中描述浏览器版本、操作步骤、预期结果和实际表现。截图请遮去姓名、学号等信息，**不要上传密码、Cookie、Token 或带临时凭证的地址**。

## 开发者

普通使用者不需要执行以下命令。修改代码后可用 Node.js 运行离线回归：

```sh
node --test tests/extension.test.cjs
```

测试不连接平台，不代表所有浏览器和课程均已通过实际播放验证。

安装方式参考 [Chrome 官方教程](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world) 与 [Edge 官方教程](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading)。

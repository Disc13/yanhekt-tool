# 第三方组件

## hls.js 1.5.13

- 上游：[video-dev/hls.js v1.5.13](https://github.com/video-dev/hls.js/tree/v1.5.13)
- 文件：`hls.min.js`，来自 `https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js`，保留上游构建产物，不做代码修改。
- SHA-256：`e5753b10fc65eae35f21883e684d22c43ce66de968d35166792585b9b8a3f1a2`
- 授权：Apache-2.0；上游版权与派生实现说明见 `hls.LICENSE`，完整许可见 `Apache-2.0.txt`。
- 扩展仅在用户点击单画面播放时，通过 `chrome.scripting` 注入本地打包文件；不运行时下载脚本。更新组件时同时核对上游版本、许可证、哈希与播放回归。

此说明不为本项目其他代码另行指定许可证。

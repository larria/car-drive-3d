# LARRIA · Larria的3d驾照考试练习场

Three.js + TypeScript + Vite + cannon-es 的本地交互汽车展示与低速驾驶网页。

## 启动

```sh
npm install
npm run dev -- --port 5173
```

打开 http://127.0.0.1:5173/car-drive-3d/ ，推荐桌面 Chrome / Edge 并启用硬件加速。模型与 Draco 解码器已本地化，运行时无需在线 CDN。

```sh
npm run build
npm run preview
npm test
# 先启动 dev server，本机需要 Chrome
npm run test:e2e
```

## 操作

- W / ↑：油门；S / ↓ / 空格：刹车。
- A / ←、D / →：转向，松手回正。
- 1：车外环绕；2：驾驶位；3：跟随。
- R：车辆复位。D/N/R 档使用界面按钮，切换前后方向需停车。
- 屏幕方向盘左右拖动；油门和刹车按钮可按住。
- 驾驶位拖动画面转头，双击回正。
- 右上三面实时后视窗口可点击放大，支持收起。
- 可更换五种车漆、切换灯光和高/流畅质量。

## 实现和范围

- 优先使用现成 Ferrari 458 Italia GLB，具有内饰、独立车轮、方向盘。实际模型为开放座舱运动轿跑，不是四门三厢家轿。
- 二次调整车漆与内饰材质，增加可动踏板、灯光响应、方向盘与车轮联动。
- cannon-es RaycastVehicle：重力、射线轮胎、悬架、驱动、制动、边界碰撞。为低速交互体验限制翻滚，非真实车型标定或驾考评分系统。
- 左右与中央后视视角使用独立实时后向镜像相机；左右保留车身边缘，中央使用后窗附近视点。显示在独立辅助窗口中，并非精确平面/凸面光学反射。原模型镜面不宣称已实现真实反射。
- 场地标线、锥桶、停车位、建筑、树木和灯杆为程序化模型。边界及主要实体障碍有碰撞，装饰物不全部参与物理。
- 速度是当前模拟值，不对应真实 Ferrari 性能。车内原模型仪表没有真实读数纹理，速度与档位在界面呈现。

## 模型来源及许可注意

- 模型：Ferrari 458 Italia，原作者 **vicent091036**。
- Three.js 官方示例：https://threejs.org/examples/webgl_materials_car.html
- 原模型：https://sketchfab.com/models/57bf6cc56931426e87494f554df1dab6
- 下载文件：https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/ferrari.glb
- Three.js 与 cannon-es 库采用 MIT 许可；这不等于其中第三方模型也自动适用 MIT。
- **本站发布者确认已有当前模型公开发布授权。此确认不代表模型以 MIT / CC0 授权给其他人；第三方再分发或商用须自行取得相应授权。**

## 验证

- TypeScript 检查与生产构建通过；大型 3D 引擎 bundle 会触发 Vite 500 kB 提示，不影响运行。
- 9 项物理单元测试：前后移动、转向、换档、刹车、复位和边界。
- Chrome 浏览器端到端测试：键盘前进、刹停、倒车、换档保护、视角、镜面放大、车漆以及窄屏布局。
- `check-browser.mjs` 生成车外与驾驶舱截图；截图位于 `artifacts/`。
- 内置浏览器截图接口在本次环境超时，独立 Chrome 截图与运行正常。Chrome 单次截图采样约 58–60 FPS，非所有设备性能承诺；内置浏览器可能明显较慢，可切换“流畅”质量或使用独立浏览器。

## PWA 与更新

- 支持安装到桌面；在 HTTPS 或 localhost 的生产构建中启用 Service Worker。
- 首次在线加载并完成缓存后，可离线打开，包括车型和 Draco 解码器。缓存不等于数据永久保存，浏览器仍可能回收空间。
- 页脚提供“安装应用”和“检查更新”。后台每 15 分钟及返回页面时检查更新。
- 发现新版本后提示，停车并确认才切换；不会在驾驶中强制刷新。iOS 使用 Safari 的“分享→添加到主屏幕”。
- `npm run build && npm run preview` 可本地检查 PWA；开发模式不注册生产 SW。
- `npx playwright test --config tests/pwa.config.mjs` 检查缓存/离线与更新保护。

## GitHub Pages

- 仓库：https://github.com/larria/car-drive-3d
- 站点：https://larria.github.io/car-drive-3d/
- 推送 main 后 GitHub Actions 自动测试、构建并部署；Pages Source 使用 GitHub Actions。
- 版本 tag 使用 `v1.0.0` 起的语义化版本；后续发布修改 package.json 版本并提交即可触发 SW 内容更新。

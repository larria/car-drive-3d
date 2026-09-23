# LARRIA · Larria的3d驾照考试练习场

Three.js + TypeScript + Vite + cannon-es 的本地科目二场地考试体验，首期开放直角转弯。

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
- Z → R 档，X → N 档，C → D 档；与界面按钮使用同一保护入口，不能经 N 绕过行驶方向切换保护。
- R：重新考试；Esc：暂停。
- 屏幕方向盘左右拖动；油门和刹车按钮可按住。
- 驾驶位在场景区域移动鼠标即可转头，无需按左键；触屏仍按下拖动，双击回正。悬停 UI 不转头。
- 项目选择 → 考前说明 → 默认驾驶座舱考试 → 结果；考试页隐藏无关设置。帮助、失焦和切后台暂停物理及判定，需显式继续。
- 驾驶座舱中三路后视画面嵌入模型实际镜面；车外视角保留右上辅助窗口，可点击放大或收起。
- 曲线行驶、侧方位停车、倒车入库、自由练习仅占位，暂不可进入。

## 实现和范围

- 优先使用现成 Ferrari 458 Italia GLB，具有内饰、独立车轮、方向盘。实际模型为开放座舱运动轿跑，不是四门三厢家轿。
- 二次调整车漆与内饰材质，增加可动踏板、灯光响应、方向盘与车轮联动。
- cannon-es RaycastVehicle：重力、射线轮胎、悬架、驱动、制动、边界碰撞。为低速交互体验限制翻滚，非真实车型标定；考试只判通过/失败，不虚构分数。
- 左右与中央后视视角使用独立实时后向镜像相机；左右保留车身边缘，中央使用后窗附近视点。座舱中映射到原模型镜面的真实三角形轮廓，车外显示辅助窗口。仍为后向镜像视频，不是精确平面/凸面光学反射。
- `src/vehicle-view-profile.ts` 定义通用眼位与镜面绑定接口，`src/ferrari-view-profile.ts` 隔离当前车型的几何选择与相机配置。更换模型时提供新的 profile（实际镜面几何、UV、眼位、后视相机），无需修改 UI 与 MirrorSystem；不保证自动识别任意模型镜面。
- 独立直角考道与规则共享米制定义；边线为判罚线，不是阻挡车辆的实体墙。远景建筑、树木和灯杆保留。
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
- Chrome 端到端：项目→说明→考试，通过持续键盘油门与屏幕方向盘真实驾驶完成成功转弯；倒车/停车/越界失败、结果冻结、重试、帮助/失焦暂停、视角、镜面与窄屏。
- `check-browser.mjs` 生成车外与驾驶舱截图；截图位于 `artifacts/`。
- 内置浏览器截图接口在本次环境超时，独立 Chrome 截图与运行正常。Chrome 单次截图采样约 58–60 FPS，非所有设备性能承诺；内置浏览器可能明显较慢，可切换“流畅”质量或使用独立浏览器。

## PWA 与更新

- 支持安装到桌面；在 HTTPS 或 localhost 的生产构建中启用 Service Worker。
- 首次在线加载并完成缓存后，可离线打开，包括车型和 Draco 解码器。缓存不等于数据永久保存，浏览器仍可能回收空间。
- 页脚提供“安装应用”和“检查更新”。后台每 15 分钟及返回页面时检查更新。
- 考试进行中及暂停中均禁止刷新，更新不会弹模态打断考试；退出考试后确认才可更新。iOS 使用 Safari 的“分享→添加到主屏幕”。
- `npm run build && npm run preview` 可本地检查 PWA；开发模式不注册生产 SW。
- `npx playwright test --config tests/pwa.config.mjs` 检查缓存/离线与更新保护。

## GitHub Pages

- 仓库：https://github.com/larria/car-drive-3d
- 站点：https://larria.github.io/car-drive-3d/
- 推送 main 后 GitHub Actions 自动测试、构建并部署；Pages Source 使用 GitHub Actions。
- 版本 tag 使用 `v1.0.0` 起的语义化版本；后续发布修改 package.json 版本并提交即可触发 SW 内容更新。

## 直角规则来源与规格

参考只读项目 `car-drive/src/config/scenes/scene-0-right-angle.js`、`core/rules.js`、`core/geometry.js`、`core/collision.js` 的真实实现。

- 当前集中模拟配置：车身 4.10 × 1.72 m（不含镜），轴距 2.650 m，道宽=轴距+1 m=3.650 m；入口12 m、出口10 m，初始车身中心 (0,9)，朝 -Z。
- 判罚四条边界，不封入口；车身与线段严格相交，端点接触/共线不算越界。任一车身边穿过终点即通过，不要求整车驶离。
- 按油门锁存起步；速度 < -0.0042 m/s 判倒车；起步后未按油门且速度 < 0.021 m/s 判停车。阈值由参考 0.01/0.05 px/帧、7 mm/px、60 Hz 换算。
- 顺序：倒车 → 停车 → 边界 → 终点。没有时间限制、转向灯扣分、车轮压线、停车宽限或必经检查点。
- 60 Hz 唯一物理累积器，每个子步后判定；暂停与结果冻结，恢复不补跑。最大模拟速度约16.6 km/h，停车转向锁45°，随速度减小；未缩小车身或放宽道路。
- 练习提示：入口适当靠左，在直角处把握右转时机，转正后及时回轮。可以松油门滑行，但不得停车。
- 核心模块：`vehicle-config.ts`、`courses/right-angle.ts`、`exam-rules.ts`、`exam-session.ts`、`exam-ui.ts`。
- `tests/drive-search.test.ts` 为固定步真实物理路径回归；`tests/verify-exam.mjs` 通过UI操作生成完整行驶遥测与截图，不传送车辆。

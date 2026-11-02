/**
 * 高德地图组件封装
 * 依赖：页面需先加载 https://webapi.amap.com/maps?v=2.0&key=KEY&plugin=AMap.Geocoder,AMap.ToolBar
 */

let sdkReady = false;
const waiting = [];

/* 详情页每次渲染都会重建容器，旧实例必须显式销毁，否则会泄漏 */
let activeMap = null;
let activeMarker = null;

function onReady(fn) {
  if (sdkReady) { fn(); return; }
  waiting.push(fn);
}

function bootSdk() {
  if (!window.AMap) return;
  AMap.plugin(['AMap.Geocoder', 'AMap.ToolBar'], () => {
    sdkReady = true;
    const list = waiting.splice(0);
    list.forEach(fn => fn());
  });
}

if (typeof window !== 'undefined') {
  if (window.AMap) bootSdk();
  else {
    // SDK 用普通 <script> 加载，可能在模块执行之后才就绪
    let tries = 0;
    const timer = setInterval(() => {
      if (window.AMap) { clearInterval(timer); bootSdk(); }
      else if (++tries > 100) clearInterval(timer);   // 约 10 秒后放弃
    }, 100);
  }
}

function destroyActive() {
  if (activeMap) { activeMap.destroy(); activeMap = null; }
  activeMarker = null;
}

/**
 * 在指定容器中显示地址对应的地图和标记
 * @param {string} containerId 容器元素 id
 * @param {string} address     要解析的地址文本
 * @param {string} name        标记点名称
 * @param {string} city        城市，提高地理编码命中率
 * @returns {Promise<boolean>} 是否成功画出地图
 */
export function showAddressMap(containerId, address, name, city = '杭州') {
  return new Promise(resolve => {
    if (!address) { resolve(false); return; }

    /* SDK 脚本被拦截或网络失败时 onReady 永远不会回调，单独兜底 */
    const sdkWatchdog = setTimeout(() => {
      if (sdkReady) return;
      const box = document.getElementById(containerId);
      if (box) box.innerHTML = '<div class="map-hint">地图 SDK 未能加载<br><a href="/map-test.html" target="_blank" rel="noopener">点此打开诊断页查明原因 →</a></div>';
      resolve(false);
    }, 10000);

    onReady(() => {
      clearTimeout(sdkWatchdog);
      const container = document.getElementById(containerId);
      if (!container) { resolve(false); return; }

      destroyActive();
      container.innerHTML = '<div class="map-hint">正在解析地址…</div>';

      /* 认证失败时高德往往只是静默不回调，这里兜底给出可读提示 */
      let settled = false;
      const watchdog = setTimeout(() => {
        if (settled) return;
        settled = true;
        const box = document.getElementById(containerId);
        if (box) box.innerHTML = '<div class="map-hint">地图未能加载<br><a href="/map-test.html" target="_blank" rel="noopener">点此打开诊断页查明原因 →</a></div>';
        resolve(false);
      }, 8000);

      const geocoder = new AMap.Geocoder({ city });
      geocoder.getLocation(address, (status, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);

        const box = document.getElementById(containerId);
        if (!box) { resolve(false); return; }

        if (status !== 'complete' || !result.geocodes || !result.geocodes.length) {
          const info = result && result.info ? String(result.info) : status;
          box.innerHTML = `<div class="map-hint">地址解析未成功（${info}）<br><a href="/map-test.html" target="_blank" rel="noopener">打开诊断页查看详情 →</a></div>`;
          resolve(false);
          return;
        }

        const lnglat = result.geocodes[0].location;
        box.innerHTML = '';
        activeMap = new AMap.Map(containerId, {
          zoom: 16,
          center: lnglat,
          viewMode: '2D',
          resizeEnable: true
        });

        activeMarker = new AMap.Marker({
          map: activeMap,
          position: lnglat,
          title: name,
          label: {
            content: `<div class="map-label">${String(name).replace(/[<>&]/g, '')}</div>`,
            direction: 'top',
            offset: new AMap.Pixel(0, -6)
          }
        });

        activeMap.addControl(new AMap.ToolBar({ locate: false }));

        // 高德在容器尺寸变化后需手动刷新，否则弹窗/换页会显示灰块
        setTimeout(() => activeMap && activeMap.resize(), 60);

        const fmt = result.geocodes[0];
        const note = document.getElementById(containerId + '-note');
        if (note) note.textContent = `地图定位：${fmt.formattedAddress || address}`;

        resolve(true);
      });
    });
  });
}

/**
 * 在地图上显示实时位置标记（供后续司机位置追踪使用）
 * @param {string} containerId 容器元素 id
 * @param {number} lng 经度
 * @param {number} lat 纬度
 * @param {string} name 标记点名称
 */
export function showLiveMap(containerId, lng, lat, name) {
  const handle = {
    updatePosition(nextLng, nextLat) {
      if (activeMarker) activeMarker.setPosition([nextLng, nextLat]);
      if (activeMap) activeMap.setCenter([nextLng, nextLat]);
    },
    destroy() { destroyActive(); }
  };

  onReady(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    destroyActive();
    container.innerHTML = '';
    activeMap = new AMap.Map(containerId, {
      zoom: 15,
      center: [lng, lat],
      viewMode: '2D',
      resizeEnable: true
    });
    activeMarker = new AMap.Marker({
      map: activeMap,
      position: [lng, lat],
      title: name,
      label: { content: `<div class="map-label">${String(name).replace(/[<>&]/g, '')}</div>`, direction: 'top', offset: new AMap.Pixel(0, -6) }
    });
    activeMap.addControl(new AMap.ToolBar({ locate: false }));
    setTimeout(() => activeMap && activeMap.resize(), 60);
  });

  return handle;
}

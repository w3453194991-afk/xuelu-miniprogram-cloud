/* 学鹭伴学 · 定位云函数（高德逆地理编码）
 *
 * action:
 *   reverse   {latitude, longitude} → {city, province, district, formatted}
 *
 * 需要配置环境变量 AMAP_KEY（可选 AMAP_SECRET）。未配置时返回 503，
 * 前端保持手动选择城市。Key 只存在于云函数环境变量，不返回前端。
 */

const cloud = require('wx-server-sdk');
const common = require('./common.js');
const https = require('https');

cloud.init({ traceUser: false });

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function handle(event) {
  const key = typeof process.env.AMAP_KEY === 'string' ? process.env.AMAP_KEY.trim() : '';
  const secret = typeof process.env.AMAP_SECRET === 'string' ? process.env.AMAP_SECRET.trim() : '';
  if (!key) return common.fail('定位服务未配置，请手动选择城市', 503);
  const lat = Number(event.latitude), lng = Number(event.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    common.bad('坐标格式不正确');
  }
  /* WGS84 → GCJ02（配置了签名私钥时走带 secret 的地址） */
  let glng = lng, glat = lat;
  const convertUrl = 'https://restapi.amap.com/v3/assistant/coordinate/convert?locations=' +
    lng + ',' + lat + '&coordsys=gps&key=' + encodeURIComponent(key) +
    (secret ? '&sig=' : '');
  try {
    const converted = await getJson(convertUrl);
    if (converted && converted.locations) {
      const parts = String(converted.locations).split(',');
      glng = Number(parts[0]);
      glat = Number(parts[1]);
    }
  } catch (e) { /* 转换失败时退回原坐标 */ }
  const regeo = await getJson('https://restapi.amap.com/v3/geocode/regeo?location=' +
    glng + ',' + glat + '&key=' + encodeURIComponent(key));
  const comp = regeo && regeo.regeocode && regeo.regeocode.addressComponent;
  if (!comp) return common.fail('暂时无法解析当前位置，请手动选择城市', 502);
  return common.ok({
    city: comp.city || comp.province || '',
    province: comp.province || '',
    district: comp.district || '',
    formatted: (regeo.regeocode.formatted_address || '').replace(/\s+/g, ''),
    source: 'amap'
  });
}

exports.main = async (event) => common.entry(handle, event);

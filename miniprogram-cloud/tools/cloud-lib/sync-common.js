/* 把公共模块同步到每个云函数目录
 * 云函数部署时只能打包自己目录内的文件，所以每个函数各持有一份拷贝。
 *
 * 单一来源（避免两份拷贝各自漂移）：
 *   - common.js           云函数专用（wx-server-sdk 的环境初始化、统一返回），来源 tools/cloud-lib
 *   - institution-lib.js  小程序与云函数共用，来源 miniprogram/utils
 *   - seed-data.js        小程序与云函数共用，来源 miniprogram/utils
 *   - 高考 / 备考模型      小程序与云函数共用，来源 miniprogram/utils
 *
 * 改完以上任一处后运行：node tools/cloud-lib/sync-common.js
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../cloudfunctions');
const libDir = __dirname;
const mpUtils = path.resolve(__dirname, '../../miniprogram/utils');

/* 只存在于云函数的公共模块 */
const cloudOnly = {
  'common.js': ['auth', 'services', 'orders', 'applications', 'institutions', 'profile', 'feedback', 'learning', 'content', 'location', 'gaokao', 'exam', 'lists', 'plan', 'seed']
};

/* 小程序与云函数共用的模块：一律以 miniprogram/utils 为准 */
const shared = {
  'institution-lib.js': ['services', 'institutions', 'applications'],
  'seed-data.js': ['services', 'seed', 'orders', 'institutions', 'learning', 'content'],
  'gaokao-data.js': ['gaokao', 'plan'],
  'gaokao-model.js': ['gaokao', 'plan'],
  'plan-model.js': ['plan'],
  'exam-data.js': ['exam'],
  'exam-model.js': ['exam']
};

let count = 0;
function sync(baseDir, map) {
  for (const [file, functions] of Object.entries(map)) {
    const source = fs.readFileSync(path.join(baseDir, file), 'utf8');
    for (const fn of functions) {
      const dest = path.join(root, fn, file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, source);
      count++;
    }
  }
}
sync(libDir, cloudOnly);
sync(mpUtils, shared);
console.log('已同步 ' + count + ' 个文件');

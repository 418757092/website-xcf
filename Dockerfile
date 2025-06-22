# 使用 slim 版本作为基础镜像
FROM node:slim

# 设置工作目录
WORKDIR /app

# --- 优化步骤 ---
# 1. 单独复制 package.json，以便利用缓存
COPY package.json ./

# 2. 更新包管理器、安装依赖，并清理缓存以减小镜像体积
#    这里是解决您问题的关键，我们安装了 curl 和 gawk
RUN apt-get update && \
    apt-get install -y curl gawk && \
    npm install && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 3. 复制剩余的应用文件
COPY manager.js ./
COPY index.html ./

# 暴露应用端口
EXPOSE 3000

# 定义容器启动命令
CMD ["node", "manager.js"]

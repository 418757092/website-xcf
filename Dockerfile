# 1. 使用 Alpine Linux 基础镜像，它的体积非常小
FROM node:20.11.1-alpine3.19

# 2. 设置工作目录
WORKDIR /app

# 3. 优化缓存：先拷贝 package.json 并安装依赖
#    这样在代码变更但依赖不变的情况下，可以利用 Docker 缓存，加快构建速度
COPY package.json ./

# 4. 安装必要的系统依赖和 Node.js 包
#    关键：添加了 gawk (提供 awk 命令) 和 coreutils (提供 nohup 命令)
#    --no-cache 标志可以确保不保留包管理器的缓存，减小镜像体积
RUN apk add --no-cache curl gawk coreutils && \
    npm install

# 5. 拷贝所有剩余的项目文件到工作目录
COPY manager.js ./
COPY index.html ./

# 6. 暴露应用监听的端口
EXPOSE 3000

# 7. 定义容器启动时执行的命令 (使用 package.json 中的 "start" 脚本)
CMD ["npm", "start"]

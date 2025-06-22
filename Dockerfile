FROM node:slim

WORKDIR /app

COPY package.json ./
COPY manager.js ./
COPY index.html ./

EXPOSE 3000

RUN apt update -y &&\
    chmod +x manager.js &&\
    npm install 
    
CMD ["node", "manager.js"]

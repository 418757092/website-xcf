FROM node:20.11.1-alpine3.19

WORKDIR /app

COPY package.json ./
COPY manager.js ./
COPY index.html ./ 

EXPOSE 3000

RUN apk update -y && \
    apk add --no-cache curl bash && \
    chmod +x manager.js && \
    npm install 
    
CMD ["node", "manager.js"]

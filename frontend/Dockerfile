FROM node:25-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 4321

# In production, you'd build and serve static or use node adapter. 
# For dev/mvp, we use `npm start` which runs `astro dev`.
CMD ["npm", "start", "--", "--host"]

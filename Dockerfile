FROM ubuntu:20.04

RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get --no-install-recommends -y install nodejs npm curl \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* \
  && nodejs -v \
  && npm -v
WORKDIR /usr/src/app
COPY package.json .
COPY package-lock.json .
RUN npm ci
COPY index.js .

EXPOSE 5050
RUN groupadd --gid 1000 node \
  && useradd --uid 1000 --gid node --shell /bin/bash --create-home node
USER node
CMD [ "npm", "start" ]
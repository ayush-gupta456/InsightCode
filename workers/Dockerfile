FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/insightcode
RUN npm install --ignore-scripts --no-audit --no-fund eslint@9.39.1 typescript@5.9.3
RUN python3 -m venv /opt/python && /opt/python/bin/pip install --no-cache-dir ruff==0.14.3 bandit==1.8.6
ENV PATH="/opt/python/bin:${PATH}"
COPY workers/runner.mjs /opt/insightcode/runner.mjs
USER 65534:65534
ENTRYPOINT ["node", "/opt/insightcode/runner.mjs"]

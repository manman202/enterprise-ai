FROM python:3.12-slim

# LDAP client libs + build tools needed by python-ldap / passlib[bcrypt]
RUN apt-get update && apt-get install -y --no-install-recommends \
        libldap2-dev \
        libsasl2-dev \
        libssl-dev \
        gcc \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]

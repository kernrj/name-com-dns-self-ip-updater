This script gets your IP addresses (IPv4 and IPv6) and updates DNS entries in your name.com account.

Required environment variables:
- NAME_COM_DOMAIN - this is the base domain (e.g. example.com)
- NAME_COM_USER_NAME - same username you use to login to name.com
- NAME_COM_TOKEN - API token, not your password - [instructions to generate](https://www.name.com/support/articles/360007597874-signing-up-for-api-access)

Optional environment variables:
- NAME_COM_HOST - hostname (e.g. www). Default: your system's hostname.
- NAME_COM_ENDPOINT - name.com API endpoint to use. Default: api.name.com
- NAME_COM_DNS_TTL - TTL (in seconds) to use for DNS entries. Default: 300
- NAME_COM_DNS_UPDATE_INTERVAL - How often (in seconds) to update your IP addresses. Default 600 (10 minutes).
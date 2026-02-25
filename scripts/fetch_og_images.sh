#!/usr/bin/zsh
# File: scripts/fetch_og_images.sh

if [ -z "$API_V2_URL" ]; then
  echo "ERROR: Please set API_V2_URL before running this script."
  exit 1
fi

LOCAL_BASE="$API_V2_URL"
PROD_BASE="$API_V2_URL"

curl "${LOCAL_BASE%/}/api/preview?q=isobel+björk" --output preview-isobel.png
curl "${PROD_BASE%/}/api/preview?q=isobel+björk" --output preview-isobel-url.png

curl -G "${LOCAL_BASE%/}/api/preview" --data-urlencode "q=isobel björk" --output preview-isobel-encoded.png
curl -G "${PROD_BASE%/}/api/preview" --data-urlencode "q=isobel björk" --output preview-isobel-url-encoded.png

curl "${LOCAL_BASE%/}/api/preview?q=isobel%20bj%C3%B6rk" --output preview-isobel-fd.png
curl "${PROD_BASE%/}/api/preview?q=isobel%20bj%C3%B6rk" --output preview-isobel-url-fd.png

curl "${LOCAL_BASE%/}/api/preview" --output preview-default.png
curl "${PROD_BASE%/}/api/preview" --output preview-default-url.png

#!/bin/bash
for url in $(curl -s https://hundunmp.vip/ | grep -oP "src=\"/_next/static/[^\"]+" | sed "s/src=\"//"); do
  status=$(curl -s -o /dev/null -w "%{http_code}" "https://hundunmp.vip$url")
  echo "$status $url"
done
echo "DONE"

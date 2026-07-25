#!/bin/bash
for i in $(seq 1 20); do
  echo -n "$i: "
  curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" https://hundunmp.vip/
done
